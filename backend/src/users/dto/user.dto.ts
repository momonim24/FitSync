import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Role } from '../../common/enums';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;
/** http(s) URL, or a relative path made of safe characters without "..". */
export const PROFILE_IMAGE_PATTERN = /^(?:https?:\/\/[^\s"'<>]+|(?!.*\.\.)[A-Za-z0-9_][A-Za-z0-9_./-]*)$/;
export const PASSWORD_MESSAGE ='Password must contain at least one letter and one number.';

/** POST /users — public registration (always creates a Member). */
export class RegisterUserDto {
  @Transform(trim)
  @IsString({ message: 'Full name must be text.' })
  @IsNotEmpty({ message: 'Full name is required.' })
  @MaxLength(100, { message: 'Full name cannot exceed 100 characters.' })
  fullName: string;

  @Transform(trimLower)
  @IsEmail({}, { message: 'Email must be a valid email address.' })
  @MaxLength(100, { message: 'Email cannot exceed 100 characters.' })
  email: string;

  @IsString({ message: 'Password must be text.' })
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  // bcrypt only uses the first 72 bytes of a password.
  @MaxLength(72, { message: 'Password cannot exceed 72 characters.' })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password: string;
}

/** POST /users/accounts — admin creates an account with any role. */
export class CreateAccountDto extends RegisterUserDto {
  @IsEnum(Role, { message: 'Role must be Member, Trainer or Admin.' })
  role: Role;
}

/** PATCH /users/{id} — partial profile update (owner or admin). */
export class UpdateUserDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Full name must be text.' })
  @IsNotEmpty({ message: 'Full name cannot be empty.' })
  @MaxLength(100, { message: 'Full name cannot exceed 100 characters.' })
  fullName?: string;

  @IsOptional()
  @Transform(trimLower)
  @IsEmail({}, { message: 'Email must be a valid email address.' })
  @MaxLength(100, { message: 'Email cannot exceed 100 characters.' })
  email?: string;

  /** Image path or URL (ProfileImage column). Send null to remove it. */
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Profile image must be a path or URL string.' })
  @MaxLength(255, { message: 'Profile image cannot exceed 255 characters.' })
  // Shown as <img src>: only web URLs or relative upload paths (Lab 05 example
  // "uploads/profiles/juan.jpg"); no javascript:/data: URLs, spaces or "..".
  @Matches(PROFILE_IMAGE_PATTERN, { message: 'Profile image must be an http(s) URL or a relative path such as uploads/profiles/photo.jpg.' })
  profileImg?: string | null;
}

/** PATCH /users/{id}/role — admin changes a user's role. */
export class UpdateRoleDto {
  @IsEnum(Role, { message: 'Role must be Member, Trainer or Admin.' })
  role: Role;
}

/** GET /users — admin list filters. */
export class UserQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(Role, { message: 'Role must be Member, Trainer or Admin.' })
  role?: Role;

  @IsOptional()
  @IsIn(['true', 'false'], { message: 'isActive must be true or false.' })
  isActive?: 'true' | 'false';

  /** Matches full name or email. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}
