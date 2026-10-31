import type { Prisma, PrismaClient } from '@prisma/client';
import {
  productLabel,
  type OptimizationRunDto,
  type OptimizerRequest,
  type ScenarioKind,
  type ScenarioResultDto,
  type SupplierGroupDto,
} from '@smp/shared';
import { env, freshnessPolicy } from '../config/env';
import { optimizeBasket, type OptimizerResult, type ScenarioResult } from '../algorithms/optimizer';
import type { OfferRepository } from '../repositories/offer.repository';
import { D, money, moneyOrNull, qty, Decimal } from '../utils/decimal';
import { badRequest, notFound } from '../utils/errors';
import { toOptimizerOffer } from './supplierOffer.service';

export const SCENARIO_TITLES: Record<ScenarioKind, string> = {
  SINGLE: 'Один поставщик',
  MULTI: 'Несколько поставщиков',
  BALANCED_2: 'Не более 2 поставщиков',
  BALANCED_3: 'Не более 3 поставщиков',
};

const fmt = (v: Decimal) =>
  v.toDecimalPlaces(0).toNumber().toLocaleString('ru-RU').replace(/\s/g, ' ') + ' UZS';

function scenarioDto(
  s: ScenarioResult,
  status: OptimizerResult['status'],
  days: Map<string, number>,
): ScenarioResultDto {
  const groups = new Map<string, SupplierGroupDto>();
  for (const a of s.allocations) {
    let g = groups.get(a.supplierId);
    if (!g) {
      g = {
        supplierId: a.supplierId,
        supplierName: a.supplierName,
        deliveryCost: money(s.deliveryBySupplier[a.supplierId] ?? D(0)),
        productsCost: '0',
        estimatedDeliveryDays: 0,
        allocations: [],
      };
      groups.set(a.supplierId, g);
    }
    g.allocations.push({
      productId: a.productId,
      productName: a.productName,
      supplierId: a.supplierId,
      supplierName: a.supplierName,
      offerId: a.offerId,
      unit: a.unit,
      quantity: qty(a.quantity),
      unitPrice: money(a.unitPrice),
      totalPrice: money(a.totalPrice),
    });
    g.estimatedDeliveryDays = Math.max(g.estimatedDeliveryDays, days.get(a.offerId) ?? 0);
  }
  for (const g of groups.values()) {
    g.productsCost = money(g.allocations.reduce((acc, a) => acc.plus(D(a.totalPrice)), D(0)));
  }
  return {
    kind: s.kind,
    title: SCENARIO_TITLES[s.kind],
    optimizationStatus: s.feasible ? (status === 'INFEASIBLE' ? 'OPTIMAL' : status) : 'INFEASIBLE',
    feasible: s.feasible,
    productsCost: moneyOrNull(s.productsCost),
    deliveryCost: moneyOrNull(s.deliveryCost),
    totalCost: moneyOrNull(s.totalCost),
    supplierCount: s.supplierCount,
    allocations: [...groups.values()].flatMap((g) => g.allocations),
    suppliers: [...groups.values()],
    baselineCost: moneyOrNull(s.baselineCost),
    savings: moneyOrNull(s.savings),
    message: s.message,
  };
}

/** Rule-based, fact-only explanation of the recommendation. */
export function explain(result: OptimizerResult): string[] {
  const lines: string[] = [];
  if (!result.recommended) {
    lines.push('Допустимый план закупки не найден. Причины перечислены в предупреждениях ниже.');
    return lines;
  }
  const rec = result.scenarios.find((s) => s.kind === result.recommended)!;
  lines.push(
    `Рекомендован сценарий «${SCENARIO_TITLES[rec.kind]}»: итого ${fmt(rec.totalCost!)} ` +
      `(товары ${fmt(rec.productsCost!)}, доставка ${fmt(rec.deliveryCost!)}, поставщиков: ${rec.supplierCount}).`,
  );
  if (result.baselineCost && rec.savings) {
    if (rec.savings.gt(0)) {
      lines.push(
        `Это на ${fmt(rec.savings)} дешевле лучшей закупки у одного поставщика (${fmt(result.baselineCost)}). ` +
          'Экономия расчётная и не подтверждена реальными сделками.',
      );
    } else if (rec.savings.eq(0)) {
      lines.push('Разделение заказа не даёт выгоды: дешевле всего купить всё у одного поставщика.');
    }
  } else {
    lines.push('Ни один поставщик не может выполнить заказ целиком, поэтому экономию не с чем сравнить.');
  }
  const multi = result.scenarios.find((s) => s.kind === 'MULTI');
  if (multi?.feasible && rec.kind !== 'MULTI' && multi.supplierCount > rec.supplierCount) {
    lines.push(
      `Добавление поставщиков не снижает итоговую стоимость с учётом доставки — выбран вариант проще в логистике.`,
    );
  }
  lines.push('Доставка учитывается один раз для каждого выбранного поставщика.');
  const excluded = result.warnings.filter((w) => w.code.startsWith('OFFER_EXCLUDED_')).length;
  if (excluded) lines.push(`Исключено предложений: ${excluded} (устаревшие, без доставки в ваш район и т.п.).`);
  return lines;
}

