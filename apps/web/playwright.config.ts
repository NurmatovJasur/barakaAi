import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * E2E against the real API + seeded database, authenticated through Telegram initData signed with
 * TELEGRAM_BOT_TOKEN from the root .env. Start the DB first: npm run db:start
 */
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '../../.env'));
} catch {
  // no .env — specs needing the bot token skip themselves
}

const CI = !!process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : 3,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    locale: 'ru-RU',
  },
  projects: [{ name: 'telegram-mobile', use: { ...devices['Pixel 7'] } }],
  webServer: [
    {
      command: 'npm run dev -w @smp/api',
      cwd: '../..',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -w @smp/web',
      cwd: '../..',
      url: 'http://localhost:5173',
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
  ],
});
