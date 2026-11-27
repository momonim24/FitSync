/**
 * Timestamp audit and evidence-based correction (Version 2.0).
 *
 *   npm run db:timestamps                          # audit only (read-only)
 *   npm run db:timestamps -- --apply Users:11      # correct the listed rows
 *   DB_NAME=fitsync_test_db npm run db:timestamps  # another database
 *
 * Background: Version 1 let MySQL/MariaDB fill CreatedAt / AssignedAt with
 * CURRENT_TIMESTAMP, which is the DATABASE SERVER's local time, while the API
 * reads every DATETIME as UTC. Those rows are shown 8 hours late (UTC+8).
 * Rows written by the application (the seed script, and every insert since
 * the UtcTimestampsSubscriber) are already UTC and must NOT be shifted.
 *
 * The two kinds cannot be told apart in general, so nothing is shifted
 * automatically. The audit marks a row PROVEN-LOCAL only when the stored
 * value is later than the current UTC time — impossible for a UTC instant.
 * --apply converts ONLY rows that are both listed explicitly and proven
 * local at that moment; anything else is refused. Each change is printed
 * (old → new) and guarded with "WHERE value = old value".
 */
import '../config/timezone';
import { APP_TIME_ZONE } from '../config/timezone';
import { createConnection, RowDataPacket } from 'mysql2/promise';

const COLUMNS: Array<{ table: string; key: string; column: string }> = [
  { table: 'Users', key: 'UserID', column: 'CreatedAt' },
  { table: 'TrainerAssignments', key: 'AssignmentID', column: 'AssignedAt' },
  { table: 'WorkoutPlans', key: 'PlanID', column: 'CreatedAt' },
  { table: 'WorkoutCompletions', key: 'CompletionID', column: 'CreatedAt' },
  { table: 'FitnessGoals', key: 'GoalID', column: 'CreatedAt' },
  { table: 'TrainerFeedback', key: 'FeedbackID', column: 'CreatedAt' },
];
const TOLERANCE_SECONDS = 60;

/** 'YYYY-MM-DD HH:MM:SS' read as APP_TIME_ZONE wall-clock time -> UTC 'YYYY-MM-DD HH:MM:SS'. */
export function localWallClockToUtc(value: string): string {
  const [date, time] = value.split(' ');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm, ss] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, ss).toISOString().slice(0, 19).replace('T', ' ');
}

async function main() {
  const database = process.env.DB_NAME ?? 'fitsync_db';
  if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error(`Invalid database name: ${database}`);
  const applyIndex = process.argv.indexOf('--apply');
  const requested = applyIndex === -1 ? [] : process.argv.slice(applyIndex + 1).filter((a) => /^\w+:\d+$/.test(a));

  const db = await createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database,
    dateStrings: true, // read the raw stored values, no conversion
  });
  try {
    const [[clock]] = await db.query<RowDataPacket[]>("SELECT DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s') AS utcNow, @@session.time_zone AS tz");
    console.log(`Database "${database}" · UTC now ${clock.utcNow} · server session time zone ${clock.tz} · app time zone ${APP_TIME_ZONE}\n`);

    const proven = new Map<string, { table: string; key: string; column: string; id: number; value: string }>();
    for (const c of COLUMNS) {
      const [exists] = await db.query<RowDataPacket[]>(
        'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND LOWER(TABLE_NAME) = LOWER(?)',
        [database, c.table],
      );
      if (!exists.length) continue;
      const table = String(exists[0].name);
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT \`${c.key}\` AS id, DATE_FORMAT(\`${c.column}\`, '%Y-%m-%d %H:%i:%s') AS value,
                TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), \`${c.column}\`) AS aheadSeconds
           FROM \`${table}\` ORDER BY \`${c.key}\``,
      );
      const local = rows.filter((r) => Number(r.aheadSeconds) > TOLERANCE_SECONDS);
      console.log(`${c.table}.${c.column}: ${rows.length} row(s), ${local.length} proven local-time`);
      for (const r of local) {
        console.log(`   PROVEN-LOCAL  ${c.table}:${r.id}  stored ${r.value} is ${Math.round(Number(r.aheadSeconds) / 60)} min later than UTC now → UTC ${localWallClockToUtc(r.value)}`);
        proven.set(`${c.table}:${r.id}`.toLowerCase(), { ...c, table, id: Number(r.id), value: String(r.value) });
      }
    }

    if (applyIndex === -1) {
      console.log('\nAudit only — nothing changed. Rows that are not proven local-time are left as they are.');
      return;
    }
    if (!requested.length) throw new Error('--apply needs one or more Table:ID arguments, e.g. --apply Users:11');
    for (const ref of requested) {
      const row = proven.get(ref.toLowerCase());
      if (!row) {
        console.log(`   REFUSED  ${ref}: not proven local-time right now; left unchanged.`);
        continue;
      }
      const utc = localWallClockToUtc(row.value);
      const [result] = await db.query<RowDataPacket[] & { affectedRows: number }>(
        `UPDATE \`${row.table}\` SET \`${row.column}\` = ? WHERE \`${row.key}\` = ? AND \`${row.column}\` = ?`,
        [utc, row.id, row.value],
      );
      console.log(`   ${(result as unknown as { affectedRows: number }).affectedRows === 1 ? 'CORRECTED' : 'SKIPPED (changed meanwhile)'}  ${ref}.${row.column}: ${row.value} (local) → ${utc} (UTC)`);
    }
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  main().catch((error: Error) => {
    console.error('Timestamp tool failed:', error.message);
    process.exit(1);
  });
}
