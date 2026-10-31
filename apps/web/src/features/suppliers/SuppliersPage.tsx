import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { MapPin, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Card, DemoBadge, EmptyState, ErrorState, ListSkeleton, VerificationBadge } from '../../components/ui';

export function SuppliersPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const q = useQuery({
    queryKey: ['suppliers', debounced],
    queryFn: () => api.suppliers.list({ search: debounced, pageSize: 50 }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Поставщики</h1>
        <DemoBadge />
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск поставщика"
          aria-label="Поиск поставщика"
          className="h-10 w-full rounded-xl border border-line bg-surface pl-9 text-sm outline-none focus:border-primary"
        />
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Все поставщики — демонстрационные и не прошли проверку. Не используйте их контакты для реальных заказов.
      </p>
      <div className="mt-3">
        {q.isPending ? (
          <ListSkeleton rows={5} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.data.items.length === 0 ? (
          <EmptyState title="Поставщики не найдены" />
        ) : (
          <div className="space-y-2">
            {q.data.items.map((s) => (
              <Link key={s.id} to={`/suppliers/${s.id}`} className="block">
                <Card className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">
                      {s.companyName.slice(-1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{s.companyName}</p>
                        <VerificationBadge status={s.verificationStatus} />
                      </div>
                      <p className="flex items-center gap-1 text-xs text-muted">
                        <MapPin className="size-3" /> {s.district} · ★ {s.rating ?? '—'} ({s.reviewCount}) · {s.offerCount} предложений
                      </p>
                    </div>
                  </div>
                  {s.description && <p className="mt-2 line-clamp-2 text-xs text-muted">{s.description}</p>}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
