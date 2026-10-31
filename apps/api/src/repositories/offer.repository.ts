import { Prisma, type PrismaClient } from '@prisma/client';

export const offerInclude = {
  supplier: { select: { id: true, companyName: true, isActive: true, verificationStatus: true } },
  product: { select: { id: true, name: true, isActive: true, unit: true } },
} satisfies Prisma.SupplierOfferInclude;

export type OfferWithRelations = Prisma.SupplierOfferGetPayload<{ include: typeof offerInclude }>;

/** SQL predicate (alias `o`) for offers that may currently be shown as purchasable. */
export const usableOfferSql = Prisma.sql`
  o."availabilityStatus" <> 'OUT_OF_STOCK'
  AND o."dataQualityStatus" IN ('VALID', 'WARNING')
  AND (o."expiresAt" IS NULL OR o."expiresAt" > NOW())
  AND EXISTS (SELECT 1 FROM "Supplier" s WHERE s.id = o."supplierId" AND s."isActive")`;

/** Prisma `where` equivalent of usableOfferSql. */
export const usableOfferWhere = (): Prisma.SupplierOfferWhereInput => ({
  availabilityStatus: { not: 'OUT_OF_STOCK' },
  dataQualityStatus: { in: ['VALID', 'WARNING'] },
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  supplier: { isActive: true },
});

export class OfferRepository {
  constructor(private readonly db: PrismaClient) {}

  byProduct(productId: string) {
    return this.db.supplierOffer.findMany({
      where: { productId },
      include: offerInclude,
      orderBy: { price: 'asc' },
    });
  }

  bySupplier(supplierId: string) {
    return this.db.supplierOffer.findMany({
      where: { supplierId },
      include: offerInclude,
      orderBy: { product: { name: 'asc' } },
    });
  }

  /** Single query for all offers of the given products (no N+1). */
  forProducts(productIds: string[]) {
    return this.db.supplierOffer.findMany({
      where: { productId: { in: productIds } },
      include: offerInclude,
    });
  }
}
