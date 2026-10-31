import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Plus, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CATEGORY_LABELS, CATEGORY_SLUGS, type CategorySlug, type ProductSummaryDto } from '@smp/shared';
import { api } from '../../services/api';
import { Button, Card, EmptyState, ErrorState, ListSkeleton } from '../../components/ui';
import { ProductIcon } from '../../components/ProductIcon';
import { AddToBasketDialog } from '../../components/AddToBasketDialog';
import { pricePerUnit, relativeTime } from '../../utils/format';
import { useBasket } from '../../hooks/useBasket';

type Sort = 'name' | 'price_asc' | 'price_desc';

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(search);
  const category = (params.get('category') as CategorySlug | null) ?? undefined;
  const sort = (params.get('sort') as Sort | null) ?? 'name';
  const page = Number(params.get('page') ?? 1);
  const [adding, setAdding] = useState<ProductSummaryDto | null>(null);
  const basket = useBasket();
  const inBasket = new Set(basket.data?.items.map((i) => i.productId));

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if ((params.get('q') ?? '') !== debounced) set({ q: debounced || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const q = useQuery({
    queryKey: ['products', { search: debounced, category, sort, page }],
    queryFn: () => api.products.list({ search: debounced, category, sort, page, pageSize: 12 }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Каталог</h1>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск товара"
          aria-label="Поиск товара"
          className="h-10 w-full rounded-xl border border-line bg-surface pr-9 pl-9 text-sm outline-none focus:border-primary"
        />
        {search && (
          <button aria-label="Очистить поиск" onClick={() => setSearch('')} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="scrollbar-none -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4">
        <Chip active={!category} onClick={() => set({ category: undefined })}>Все</Chip>
        {CATEGORY_SLUGS.map((c) => (
          <Chip key={c} active={category === c} onClick={() => set({ category: c })}>
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-muted">{q.data ? `Найдено: ${q.data.total}` : ' '}</p>
        <select
          aria-label="Сортировка"
          value={sort}
          onChange={(e) => set({ sort: e.target.value === 'name' ? undefined : e.target.value })}
          className="rounded-lg border border-line bg-surface px-2 py-1 text-xs"
        >
          <option value="name">По названию</option>
          <option value="price_asc">Сначала дешевле</option>
          <option value="price_desc">Сначала дороже</option>
        </select>
      </div>

      <div className="mt-2">
        {q.isPending ? (
          <ListSkeleton rows={6} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.data.items.length === 0 ? (
          <EmptyState title="Ничего не найдено" text="Измените запрос или выберите другую категорию." />
        ) : (
          <div className={clsx('space-y-2 transition-opacity', q.isPlaceholderData && 'opacity-60')}>
            {q.data.items.map((p) => (
              <Card key={p.id} className="flex items-center gap-3 p-3">
                <Link to={`/products/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <ProductIcon category={p.category.slug} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    {p.minPrice ? (
                      <p className="tabular text-sm">
                        от <span className="font-semibold">{pricePerUnit(p.minPrice, p.unit)}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-danger">Нет доступных предложений</p>
                    )}
                    <p className="text-[11px] text-muted">
                      {p.offerCount} предл. · ср. {pricePerUnit(p.avgPrice, p.unit)} · {relativeTime(p.priceUpdatedAt)}
                    </p>
                  </div>
                </Link>
                <button
                  aria-label={`Добавить ${p.name}`}
                  disabled={!p.minPrice}
                  onClick={() => setAdding(p)}
                  className={clsx(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg disabled:opacity-40',
                    inBasket.has(p.id) ? 'bg-success-soft text-success' : 'bg-primary text-white',
                  )}
                >
                  <Plus className="size-5" />
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {q.data && q.data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>
            Назад
          </Button>
          <span className="text-xs text-muted">
            {page} из {q.data.totalPages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= q.data.totalPages} onClick={() => set({ page: String(page + 1) })}>
            Далее
          </Button>
        </div>
      )}

      {adding && (
        <AddToBasketDialog
          productId={adding.id}
          productName={adding.name}
          unit={adding.unit}
          initial={Number(basket.data?.items.find((i) => i.productId === adding.id)?.quantity) || undefined}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium',
        active ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink',
      )}
    >
      {children}
    </button>
  );
}
