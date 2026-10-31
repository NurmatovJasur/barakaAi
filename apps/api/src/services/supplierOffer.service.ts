import type { OfferDto } from '@smp/shared';
import { productLabel } from '@smp/shared';
import { freshnessPolicy } from '../config/env';
import { D, money, qty } from '../utils/decimal';
import { freshnessOf } from '../utils/freshness';
import type { OptimizerOffer } from '../algorithms/offerEligibility';
import type { OfferRepository, OfferWithRelations } from '../repositories/offer.repository';
import { notFound } from '../utils/errors';
import type { PrismaClient } from '@prisma/client';

export function toOfferDto(o: OfferWithRelations, now = new Date()): OfferDto {
  return {
    id: o.id,
    productId: o.productId,
    productName: productLabel(o.product.name),
    supplierId: o.supplierId,
    supplierName: o.supplier.companyName,
    supplierVerification: o.supplier.verificationStatus,
    price: money(D(o.price)),
    currency: o.currency,
    unit: o.unit,
    minOrderQuantity: qty(D(o.minOrderQuantity)),
    availableQuantity: qty(D(o.availableQuantity)),
    deliveryCost: money(D(o.deliveryCost)),
    deliveryZones: o.deliveryZones,
    estimatedDeliveryDays: o.estimatedDeliveryDays,
    lastUpdated: o.lastUpdated.toISOString(),
    expiresAt: o.expiresAt?.toISOString() ?? null,
    availabilityStatus: o.availabilityStatus,
    verificationStatus: o.verificationStatus,
    dataQualityStatus: o.dataQualityStatus,
    dataQualityNotes: o.dataQualityNotes,
    freshness: freshnessOf(o.lastUpdated, now, freshnessPolicy),
    isDemo: o.isDemo,
  };
}

export function toOptimizerOffer(o: OfferWithRelations): OptimizerOffer {
  return {
    offerId: o.id,
    productId: o.productId,
    supplierId: o.supplierId,
    supplierName: o.supplier.companyName,
    productName: productLabel(o.product.name),
    price: D(o.price),
    currency: o.currency,
    unit: o.unit,
    minOrderQuantity: D(o.minOrderQuantity),
    availableQuantity: D(o.availableQuantity),
    deliveryCost: D(o.deliveryCost),
    deliveryZones: o.deliveryZones,
    estimatedDeliveryDays: o.estimatedDeliveryDays,
    lastUpdated: o.lastUpdated,
    expiresAt: o.expiresAt,
    availabilityStatus: o.availabilityStatus,
    dataQualityStatus: o.dataQualityStatus,
    supplierActive: o.supplier.isActive,
    productActive: o.product.isActive,
  };
}

export class SupplierOfferService {
  constructor(
    private readonly db: PrismaClient,
    private readonly offers: OfferRepository,
  ) {}

  async forProduct(productId: string): Promise<OfferDto[]> {
    const exists = await this.db.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!exists) throw notFound('Товар');
    const now = new Date();
    return (await this.offers.byProduct(productId)).map((o) => toOfferDto(o, now));
  }

  async forSupplier(supplierId: string): Promise<OfferDto[]> {
    const exists = await this.db.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
    if (!exists) throw notFound('Поставщик');
    const now = new Date();
    return (await this.offers.bySupplier(supplierId))
      .map((o) => toOfferDto(o, now))
      .sort((a, b) => a.productName.localeCompare(b.productName, 'ru'));
  }
}
