/**
 * Runs before the e2e tests: loads backend/.env, then points the app at the
 * dedicated TEST database so the demo data in fitsync_db is never touched.
 */
import '../src/config/timezone';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '..', '.env') });

const testDb = process.env.DB_TEST_NAME || 'fitsync_test_db';
if (!/test/i.test(testDb)) {
  throw new Error(`Refusing to run e2e tests: DB_TEST_NAME "${testDb}" must contain "test".`);
}
process.env.DB_NAME = testDb;
process.env.NODE_ENV = 'test';
// High limits so the suite is not throttled; the rate-limit test lowers it explicitly.
process.env.LOGIN_RATE_LIMIT = '1000';
process.env.GLOBAL_RATE_LIMIT = '100000';
process.env.BCRYPT_SALT_ROUNDS = '4';
// External API calls are mocked in e2e tests; a short timeout keeps the timeout test fast.
process.env.WGER_TIMEOUT_MS = '300';
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'e2e-only-secret-not-used-anywhere-else-0123456789';
}
