/**
 * Smart Basket Optimizer — exact enumeration for the MVP catalog size.
 *
 * Model (see docs/OPTIMIZER.md):
 *   min Σ p_ij·x_ij + Σ d_j·y_j
 *   s.t. Σ_j x_ij = q_i,  0 ≤ x_ij ≤ a_ij·y_j,  x_ij = 0 ∨ x_ij ≥ m_ij,  y_j ∈ {0,1}
 *
 * Strategy:
 *   1. Filter offers that may not be used (expired, stale, wrong zone, ...).
 *   2. For every product enumerate non-empty sets of "active" offers. With the active set fixed the
 *      problem is a box-constrained LP: give each offer its MOQ, then fill the remainder cheapest-first.
 *      This is exact.
 *   3. Enumerate supplier subsets S. For each product take the cheapest active set whose suppliers ⊆ S.
 *      Delivery is charged once per supplier that actually receives an allocation.
 *   4. Scenarios are the best S under |S| = 1, unrestricted, ≤ 2, ≤ 3.
 *
 * The module is pure: no database, no HTTP.
 */
import Decimal from 'decimal.js';
import type { OptimizationStatus, ScenarioKind, Unit } from '@smp/shared';
import {
  checkOffer,
  rejectionMessage,
  type EligibilityContext,
  type OptimizerOffer,
} from './offerEligibility';
import type { FreshnessPolicy } from '../utils/freshness';

export interface OptimizerItem {
  productId: string;
  productName: string;
  quantity: Decimal;
  unit: Unit;
}

export interface OptimizerInput {
  items: OptimizerItem[];
  offers: OptimizerOffer[];
  deliveryDistrict: string | null;
  now: Date;
  freshness: FreshnessPolicy;
  currency?: string;
  maxEvaluations?: number;
  /** Upper bound on offers considered per product (cheapest kept). */
  maxOffersPerProduct?: number;
}

export interface Allocation {
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  offerId: string;
  unit: Unit;
  quantity: Decimal;
  unitPrice: Decimal;
  totalPrice: Decimal;
}

export interface ScenarioResult {
  kind: ScenarioKind;
  feasible: boolean;
  productsCost: Decimal | null;
  deliveryCost: Decimal | null;
  totalCost: Decimal | null;
  supplierIds: string[];
  supplierCount: number;
  allocations: Allocation[];
  deliveryBySupplier: Record<string, Decimal>;
  baselineCost: Decimal | null;
  savings: Decimal | null;
  message: string | null;
}

export interface OptimizerWarning {
  code: string;
  message: string;
  productId?: string;
  supplierId?: string;
  offerId?: string;
}

export interface OptimizerResult {
  status: OptimizationStatus;
  scenarios: ScenarioResult[];
  recommended: ScenarioKind | null;
  baselineCost: Decimal | null;
  warnings: OptimizerWarning[];
  evaluations: number;
}

export class OptimizerInputError extends Error {}

interface ProductOption {
  supplierMask: number;
  cost: Decimal;
  allocations: Allocation[];
  offerCount: number;
}

const ZERO = new Decimal(0);

/** Exact allocation for a fixed set of active offers, or null if infeasible. */
export function allocateActiveSet(
  item: OptimizerItem,
  active: OptimizerOffer[],
): { cost: Decimal; allocations: Allocation[] } | null {
  const sumMin = active.reduce((s, o) => s.plus(o.minOrderQuantity), ZERO);
  const sumAvail = active.reduce((s, o) => s.plus(o.availableQuantity), ZERO);
  if (sumMin.gt(item.quantity) || sumAvail.lt(item.quantity)) return null;

  const qtys = new Map<string, Decimal>(active.map((o) => [o.offerId, o.minOrderQuantity]));
  let remainder = item.quantity.minus(sumMin);
  const byPrice = [...active].sort(
    (a, b) => a.price.comparedTo(b.price) || a.offerId.localeCompare(b.offerId),
  );
  for (const o of byPrice) {
    if (remainder.lte(0)) break;
    const room = o.availableQuantity.minus(o.minOrderQuantity);
    const take = Decimal.min(room, remainder);
    qtys.set(o.offerId, qtys.get(o.offerId)!.plus(take));
    remainder = remainder.minus(take);
  }
  if (remainder.gt(0)) return null;

  const allocations: Allocation[] = active.map((o) => {
    const quantity = qtys.get(o.offerId)!;
    return {
      productId: item.productId,
      productName: item.productName,
      supplierId: o.supplierId,
      supplierName: o.supplierName,
      offerId: o.offerId,
      unit: o.unit,
      quantity,
      unitPrice: o.price,
      totalPrice: o.price.times(quantity),
    };
  });
  const cost = allocations.reduce((s, a) => s.plus(a.totalPrice), ZERO);
  return { cost, allocations };
}

function popcount(n: number) {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
}

const SCENARIO_LIMITS: { kind: ScenarioKind; max: number }[] = [
  { kind: 'SINGLE', max: 1 },
  { kind: 'MULTI', max: Infinity },
  { kind: 'BALANCED_2', max: 2 },
  { kind: 'BALANCED_3', max: 3 },
];

