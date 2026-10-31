import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Clock, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { Badge, Button, Card, DemoBadge, EmptyState, ErrorState, FreshnessBadge, QualityBadge, SectionTitle, Skeleton, VerificationBadge } from '../../components/ui';
import { ProductIcon } from '../../components/ProductIcon';
import { AddToBasketDialog } from '../../components/AddToBasketDialog';
import { PriceHistoryChart } from '../analytics/PriceHistoryChart';
import { pricePerUnit, quantity, relativeTime, uzs } from '../../utils/format';
import { useBasket } from '../../hooks/useBasket';

export function ProductPage() {
  const { id = '' } = useParams();
  const product = useQuery({ queryKey: ['product', id], queryFn: () => api.products.get(id) });
  const offers = useQuery({ queryKey: ['product', id, 'offers'], queryFn: () => api.products.offers(id) });
  const basket = useBasket();
  const inBasket = basket.data?.items.find((i) => i.productId === id);
  const [adding, setAdding] = useState(false);

  if (product.isError) return <ErrorState error={product.error} onRetry={() => product.refetch()} />;
  const p = product.data;

  return (
    <div>
      {p ? (
        <Card className="flex items-start gap-3 p-4">
          <ProductIcon category={p.category.slug} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{p.name}</h1>
            <p className="text-sm text-muted">{p.category.name}{p.description ? ` · ${p.description}` : ''}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>
                Мин: <b className="tabular">{pricePerUnit(p.minPrice, p.unit)}</b>
              </span>
              <span className="text-muted">
                Средняя: <span className="tabular">{pricePerUnit(p.avgPrice, p.unit)}</span>
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted">Цены обновлены {relativeTime(p.priceUpdatedAt)}</p>
          </div>
        </Card>
      ) : (
        <Skeleton className="h-28" />
      )}

      {p && (
        <Button className="mt-3 w-full" size="lg" disabled={!p.minPrice} onClick={() => setAdding(true)}>
          {inBasket ? `В закупке: ${quantity(inBasket.quantity, p.unit)} — изменить` : 'Добавить в закупку'}
        </Button>
      )}

      <SectionTitle action={<DemoBadge />}>Предложения поставщиков</SectionTitle>
      {offers.isPending ? (
        <Skeleton className="h-48" />
      ) : offers.isError ? (
        <ErrorState error={offers.error} onRetry={() => offers.refetch()} />
      ) : offers.data.length === 0 ? (
        <EmptyState title="Нет предложений" text="Ни один поставщик сейчас не предлагает этот товар." />
      ) : (
        <div className="space-y-2">
          {offers.data.map((o) => {
            const unusable = o.availabilityStatus === 'OUT_OF_STOCK' || o.dataQualityStatus === 'EXPIRED' || o.dataQualityStatus === 'INVALID';
            return (
              <Card key={o.id} className={`p-3 ${unusable ? 'opacity-60' : ''}`}>
                <Link to={`/suppliers/${o.supplierId}`} className="flex items-center gap-2">
                  <span className="font-medium">{o.supplierName}</span>
                  <VerificationBadge status={o.supplierVerification} />
                  <ChevronRight className="ml-auto size-4 text-muted" />
                </Link>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="tabular text-lg font-semibold">{pricePerUnit(o.price, o.unit)}</span>
                  <div className="flex gap-1">
                    <FreshnessBadge level={o.freshness} />
                    <QualityBadge status={o.dataQualityStatus} />
                    {o.availabilityStatus === 'OUT_OF_STOCK' && <Badge tone="danger">Нет в наличии</Badge>}
                    {o.availabilityStatus === 'LIMITED' && <Badge tone="warning">Мало</Badge>}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
                  <span>Мин. заказ: <b className="text-ink">{quantity(o.minOrderQuantity, o.unit)}</b></span>
                  <span>Доступно: <b className="text-ink">{quantity(o.availableQuantity, o.unit)}</b></span>
                  <span className="flex items-center gap-1"><Truck className="size-3" /> {uzs(o.deliveryCost)}</span>
                  <span className="flex items-center gap-1"><Clock className="size-3" /> {o.estimatedDeliveryDays} дн · {relativeTime(o.lastUpdated)}</span>
                </div>
                <p className="mt-1 truncate text-[11px] text-muted">
                  Зоны: {o.deliveryZones.includes('ALL') ? 'весь Ташкент' : o.deliveryZones.join(', ')}
                </p>
                {o.dataQualityNotes.length > 0 && <p className="mt-1 text-[11px] text-warning">{o.dataQualityNotes.join('; ')}</p>}
              </Card>
            );
          })}
        </div>
      )}

      <SectionTitle>История цен</SectionTitle>
      <PriceHistoryChart productId={id} />

      {adding && p && (
        <AddToBasketDialog
          productId={p.id}
          productName={p.name}
          unit={p.unit}
          initial={inBasket ? Number(inBasket.quantity) : undefined}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
