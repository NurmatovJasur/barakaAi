import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  allocateActiveSet,
  optimizeBasket,
  OptimizerInputError,
  type OptimizerInput,
  type OptimizerItem,
  type OptimizerResult,
} from './optimizer';
import type { OptimizerOffer } from './offerEligibility';

const NOW = new Date('2026-10-30T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const D = (v: number | string) => new Decimal(v);

let seq = 0;
function offer(
  p: Partial<Omit<OptimizerOffer, 'price'>> & { productId: string; supplierId: string; price: number },
): OptimizerOffer {
  seq++;
  return {
    offerId: `o${seq}`,
    productName: p.productId,
    supplierName: p.supplierId,
    currency: 'UZS',
    unit: 'KG',
    minOrderQuantity: D(0),
    availableQuantity: D(1000),
    deliveryCost: D(0),
    deliveryZones: ['ALL'],
    estimatedDeliveryDays: 1,
    lastUpdated: hoursAgo(1),
    expiresAt: null,
    availabilityStatus: 'AVAILABLE',
    dataQualityStatus: 'VALID',
    supplierActive: true,
    productActive: true,
    ...p,
    price: D(p.price),
  } as OptimizerOffer;
}

const item = (productId: string, quantity: number): OptimizerItem => ({
  productId,
  productName: productId,
  quantity: D(quantity),
  unit: 'KG',
});

function run(items: OptimizerItem[], offers: OptimizerOffer[], extra: Partial<OptimizerInput> = {}) {
  return optimizeBasket({
    items,
    offers,
    deliveryDistrict: 'Chilonzor',
    now: NOW,
    freshness: { freshHours: 24, staleHours: 72 },
    ...extra,
  });
}

const scenario = (r: OptimizerResult, kind: string) => r.scenarios.find((s) => s.kind === kind)!;

/** Every feasible scenario must satisfy all model constraints. */
function assertInvariants(r: OptimizerResult, items: OptimizerItem[], offers: OptimizerOffer[]) {
  const byId = new Map(offers.map((o) => [o.offerId, o]));
  for (const s of r.scenarios.filter((x) => x.feasible)) {
    for (const it of items) {
      const sum = s.allocations
        .filter((a) => a.productId === it.productId)
        .reduce((acc, a) => acc.plus(a.quantity), D(0));
      expect(sum.eq(it.quantity), `Σx = q for ${it.productId} in ${s.kind}`).toBe(true);
    }
    for (const a of s.allocations) {
      const o = byId.get(a.offerId)!;
      expect(a.quantity.lte(o.availableQuantity), 'x ≤ a').toBe(true);
      expect(a.quantity.gte(o.minOrderQuantity), 'x ≥ m').toBe(true);
      expect(a.quantity.gt(0)).toBe(true);
      expect(a.totalPrice.eq(o.price.times(a.quantity))).toBe(true);
    }
    const used = new Set(s.allocations.map((a) => a.supplierId));
    expect(used.size).toBe(s.supplierCount);
    const expectedDelivery = [...used].reduce(
      (acc, id) => acc.plus(s.deliveryBySupplier[id]),
      D(0),
    );
    expect(s.deliveryCost!.eq(expectedDelivery)).toBe(true);
    expect(s.totalCost!.eq(s.productsCost!.plus(s.deliveryCost!))).toBe(true);
  }
}

describe('allocateActiveSet', () => {
  it('fills MOQ first then cheapest', () => {
    const a = offer({ productId: 'p', supplierId: 'A', price: 10, minOrderQuantity: D(5), availableQuantity: D(20) });
    const b = offer({ productId: 'p', supplierId: 'B', price: 8, minOrderQuantity: D(5), availableQuantity: D(10) });
    const res = allocateActiveSet(item('p', 18), [a, b])!;
    const qa = res.allocations.find((x) => x.offerId === a.offerId)!.quantity;
    const qb = res.allocations.find((x) => x.offerId === b.offerId)!.quantity;
    expect(qb.toNumber()).toBe(10);
    expect(qa.toNumber()).toBe(8);
    expect(res.cost.toNumber()).toBe(8 * 10 + 10 * 8);
  });

  it('returns null when MOQ sum exceeds need', () => {
    const a = offer({ productId: 'p', supplierId: 'A', price: 10, minOrderQuantity: D(50) });
    expect(allocateActiveSet(item('p', 10), [a])).toBeNull();
  });
});

describe('optimizeBasket', () => {
  it('1. one product, one supplier', () => {
    const offers = [offer({ productId: 'potato', supplierId: 'A', price: 4000, deliveryCost: D(20000) })];
    const items = [item('potato', 100)];
    const r = run(items, offers);
    expect(r.status).toBe('OPTIMAL');
    const s = scenario(r, 'SINGLE');
    expect(s.totalCost!.toNumber()).toBe(400_000 + 20_000);
    expect(s.savings!.toNumber()).toBe(0);
    assertInvariants(r, items, offers);
  });

  it('2. one product, three suppliers → picks cheapest incl. delivery', () => {
    const offers = [
      offer({ productId: 'potato', supplierId: 'A', price: 4000, deliveryCost: D(10000) }),
      offer({ productId: 'potato', supplierId: 'B', price: 3800, deliveryCost: D(30000) }),
      offer({ productId: 'potato', supplierId: 'C', price: 4200, deliveryCost: D(0) }),
    ];
    const items = [item('potato', 100)];
    const r = run(items, offers);
    // A: 410 000, B: 410 000, C: 420 000 → tie A/B both one supplier; total 410 000
    expect(scenario(r, 'MULTI').totalCost!.toNumber()).toBe(410_000);
    expect(scenario(r, 'MULTI').supplierCount).toBe(1);
    assertInvariants(r, items, offers);
  });

  it('3. several products, one supplier', () => {
    const offers = [
      offer({ productId: 'potato', supplierId: 'A', price: 4000, deliveryCost: D(15000) }),
      offer({ productId: 'onion', supplierId: 'A', price: 3000, deliveryCost: D(15000) }),
    ];
    const items = [item('potato', 10), item('onion', 5)];
    const r = run(items, offers);
    const s = scenario(r, 'SINGLE');
    expect(s.totalCost!.toNumber()).toBe(40_000 + 15_000 + 15_000);
    expect(s.deliveryCost!.toNumber()).toBe(15_000);
    assertInvariants(r, items, offers);
  });

  it('4. several products, several suppliers', () => {
    const offers = [
      offer({ productId: 'potato', supplierId: 'A', price: 3000, deliveryCost: D(10000) }),
      offer({ productId: 'onion', supplierId: 'A', price: 5000, deliveryCost: D(10000) }),
      offer({ productId: 'onion', supplierId: 'B', price: 2000, deliveryCost: D(10000) }),
      offer({ productId: 'potato', supplierId: 'B', price: 4500, deliveryCost: D(10000) }),
    ];
    const items = [item('potato', 100), item('onion', 50)];
    const r = run(items, offers);
    // single A: 300k+250k+10k = 560k; single B: 450k+100k+10k = 560k; split: 300k+100k+20k = 420k
    expect(scenario(r, 'SINGLE').totalCost!.toNumber()).toBe(560_000);
    expect(scenario(r, 'MULTI').totalCost!.toNumber()).toBe(420_000);
    expect(scenario(r, 'MULTI').savings!.toNumber()).toBe(140_000);
    expect(r.recommended).toBe('BALANCED_2');
    assertInvariants(r, items, offers);
  });

  it('5. insufficient quantity → infeasible, never over-buys', () => {
    const offers = [
      offer({ productId: 'potato', supplierId: 'A', price: 4000, availableQuantity: D(30) }),
      offer({ productId: 'potato', supplierId: 'B', price: 4100, availableQuantity: D(40) }),
    ];
    const items = [item('potato', 100)];
    const r = run(items, offers);
    expect(r.status).toBe('INFEASIBLE');
    expect(r.scenarios.every((s) => !s.feasible)).toBe(true);
    expect(r.warnings.some((w) => w.code === 'INSUFFICIENT_QUANTITY')).toBe(true);
  });

  it('5b. stock split across suppliers when one is not enough', () => {
    const offers = [
      offer({ productId: 'potato', supplierId: 'A', price: 4000, availableQuantity: D(60) }),
      offer({ productId: 'potato', supplierId: 'B', price: 4100, availableQuantity: D(60) }),
    ];
    const items = [item('potato', 100)];
    const r = run(items, offers);
    expect(scenario(r, 'SINGLE').feasible).toBe(false);
    expect(r.baselineCost).toBeNull();
    const m = scenario(r, 'MULTI');
    expect(m.totalCost!.toNumber()).toBe(60 * 4000 + 40 * 4100);
    expect(m.savings).toBeNull();
    expect(r.warnings.some((w) => w.code === 'NO_BASELINE')).toBe(true);
    assertInvariants(r, items, offers);
  });

  it('6. inactive supplier / out of stock is excluded', () => {
    const offers = [
      offer({ productId: 'potato', supplierId: 'A', price: 1000, supplierActive: false }),
      offer({ productId: 'potato', supplierId: 'B', price: 1500, availabilityStatus: 'OUT_OF_STOCK' }),
      offer({ productId: 'potato', supplierId: 'C', price: 4000 }),
    ];
    const items = [item('potato', 10)];
    const r = run(items, offers);
    const s = scenario(r, 'MULTI');
    expect(s.supplierIds).toEqual(['C']);
    expect(r.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(['OFFER_EXCLUDED_SUPPLIER_INACTIVE', 'OFFER_EXCLUDED_OUT_OF_STOCK']),
    );
  });

  it('7. stale price and expired offers are not used', () => {
    const offers = [
      offer({ productId: 'potato', supplierId: 'A', price: 1000, lastUpdated: hoursAgo(100) }),
      offer({ productId: 'potato', supplierId: 'B', price: 1100, expiresAt: hoursAgo(1) }),
      offer({ productId: 'potato', supplierId: 'C', price: 1200, dataQualityStatus: 'EXPIRED' }),
      offer({ productId: 'potato', supplierId: 'D', price: 3000, lastUpdated: hoursAgo(48) }),
    ];
    const items = [item('potato', 10)];
    const r = run(items, offers);
    expect(scenario(r, 'MULTI').supplierIds).toEqual(['D']); // 48h = "attention", still allowed
    const codes = r.warnings.map((w) => w.code);
    expect(codes).toContain('OFFER_EXCLUDED_STALE_PRICE');
    expect(codes.filter((c) => c === 'OFFER_EXCLUDED_EXPIRED')).toHaveLength(2);
  });

  it('8. minimum order quantity is respected', () => {
    const offers = [
      offer({ productId: 'potato', supplierId: 'A', price: 1000, minOrderQuantity: D(200) }),
      offer({ productId: 'potato', supplierId: 'B', price: 2000, minOrderQuantity: D(10) }),
    ];
    const items = [item('potato', 50)];
    const r = run(items, offers);
    const s = scenario(r, 'MULTI');
    expect(s.supplierIds).toEqual(['B']);
    expect(s.totalCost!.toNumber()).toBe(100_000);
    assertInvariants(r, items, offers);
  });

  it('8b. MOQ forces split where both minimums fit', () => {
    const offers = [
      offer({ productId: 'potato', supplierId: 'A', price: 1000, minOrderQuantity: D(30), availableQuantity: D(70) }),
      offer({ productId: 'potato', supplierId: 'B', price: 2000, minOrderQuantity: D(30), availableQuantity: D(100) }),
    ];
    const items = [item('potato', 100)];
    const r = run(items, offers);
    const s = scenario(r, 'MULTI');
    expect(s.totalCost!.toNumber()).toBe(70 * 1000 + 30 * 2000);
    assertInvariants(r, items, offers);
  });

  it('9. delivery is charged once per supplier', () => {
    const offers = ['a', 'b', 'c'].map((p) =>
      offer({ productId: p, supplierId: 'A', price: 1000, deliveryCost: D(25000) }),
    );
    const items = [item('a', 1), item('b', 1), item('c', 1)];
    const r = run(items, offers);
    const s = scenario(r, 'SINGLE');
    expect(s.deliveryCost!.toNumber()).toBe(25_000);
    expect(s.totalCost!.toNumber()).toBe(3000 + 25_000);
    assertInvariants(r, items, offers);
  });

  it('9b. extra supplier only chosen when the price gain beats its delivery', () => {
    const offers = [
      offer({ productId: 'a', supplierId: 'A', price: 1000, deliveryCost: D(20000) }),
      offer({ productId: 'b', supplierId: 'A', price: 1000, deliveryCost: D(20000) }),
      offer({ productId: 'b', supplierId: 'B', price: 900, deliveryCost: D(20000) }),
    ];
    const items = [item('a', 10), item('b', 10)];
    const r = run(items, offers);
    // B saves 1 000 on product b but costs 20 000 delivery → stay single
    expect(scenario(r, 'MULTI').supplierIds).toEqual(['A']);
    expect(r.recommended).toBe('SINGLE');
  });

  it('10. no feasible combination', () => {
    const offers = [offer({ productId: 'potato', supplierId: 'A', price: 1000 })];
    const items = [item('potato', 10), item('onion', 5)];
    const r = run(items, offers);
    expect(r.status).toBe('INFEASIBLE');
    expect(r.recommended).toBeNull();
    expect(r.warnings.some((w) => w.code === 'NO_ELIGIBLE_OFFERS' && w.productId === 'onion')).toBe(true);
  });

  it('11. zero or negative quantity is rejected', () => {
    const offers = [offer({ productId: 'potato', supplierId: 'A', price: 1000 })];
    expect(() => run([item('potato', 0)], offers)).toThrow(OptimizerInputError);
    expect(() => run([item('potato', -5)], offers)).toThrow(OptimizerInputError);
    expect(() => run([], offers)).toThrow(OptimizerInputError);
  });

  it('12. optimal distribution across suppliers (prompt example)', () => {
    const offers = [
      offer({ productId: 'potato', supplierId: 'A', price: 3500, deliveryCost: D(15000) }),
      offer({ productId: 'onion', supplierId: 'A', price: 4500, deliveryCost: D(15000) }),
      offer({ productId: 'tomato', supplierId: 'A', price: 12000, deliveryCost: D(15000) }),
      offer({ productId: 'potato', supplierId: 'B', price: 4200, deliveryCost: D(15000) }),
      offer({ productId: 'onion', supplierId: 'B', price: 2500, deliveryCost: D(15000) }),
      offer({ productId: 'tomato', supplierId: 'B', price: 13000, deliveryCost: D(15000) }),
      offer({ productId: 'tomato', supplierId: 'C', price: 8000, deliveryCost: D(15000) }),
    ];
    const items = [item('potato', 100), item('onion', 50), item('tomato', 30)];
    const r = run(items, offers);
    const m = scenario(r, 'MULTI');
    // A potato 350k + B onion 125k + C tomato 240k + 3×15k = 760k
    expect(m.totalCost!.toNumber()).toBe(760_000);
    expect(m.supplierCount).toBe(3);
    // single A: 350k+225k+360k+15k = 950k ; single B: 420k+125k+390k+15k = 950k
    expect(r.baselineCost!.toNumber()).toBe(950_000);
    expect(m.savings!.toNumber()).toBe(190_000);
    // ≤2: A potato + B onion + A tomato(360k)? vs A potato + C tomato + onion A... brute-force below
    const b2 = scenario(r, 'BALANCED_2');
    expect(b2.supplierCount).toBeLessThanOrEqual(2);
    expect(b2.totalCost!.gte(m.totalCost!)).toBe(true);
    assertInvariants(r, items, offers);
  });

  it('zone mismatch offers are excluded', () => {
    const offers = [
      offer({ productId: 'potato', supplierId: 'A', price: 1000, deliveryZones: ['Sergeli'] }),
      offer({ productId: 'potato', supplierId: 'B', price: 2000, deliveryZones: ['Chilonzor'] }),
    ];
    const r = run([item('potato', 10)], offers);
    expect(scenario(r, 'MULTI').supplierIds).toEqual(['B']);
    expect(r.warnings.some((w) => w.code === 'OFFER_EXCLUDED_ZONE_MISMATCH')).toBe(true);
  });

  it('unit mismatch offers are excluded', () => {
    const offers = [offer({ productId: 'potato', supplierId: 'A', price: 1000, unit: 'PCS' })];
    const r = run([item('potato', 10)], offers);
    expect(r.status).toBe('INFEASIBLE');
  });

  it('compute limit yields FEASIBLE_LIMIT_REACHED, never an invalid plan', () => {
    const suppliers = ['A', 'B', 'C', 'D', 'E', 'F'];
    const products = ['p1', 'p2', 'p3', 'p4'];
    const offers = products.flatMap((p, i) =>
      suppliers.map((s, j) =>
        offer({ productId: p, supplierId: s, price: 1000 + ((i * 7 + j * 13) % 11) * 100, deliveryCost: D(5000) }),
      ),
    );
    const items = products.map((p) => item(p, 10));
    const r = run(items, offers, { maxEvaluations: 300 });
    expect(r.status).toBe('FEASIBLE_LIMIT_REACHED');
    assertInvariants(r, items, offers);
  });

  it('matches brute force on a randomized small instance', () => {
    let s = 42;
    const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let trial = 0; trial < 25; trial++) {
      const suppliers = ['A', 'B', 'C', 'D'];
      const products = ['p1', 'p2', 'p3'];
      const offers: OptimizerOffer[] = [];
      for (const p of products)
        for (const sup of suppliers)
          if (rnd() < 0.75)
            offers.push(
              offer({
                productId: p,
                supplierId: sup,
                price: 100 + Math.floor(rnd() * 50) * 10,
                minOrderQuantity: D(Math.floor(rnd() * 3) * 5),
                availableQuantity: D(5 + Math.floor(rnd() * 4) * 5),
                deliveryCost: D(Math.floor(rnd() * 5) * 500),
              }),
            );
      const items = products.map((p) => item(p, 5 + Math.floor(rnd() * 3) * 5));
      const r = run(items, offers);
      const bf = bruteForce(items, offers);
      const m = scenario(r, 'MULTI');
      if (bf === null) expect(m.feasible).toBe(false);
      else expect(m.totalCost!.toNumber()).toBe(bf);
      assertInvariants(r, items, offers);
    }
  });
});

