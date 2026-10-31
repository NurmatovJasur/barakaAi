import type { PrismaClient } from '@prisma/client';
import { CATEGORY_LABELS, type AnalyticsOverviewDto, type CategorySlug, type DashboardStatsDto, type SavingsAnalyticsDto } from '@smp/shared';
import { usableOfferWhere } from '../repositories/offer.repository';
import { D, money } from '../utils/decimal';
import type { PriceIntelligenceService } from './priceIntelligence.service';

export class DashboardService {
  constructor(
    private readonly db: PrismaClient,
    private readonly prices: PriceIntelligenceService,
  ) {}

  async stats(userId: string): Promise<DashboardStatsDto> {
    const active = { userId, status: { not: 'CANCELLED' as const } };
    const [sum, savings, purchases, suppliers, offers, products, demo] = await Promise.all([
      this.db.purchase.aggregate({ where: active, _sum: { totalCost: true } }),
      this.db.purchase.aggregate({ where: active, _sum: { estimatedSavings: true } }),
      this.db.purchase.count({ where: { userId } }),
      this.db.supplier.count({ where: { isActive: true } }),
      this.db.supplierOffer.count({ where: usableOfferWhere() }),
      this.db.product.count({ where: { isActive: true, offers: { some: usableOfferWhere() } } }),
      this.db.supplier.count({ where: { isDemo: true } }),
    ]);
    return {
      totalProcurementValue: money(D(sum._sum.totalCost ?? 0)),
      availableSuppliers: suppliers,
      availableProducts: products,
      estimatedSavings: money(D(savings._sum.estimatedSavings ?? 0)),
      totalPurchases: purchases,
      activeOffers: offers,
      isDemoData: demo > 0,
    };
  }

  async overview(userId: string): Promise<AnalyticsOverviewDto> {
    const [byMonth, bySupplier, byCategory, index, demo] = await Promise.all([
      this.db.$queryRaw<{ month: string; total: string }[]>`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month, SUM("totalCost")::text AS total
        FROM "Purchase" WHERE "userId" = ${userId}::uuid AND status <> 'CANCELLED'
        GROUP BY 1 ORDER BY 1`,
      this.db.$queryRaw<{ supplierId: string; supplierName: string; total: string }[]>`
        SELECT s.id AS "supplierId", s."companyName" AS "supplierName", SUM(i."totalPrice")::text AS total
        FROM "PurchaseItem" i JOIN "Purchase" p ON p.id = i."purchaseId" JOIN "Supplier" s ON s.id = i."supplierId"
        WHERE p."userId" = ${userId}::uuid AND p.status <> 'CANCELLED'
        GROUP BY s.id ORDER BY SUM(i."totalPrice") DESC`,
      this.db.$queryRaw<{ slug: CategorySlug; total: string }[]>`
        SELECT c.slug, SUM(i."totalPrice")::text AS total
        FROM "PurchaseItem" i JOIN "Purchase" p ON p.id = i."purchaseId"
        JOIN "Product" pr ON pr.id = i."productId" JOIN "ProductCategory" c ON c.id = pr."categoryId"
        WHERE p."userId" = ${userId}::uuid AND p.status <> 'CANCELLED'
        GROUP BY c.slug ORDER BY SUM(i."totalPrice") DESC`,
      this.prices.priceIndex(30),
      this.db.supplier.count({ where: { isDemo: true } }),
    ]);
    return {
      spendingByMonth: byMonth.map((r) => ({ month: r.month, total: money(D(r.total)) })),
      spendingBySupplier: bySupplier.map((r) => ({ ...r, total: money(D(r.total)) })),
      spendingByCategory: byCategory.map((r) => ({
        category: CATEGORY_LABELS[r.slug] ?? r.slug,
        total: money(D(r.total)),
      })),
      priceIndex: index,
      isDemo: demo > 0,
    };
  }

  async savings(userId: string): Promise<SavingsAnalyticsDto> {
    const rows = await this.db.purchase.findMany({
      where: { userId, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true, estimatedSavings: true, totalCost: true },
    });
    const withBaseline = rows.filter((r) => r.estimatedSavings != null);
    return {
      totalEstimatedSavings: money(withBaseline.reduce((a, r) => a.plus(D(r.estimatedSavings!)), D(0))),
      purchasesWithBaseline: withBaseline.length,
      purchasesWithoutBaseline: rows.length - withBaseline.length,
      byPurchase: withBaseline.map((r) => ({
        purchaseId: r.id,
        createdAt: r.createdAt.toISOString(),
        savings: money(D(r.estimatedSavings!)),
        totalCost: money(D(r.totalCost)),
      })),
      disclaimer:
        'Экономия расчётная: разница между лучшей закупкой у одного поставщика и сохранённым планом. ' +
        'Она не подтверждена реальными транзакциями.',
    };
  }
}
