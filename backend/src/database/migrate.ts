/**
 * Applies FitSync schema migrations (documented in database/migrations/*.sql).
 *
 *   npm run db:migrate                         # uses DB_NAME from .env
 *   DB_NAME=fitsync_test_db npm run db:migrate # another database
 *
 * Every step first checks information_schema and is skipped if the column or
 * constraint already exists, so the script is idempotent and never drops,
 * renames or rewrites data. (MySQL 8 has no ADD COLUMN IF NOT EXISTS, so the
 * checks are done here instead of in SQL.)
 *
 *   001  Exercises: external source & licence columns (Lab-alignment upgrade)
 *   002  WorkoutCompletions, FitnessGoals, TrainerFeedback (Version 2.0);
 *        the CREATE TABLE statements are read from
 *        database/migrations/002_fitness_management.sql, the same DDL that
 *        database/schema.sql contains, so both paths build identical tables.
 */
import '../config/timezone';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Connection, createConnection, RowDataPacket } from 'mysql2/promise';

type Step = { kind: 'column' | 'constraint'; name: string; sql: (table: string) => string };

/** Migration 001 — external exercise source & attribution. */
const MIGRATION_001: Step[] = [
  ['ExternalSource', "VARCHAR(20) NULL COMMENT 'Provider of imported content, e.g. wger; NULL = local exercise'"],
  ['ExternalID', "INT NULL COMMENT 'Exercise ID at the external provider'"],
  ['SourceUrl', "VARCHAR(255) NULL COMMENT 'Public page of the original exercise'"],
  ['LicenseName', "VARCHAR(100) NULL COMMENT 'Licence of the imported text, e.g. CC-BY-SA 4'"],
  ['LicenseUrl', "VARCHAR(255) NULL COMMENT 'Link to the licence text'"],
  ['LicenseAuthor', "VARCHAR(255) NULL COMMENT 'Author(s) credited by the provider'"],
  ['ImportedAt', "DATETIME NULL COMMENT 'When an administrator imported the exercise (UTC)'"],
]
  .map(([name, definition]): Step => ({ kind: 'column', name, sql: (t) => `ALTER TABLE \`${t}\` ADD COLUMN ${name} ${definition}` }))
  .concat([
    {
      kind: 'constraint',
      name: 'UQ_Exercises_External',
      sql: (t) => `ALTER TABLE \`${t}\` ADD CONSTRAINT UQ_Exercises_External UNIQUE (ExternalSource, ExternalID)`,
    },
    {
      kind: 'constraint',
      name: 'CHK_Exercises_ExternalPair',
      sql: (t) =>
        `ALTER TABLE \`${t}\` ADD CONSTRAINT CHK_Exercises_ExternalPair CHECK ` +
        '((ExternalSource IS NULL AND ExternalID IS NULL) OR (ExternalSource IS NOT NULL AND ExternalID IS NOT NULL))',
    },
  ]);

/** Migration 002 — CREATE TABLE IF NOT EXISTS statements, in dependency order. */
export function migration002Statements(): Array<{ table: string; sql: string }> {
  const file = join(__dirname, '..', '..', '..', 'database', 'migrations', '002_fitness_management.sql');
  const withoutComments = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  return withoutComments
    .split(/;\s*(?:\n|$)/)
    .map((sql) => sql.trim())
    .filter(Boolean)
    .map((sql) => {
      const match = /^CREATE TABLE IF NOT EXISTS (\w+)/i.exec(sql);
      if (!match) throw new Error(`Unexpected statement in migration 002: ${sql.slice(0, 60)}`);
      return { table: match[1], sql };
    });
}

async function tableExists(db: Connection, schema: string, table: string): Promise<boolean> {
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND LOWER(TABLE_NAME) = LOWER(?)',
    [schema, table],
  );
  return rows.length > 0;
}

async function exists(db: Connection, schema: string, table: string, step: Step): Promise<boolean> {
  const sql =
    step.kind === 'column'
      ? 'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?'
      : 'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?';
  const [rows] = await db.query<RowDataPacket[]>(sql, [schema, table, step.name]);
  return rows.length > 0;
}

/**
 * Migration 003 — optional duration targets for timed exercises
 * (database/migrations/003_timed_plan_targets.sql). Nullable and additive.
 */
const column003 = (name: string, definition: string): Step => ({
  kind: 'column',
  name,
  sql: (t) => `ALTER TABLE \`${t}\` ADD COLUMN ${name} ${definition}`,
});
const check003 = (name: string, rule: string): Step => ({
  kind: 'constraint',
  name,
  sql: (t) => `ALTER TABLE \`${t}\` ADD CONSTRAINT ${name} CHECK (${rule})`,
});
const MIGRATION_003: Array<{ table: string; step: Step }> = [
  { table: 'PlanExercises', step: column003('TargetDurationMinutes', "INT NULL COMMENT 'Total minutes for a timed exercise; NULL = repetition-based'") },
  { table: 'PlanExercises', step: check003('CHK_PlanExercises_TargetDuration', 'TargetDurationMinutes IS NULL OR TargetDurationMinutes > 0') },
  { table: 'WorkoutCompletions', step: column003('PrescribedDurationMinutes', "INT NULL COMMENT 'Snapshot of TargetDurationMinutes; NULL = repetition-based'") },
  { table: 'WorkoutCompletions', step: check003('CHK_WorkoutCompletions_PrescribedDuration', 'PrescribedDurationMinutes IS NULL OR PrescribedDurationMinutes > 0') },
];

async function storedTableName(db: Connection, schema: string, table: string): Promise<string | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND LOWER(TABLE_NAME) = LOWER(?)',
    [schema, table],
  );
  return rows.length ? String(rows[0].name) : null;
}

export async function migrateDatabase(database: string, log: (line: string) => void = console.log): Promise<void> {
  if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error(`Invalid database name: ${database}`);
  const db = await createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database,
  });
  try {
    // Windows MySQL/MariaDB stores table names in lowercase; use the exact stored name.
    const [tables] = await db.query<RowDataPacket[]>(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND LOWER(TABLE_NAME) = 'exercises'",
      [database],
    );
    if (tables.length === 0) throw new Error(`Table Exercises not found in "${database}". Run npm run db:init first.`);
    const table = String(tables[0].name);

    for (const step of MIGRATION_001) {
      if (await exists(db, database, table, step)) {
        log(`  skip   ${step.name} (already present)`);
        continue;
      }
      await db.query(step.sql(table));
      log(`  added  ${step.name}`);
    }

    for (const { table: name, sql } of migration002Statements()) {
      if (await tableExists(db, database, name)) {
        log(`  skip   ${name} (already present)`);
        continue;
      }
      await db.query(sql);
      log(`  added  table ${name}`);
    }

    for (const { table: logical, step } of MIGRATION_003) {
      const stored = await storedTableName(db, database, logical);
      if (!stored) throw new Error(`Table ${logical} not found in "${database}".`);
      if (await exists(db, database, stored, step)) {
        log(`  skip   ${step.name} (already present)`);
        continue;
      }
      await db.query(step.sql(stored));
      log(`  added  ${step.name}`);
    }
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  const database = process.env.DB_NAME ?? 'fitsync_db';
  console.log(`Applying migrations to "${database}"...`);
  migrateDatabase(database)
    .then(() => console.log('Migrations complete.'))
    .catch((error: Error) => {
      console.error('Migration failed:', error.message);
      process.exit(1);
    });
}
