import { expect, test } from './fixtures/telegram';
import { CatalogPage, NavBar, OptimizationPage } from './pages/AppPages';

test.describe('Optimization → purchase', () => {
  test('full flow through Telegram MainButton', async ({ page, openApp, tg }) => {
    const catalog = new CatalogPage(page);
    const result = new OptimizationPage(page);

    await openApp('/catalog');
    await catalog.add('Картофель', '100');
    await catalog.add('Лук', '50');
    await catalog.add('Рис', '25');
    await new NavBar(page).go('Закупка');

    await tg.pressMainButton();
    await expect(result.heading).toBeVisible();
    await expect(page.getByText('Оптимальность подтверждена полным перебором')).toBeVisible();
    await expect(page.getByText('Рекомендуем')).toBeVisible();
    await expect(page.getByText('Доставка учитывается один раз для каждого выбранного поставщика.')).toBeVisible();

    // Every allocated supplier appears once
    const suppliers = await result.supplierGroupHeaders().allTextContents();
    expect(new Set(suppliers).size).toBe(suppliers.length);

    // Single-supplier scenario is the baseline: its savings are zero
    await result.scenarioTab(/1 поставщик/).click();
    await expect(page.getByText('Один поставщик', { exact: true })).toBeVisible();

    await tg.expectMainButton('Сохранить план закупки');
    await tg.pressMainButton();
    await result.confirmSave();

    await expect(page).toHaveURL(/\/purchases\/[0-9a-f-]{36}$/);
    await expect(page.getByText('План закупки сохранён')).toBeVisible();
    await expect(page.getByText('Запланирована')).toBeVisible();

    // Status transition with confirmation
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Подтвердить' }).click();
    await expect(page.getByText('Подтверждена', { exact: true })).toBeVisible();

    // Repeat puts the items back into the basket
    await page.getByRole('button', { name: /Повторить закупку/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Подтвердить' }).click();
    await expect(page).toHaveURL(/\/basket$/);
    await expect(page.getByLabel('Количество Рис')).toHaveValue('25');
  });

  test('saved run cannot be saved twice', async ({ page, openApp, tg }) => {
    await openApp('/catalog');
    await new CatalogPage(page).add('Соль', '20');
    await new NavBar(page).go('Закупка');
    await tg.pressMainButton();
    await expect(new OptimizationPage(page).heading).toBeVisible();
    const runUrl = page.url();

    await tg.pressMainButton();
    await new OptimizationPage(page).confirmSave();
    await expect(page).toHaveURL(/\/purchases\//);

    await page.goto(runUrl);
    await tg.expectMainButton('Открыть сохранённую закупку');
  });

  test('infeasible basket explains why and offers no save', async ({ page, openApp, tg }) => {
    await openApp('/catalog');
    await new CatalogPage(page).add('Сливочное масло', '99999');
    await new NavBar(page).go('Закупка');
    await tg.pressMainButton();

    await expect(page.getByText('Допустимый план не найден')).toBeVisible();
    await expect(page.getByText(/доступно всего/)).toBeVisible();
    await tg.expectMainButtonHidden();
  });

  test('supplier profile from allocation shows trust and contacts', async ({ page, openApp, tg }) => {
    await openApp('/catalog');
    await new CatalogPage(page).add('Картофель', '50');
    await new NavBar(page).go('Закупка');
    await tg.pressMainButton();
    await new OptimizationPage(page).supplierGroupHeaders().first().click();

    await expect(page).toHaveURL(/\/suppliers\//);
    await expect(page.getByText('Не проверен').first()).toBeVisible();
    await expect(page.getByText('DEMO DATA').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /\+998/ })).toHaveAttribute('href', /^tel:/);
    await expect(page.getByText('Надёжность (Trust Score)')).toBeVisible();

    // Telegram BackButton returns to the result
    await tg.pressBackButton();
    await expect(new OptimizationPage(page).heading).toBeVisible();
  });
});
