/**
 * Local PostgreSQL without Docker (embedded-postgres ships real PostgreSQL binaries via npm).
 * Data lives in <repo>/.data/pg. Credentials and port are taken from DATABASE_URL.
 * Alternative: `docker compose up -d`.
 */
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';

const dbUrl = new URL(process.env.DATABASE_URL ?? '');
const testDbName = process.env.TEST_DATABASE_URL
  ? new URL(process.env.TEST_DATABASE_URL).pathname.slice(1)
  : null;
const dataDir = path.resolve(process.cwd(), '../../.data/pg');

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  port: Number(dbUrl.port || 5433),
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

const firstRun = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));
if (firstRun) await pg.initialise();
await pg.start();

for (const name of [dbUrl.pathname.slice(1), testDbName].filter(Boolean) as string[]) {
  try {
    await pg.createDatabase(name);
    console.log(`created database ${name}`);
  } catch {
    // already exists
  }
}

console.log(`PostgreSQL running on port ${dbUrl.port || 5433} (data: ${dataDir}). Ctrl+C to stop.`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
