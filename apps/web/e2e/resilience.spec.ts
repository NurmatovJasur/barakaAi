import { expect, test } from './fixtures/telegram';
import { CatalogPage } from './pages/AppPages';

test.describe('Error states', () => {
  test('backend failure shows error and retry recovers', async ({ page, openApp }) => {
    await page.route('**/api/products?**', (route) => route.abort('connectionrefused'));
    await openApp('/catalog');
    await expect(page.getByText('Не удалось загрузить данные')).toBeVisible();
    await expect(page.getByText(/Сервер недоступен/)).toBeVisible();

    await page.unroute('**/api/products?**');
    await page.getByRole('button', { name: /Повторить/ }).click();
    await expect(new CatalogPage(page).productLinks.first()).toBeVisible();
  });

  test('server error message is shown to the user', async ({ page, openApp }) => {
    await page.route('**/api/products?**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL', message: 'Внутренняя ошибка сервера' } }),
      }),
    );
    await openApp('/catalog');
    await expect(page.getByText('Внутренняя ошибка сервера')).toBeVisible();
  });

  test('offline banner appears and disappears', async ({ page, context, openApp }) => {
    await openApp('/');
    await context.setOffline(true);
    await expect(page.getByRole('status').filter({ hasText: 'Нет подключения к интернету' })).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText('Нет подключения к интернету')).toHaveCount(0);
  });

  test('unknown run id shows a not-found message', async ({ page, openApp }) => {
    await openApp('/optimizer/00000000-0000-4000-8000-000000000000');
    await expect(page.getByText('Расчёт не найден')).toBeVisible();
  });
});
