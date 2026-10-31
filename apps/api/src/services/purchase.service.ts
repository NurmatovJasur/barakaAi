import type { Prisma, PrismaClient, PurchaseStatus } from '@prisma/client';
import {
  PURCHASE_TRANSITIONS,
  productLabel,
  type BasketItemInput,
  type CreatePurchaseInput,
  type Paginated,
  type PurchaseDto,
} from '@smp/shared';
import { D, money, qty } from '../utils/decimal';
import { badRequest, conflict, notFound } from '../utils/errors';
import { paginated } from '../utils/http';

const detailInclude = {
  items: {
    include: {
      product: { select: { name: true } },
      supplier: {
        select: { id: true, companyName: true, phone: true, telegramUsername: true, email: true },
      },
    },
  },
} satisfies Prisma.PurchaseInclude;

type PurchaseWithItems = Prisma.PurchaseGetPayload<{ include: typeof detailInclude }>;

function toDto(p: PurchaseWithItems, withItems: boolean): PurchaseDto {
  const suppliers = new Map(p.items.map((i) => [i.supplier.id, i.supplier]));
  return {
    id: p.id,
    status: p.status,
    scenario: p.scenario,
    productsCost: money(D(p.productsCost)),
    deliveryCost: money(D(p.deliveryCost)),
    totalCost: money(D(p.totalCost)),
    estimatedSavings: p.estimatedSavings ? money(D(p.estimatedSavings)) : null,
    note: p.note,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    supplierCount: suppliers.size,
    itemCount: p.items.length,
    ...(withItems && {
      items: p.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: productLabel(i.product.name),
        supplierId: i.supplierId,
        supplierName: i.supplier.companyName,
        unit: i.unit,
        quantity: qty(D(i.quantity)),
        unitPrice: money(D(i.unitPrice)),
        totalPrice: money(D(i.totalPrice)),
      })),
      suppliers: [...suppliers.values()],
    }),
  };
}

export class PurchaseService {
  constructor(private readonly db: PrismaClient) {}

  async list(userId: string, q: { page: number; pageSize: number }): Promise<Paginated<PurchaseDto>> {
    const [rows, total] = await Promise.all([
      this.db.purchase.findMany({
        where: { userId },
        include: detailInclude,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.db.purchase.count({ where: { userId } }),
    ]);
    return paginated(rows.map((r) => toDto(r, false)), q.page, q.pageSize, total);
  }

  async get(userId: string, id: string): Promise<PurchaseDto> {
    const p = await this.db.purchase.findFirst({ where: { id, userId }, include: detailInclude });
    if (!p) throw notFound('Закупка');
    return toDto(p, true);
  }

  /** Saves a scenario of an optimization run as a purchase plan (single transaction). */
  async createFromRun(userId: string, input: CreatePurchaseInput): Promise<PurchaseDto> {
    const id = await this.db.$transaction(async (tx) => {
      const run = await tx.optimizationRun.findFirst({
        where: { id: input.optimizationRunId, userId },
        include: { purchase: { select: { id: true } }, allocations: { where: { scenario: input.scenario } } },
      });
      if (!run) throw notFound('Расчёт');
      if (run.purchase) throw conflict('Этот расчёт уже сохранён как закупка');
      if (run.allocations.length === 0) throw badRequest('Выбранный сценарий недопустим');

      const result = run.result as unknown as {
        scenarios: { kind: string; productsCost: string; deliveryCost: string; totalCost: string; baselineCost: string | null; savings: string | null }[];
      };
      const s = result.scenarios.find((x) => x.kind === input.scenario);
      if (!s || !s.totalCost) throw badRequest('Выбранный сценарий недопустим');

      // Recompute from stored allocations to make sure totals match line items.
      const productsCost = run.allocations.reduce((acc, a) => acc.plus(D(a.totalPrice)), D(0));
      if (!productsCost.toDecimalPlaces(2).eq(D(s.productsCost))) {
        throw conflict('Данные расчёта не согласованы, выполните оптимизацию повторно');
      }

      const purchase = await tx.purchase.create({
        data: {
          userId,
          status: input.status as PurchaseStatus,
          scenario: input.scenario,
          optimizationRunId: run.id,
          productsCost: s.productsCost,
          deliveryCost: s.deliveryCost,
          totalCost: s.totalCost,
          baselineCost: s.baselineCost,
          estimatedSavings: s.savings,
          note: input.note,
          items: {
            create: run.allocations.map((a) => ({
              productId: a.productId,
              supplierId: a.supplierId,
              unit: a.unit,
              quantity: a.quantity,
              unitPrice: a.unitPrice,
              totalPrice: a.totalPrice,
            })),
          },
        },
      });
      return purchase.id;
    });
    return this.get(userId, id);
  }

  async updateStatus(userId: string, id: string, status: PurchaseStatus): Promise<PurchaseDto> {
    const p = await this.db.purchase.findFirst({ where: { id, userId }, select: { status: true } });
    if (!p) throw notFound('Закупка');
    if (!PURCHASE_TRANSITIONS[p.status].includes(status)) {
      throw badRequest(`Нельзя перевести закупку из ${p.status} в ${status}`);
    }
    await this.db.purchase.update({ where: { id }, data: { status } });
    return this.get(userId, id);
  }

  /** Items of a purchase aggregated per product, for "repeat purchase". */
  async repeatItems(userId: string, id: string): Promise<BasketItemInput[]> {
    const p = await this.db.purchase.findFirst({ where: { id, userId }, include: { items: true } });
    if (!p) throw notFound('Закупка');
    const agg = new Map<string, BasketItemInput>();
    for (const i of p.items) {
      const prev = agg.get(i.productId);
      const quantity = D(i.quantity).plus(prev ? prev.quantity : 0).toNumber();
      agg.set(i.productId, { productId: i.productId, unit: i.unit, quantity });
    }
    return [...agg.values()];
  }
}

