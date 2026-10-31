import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  AuthResponse,
  BasketDto,
  OfferDto,
  OptimizationRunDto,
  Paginated,
  ProductSummaryDto,
  PurchaseDto,
} from '@smp/shared';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { signInitData } from '../src/integrations/telegram';

const app = createApp();
let token = '';
const auth = () => ({ Authorization: `Bearer ${token}` });
const BOT = process.env.TELEGRAM_BOT_TOKEN!;

let products: ProductSummaryDto[] = [];
const byName = (n: string) => products.find((p) => p.name === n)!;

beforeAll(async () => {
  const res = await request(app).post('/api/auth/dev').send({});
  token = (res.body as AuthResponse).token;
  const list = await request(app).get('/api/products?pageSize=50').set(auth());
  products = (list.body as Paginated<ProductSummaryDto>).items;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Authentication', () => {
  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a forged token', async () => {
    const res = await request(app).get('/api/products').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
  });

  it('dev login returns the demo user', async () => {
    const res = await request(app).get('/api/auth/me').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.business.district).toBe('Chilonzor');
  });

  it('accepts valid Telegram initData and creates a user', async () => {
    const initData = signInitData(
      {
        auth_date: String(Math.floor(Date.now() / 1000)),
        query_id: 'AAE',
        user: JSON.stringify({ id: 555001, first_name: 'Тест', username: 'tester' }),
      },
      BOT,
    );
    const res = await request(app).post('/api/auth/telegram').send({ initData });
    expect(res.status).toBe(200);
    expect(res.body.user.telegramId).toBe('555001');
    expect(res.body.token).toBeTruthy();
  });

  it('rejects tampered Telegram initData', async () => {
    const initData = signInitData(
      { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 1 }) },
      BOT,
    ).replace('%22id%22%3A1', '%22id%22%3A2');
    const res = await request(app).post('/api/auth/telegram').send({ initData });
    expect(res.status).toBe(401);
  });

  it('rejects expired Telegram initData', async () => {
    const initData = signInitData(
      { auth_date: String(Math.floor(Date.now() / 1000) - 3 * 86400), user: JSON.stringify({ id: 7 }) },
      BOT,
    );
    const res = await request(app).post('/api/auth/telegram').send({ initData });
    expect(res.status).toBe(401);
  });
});