/** Integer brute force over every x_ij in steps of 5 (all test quantities are multiples of 5). */
function bruteForce(items: OptimizerItem[], offers: OptimizerOffer[]): number | null {
  let best: number | null = null;
  const perProduct = items.map((it) => offers.filter((o) => o.productId === it.productId));
  const rec = (i: number, alloc: Map<string, number>) => {
    if (i === items.length) {
      let cost = 0;
      const used = new Map<string, number>();
      for (const [offerId, q] of alloc) {
        if (q === 0) continue;
        const o = offers.find((x) => x.offerId === offerId)!;
        cost += o.price.toNumber() * q;
        used.set(o.supplierId, Math.max(used.get(o.supplierId) ?? 0, 0));
      }
      // delivery = max fee among supplier's offers that appear in the basket (same rule as optimizer)
      for (const sup of used.keys()) {
        const fees = offers
          .filter((o) => o.supplierId === sup && items.some((it) => it.productId === o.productId))
          .map((o) => o.deliveryCost.toNumber());
        cost += Math.max(...fees);
      }
      if (best === null || cost < best) best = cost;
      return;
    }
    const list = perProduct[i];
    const q = items[i].quantity.toNumber();
    const split = (k: number, left: number) => {
      if (k === list.length) {
        if (left === 0) rec(i + 1, alloc);
        return;
      }
      const o = list[k];
      for (let x = 0; x <= Math.min(left, o.availableQuantity.toNumber()); x += 5) {
        if (x > 0 && x < o.minOrderQuantity.toNumber()) continue;
        alloc.set(o.offerId, x);
        split(k + 1, left - x);
      }
      alloc.delete(o.offerId);
    };
    split(0, q);
  };
  rec(0, new Map());
  return best;
}
