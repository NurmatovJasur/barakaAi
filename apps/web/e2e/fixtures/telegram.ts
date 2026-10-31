import crypto from 'node:crypto';
import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Opens the app the way Telegram does: signed initData in the URL hash (#tgWebAppData=…), which the
 * official telegram-web-app.js parses. The API verifies the HMAC with TELEGRAM_BOT_TOKEN, so tests
 * exercise the real auth path. The token never leaves this machine.
 */

export interface TgUser {
  id: number;
  first_name: string;
  username?: string;
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';

export function signInitData(user: TgUser, opts: { authDate?: number; token?: string } = {}): string {
  const fields: Record<string, string> = {
    auth_date: String(opts.authDate ?? Math.floor(Date.now() / 1000)),
    query_id: 'AAE2E',
    user: JSON.stringify(user),
  };
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(opts.token ?? BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

export const LIGHT_THEME = { bg_color: '#ffffff', secondary_bg_color: '#f4f6f9', text_color: '#1f2937', hint_color: '#6b7280' };
export const DARK_THEME = { bg_color: '#17212b', secondary_bg_color: '#0e1621', text_color: '#f5f5f5', hint_color: '#708499' };

export function telegramHash(initData: string, theme: Record<string, string> = LIGHT_THEME) {
  const p = new URLSearchParams({
    tgWebAppData: initData,
    tgWebAppVersion: '8.0',
    tgWebAppPlatform: 'tdesktop',
    tgWebAppThemeParams: JSON.stringify(theme),
  });
  return `#${p.toString()}`;
}

type TgWindow = {
  Telegram: {
    WebApp: { MainButton: { text: string; isVisible: boolean; isActive: boolean; isProgressVisible: boolean } };
    WebView: { receiveEvent(e: string): void };
  };
};

/** Controls the Telegram-native buttons, which are not DOM elements inside the Mini App. */
export class TelegramDriver {
  constructor(private readonly page: Page) {}

  mainButton() {
    return this.page.evaluate(() => {
      const b = (window as unknown as TgWindow).Telegram.WebApp.MainButton;
      return { text: b.text, isVisible: b.isVisible, isActive: b.isActive, isProgressVisible: b.isProgressVisible };
    });
  }

  async expectMainButton(text: string | RegExp) {
    await expect.poll(async () => (await this.mainButton()).isVisible).toBe(true);
    await expect.poll(async () => (await this.mainButton()).text).toMatch(text);
  }

  async expectMainButtonHidden() {
    await expect.poll(async () => (await this.mainButton()).isVisible).toBe(false);
  }

  async pressMainButton() {
    await expect
      .poll(async () => {
        const b = await this.mainButton();
        return b.isVisible && b.isActive && !b.isProgressVisible;
      })
      .toBe(true);
    await this.page.evaluate(() => (window as unknown as TgWindow).Telegram.WebView.receiveEvent('main_button_pressed'));
  }

  async pressBackButton() {
    await this.page.evaluate(() => (window as unknown as TgWindow).Telegram.WebView.receiveEvent('back_button_pressed'));
  }
}

/** Stable per-test Telegram user so parallel tests never share a basket. */
function userFor(title: string): TgUser {
  const h = crypto.createHash('sha1').update(title).digest().readUInt32BE(0);
  return { id: 900_000_000 + (h % 1_000_000), first_name: 'E2E', username: 'e2e_tester' };
}

async function resetBasket(request: APIRequestContext, initData: string) {
  const auth = await request.post('/api/auth/telegram', { data: { initData } });
  expect(auth.ok(), `Telegram auth failed: ${await auth.text()}`).toBeTruthy();
  const { token } = await auth.json();
  const res = await request.delete('/api/basket', { headers: { Authorization: `Bearer ${token}` } });
  expect(res.ok()).toBeTruthy();
  return token as string;
}

export const test = base.extend<{
  tgUser: TgUser;
  apiToken: string;
  tg: TelegramDriver;
  openApp: (path?: string) => Promise<void>;
}>({
  // eslint-disable-next-line no-empty-pattern
  tgUser: async ({}, provide, testInfo) => {
    testInfo.skip(!BOT_TOKEN, 'TELEGRAM_BOT_TOKEN is not set in .env');
    // Repeats and retries run in parallel too, so they get their own user
    await provide(userFor(`${testInfo.titlePath.join(' > ')}#${testInfo.repeatEachIndex}#${testInfo.retry}`));
  },
  apiToken: async ({ request, tgUser }, provide) => {
    await provide(await resetBasket(request, signInitData(tgUser)));
  },
  tg: async ({ page }, provide) => {
    await provide(new TelegramDriver(page));
  },
  openApp: async ({ page, tgUser, apiToken }, provide) => {
    // Reuse the session from the fixture login: one auth request per test keeps us under the
    // API rate limit. The UI login path itself is covered by auth.spec.ts.
    await page.addInitScript((token) => sessionStorage.setItem('smp.token', token), apiToken);
    await provide(async (path = '/') => {
      await page.goto(`${path}${telegramHash(signInitData(tgUser))}`);
      await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
    });
  },
});

export { expect };
