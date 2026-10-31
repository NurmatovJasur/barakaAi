import { execSync } from 'node:child_process';

/** Migrates and seeds the dedicated test database once per run. Skipped for pure unit runs (SKIP_DB=1). */
export default function setup() {
  if (process.env.SKIP_DB === '1') return;
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
  const env = { ...process.env, DATABASE_URL: url };
  execSync('npx prisma migrate deploy', { env, stdio: 'inherit' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'inherit' });
}
