import type Decimal from 'decimal.js';
import type { AvailabilityStatus, DataQualityStatus, Unit } from '@smp/shared';
import { freshnessOf, type FreshnessPolicy } from '../utils/freshness';

/** Offer as seen by the optimizer. Pure data — no Prisma types. */
export interface OptimizerOffer {
  offerId: string;
  productId: string;
  supplierId: string;
  supplierName: string;
  productName: string;
  price: Decimal;
  currency: string;
  unit: Unit;
  minOrderQuantity: Decimal;
  availableQuantity: Decimal;
  /** Delivery fee of the supplier for this offer. Charged at most once per supplier. */
  deliveryCost: Decimal;
  /** District names or 'ALL' */
  deliveryZones: string[];
  estimatedDeliveryDays: number;
  lastUpdated: Date;
  expiresAt: Date | null;
  availabilityStatus: AvailabilityStatus;
  dataQualityStatus: DataQualityStatus;
  supplierActive: boolean;
  productActive: boolean;
}

export type RejectionCode =
  | 'PRODUCT_INACTIVE'
  | 'SUPPLIER_INACTIVE'
  | 'OUT_OF_STOCK'
  | 'EXPIRED'
  | 'STALE_PRICE'
  | 'ZONE_MISMATCH'
  | 'UNIT_MISMATCH'
  | 'CURRENCY_MISMATCH'
  | 'DATA_QUALITY'
  | 'MOQ_EXCEEDS_STOCK';

export interface EligibilityContext {
  now: Date;
  freshness: FreshnessPolicy;
  /** null = delivery district unknown; zone check is skipped and a warning is produced */
  deliveryDistrict: string | null;
  requiredUnit: Unit;
  currency: string;
}

const MESSAGES: Record<RejectionCode, string> = {
  PRODUCT_INACTIVE: 'товар неактивен',
  SUPPLIER_INACTIVE: 'поставщик неактивен',
  OUT_OF_STOCK: 'нет в наличии',
  EXPIRED: 'срок действия предложения истёк',
  STALE_PRICE: 'цена устарела',
  ZONE_MISMATCH: 'нет доставки в ваш район',
  UNIT_MISMATCH: 'другая единица измерения',
  CURRENCY_MISMATCH: 'другая валюта',
  DATA_QUALITY: 'данные предложения некорректны',
  MOQ_EXCEEDS_STOCK: 'минимальный заказ больше остатка',
};

export const rejectionMessage = (code: RejectionCode) => MESSAGES[code];

/** Returns null when the offer may be used by the optimizer, otherwise the rejection reason. */
export function checkOffer(offer: OptimizerOffer, ctx: EligibilityContext): RejectionCode | null {
  if (!offer.productActive) return 'PRODUCT_INACTIVE';
  if (!offer.supplierActive) return 'SUPPLIER_INACTIVE';
  if (offer.dataQualityStatus === 'INVALID') return 'DATA_QUALITY';
  if (offer.dataQualityStatus === 'EXPIRED') return 'EXPIRED';
  if (offer.expiresAt && offer.expiresAt.getTime() <= ctx.now.getTime()) return 'EXPIRED';
  if (offer.availabilityStatus === 'OUT_OF_STOCK' || offer.availableQuantity.lte(0)) {
    return 'OUT_OF_STOCK';
  }
  if (freshnessOf(offer.lastUpdated, ctx.now, ctx.freshness) === 'STALE') return 'STALE_PRICE';
  if (offer.unit !== ctx.requiredUnit) return 'UNIT_MISMATCH';
  if (offer.currency !== ctx.currency) return 'CURRENCY_MISMATCH';
  if (
    ctx.deliveryDistrict &&
    !offer.deliveryZones.includes('ALL') &&
    !offer.deliveryZones.includes(ctx.deliveryDistrict)
  ) {
    return 'ZONE_MISMATCH';
  }
  if (offer.minOrderQuantity.gt(offer.availableQuantity)) return 'MOQ_EXCEEDS_STOCK';
  return null;
}