export class OptimizerService {
  constructor(
    private readonly db: PrismaClient,
    private readonly offers: OfferRepository,
  ) {}

  async calculate(userId: string, req: OptimizerRequest): Promise<OptimizationRunDto> {
    const productIds = req.items.map((i) => i.productId);
    const [products, user, offers] = await Promise.all([
      this.db.product.findMany({ where: { id: { in: productIds } } }),
      this.db.user.findUnique({ where: { id: userId }, include: { business: true } }),
      this.offers.forProducts(productIds),
    ]);
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const i of req.items) {
      const p = byId.get(i.productId);
      if (!p) throw notFound('Товар');
      if (!p.isActive) throw badRequest(`Товар «${productLabel(p.name)}» недоступен`);
      if (p.unit !== i.unit) throw badRequest(`Неверная единица измерения для «${productLabel(p.name)}»`);
    }
    const district = req.deliveryDistrict ?? user?.business?.district ?? null;
    const items = req.items.map((i) => ({
      productId: i.productId,
      productName: productLabel(byId.get(i.productId)!.name),
      quantity: new Decimal(i.quantity),
      unit: i.unit,
    }));

    const result = optimizeBasket({
      items,
      offers: offers.map(toOptimizerOffer),
      deliveryDistrict: district,
      now: new Date(),
      freshness: freshnessPolicy,
      maxEvaluations: env.OPTIMIZER_MAX_EVALUATIONS,
    });

    const days = new Map(offers.map((o) => [o.id, o.estimatedDeliveryDays]));
    const body: Omit<OptimizationRunDto, 'id' | 'createdAt' | 'savedPurchaseId'> = {
      deliveryDistrict: district,
      optimizationStatus: result.status,
      recommended: result.recommended,
      explanation: explain(result),
      scenarios: result.scenarios.map((s) => scenarioDto(s, result.status, days)),
      warnings: result.warnings,
      evaluations: result.evaluations,
      items: items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantity: qty(i.quantity),
        unit: i.unit,
      })),
    };

    const run = await this.db.optimizationRun.create({
      data: {
        userId,
        deliveryDistrict: district,
        request: req as unknown as Prisma.InputJsonValue,
        result: body as unknown as Prisma.InputJsonValue,
        status: result.status,
        recommended: result.recommended,
        evaluations: result.evaluations,
        allocations: {
          create: result.scenarios.flatMap((s) =>
            s.allocations.map((a) => ({
              scenario: s.kind,
              productId: a.productId,
              supplierId: a.supplierId,
              offerId: a.offerId,
              unit: a.unit,
              quantity: a.quantity.toString(),
              unitPrice: a.unitPrice.toString(),
              totalPrice: a.totalPrice.toDecimalPlaces(2).toString(),
            })),
          ),
        },
      },
    });
    return { id: run.id, createdAt: run.createdAt.toISOString(), savedPurchaseId: null, ...body };
  }

  async get(userId: string, id: string): Promise<OptimizationRunDto> {
    const run = await this.db.optimizationRun.findFirst({
      where: { id, userId },
      include: { purchase: { select: { id: true } } },
    });
    if (!run) throw notFound('Расчёт');
    const body = run.result as unknown as Omit<OptimizationRunDto, 'id' | 'createdAt' | 'savedPurchaseId'>;
    return {
      id: run.id,
      createdAt: run.createdAt.toISOString(),
      savedPurchaseId: run.purchase?.id ?? null,
      ...body,
    };
  }

  async latest(userId: string): Promise<OptimizationRunDto | null> {
    const run = await this.db.optimizationRun.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return run ? this.get(userId, run.id) : null;
  }
}
