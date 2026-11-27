import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from '../common/interfaces/auth-user.interface';
import { badRequest, unauthorized } from '../common/utils/http-errors';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto';

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: User;
}

/**
 * Implements the Lab 06 authentication flow:
 * find user by email -> compare bcrypt hash -> check IsActive -> sign JWT.
 */
@Injectable()
export class AuthService {
  private readonly dummyHash = bcrypt.hashSync('fitsync-timing-guard', 10);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    // Same message (and similar response time, thanks to the dummy hash) for
    // "no such email" and "wrong password", so attackers cannot discover
    // which emails are registered.
    const passwordMatches = await bcrypt.compare(dto.password, user?.passwordHash ?? this.dummyHash);
    if (!user || !passwordMatches) {
      throw unauthorized('Invalid email or password.', 'Login failed. Check your email and password.');
    }
    if (!user.isActive) {
      throw unauthorized('Account is deactivated.', 'This account has been deactivated. Contact an administrator.');
    }

    const payload: JwtPayload = { sub: user.userId, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);
    const { passwordHash: _hidden, ...safeUser } = user;

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '1h'),
      user: Object.assign(new User(), safeUser),
    };
  }

  me(userId: number): Promise<User> {
    return this.usersService.getById(userId);
  }

  async changePassword(userId: number, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw badRequest('Password change failed.', 'Current password is incorrect.');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw badRequest('Password change failed.', 'New password must be different from the current password.');
    }
    const rounds = Number(this.config.get('BCRYPT_SALT_ROUNDS', 10));
    await this.usersService.updatePasswordHash(userId, await bcrypt.hash(dto.newPassword, rounds));
    return { message: 'Password updated successfully.' };
  }
}
