import { Prisma, type PrismaClient } from '@prisma/client';
import {
  PRODUCT_NAMES_RU,
  productLabel,
  type CategorySlug,
  type Paginated,
  type ProductDetailDto,
  type ProductListQuery,
  type ProductSummaryDto,
  type Unit,
} from '@smp/shared';
import { usableOfferSql } from '../repositories/offer.repository';
import { D, money } from '../utils/decimal';
import { notFound } from '../utils/errors';
import { paginated } from '../utils/http';

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  unit: Unit;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  categoryId: string;
  categorySlug: CategorySlug;
  categoryName: string;
  offerCount: number;
  minPrice: string | null;
  avgPrice: string | null;
  priceUpdatedAt: Date | null;
}

// Sort by the Russian display name shown in the UI, falling back to the DB name.
const displayName = Prisma.sql`COALESCE(CASE p.name ${Prisma.join(
  Object.entries(PRODUCT_NAMES_RU).map(([en, ru]) => Prisma.sql`WHEN ${en} THEN ${ru}`),
  ' ',
)} END, p.name)`;

const ORDER: Record<ProductListQuery['sort'], Prisma.Sql> = {
  name: Prisma.sql`${displayName} ASC`,
  price_asc: Prisma.sql`MIN(o.price) ASC NULLS LAST, ${displayName} ASC`,
  price_desc: Prisma.sql`MIN(o.price) DESC NULLS LAST, ${displayName} ASC`,
};

function toDto(r: ProductRow): ProductDetailDto {
  return {
    id: r.id,
    name: productLabel(r.name),
    description: r.description,
    category: { id: r.categoryId, slug: r.categorySlug, name: r.categoryName },
    unit: r.unit,
    imageUrl: r.imageUrl,
    offerCount: Number(r.offerCount),
    minPrice: r.minPrice ? money(D(r.minPrice)) : null,
    avgPrice: r.avgPrice ? money(D(r.avgPrice)) : null,
    priceUpdatedAt: r.priceUpdatedAt?.toISOString() ?? null,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export class ProductService {
  constructor(private readonly db: PrismaClient) {}

  private baseSelect(where: Prisma.Sql) {
    return Prisma.sql`
      SELECT p.id, p.name, p.description, p.unit::text AS unit, p."imageUrl", p."isActive",
             p."createdAt", p."updatedAt",
             c.id AS "categoryId", c.slug AS "categorySlug", c.name AS "categoryName",
             COUNT(o.id)::int AS "offerCount",
             MIN(o.price)::text AS "minPrice",
             AVG(o.price)::text AS "avgPrice",
             MAX(o."lastUpdated") AS "priceUpdatedAt"
      FROM "Product" p
      JOIN "ProductCategory" c ON c.id = p."categoryId"
      LEFT JOIN "SupplierOffer" o
        ON o."productId" = p.id AND o.unit = p.unit AND o.currency = 'UZS' AND ${usableOfferSql}
      WHERE ${where}
      GROUP BY p.id, c.id`;
  }

  async list(q: ProductListQuery): Promise<Paginated<ProductSummaryDto>> {
    const conds: Prisma.Sql[] = [Prisma.sql`p."isActive" = true`];
    if (q.search) {
      const term = q.search.toLowerCase();
      // Match English DB name and Russian display name
      const ruMatches = Object.entries(PRODUCT_NAMES_RU)
        .filter(([, ru]) => ru.toLowerCase().includes(term))
        .map(([en]) => en);
      const like = `%${q.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      conds.push(
        ruMatches.length
          ? Prisma.sql`(p.name ILIKE ${like} OR p.name IN (${Prisma.join(ruMatches)}))`
          : Prisma.sql`p.name ILIKE ${like}`,
      );
    }
    if (q.category) conds.push(Prisma.sql`c.slug = ${q.category}`);
    const where = Prisma.join(conds, ' AND ');

    const [rows, countRows] = await Promise.all([
      this.db.$queryRaw<ProductRow[]>`
        ${this.baseSelect(where)}
        ORDER BY ${ORDER[q.sort]}
        LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
      this.db.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM "Product" p
        JOIN "ProductCategory" c ON c.id = p."categoryId" WHERE ${where}`,
    ]);
    return paginated(rows.map(toDto), q.page, q.pageSize, Number(countRows[0]?.n ?? 0));
  }

  async get(id: string): Promise<ProductDetailDto> {
    const rows = await this.db.$queryRaw<ProductRow[]>`${this.baseSelect(Prisma.sql`p.id = ${id}::uuid`)}`;
    if (!rows[0]) throw notFound('Товар');
    return toDto(rows[0]);
  }

  /** Min usable price per product (for basket estimates). */
  async minPrices(ids: string[]): Promise<Map<string, { minPrice: string | null; offerCount: number }>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db.$queryRaw<ProductRow[]>`
      ${this.baseSelect(Prisma.sql`p.id IN (${Prisma.join(ids.map((i) => Prisma.sql`${i}::uuid`))})`)}`;
    return new Map(rows.map((r) => [r.id, { minPrice: r.minPrice, offerCount: Number(r.offerCount) }]));
  }
}