export function optimizeBasket(input: OptimizerInput): OptimizerResult {
  const currency = input.currency ?? 'UZS';
  const maxEvaluations = input.maxEvaluations ?? 200_000;
  const maxOffersPerProduct = input.maxOffersPerProduct ?? 10;
  const warnings: OptimizerWarning[] = [];
  let limitReached = false;

  if (input.items.length === 0) throw new OptimizerInputError('Корзина пуста');
  const seen = new Set<string>();
  for (const item of input.items) {
    if (!item.quantity.isFinite() || item.quantity.lte(0)) {
      throw new OptimizerInputError(`Количество для «${item.productName}» должно быть больше нуля`);
    }
    if (seen.has(item.productId)) {
      throw new OptimizerInputError(`Товар «${item.productName}» указан в корзине дважды`);
    }
    seen.add(item.productId);
  }

  if (!input.deliveryDistrict) {
    warnings.push({
      code: 'DISTRICT_UNKNOWN',
      message: 'Район доставки не указан — зоны доставки не проверялись.',
    });
  }

  // 1. Eligibility per product
  const eligibleByProduct = new Map<string, OptimizerOffer[]>();
  for (const item of input.items) {
    const ctx: EligibilityContext = {
      now: input.now,
      freshness: input.freshness,
      deliveryDistrict: input.deliveryDistrict,
      requiredUnit: item.unit,
      currency,
    };
    const offers = input.offers.filter((o) => o.productId === item.productId);
    const ok: OptimizerOffer[] = [];
    for (const o of offers) {
      const reason = checkOffer(o, ctx);
      if (reason) {
        warnings.push({
          code: `OFFER_EXCLUDED_${reason}`,
          message: `${item.productName} у ${o.supplierName} исключено: ${rejectionMessage(reason)}.`,
          productId: item.productId,
          supplierId: o.supplierId,
          offerId: o.offerId,
        });
      } else {
        ok.push(o);
      }
    }
    // One offer per supplier per product (unique constraint in DB); keep the cheapest defensively.
    const perSupplier = new Map<string, OptimizerOffer>();
    for (const o of ok) {
      const prev = perSupplier.get(o.supplierId);
      if (!prev || o.price.lt(prev.price)) perSupplier.set(o.supplierId, o);
    }
    let list = [...perSupplier.values()].sort((a, b) => a.price.comparedTo(b.price));
    if (list.length > maxOffersPerProduct) {
      limitReached = true;
      warnings.push({
        code: 'OFFER_LIMIT',
        message: `${item.productName}: рассмотрены только ${maxOffersPerProduct} самых дешёвых предложений.`,
        productId: item.productId,
      });
      list = list.slice(0, maxOffersPerProduct);
    }
    if (list.length === 0) {
      warnings.push({
        code: 'NO_ELIGIBLE_OFFERS',
        message: `${item.productName}: нет допустимых предложений.`,
        productId: item.productId,
      });
    } else {
      const totalAvail = list.reduce((s, o) => s.plus(o.availableQuantity), ZERO);
      if (totalAvail.lt(item.quantity)) {
        warnings.push({
          code: 'INSUFFICIENT_QUANTITY',
          message: `${item.productName}: доступно всего ${totalAvail.toString()} ${item.unit}, требуется ${item.quantity.toString()}.`,
          productId: item.productId,
        });
      }
    }
    eligibleByProduct.set(item.productId, list);
  }

  // Supplier index
  const supplierIds = [
    ...new Set([...eligibleByProduct.values()].flat().map((o) => o.supplierId)),
  ].sort();
  const supplierIndex = new Map(supplierIds.map((id, i) => [id, i]));
  const supplierDelivery = new Map<string, Decimal>();
  for (const o of [...eligibleByProduct.values()].flat()) {
    // Supplier delivery fee = highest fee among its eligible offers in this basket (conservative).
    const prev = supplierDelivery.get(o.supplierId) ?? ZERO;
    supplierDelivery.set(o.supplierId, Decimal.max(prev, o.deliveryCost));
  }

  if (supplierIds.length > 20) {
    throw new OptimizerInputError('Слишком много поставщиков для точного перебора');
  }

  // 2. Product options (all feasible active sets)
  let evaluations = 0;
  const optionsByProduct: ProductOption[][] = [];
  for (const item of input.items) {
    const list = eligibleByProduct.get(item.productId)!;
    const options: ProductOption[] = [];
    const n = list.length;
    for (let m = 1; m < 1 << n; m++) {
      evaluations++;
      const active = list.filter((_, k) => m & (1 << k));
      const res = allocateActiveSet(item, active);
      if (!res) continue;
      const supplierMask = active.reduce((s, o) => s | (1 << supplierIndex.get(o.supplierId)!), 0);
      options.push({ supplierMask, cost: res.cost, allocations: res.allocations, offerCount: n });
    }
    options.sort((a, b) => a.cost.comparedTo(b.cost) || popcount(a.supplierMask) - popcount(b.supplierMask));
    optionsByProduct.push(options);
  }

  // 3. Supplier subsets
  type Candidate = {
    usedMask: number;
    productsCost: Decimal;
    deliveryCost: Decimal;
    total: Decimal;
    choice: ProductOption[];
  };
  const best = new Map<ScenarioKind, Candidate>();
  const anyInfeasibleProduct = optionsByProduct.some((o) => o.length === 0);

  if (!anyInfeasibleProduct && supplierIds.length > 0) {
    const S = supplierIds.length;
    const masks: number[] = [];
    for (let m = 1; m < 1 << S; m++) masks.push(m);
    // Smaller subsets first so the budget favours simpler logistics when it runs out.
    masks.sort((a, b) => popcount(a) - popcount(b) || a - b);

    for (const mask of masks) {
      if (evaluations >= maxEvaluations) {
        limitReached = true;
        break;
      }
      const choice: ProductOption[] = [];
      let feasible = true;
      for (const options of optionsByProduct) {
        evaluations++;
        // options are sorted by cost, first fitting one is the cheapest
        const opt = options.find((o) => (o.supplierMask & ~mask) === 0);
        if (!opt) {
          feasible = false;
          break;
        }
        choice.push(opt);
      }
      if (!feasible) continue;

      const usedMask = choice.reduce((s, o) => s | o.supplierMask, 0);
      const productsCost = choice.reduce((s, o) => s.plus(o.cost), ZERO);
      let deliveryCost = ZERO;
      for (let j = 0; j < S; j++) {
        if (usedMask & (1 << j)) deliveryCost = deliveryCost.plus(supplierDelivery.get(supplierIds[j])!);
      }
      const total = productsCost.plus(deliveryCost);
      const count = popcount(usedMask);

      for (const { kind, max } of SCENARIO_LIMITS) {
        if (count > max) continue;
        const cur = best.get(kind);
        if (
          !cur ||
          total.lt(cur.total) ||
          (total.eq(cur.total) && count < popcount(cur.usedMask))
        ) {
          best.set(kind, { usedMask, productsCost, deliveryCost, total, choice });
        }
      }
    }
  }

  // 4. Build scenarios
  const baseline = best.get('SINGLE')?.total ?? null;
  const scenarios: ScenarioResult[] = SCENARIO_LIMITS.map(({ kind, max }) => {
    const c = best.get(kind);
    if (!c) {
      return {
        kind,
        feasible: false,
        productsCost: null,
        deliveryCost: null,
        totalCost: null,
        supplierIds: [],
        supplierCount: 0,
        allocations: [],
        deliveryBySupplier: {},
        baselineCost: baseline,
        savings: null,
        message:
          kind === 'SINGLE'
            ? 'Ни один поставщик не может выполнить весь заказ целиком.'
            : max === Infinity
              ? 'Не найдено допустимой комбинации поставщиков для всей корзины.'
              : `Невозможно выполнить заказ, используя не более ${max} поставщиков.`,
      };
    }
    const used = supplierIds.filter((_, j) => c.usedMask & (1 << j));
    const deliveryBySupplier: Record<string, Decimal> = {};
    for (const id of used) deliveryBySupplier[id] = supplierDelivery.get(id)!;
    return {
      kind,
      feasible: true,
      productsCost: c.productsCost,
      deliveryCost: c.deliveryCost,
      totalCost: c.total,
      supplierIds: used,
      supplierCount: used.length,
      allocations: c.choice.flatMap((o) => o.allocations),
      deliveryBySupplier,
      baselineCost: baseline,
      savings: baseline ? baseline.minus(c.total) : null,
      message: null,
    };
  });

  const feasible = scenarios.filter((s) => s.feasible);
  // Same cost and supplier count → prefer the scenario with the tighter supplier limit.
  const preference: ScenarioKind[] = ['SINGLE', 'BALANCED_2', 'BALANCED_3', 'MULTI'];
  feasible.sort(
    (a, b) =>
      a.totalCost!.comparedTo(b.totalCost!) ||
      a.supplierCount - b.supplierCount ||
      preference.indexOf(a.kind) - preference.indexOf(b.kind),
  );
  const recommended = feasible[0]?.kind ?? null;

  const status: OptimizationStatus = !best.has('MULTI')
    ? 'INFEASIBLE'
    : limitReached
      ? 'FEASIBLE_LIMIT_REACHED'
      : 'OPTIMAL';

  if (status === 'FEASIBLE_LIMIT_REACHED') {
    warnings.push({
      code: 'COMPUTE_LIMIT',
      message:
        'Достигнут лимит вычислений: найден допустимый план, но его оптимальность не подтверждена.',
    });
  }
  if (!baseline && status !== 'INFEASIBLE') {
    warnings.push({
      code: 'NO_BASELINE',
      message: 'Нет поставщика, способного выполнить заказ целиком, — экономия не рассчитывается.',
    });
  }

  return { status, scenarios, recommended, baselineCost: baseline, warnings, evaluations };
}
