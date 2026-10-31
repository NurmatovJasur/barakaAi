import { expect, test } from './fixtures/telegram';
import { BasketPage, CatalogPage, NavBar } from './pages/AppPages';

test.describe('Smart Basket', () => {
  test('empty basket hides the Telegram MainButton', async ({ page, openApp, tg }) => {
    await openApp('/basket');
    await expect(page.getByText('Корзина закупки пуста')).toBeVisible();
    await tg.expectMainButtonHidden();
  });

  test('add, update, remove, persist after reload', async ({ page, openApp, tg }) => {
    const catalog = new CatalogPage(page);
    const basket = new BasketPage(page);
    const nav = new NavBar(page);

    await openApp('/catalog');
    await catalog.add('Картофель', '100');
    await catalog.add('Лук', '50');
    await expect(nav.basketLink()).toContainText('2');

    await nav.go('Закупка');
    await expect(basket.quantity('Картофель')).toHaveValue('100');
    await tg.expectMainButton('Оптимизировать закупку');

    const estimate = page.getByText(/^≈ [\d\s]+ UZS$/).first();
    const before = await estimate.textContent();
    await basket.setQuantity('Картофель', '120');
    await expect(estimate).not.toHaveText(before!);

    await basket.remove('Лук');
    await expect(page.getByLabel('Количество Лук')).toHaveCount(0);

    // Server is the source of truth: reload keeps the basket
    await page.reload();
    await expect(basket.quantity('Картофель')).toHaveValue('120');
    await expect(page.getByLabel('Количество Лук')).toHaveCount(0);
  });

  test('invalid quantity is rejected with a clear message', async ({ page, openApp }) => {
    const catalog = new CatalogPage(page);
    await openApp('/catalog');
    await catalog.find('Рис');
    await page.getByLabel('Добавить Рис').click();
    const dialog = page.getByRole('dialog');
    const input = dialog.getByLabel('Количество');

    await input.fill('0');
    await expect(dialog.getByText('Количество должно быть больше нуля')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'В закупку' })).toBeDisabled();

    await input.fill('1.2345');
    await expect(dialog.getByText('Не более 3 знаков после запятой')).toBeVisible();

    await input.fill('200000');
    await expect(dialog.getByText(/Максимум/)).toBeVisible();
  });

  test('clear requires confirmation', async ({ page, openApp, tg }) => {
    const catalog = new CatalogPage(page);
    await openApp('/catalog');
    await catalog.add('Соль', '10');
    await new NavBar(page).go('Закупка');

    await page.getByRole('button', { name: /Очистить/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Отмена' }).click();
    await expect(page.getByLabel('Количество Соль')).toBeVisible();

    await new BasketPage(page).clear();
    await expect(page.getByText('Корзина закупки пуста')).toBeVisible();
    await tg.expectMainButtonHidden();
  });
});
