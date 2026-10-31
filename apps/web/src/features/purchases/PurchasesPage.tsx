import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PurchaseDto, PurchaseStatus } from '@smp/shared';
import { api } from '../../services/api';
import { Badge, Button, Card, EmptyState, ErrorState, ListSkeleton } from '../../components/ui';
import { date, uzs } from '../../utils/format';

export const PURCHASE_STATUS: Record<PurchaseStatus, { label: string; tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  DRAFT: { label: 'Черновик', tone: 'neutral' },
  PLANNED: { label: 'Запланирована', tone: 'primary' },
  CONFIRMED: { label: 'Подтверждена', tone: 'warning' },
  COMPLETED: { label: 'Выполнена', tone: 'success' },
  CANCELLED: { label: 'Отменена', tone: 'danger' },
};

export function PurchaseRow({ p }: { p: PurchaseDto }) {
  const st = PURCHASE_STATUS[p.status];
  return (
    <Link to={`/purchases/${p.id}`} className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{date(p.createdAt)}</p>
        <p className="text-xs text-muted">
          {p.itemCount} поз. · {p.supplierCount} пост.
          {p.estimatedSavings && Number(p.estimatedSavings) > 0 ? ` · экономия ${uzs(p.estimatedSavings)}` : ''}
        </p>
      </div>
      <div className="text-right">
        <p className="tabular text-sm font-semibold">{uzs(p.totalCost)}</p>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <ChevronRight className="size-4 text-muted" />
    </Link>
  );
}

export function PurchasesPage() {
  const q = useQuery({ queryKey: ['purchases'], queryFn: () => api.purchases.list() });
  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Мои закупки</h1>
      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <EmptyState
          title="Закупок пока нет"
          text="Сохраните план после оптимизации — он появится здесь."
          action={
            <Link to="/basket">
              <Button>К корзине</Button>
            </Link>
          }
        />
      ) : (
        <Card className="divide-y divide-line">
          {q.data.items.map((p) => (
            <PurchaseRow key={p.id} p={p} />
          ))}
        </Card>
      )}
    </div>
  );
}
