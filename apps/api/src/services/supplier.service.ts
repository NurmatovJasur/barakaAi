import type { Prisma, PrismaClient } from '@prisma/client';
import type { Paginated, ReviewDto, SupplierDetailDto, SupplierSummaryDto } from '@smp/shared';
import { freshnessPolicy } from '../config/env';
import { usableOfferWhere } from '../repositories/offer.repository';
import { D, money } from '../utils/decimal';
import { notFound } from '../utils/errors';
import { freshnessOf } from '../utils/freshness';
import { paginated } from '../utils/http';
import { computeTrustScore } from './trustScore.service';

type SupplierRow = Prisma.SupplierGetPayload<{
  include: { _count: { select: { offers: true; reviews: true } } };
}>;

function toSummary(s: SupplierRow, usableOffers: number): SupplierSummaryDto {
  return {
    id: s.id,
    companyName: s.companyName,
    description: s.description,
    district: s.district,
    deliveryZones: s.deliveryZones,
    rating: s.rating ? D(s.rating).toFixed(2) : null,
    reviewCount: s._count.reviews,
    verificationStatus: s.verificationStatus,
    offerCount: usableOffers,
    isDemo: s.isDemo,
    isActive: s.isActive,
  };
}

export class SupplierService {
  constructor(private readonly db: PrismaClient) {}

  private async usableCounts(ids: string[]) {
    const rows = await this.db.supplierOffer.groupBy({
      by: ['supplierId'],
      where: { ...usableOfferWhere(), supplierId: { in: ids } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.supplierId, r._count._all]));
  }

  async list(q: { page: number; pageSize: number; search?: string }): Promise<Paginated<SupplierSummaryDto>> {
    const where: Prisma.SupplierWhereInput = q.search
      ? { companyName: { contains: q.search, mode: 'insensitive' } }
      : {};
    const [rows, total] = await Promise.all([
      this.db.supplier.findMany({
        where,
        include: { _count: { select: { offers: true, reviews: true } } },
        orderBy: [{ rating: { sort: 'desc', nulls: 'last' } }, { companyName: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.db.supplier.count({ where }),
    ]);
    const counts = await this.usableCounts(rows.map((r) => r.id));
    return paginated(
      rows.map((r) => toSummary(r, counts.get(r.id) ?? 0)),
      q.page,
      q.pageSize,
      total,
    );
  }

  async get(id: string, userId: string): Promise<SupplierDetailDto> {
    const s = await this.db.supplier.findUnique({
      where: { id },
      include: {
        _count: { select: { offers: true, reviews: true } },
        metrics: true,
        reviews: { select: { rating: true } },
        offers: { select: { lastUpdated: true } },
      },
    });
    if (!s) throw notFound('Поставщик');
    const counts = await this.usableCounts([id]);
    const now = new Date();
    const trust = computeTrustScore({
      metrics: s.metrics,
      ratings: s.reviews.map((r) => r.rating),
      offerFreshness: s.offers.map((o) => freshnessOf(o.lastUpdated, now, freshnessPolicy)),
    });

    // Deal history: the current user's purchases that include this supplier
    const purchases = await this.db.purchase.findMany({
      where: { userId, items: { some: { supplierId: id } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        status: true,
        items: { where: { supplierId: id }, select: { totalPrice: true } },
      },
    });

    return {
      ...toSummary(s, counts.get(id) ?? 0),
      contactPerson: s.contactPerson,
      phone: s.phone,
      email: s.email,
      telegramUsername: s.telegramUsername,
      address: s.address,
      createdAt: s.createdAt.toISOString(),
      trust,
      dealHistory: purchases.map((p) => ({
        purchaseId: p.id,
        createdAt: p.createdAt.toISOString(),
        status: p.status,
        total: money(p.items.reduce((acc, i) => acc.plus(D(i.totalPrice)), D(0))),
      })),
    };
  }

  async reviews(id: string, q: { page: number; pageSize: number }): Promise<Paginated<ReviewDto>> {
    const exists = await this.db.supplier.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw notFound('Поставщик');
    const [rows, total] = await Promise.all([
      this.db.review.findMany({
        where: { supplierId: id },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.db.review.count({ where: { supplierId: id } }),
    ]);
    return paginated(
      rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        authorName: r.authorName,
        createdAt: r.createdAt.toISOString(),
        isDemo: r.isDemo,
      })),
      q.page,
      q.pageSize,
      total,
    );
  }
}
