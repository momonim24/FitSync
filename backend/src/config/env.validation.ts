/**
 * Validates environment variables when the app starts, so a missing or weak
 * JWT secret fails fast instead of silently producing insecure tokens.
 */
export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const problems: string[] = [];
  const secret = String(env.JWT_SECRET ?? '');
  if (secret.length < 32) {
    problems.push('JWT_SECRET must be set and at least 32 characters long.');
  }
  if (!env.DB_NAME) problems.push('DB_NAME must be set.');
  if (!env.DB_USERNAME) problems.push('DB_USERNAME must be set.');

  if (problems.length) {
    throw new Error(
      `Invalid environment configuration (see backend/.env.example):\n  - ${problems.join('\n  - ')}`,
    );
  }
  return env;
}
