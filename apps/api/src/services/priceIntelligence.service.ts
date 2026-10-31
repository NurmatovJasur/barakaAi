import type { PrismaClient } from '@prisma/client';
import {
  productLabel,
  type PriceChangeDto,
  type ProductPriceAnalyticsDto,
  type PriceSeriesDto,
} from '@smp/shared';
import { D, money } from '../utils/decimal';
import { notFound } from '../utils/errors';

const DAY = 86_400_000;

export class PriceIntelligenceService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Price series per offer. Each series is bound to one product + supplier + unit + currency,
   * so incomparable offers are never merged.
   */
  async forProduct(productId: string, rangeDays: number): Promise<ProductPriceAnalyticsDto> {
    const product = await this.db.product.findUnique({ where: { id: productId } });
    if (!product) throw notFound('Товар');
    const since = new Date(Date.now() - rangeDays * DAY);
    const offers = await this.db.supplierOffer.findMany({
      where: { productId },
      include: {
        supplier: { select: { companyName: true } },
        priceHistory: { where: { recordedAt: { gte: since } }, orderBy: { recordedAt: 'asc' } },
      },
      orderBy: { price: 'asc' },
    });

    const series: PriceSeriesDto[] = offers.map((o) => {
      const pts = o.priceHistory.map((h) => ({ date: h.recordedAt.toISOString(), price: D(h.price) }));
      const values = pts.length ? pts.map((p) => p.price) : [D(o.price)];
      const sum = values.reduce((a, b) => a.plus(b), D(0));
      const first = values[0];
      const current = D(o.price);
      return {
        offerId: o.id,
        supplierId: o.supplierId,
        supplierName: o.supplier.companyName,
        unit: o.unit,
        currency: o.currency,
        current: money(current),
        min: money(values.reduce((a, b) => (b.lt(a) ? b : a))),
        max: money(values.reduce((a, b) => (b.gt(a) ? b : a))),
        avg: money(sum.div(values.length)),
        changePercent: first.gt(0) ? current.minus(first).div(first).times(100).toDecimalPlaces(1).toNumber() : null,
        lastUpdated: o.lastUpdated.toISOString(),
        points: pts.map((p) => ({ date: p.date, price: money(p.price) })),
      };
    });

    return {
      productId,
      productName: productLabel(product.name),
      range: rangeDays,
      series,
      isDemo: offers.some((o) => o.isDemo),
    };
  }

  /** Latest change per offer (last two history points), largest absolute change first. */
  async latestChanges(limit = 10, direction?: 'up' | 'down'): Promise<PriceChangeDto[]> {
    const rows = await this.db.$queryRaw<
      {
        offerId: string;
        productId: string;
        productName: string;
        supplierId: string;
        supplierName: string;
        unit: string;
        currency: string;
        cur: string;
        prev: string;
        changedAt: Date;
      }[]
    >`
      WITH ranked AS (
        SELECT h."offerId", h.price, h."recordedAt",
               ROW_NUMBER() OVER (PARTITION BY h."offerId" ORDER BY h."recordedAt" DESC) rn
        FROM "PriceHistory" h
        WHERE h."recordedAt" > NOW() - INTERVAL '14 days'
      )
      SELECT o.id AS "offerId", p.id AS "productId", p.name AS "productName",
             s.id AS "supplierId", s."companyName" AS "supplierName",
             o.unit::text AS unit, o.currency,
             c.price::text AS cur, pr.price::text AS prev, c."recordedAt" AS "changedAt"
      FROM ranked c
      JOIN ranked pr ON pr."offerId" = c."offerId" AND pr.rn = 2
      JOIN "SupplierOffer" o ON o.id = c."offerId"
      JOIN "Product" p ON p.id = o."productId"
      JOIN "Supplier" s ON s.id = o."supplierId"
      WHERE c.rn = 1 AND c.price <> pr.price AND o."dataQualityStatus" <> 'INVALID'`;

    return rows
      .map((r) => {
        const cur = D(r.cur);
        const prev = D(r.prev);
        return {
          productId: r.productId,
          productName: productLabel(r.productName),
          supplierId: r.supplierId,
          supplierName: r.supplierName,
          unit: r.unit as PriceChangeDto['unit'],
          currency: r.currency,
          previousPrice: money(prev),
          currentPrice: money(cur),
          changePercent: cur.minus(prev).div(prev).times(100).toDecimalPlaces(1).toNumber(),
          changedAt: r.changedAt.toISOString(),
        };
      })
      .filter((c) => (direction === 'up' ? c.changePercent > 0 : direction === 'down' ? c.changePercent < 0 : true))
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, limit);
  }

  /** Change of each offer over `days` days (current vs first point in window). */
  async periodChanges(days: number) {
    const since = new Date(Date.now() - days * DAY);
    const offers = await this.db.supplierOffer.findMany({
      include: {
        product: { select: { name: true } },
        supplier: { select: { companyName: true } },
        priceHistory: { where: { recordedAt: { gte: since } }, orderBy: { recordedAt: 'asc' }, take: 1 },
      },
    });
    return offers
      .filter((o) => o.priceHistory[0])
      .map((o) => {
        const first = D(o.priceHistory[0].price);
        const cur = D(o.price);
        return {
          productId: o.productId,
          productName: productLabel(o.product.name),
          supplierName: o.supplier.companyName,
          unit: o.unit,
          from: first,
          to: cur,
          changePercent: cur.minus(first).div(first).times(100).toDecimalPlaces(1).toNumber(),
        };
      });
  }

  /** Average normalized price index (100 = first day in window) across all offers. */
  async priceIndex(days: number) {
    const since = new Date(Date.now() - days * DAY);
    const rows = await this.db.$queryRaw<{ day: Date; idx: number }[]>`
      WITH base AS (
        SELECT DISTINCT ON ("offerId") "offerId", price AS p0
        FROM "PriceHistory" WHERE "recordedAt" >= ${since}
        ORDER BY "offerId", "recordedAt" ASC
      )
      SELECT date_trunc('day', h."recordedAt") AS day, AVG(h.price / b.p0 * 100)::float8 AS idx
      FROM "PriceHistory" h JOIN base b ON b."offerId" = h."offerId"
      WHERE h."recordedAt" >= ${since}
      GROUP BY 1 ORDER BY 1`;
    return rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), index: Math.round(r.idx * 10) / 10 }));
  }
}
