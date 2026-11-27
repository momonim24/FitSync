/**
 * Creates the FitSync database and tables by running database/schema.sql.
 *
 *   npm run db:init
 *
 * Non-destructive: schema.sql only uses CREATE ... IF NOT EXISTS, so running
 * it again never drops tables or deletes data. The database name in the file
 * (fitsync_db) is replaced with DB_NAME from .env.
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createConnection } from 'mysql2/promise';

export async function initDatabase(databaseName: string): Promise<void> {
  if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
    throw new Error(`Invalid database name: ${databaseName}`);
  }
  const schemaPath = join(__dirname, '..', '..', '..', 'database', 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf8').replace(/fitsync_db/g, databaseName);

  const connection = await createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    multipleStatements: true,
  });
  try {
    await connection.query(sql);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  const databaseName = process.env.DB_NAME ?? 'fitsync_db';
  initDatabase(databaseName)
    .then(() => console.log(`Database "${databaseName}" is ready (schema.sql applied).`))
    .catch((error: Error) => {
      console.error('Database initialization failed:', error.message);
      process.exit(1);
    });
}
