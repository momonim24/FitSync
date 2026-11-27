/**
 * Runs before every e2e spec FILE (jest setupFilesAfterEnv): empties the
 * test database so each suite starts from a clean state and suites cannot
 * influence each other's counts. Only ever touches DB_NAME as set by
 * setup-env.ts, which must contain "test".
 */
import { createConnection } from 'mysql2/promise';

beforeAll(async () => {
  const database = process.env.DB_NAME!;
  if (!/test/i.test(database)) throw new Error(`Refusing to reset non-test database "${database}".`);
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
});
