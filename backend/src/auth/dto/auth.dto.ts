import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_PATTERN } from '../../users/dto/user.dto';

/** POST /auth/login */
export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Email must be a valid email address.' })
  email: string;

  @IsString({ message: 'Password must be text.' })
  @IsNotEmpty({ message: 'Password is required.' })
  @MaxLength(72, { message: 'Password cannot exceed 72 characters.' })
  password: string;
}

/** PATCH /auth/password */
export class ChangePasswordDto {
  @IsString({ message: 'Current password must be text.' })
  @IsNotEmpty({ message: 'Current password is required.' })
  currentPassword: string;

  @IsString({ message: 'New password must be text.' })
  @MinLength(8, { message: 'New password must be at least 8 characters.' })
  @MaxLength(72, { message: 'New password cannot exceed 72 characters.' })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  newPassword: string;
}
