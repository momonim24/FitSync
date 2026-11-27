import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Every route requires a valid JWT by default (global JwtAuthGuard).
 * @Public() opts a route out — used only for login and registration.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
