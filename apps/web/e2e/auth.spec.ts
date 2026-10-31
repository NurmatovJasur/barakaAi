import { DARK_THEME, expect, signInitData, telegramHash, test } from './fixtures/telegram';

test.describe('Telegram authentication', () => {
  test('signed initData logs the user in', async ({ page, openApp, tgUser }) => {
    await openApp('/');
    await expect(page.getByRole('heading', { name: `Здравствуйте, ${tgUser.first_name}` })).toBeVisible();
    await page.getByLabel('Профиль').click();
    await expect(page.getByText('Вход через Telegram')).toBeVisible();
    await expect(page.getByText(`@${tgUser.username}`)).toBeVisible();
  });

  test('tampered signature is rejected', async ({ page, tgUser }) => {
    const forged = signInitData(tgUser, { token: '000000:NOT_THE_REAL_BOT_TOKEN' });
    await page.goto(`/${telegramHash(forged)}`);
    await expect(page.getByText('Ошибка авторизации')).toBeVisible();
    await expect(page.getByText('Подпись Telegram недействительна')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toHaveCount(0);
  });

  test('expired initData is rejected', async ({ page, tgUser }) => {
    const old = signInitData(tgUser, { authDate: Math.floor(Date.now() / 1000) - 3 * 86_400 });
    await page.goto(`/${telegramHash(old)}`);
    await expect(page.getByText('Данные Telegram устарели, перезапустите приложение')).toBeVisible();
  });

  test('Telegram dark theme is applied', async ({ page, tgUser, apiToken }) => {
    void apiToken;
    await page.goto(`/${telegramHash(signInitData(tgUser), DARK_THEME)}`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(14, 22, 33)');
  });
});
