import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums';
import { AuthUser } from '../interfaces/auth-user.interface';
import { forbidden } from '../utils/http-errors';

/**
 * Global role-based authorization guard. Runs after JwtAuthGuard, so the user
 * is already authenticated; if their role is not listed in @Roles(...) the
 * request is rejected with 403 Forbidden. Record-level rules (ownership,
 * trainer assignment) are enforced in the services.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user || !roles.includes(user.role)) {
      throw forbidden(`This action requires one of these roles: ${roles.join(', ')}.`);
    }
    return true;
  }
}
