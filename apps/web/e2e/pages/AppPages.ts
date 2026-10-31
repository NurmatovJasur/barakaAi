import { expect, type Locator, type Page } from '@playwright/test';

export class NavBar {
  readonly root: Locator;
  constructor(readonly page: Page) {
    this.root = page.getByRole('navigation', { name: 'Основная навигация' });
  }
  go(tab: 'Главная' | 'Каталог' | 'Закупка' | 'Поставщики' | 'Аналитика') {
    // Tab label may be followed by a count badge ("Закупка 2")
    return this.root.getByRole('link', { name: new RegExp(`^${tab}`) }).click();
  }
  basketLink() {
    return this.root.getByRole('link', { name: /Закупка/ });
  }
}

export class CatalogPage {
  readonly search: Locator;
  readonly sort: Locator;
  readonly productLinks: Locator;
  constructor(readonly page: Page) {
    this.search = page.getByLabel('Поиск товара');
    this.sort = page.getByLabel('Сортировка');
    this.productLinks = page.locator('main a[href^="/products/"]');
  }

  async find(name: string) {
    await this.search.fill(name);
    await expect(this.page.getByLabel(`Добавить ${name}`)).toBeVisible();
  }

  /** Adds a product through the quantity dialog. */
  async add(name: string, qty: string) {
    await this.find(name);
    await this.page.getByLabel(`Добавить ${name}`).click();
    const dialog = this.page.getByRole('dialog');
    await dialog.getByLabel('Количество').fill(qty);
    await dialog.getByRole('button', { name: 'В закупку' }).click();
    await expect(dialog).toBeHidden();
  }

  category(label: string) {
    return this.page.getByRole('button', { name: label, exact: true });
  }

  /** Visible minimum prices ("от 3 300 UZS/кг") as numbers. */
  async minPrices() {
    const texts = await this.productLinks.locator('span.font-semibold').allTextContents();
    return texts.map((t) => Number(t.replace(/[^\d]/g, '')));
  }
}

export class BasketPage {
  constructor(readonly page: Page) {}
  quantity(product: string) {
    return this.page.getByLabel(`Количество ${product}`);
  }
  remove(product: string) {
    return this.page.getByLabel(`Удалить ${product}`).click();
  }
  async setQuantity(product: string, qty: string) {
    await this.quantity(product).fill(qty);
    await this.quantity(product).press('Enter');
  }
  async clear() {
    await this.page.getByRole('button', { name: /Очистить/ }).click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Очистить' }).click();
  }
}

export class OptimizationPage {
  readonly heading: Locator;
  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Результат оптимизации' });
  }
  scenarioTab(label: RegExp) {
    return this.page.getByRole('tab', { name: label });
  }
  supplierGroupHeaders() {
    return this.page.locator('main a[href^="/suppliers/"] span.font-semibold');
  }
  async confirmSave() {
    const dialog = this.page.getByRole('dialog', { name: 'Сохранить план закупки?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Сохранить' }).click();
  }
}