describe('Products API', () => {
  it('lists 20 seeded products with price info', () => {
    expect(products).toHaveLength(20);
    const potatoes = byName('Картофель');
    expect(potatoes.unit).toBe('KG');
    expect(potatoes.offerCount).toBeGreaterThan(1);
    expect(Number(potatoes.minPrice)).toBeGreaterThan(0);
    expect(potatoes.priceUpdatedAt).toBeTruthy();
  });

  it('paginates', async () => {
    const res = await request(app).get('/api/products?page=2&pageSize=5').set(auth());
    expect(res.body.items).toHaveLength(5);
    expect(res.body.total).toBe(20);
    expect(res.body.totalPages).toBe(4);
  });

  it('searches by Russian name and filters by category', async () => {
    const s = await request(app).get('/api/products').query({ search: 'карт' }).set(auth());
    expect(s.body.items.map((p: ProductSummaryDto) => p.name)).toEqual(['Картофель']);
    const c = await request(app).get('/api/products?category=dairy').set(auth());
    expect(c.body.items.every((p: ProductSummaryDto) => p.category.slug === 'dairy')).toBe(true);
  });

  it('sorts by price', async () => {
    const res = await request(app).get('/api/products?sort=price_asc&pageSize=50').set(auth());
    const prices = res.body.items.map((p: ProductSummaryDto) => Number(p.minPrice ?? Infinity));
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it('validates query and ids', async () => {
    expect((await request(app).get('/api/products?pageSize=1000').set(auth())).status).toBe(400);
    expect((await request(app).get('/api/products/not-a-uuid').set(auth())).status).toBe(400);
    const missing = await request(app).get('/api/products/00000000-0000-4000-8000-000000000000').set(auth());
    expect(missing.status).toBe(404);
  });
});

describe('Offers API', () => {
  it('returns offers with freshness and quality flags', async () => {
    const res = await request(app).get(`/api/products/${byName('Сахар').id}/offers`).set(auth());
    expect(res.status).toBe(200);
    const offers = res.body as OfferDto[];
    expect(offers.length).toBeGreaterThan(1);
    expect(offers.every((o) => o.isDemo && o.currency === 'UZS')).toBe(true);
    expect(offers.some((o) => o.dataQualityStatus === 'EXPIRED')).toBe(true);
  });
});

describe('Suppliers API', () => {
  it('lists suppliers, all demo and unverified', async () => {
    const res = await request(app).get('/api/suppliers').set(auth());
    expect(res.body.total).toBe(5);
    for (const s of res.body.items) {
      expect(s.isDemo).toBe(true);
      expect(s.verificationStatus).toBe('UNVERIFIED');
    }
  });

  it('shows trust score or insufficient data', async () => {
    const list = await request(app).get('/api/suppliers').set(auth());
    const a = list.body.items.find((s: { companyName: string }) => s.companyName === 'Supplier A');
    const d = list.body.items.find((s: { companyName: string }) => s.companyName === 'Supplier D');
    const ra = await request(app).get(`/api/suppliers/${a.id}`).set(auth());
    expect(ra.body.trust.status).toBe('OK');
    expect(ra.body.trust.score).toBeGreaterThan(0);
    expect(ra.body.trust.score).toBeLessThanOrEqual(100);
    const rd = await request(app).get(`/api/suppliers/${d.id}`).set(auth());
    expect(rd.body.trust.status).toBe('INSUFFICIENT_DATA');
    expect(rd.body.trust.score).toBeNull();
    const reviews = await request(app).get(`/api/suppliers/${a.id}/reviews`).set(auth());
    expect(reviews.body.total).toBe(8);
    const offers = await request(app).get(`/api/suppliers/${a.id}/offers`).set(auth());
    expect(offers.body.length).toBe(20);
  });
});

describe('Basket API', () => {
  it('adds, updates, validates and removes items', async () => {
    await request(app).delete('/api/basket').set(auth());
    const potatoes = byName('Картофель');
    const add = await request(app)
      .post('/api/basket/items')
      .set(auth())
      .send({ productId: potatoes.id, quantity: 100, unit: 'KG' });
    expect(add.status).toBe(201);
    const basket = add.body as BasketDto;
    expect(basket.items).toHaveLength(1);
    expect(Number(basket.estimatedTotal)).toBeGreaterThan(0);

    const wrongUnit = await request(app)
      .post('/api/basket/items')
      .set(auth())
      .send({ productId: potatoes.id, quantity: 1, unit: 'L' });
    expect(wrongUnit.status).toBe(400);

    const zero = await request(app)
      .post('/api/basket/items')
      .set(auth())
      .send({ productId: potatoes.id, quantity: 0, unit: 'KG' });
    expect(zero.status).toBe(400);
    expect(zero.body.error.message).toMatch(/больше нуля/);

    const tooMuch = await request(app)
      .patch(`/api/basket/items/${basket.items[0].id}`)
      .set(auth())
      .send({ quantity: 10_000_000 });
    expect(tooMuch.status).toBe(400);

    const upd = await request(app)
      .patch(`/api/basket/items/${basket.items[0].id}`)
      .set(auth())
      .send({ quantity: 50 });
    expect(upd.body.items[0].quantity).toBe('50');

    const del = await request(app).delete(`/api/basket/items/${basket.items[0].id}`).set(auth());
    expect(del.body.items).toHaveLength(0);
  });

  it('does not let another user touch my basket items', async () => {
    const add = await request(app)
      .post('/api/basket/items')
      .set(auth())
      .send({ productId: byName('Лук').id, quantity: 5, unit: 'KG' });
    const itemId = add.body.items[0].id;
    const other = signInitData(
      { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 777002 }) },
      BOT,
    );
    const otherToken = (await request(app).post('/api/auth/telegram').send({ initData: other })).body.token;
    const res = await request(app)
      .delete(`/api/basket/items/${itemId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
    await request(app).delete('/api/basket').set(auth());
  });
});

describe('Optimizer + Purchases API', () => {
  let run: OptimizationRunDto;

  it('calculates feasible scenarios that respect all constraints', async () => {
    const items = [
      { productId: byName('Картофель').id, quantity: 100, unit: 'KG' },
      { productId: byName('Лук').id, quantity: 50, unit: 'KG' },
      { productId: byName('Помидоры').id, quantity: 30, unit: 'KG' },
      { productId: byName('Рис').id, quantity: 25, unit: 'KG' },
    ];
    const res = await request(app).post('/api/optimizer/calculate').set(auth()).send({ items });
    expect(res.status).toBe(201);
    run = res.body;
    expect(run.optimizationStatus).toBe('OPTIMAL');
    expect(run.recommended).toBeTruthy();
    expect(run.explanation.length).toBeGreaterThan(0);

    const offerIds = new Set(run.scenarios.flatMap((s) => s.allocations.map((a) => a.offerId)));
    const offers = await prisma.supplierOffer.findMany({ where: { id: { in: [...offerIds] } } });
    const byId = new Map(offers.map((o) => [o.id, o]));

    for (const s of run.scenarios.filter((x) => x.feasible)) {
      for (const it of items) {
        const sum = s.allocations
          .filter((a) => a.productId === it.productId)
          .reduce((acc, a) => acc + Number(a.quantity), 0);
        expect(sum).toBeCloseTo(it.quantity, 6);
      }
      for (const a of s.allocations) {
        const o = byId.get(a.offerId)!;
        expect(Number(a.quantity)).toBeLessThanOrEqual(Number(o.availableQuantity));
        expect(Number(a.quantity)).toBeGreaterThanOrEqual(Number(o.minOrderQuantity));
        expect(o.dataQualityStatus).not.toBe('EXPIRED');
        expect(o.deliveryZones.includes('ALL') || o.deliveryZones.includes('Chilonzor')).toBe(true);
        expect(Date.now() - o.lastUpdated.getTime()).toBeLessThan(72 * 3_600_000);
      }
      const delivery = s.suppliers.reduce((acc, g) => acc + Number(g.deliveryCost), 0);
      expect(Number(s.deliveryCost)).toBeCloseTo(delivery, 2);
      expect(new Set(s.suppliers.map((g) => g.supplierId)).size).toBe(s.suppliers.length);
      expect(Number(s.totalCost)).toBeCloseTo(Number(s.productsCost) + Number(s.deliveryCost), 2);
      if (s.baselineCost) {
        expect(Number(s.savings)).toBeCloseTo(Number(s.baselineCost) - Number(s.totalCost), 2);
      }
    }
    // Supplier D does not deliver to Chilonzor
    expect(run.warnings.some((w) => w.code === 'OFFER_EXCLUDED_ZONE_MISMATCH')).toBe(true);
  });

  it('returns 400 for an empty basket or a duplicated product', async () => {
    expect((await request(app).post('/api/optimizer/calculate').set(auth()).send({ items: [] })).status).toBe(400);
    const id = byName('Соль').id;
    const dup = await request(app)
      .post('/api/optimizer/calculate')
      .set(auth())
      .send({ items: [{ productId: id, quantity: 1, unit: 'KG' }, { productId: id, quantity: 2, unit: 'KG' }] });
    expect(dup.status).toBe(400);
  });

  it('reports infeasible when the quantity exceeds total stock', async () => {
    const res = await request(app)
      .post('/api/optimizer/calculate')
      .set(auth())
      .send({ items: [{ productId: byName('Сливочное масло').id, quantity: 99_999, unit: 'KG' }] });
    expect(res.status).toBe(201);
    expect(res.body.optimizationStatus).toBe('INFEASIBLE');
    expect(res.body.recommended).toBeNull();
  });

  it('saves the recommended scenario as a purchase in a transaction', async () => {
    const save = await request(app)
      .post(`/api/optimizer/${run.id}/save`)
      .set(auth())
      .send({ scenario: run.recommended });
    expect(save.status).toBe(201);
    const p = save.body as PurchaseDto;
    const rec = run.scenarios.find((s) => s.kind === run.recommended)!;
    expect(p.totalCost).toBe(rec.totalCost);
    expect(p.items!.length).toBe(rec.allocations.length);
    expect(p.status).toBe('PLANNED');

    const again = await request(app).post(`/api/optimizer/${run.id}/save`).set(auth()).send({ scenario: run.recommended });
    expect(again.status).toBe(409);

    const fetched = await request(app).get(`/api/optimizer/${run.id}`).set(auth());
    expect(fetched.body.savedPurchaseId).toBe(p.id);

    // status transitions
    const bad = await request(app).patch(`/api/purchases/${p.id}/status`).set(auth()).send({ status: 'COMPLETED' });
    expect(bad.status).toBe(400);
    const ok = await request(app).patch(`/api/purchases/${p.id}/status`).set(auth()).send({ status: 'CONFIRMED' });
    expect(ok.body.status).toBe('CONFIRMED');

    const list = await request(app).get('/api/purchases').set(auth());
    expect(list.body.items[0].id).toBe(p.id);

    const repeat = await request(app).post(`/api/purchases/${p.id}/repeat`).set(auth());
    expect(repeat.body.items).toHaveLength(4);
  });

  it('hides other users runs and purchases', async () => {
    const other = signInitData(
      { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 777003 }) },
      BOT,
    );
    const t = (await request(app).post('/api/auth/telegram').send({ initData: other })).body.token;
    const res = await request(app).get(`/api/optimizer/${run.id}`).set('Authorization', `Bearer ${t}`);
    expect(res.status).toBe(404);
  });
});

describe('Dashboard, analytics, assistant', () => {
  it('dashboard stats come from the database', async () => {
    const res = await request(app).get('/api/dashboard/stats').set(auth());
    expect(res.body.availableSuppliers).toBe(5);
    expect(res.body.availableProducts).toBeGreaterThan(15);
    expect(res.body.totalPurchases).toBeGreaterThanOrEqual(7);
    expect(res.body.isDemoData).toBe(true);
    const changes = await request(app).get('/api/dashboard/price-changes').set(auth());
    expect(Array.isArray(changes.body)).toBe(true);
  });

  it('price analytics keeps series per supplier/unit/currency', async () => {
    const res = await request(app).get(`/api/analytics/prices/${byName('Картофель').id}?range=7`).set(auth());
    expect(res.status).toBe(200);
    for (const s of res.body.series) {
      expect(s.points.length).toBeGreaterThanOrEqual(4);
      expect(Number(s.min)).toBeLessThanOrEqual(Number(s.max));
    }
    expect(new Set(res.body.series.map((s: { supplierId: string }) => s.supplierId)).size).toBe(res.body.series.length);
    const overview = await request(app).get('/api/analytics/overview').set(auth());
    expect(overview.body.spendingByMonth.length).toBeGreaterThan(0);
    const savings = await request(app).get('/api/analytics/savings').set(auth());
    expect(savings.body.disclaimer).toBeTruthy();
  });

  it('assistant answers from data', async () => {
    const res = await request(app).post('/api/assistant/chat').set(auth()).send({ message: 'Где дешевле купить рис?' });
    expect(res.body.intent).toBe('cheapest');
    expect(res.body.engine).toBe('rule-based');
    expect(res.body.facts.length).toBeGreaterThan(0);
    const split = await request(app).post('/api/assistant/chat').set(auth()).send({ message: 'Стоит ли разделить заказ?' });
    expect(split.body.intent).toBe('split');
    const best = await request(app).post('/api/assistant/chat').set(auth()).send({ message: 'Какой поставщик лучше?' });
    expect(best.body.answer).toMatch(/Недостаточно данных для оценки: .*Supplier D/);
  });
});
