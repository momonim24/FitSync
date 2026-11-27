import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser, JwtPayload } from '../interfaces/auth-user.interface';
import { unauthorized } from '../utils/http-errors';

/**
 * Global authentication guard (registered as APP_GUARD in AppModule).
 *
 * 1. Skips routes marked @Public().
 * 2. Reads "Authorization: Bearer <token>"            -> 401 if missing.
 * 3. Verifies signature and expiry with JWT_SECRET    -> 401 if invalid/expired.
 * 4. Loads the user and checks IsActive               -> 401 if deactivated/deleted.
 * 5. Attaches { userId, email, fullName, role } to request.user.
 *
 * Step 4 means a deactivated account or a changed role takes effect on the
 * very next request, even if the old token has not expired yet.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw unauthorized('Authentication required.', 'Missing or invalid token.');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw unauthorized('Authentication required.', 'Token has expired. Please log in again.');
      }
      throw unauthorized('Authentication required.', 'Missing or invalid token.');
    }

    const user = await this.users.findOne({ where: { userId: payload.sub } });
    if (!user || !user.isActive) {
      throw unauthorized('Authentication required.', 'Account is inactive or no longer exists.');
    }

    request.user = {
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
    return true;
  }
}
