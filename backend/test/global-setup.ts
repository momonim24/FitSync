/**
 * Creates the test database (schema.sql) and empties it before the suite.
 * Only ever operates on DB_TEST_NAME, which must contain "test".
 */
import { createConnection } from 'mysql2/promise';
import { initDatabase } from '../src/database/init-db';
import { migrateDatabase } from '../src/database/migrate';
import './setup-env';

export default async function globalSetup(): Promise<void> {
  const database = process.env.DB_NAME!;
  if (!/test/i.test(database)) throw new Error(`Refusing to reset non-test database "${database}".`);

  await initDatabase(database);
  await migrateDatabase(database, () => undefined);

  const connection = await createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database,
  });
  try {
    for (const table of ['TrainerFeedback', 'FitnessGoals', 'WorkoutCompletions', 'PlanExercises', 'WorkoutLogs', 'ProgressRecords', 'WorkoutPlans', 'TrainerAssignments', 'Exercises', 'Users']) {
      await connection.query(`DELETE FROM \`${table}\``);
    }
  } finally {
    await connection.end();
  }
}
