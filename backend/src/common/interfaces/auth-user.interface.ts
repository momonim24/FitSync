import { Role } from '../enums';

/** Claims stored inside the signed JWT (Lab 06: token contains user ID and role). */
export interface JwtPayload {
  sub: number;
  email: string;
  role: Role;
}

/** The authenticated user attached to `request.user` by JwtAuthGuard. */
export interface AuthUser {
  userId: number;
  email: string;
  fullName: string;
  role: Role;
}
