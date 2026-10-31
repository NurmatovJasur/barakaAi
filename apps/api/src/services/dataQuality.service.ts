import type { DataQualityStatus, PrismaClient, SupplierOffer } from '@prisma/client';
import { freshnessOf, type FreshnessPolicy } from '../utils/freshness';
import { DEFAULT_FRESHNESS_POLICY } from '@smp/shared';

export const ANOMALY_THRESHOLD = 0.3;

export interface QualityVerdict {
  status: DataQualityStatus;
  notes: string[];
}

/**
 * Pure check of a single offer. `previousPrice` is the price recorded before the current one.
 * Suspicious records are flagged, never deleted.
 */
export function evaluateOffer(
  offer: Pick<
    SupplierOffer,
    'price' | 'availableQuantity' | 'minOrderQuantity' | 'deliveryCost' | 'lastUpdated' | 'expiresAt' | 'currency' | 'unit'
  >,
  now: Date,
  opts: { previousPrice?: number | null; duplicate?: boolean; freshness?: FreshnessPolicy } = {},
): QualityVerdict {
  const notes: string[] = [];
  let status = 'VALID' as DataQualityStatus;
  const invalid = (n: string) => {
    notes.push(n);
    status = 'INVALID';
  };
  const warn = (n: string) => {
    notes.push(n);
    if (status === 'VALID') status = 'WARNING';
  };

  const price = Number(offer.price);
  if (!offer.currency || !offer.unit) invalid('Отсутствует валюта или единица измерения');
  if (!(price > 0)) invalid('Цена должна быть больше нуля');
  if (Number(offer.availableQuantity) < 0) invalid('Отрицательное доступное количество');
  if (Number(offer.minOrderQuantity) < 0) invalid('Отрицательный минимальный заказ');
  if (Number(offer.deliveryCost) < 0) invalid('Отрицательная стоимость доставки');
  if (offer.lastUpdated.getTime() > now.getTime() + 5 * 60_000) invalid('Дата обновления в будущем');
  if (status === 'INVALID') return { status, notes };

  if (offer.expiresAt && offer.expiresAt.getTime() <= now.getTime()) {
    return { status: 'EXPIRED', notes: ['Срок действия предложения истёк'] };
  }
  const fresh = freshnessOf(offer.lastUpdated, now, opts.freshness ?? DEFAULT_FRESHNESS_POLICY);
  if (fresh === 'STALE') warn('Цена давно не обновлялась');
  if (opts.duplicate) warn('Найдено дублирующее предложение этого поставщика');
  if (opts.previousPrice && opts.previousPrice > 0) {
    const change = Math.abs(price - opts.previousPrice) / opts.previousPrice;
    if (change > ANOMALY_THRESHOLD) {
      warn(`Аномальное изменение цены: ${Math.round(change * 100)}% за одно обновление`);
    }
  }
  return { status, notes };
}

/** Re-evaluates all offers and stores status + notes. */
export async function runDataQualityChecks(prisma: PrismaClient, now = new Date()) {
  const offers = await prisma.supplierOffer.findMany();
  const lastTwo = await prisma.$queryRaw<{ offerId: string; price: string; rn: bigint }[]>`
    SELECT "offerId", price::text, rn FROM (
      SELECT "offerId", price, ROW_NUMBER() OVER (PARTITION BY "offerId" ORDER BY "recordedAt" DESC) rn
      FROM "PriceHistory"
    ) t WHERE rn <= 2`;
  const prev = new Map<string, number>();
  for (const r of lastTwo) if (Number(r.rn) === 2) prev.set(r.offerId, Number(r.price));

  const dupKey = (o: SupplierOffer) => `${o.supplierId}:${o.productId}`;
  const counts = new Map<string, number>();
  for (const o of offers) counts.set(dupKey(o), (counts.get(dupKey(o)) ?? 0) + 1);

  const summary: Record<DataQualityStatus, number> = { VALID: 0, WARNING: 0, INVALID: 0, EXPIRED: 0 };
  for (const o of offers) {
    const v = evaluateOffer(o, now, {
      previousPrice: prev.get(o.id) ?? null,
      duplicate: (counts.get(dupKey(o)) ?? 0) > 1,
    });
    summary[v.status]++;
    if (v.status !== o.dataQualityStatus || v.notes.join('|') !== o.dataQualityNotes.join('|')) {
      await prisma.supplierOffer.update({
        where: { id: o.id },
        data: { dataQualityStatus: v.status, dataQualityNotes: v.notes },
      });
    }
  }
  return summary;
}
