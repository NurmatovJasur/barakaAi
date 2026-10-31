import { expect, test } from './fixtures/telegram';
import { CatalogPage } from './pages/AppPages';

test.describe('Catalog', () => {
  let catalog: CatalogPage;

  test.beforeEach(async ({ page, openApp }) => {
    catalog = new CatalogPage(page);
    await openApp('/catalog');
    await expect(page.getByText('Найдено: 20')).toBeVisible();
  });

  test('searches by Russian name', async ({ page }) => {
    await catalog.search.fill('карт');
    await expect(catalog.productLinks).toHaveCount(1);
    await expect(catalog.productLinks.first()).toContainText('Картофель');
    await expect(page).toHaveURL(/q=%D0%BA%D0%B0%D1%80%D1%82|q=карт/);
  });

  test('shows an empty state for unknown products', async ({ page }) => {
    await catalog.search.fill('xyznonexistent');
    await expect(page.getByText('Ничего не найдено')).toBeVisible();
  });

  test('filters by category', async ({ page }) => {
    await catalog.category('Молочное').click();
    await expect(page.getByText('Найдено: 3')).toBeVisible();
    await expect(catalog.productLinks).toHaveText([/Молоко/, /Сливочное масло/, /Яйца/]);
  });

  test('sorts by price ascending', async ({ page }) => {
    await catalog.sort.selectOption('price_asc');
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(catalog.productLinks.first()).not.toContainText('Сливочное масло');
    const prices = await catalog.minPrices();
    expect(prices.length).toBeGreaterThan(5);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  test('paginates', async ({ page }) => {
    await expect(page.getByText('1 из 2')).toBeVisible();
    await page.getByRole('button', { name: 'Далее' }).click();
    await expect(page.getByText('2 из 2')).toBeVisible();
    await expect(catalog.productLinks).toHaveCount(8);
  });

  test('product page shows offers with units and freshness', async ({ page }) => {
    await catalog.find('Сахар');
    await catalog.productLinks.first().click();
    await expect(page.getByRole('heading', { name: 'Сахар' })).toBeVisible();
    await expect(page.getByText('Предложения поставщиков')).toBeVisible();
    // Every price is shown with its unit
    await expect(page.getByText(/\d UZS\/кг/).first()).toBeVisible();
    // Expired demo offer is flagged
    await expect(page.getByText('Истекло')).toBeVisible();
    await expect(page.getByRole('tab', { name: '90 дней' })).toBeVisible();
  });
});
