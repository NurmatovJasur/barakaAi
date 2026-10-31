import { useQuery } from '@tanstack/react-query';
import { Mail, MapPin, MessageCircle, Phone, Star } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { TrustScoreDto } from '@smp/shared';
import { api } from '../../services/api';
import { openExternal } from '../../lib/telegram';
import { Badge, Card, DemoBadge, ErrorState, FreshnessBadge, SectionTitle, Skeleton, VerificationBadge } from '../../components/ui';
import { date, pricePerUnit, uzs } from '../../utils/format';

const COMPONENT_LABELS: Record<keyof TrustScoreDto['components'], string> = {
  deliveryReliability: 'Своевременность доставки (30%)',
  priceAccuracy: 'Точность цен (25%)',
  completedOrderRate: 'Выполненные заказы (20%)',
  customerRating: 'Оценки клиентов (15%)',
  dataFreshness: 'Актуальность данных (10%)',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Черновик',
  PLANNED: 'Запланирована',
  CONFIRMED: 'Подтверждена',
  COMPLETED: 'Выполнена',
  CANCELLED: 'Отменена',
};

export function SupplierPage() {
  const { id = '' } = useParams();
  const s = useQuery({ queryKey: ['supplier', id], queryFn: () => api.suppliers.get(id) });
  const offers = useQuery({ queryKey: ['supplier', id, 'offers'], queryFn: () => api.suppliers.offers(id) });
  const reviews = useQuery({ queryKey: ['supplier', id, 'reviews'], queryFn: () => api.suppliers.reviews(id) });

  if (s.isError) return <ErrorState error={s.error} onRetry={() => s.refetch()} />;
  if (!s.data) return <Skeleton className="h-64" />;
  const d = s.data;

  return (
    <div>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary">
            {d.companyName.slice(-1)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{d.companyName}</h1>
            <div className="mt-0.5 flex flex-wrap gap-1">
              <VerificationBadge status={d.verificationStatus} />
              {d.isDemo && <DemoBadge />}
            </div>
          </div>
        </div>
        {d.description && <p className="mt-3 text-sm text-muted">{d.description}</p>}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-surface-2 py-2">
            <p className="flex items-center justify-center gap-1 text-base font-semibold">
              <Star className="size-4 fill-[#f59e0b] text-[#f59e0b]" />
              {d.rating ?? '—'}
            </p>
            <p className="text-muted">{d.reviewCount} отзывов</p>
          </div>
          <div className="rounded-lg bg-surface-2 py-2">
            <p className="text-base font-semibold">{d.offerCount}</p>
            <p className="text-muted">предложений</p>
          </div>
          <div className="rounded-lg bg-surface-2 py-2">
            <p className="text-base font-semibold">{d.trust.score ?? '—'}</p>
            <p className="text-muted">Trust Score</p>
          </div>
        </div>
      </Card>

      <SectionTitle>Контакты</SectionTitle>
      <Card className="divide-y divide-line text-sm">
        {d.contactPerson && <p className="px-3 py-2.5">{d.contactPerson}</p>}
        {d.phone && (
          <a href={`tel:${d.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 px-3 py-2.5 text-primary">
            <Phone className="size-4" /> {d.phone}
          </a>
        )}
        {d.telegramUsername && (
          <button onClick={() => openExternal(`https://t.me/${d.telegramUsername}`)} className="flex w-full items-center gap-2 px-3 py-2.5 text-primary">
            <MessageCircle className="size-4" /> @{d.telegramUsername}
          </button>
        )}
        {d.email && (
          <a href={`mailto:${d.email}`} className="flex items-center gap-2 px-3 py-2.5 text-primary">
            <Mail className="size-4" /> {d.email}
          </a>
        )}
        <p className="flex items-start gap-2 px-3 py-2.5 text-muted">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          <span>
            {d.address ?? d.district}
            <br />
            <span className="text-xs">Доставка: {d.deliveryZones.includes('ALL') ? 'весь Ташкент' : d.deliveryZones.join(', ')}</span>
          </span>
        </p>
      </Card>
      {d.isDemo && <p className="mt-1 px-1 text-[11px] text-muted">Контакты демонстрационные и не принадлежат реальной компании.</p>}

      <SectionTitle>Надёжность (Trust Score)</SectionTitle>
      <Card className="p-3">
        {d.trust.status === 'INSUFFICIENT_DATA' ? (
          <p className="text-sm">
            <Badge tone="neutral">Insufficient Data</Badge>{' '}
            <span className="text-muted">
              Недостаточно данных: {d.trust.sampleSize.orders} заказов, {d.trust.sampleSize.reviews} отзывов (нужно ≥ 5 и ≥ 3).
            </span>
          </p>
        ) : (
          <p className="text-2xl font-semibold">
            {d.trust.score}
            <span className="text-sm text-muted"> / 100</span>
          </p>
        )}
        <div className="mt-3 space-y-2">
          {(Object.keys(COMPONENT_LABELS) as (keyof TrustScoreDto['components'])[]).map((k) => {
            const v = d.trust.components[k];
            return (
              <div key={k}>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">{COMPONENT_LABELS[k]}</span>
                  <span className="tabular">{v == null ? 'нет данных' : v}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${v ?? 0}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        {d.trust.isDemo && <p className="mt-2 text-[11px] text-muted">Метрики сформированы на демо-данных.</p>}
      </Card>

      <SectionTitle>Товары и цены</SectionTitle>
      <Card className="divide-y divide-line">
        {offers.data?.map((o) => (
          <Link key={o.id} to={`/products/${o.productId}`} className="flex items-center gap-2 px-3 py-2.5 text-sm">
            <span className="min-w-0 flex-1 truncate">{o.productName}</span>
            <FreshnessBadge level={o.freshness} />
            <span className="tabular w-32 text-right font-medium">{pricePerUnit(o.price, o.unit)}</span>
          </Link>
        )) ?? <div className="p-3"><Skeleton className="h-32" /></div>}
      </Card>

      <SectionTitle>История сделок</SectionTitle>
      <Card className="divide-y divide-line">
        {d.dealHistory.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted">Вы ещё не закупали у этого поставщика</p>
        ) : (
          d.dealHistory.map((h) => (
            <Link key={h.purchaseId} to={`/purchases/${h.purchaseId}`} className="flex items-center justify-between px-3 py-2.5 text-sm">
              <span>{date(h.createdAt)}</span>
              <Badge>{STATUS_LABEL[h.status]}</Badge>
              <span className="tabular font-medium">{uzs(h.total)}</span>
            </Link>
          ))
        )}
      </Card>

      <SectionTitle>Отзывы</SectionTitle>
      <div className="space-y-2">
        {reviews.data?.items.length === 0 && <p className="text-center text-sm text-muted">Отзывов пока нет</p>}
        {reviews.data?.items.map((r) => (
          <Card key={r.id} className="p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{r.authorName}</span>
              <span className="text-[#f59e0b]">{'★'.repeat(r.rating)}<span className="text-line">{'★'.repeat(5 - r.rating)}</span></span>
            </div>
            {r.comment && <p className="mt-1 text-muted">{r.comment}</p>}
            <p className="mt-1 text-[11px] text-muted">{date(r.createdAt)}{r.isDemo ? ' · демо-отзыв' : ''}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
