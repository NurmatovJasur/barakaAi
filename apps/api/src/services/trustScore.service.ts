import type { SupplierMetrics } from '@prisma/client';
import type { FreshnessLevel, TrustScoreDto } from '@smp/shared';

export const TRUST_WEIGHTS = {
  deliveryReliability: 0.3,
  priceAccuracy: 0.25,
  completedOrderRate: 0.2,
  customerRating: 0.15,
  dataFreshness: 0.1,
};
export const MIN_ORDERS = 5;
export const MIN_REVIEWS = 3;

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

/**
 * Trust Score = 0.30·Delivery + 0.25·PriceAccuracy + 0.20·CompletedRate + 0.15·Rating + 0.10·Freshness
 * All components normalized to 0–100. Returns INSUFFICIENT_DATA when the sample is too small.
 */
export function computeTrustScore(input: {
  metrics: SupplierMetrics | null;
  ratings: number[];
  offerFreshness: FreshnessLevel[];
}): TrustScoreDto {
  const m = input.metrics;
  const orders = m ? m.completedOrders + m.cancelledOrders : 0;
  const reviews = input.ratings.length;
  const avgRating = reviews ? input.ratings.reduce((a, b) => a + b, 0) / reviews : null;
  const freshPoints = input.offerFreshness.map((f): number => (f === 'FRESH' ? 100 : f === 'ATTENTION' ? 50 : 0));

  const components = {
    deliveryReliability: m ? pct(m.onTimeDeliveries, m.totalDeliveries) : null,
    priceAccuracy: m ? pct(m.priceMatchedOrders, m.priceCheckedOrders) : null,
    completedOrderRate: m ? pct(m.completedOrders, orders) : null,
    customerRating: avgRating == null ? null : Math.round(((avgRating - 1) / 4) * 1000) / 10,
    dataFreshness: freshPoints.length
      ? Math.round((freshPoints.reduce((a, b) => a + b, 0) / freshPoints.length) * 10) / 10
      : null,
  };

  const sufficient =
    orders >= MIN_ORDERS && reviews >= MIN_REVIEWS && Object.values(components).every((v) => v != null);

  const score = sufficient
    ? Math.round(
        (Object.keys(TRUST_WEIGHTS) as (keyof typeof TRUST_WEIGHTS)[]).reduce(
          (s, k) => s + TRUST_WEIGHTS[k] * (components[k] as number),
          0,
        ) * 10,
      ) / 10
    : null;

  return {
    status: sufficient ? 'OK' : 'INSUFFICIENT_DATA',
    score,
    components,
    sampleSize: { orders, reviews },
    isDemo: m?.isDemo ?? true,
  };
}
