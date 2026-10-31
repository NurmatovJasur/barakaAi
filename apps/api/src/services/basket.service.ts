import type { PrismaClient } from '@prisma/client';
import {
  MAX_BASKET_ITEMS,
  productLabel,
  type BasketDto,
  type BasketItemInput,
} from '@smp/shared';
import { D, money, qty } from '../utils/decimal';
import { badRequest, notFound } from '../utils/errors';
import type { ProductService } from './product.service';

export class BasketService {
  constructor(
    private readonly db: PrismaClient,
    private readonly products: ProductService,
  ) {}

  private async basketId(userId: string) {
    const b = await this.db.basket.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true },
    });
    return b.id;
  }

  async get(userId: string): Promise<BasketDto> {
    const id = await this.basketId(userId);
    const items = await this.db.basketItem.findMany({
      where: { basketId: id },
      include: { product: { select: { name: true } } },
      orderBy: { addedAt: 'asc' },
    });
    const prices = await this.products.minPrices(items.map((i) => i.productId));
    let total = D(0);
    let hasUnpriced = false;
    const dto = items.map((i) => {
      const p = prices.get(i.productId);
      const est = p?.minPrice ? D(p.minPrice).times(D(i.quantity)) : null;
      if (est) total = total.plus(est);
      else hasUnpriced = true;
      return {
        id: i.id,
        productId: i.productId,
        productName: productLabel(i.product.name),
        unit: i.unit,
        quantity: qty(D(i.quantity)),
        addedAt: i.addedAt.toISOString(),
        minPrice: p?.minPrice ? money(D(p.minPrice)) : null,
        estimatedCost: est ? money(est) : null,
        offerCount: p?.offerCount ?? 0,
      };
    });
    return { id, items: dto, estimatedTotal: money(total), hasUnpricedItems: hasUnpriced };
  }

  private async validateProduct(input: BasketItemInput) {
    const product = await this.db.product.findUnique({ where: { id: input.productId } });
    if (!product || !product.isActive) throw notFound('Товар');
    if (product.unit !== input.unit) {
      throw badRequest(`Неверная единица измерения: для этого товара используется ${product.unit}`);
    }
    const p = (await this.products.minPrices([product.id])).get(product.id);
    if (!p || p.offerCount === 0) throw badRequest('Для этого товара сейчас нет доступных предложений');
  }

  /** Adds an item or replaces the quantity if the product is already in the basket. */
  async addItem(userId: string, input: BasketItemInput): Promise<BasketDto> {
    await this.validateProduct(input);
    const basketId = await this.basketId(userId);
    const count = await this.db.basketItem.count({ where: { basketId } });
    const existing = await this.db.basketItem.findUnique({
      where: { basketId_productId: { basketId, productId: input.productId } },
    });
    if (!existing && count >= MAX_BASKET_ITEMS) {
      throw badRequest(`В корзине может быть не более ${MAX_BASKET_ITEMS} товаров`);
    }
    await this.db.basketItem.upsert({
      where: { basketId_productId: { basketId, productId: input.productId } },
      create: { basketId, productId: input.productId, quantity: input.quantity, unit: input.unit },
      update: { quantity: input.quantity },
    });
    return this.get(userId);
  }

  private async ownedItem(userId: string, itemId: string) {
    const item = await this.db.basketItem.findFirst({ where: { id: itemId, basket: { userId } } });
    if (!item) throw notFound('Позиция корзины');
    return item;
  }

  async updateItem(userId: string, itemId: string, quantity: number): Promise<BasketDto> {
    await this.ownedItem(userId, itemId);
    await this.db.basketItem.update({ where: { id: itemId }, data: { quantity } });
    return this.get(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<BasketDto> {
    await this.ownedItem(userId, itemId);
    await this.db.basketItem.delete({ where: { id: itemId } });
    return this.get(userId);
  }

  async clear(userId: string): Promise<BasketDto> {
    const basketId = await this.basketId(userId);
    await this.db.basketItem.deleteMany({ where: { basketId } });
    return this.get(userId);
  }

  /** Replaces basket content (used by "repeat purchase"). */
  async replace(userId: string, items: BasketItemInput[]): Promise<BasketDto> {
    const basketId = await this.basketId(userId);
    await this.db.$transaction([
      this.db.basketItem.deleteMany({ where: { basketId } }),
      this.db.basketItem.createMany({
        data: items.map((i) => ({ basketId, productId: i.productId, quantity: i.quantity, unit: i.unit })),
      }),
    ]);
    return this.get(userId);
  }
}
