import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { User } from '../users/entities/user.entity';
import { AuthService, LoginResponse } from './auth.service';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto';

/** /api/v1/auth — login and session endpoints (Lab 06). */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Email + password login. Returns a signed JWT.
   * Rate limited per IP (LOGIN_RATE_LIMIT per minute) against brute force.
   */
  @Public()
  @Throttle({
    default: {
      limit: () => Number(process.env.LOGIN_RATE_LIMIT ?? 5),
      ttl: 60_000,
    },
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  /** Returns the profile of the user who owns the token. */
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<User> {
    return this.authService.me(user.userId);
  }

  /** Changes the current user's password (requires the current password). */
  @Patch('password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto);
  }
}
