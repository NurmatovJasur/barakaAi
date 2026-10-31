import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../services/api';
import { Card, DemoBadge, ErrorState, SectionTitle, Skeleton, Stat } from '../../components/ui';
import { PriceHistoryChart, SERIES_COLORS } from './PriceHistoryChart';
import { date, uzs, uzsShort } from '../../utils/format';

const tooltipStyle = { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 12 };

export function AnalyticsPage() {
  const overview = useQuery({ queryKey: ['analytics', 'overview'], queryFn: api.analytics.overview });
  const savings = useQuery({ queryKey: ['analytics', 'savings'], queryFn: api.analytics.savings });
  const products = useQuery({ queryKey: ['products', 'all'], queryFn: () => api.products.list({ pageSize: 50 }) });
  const [productId, setProductId] = useState('');
  const selected = productId || products.data?.items[0]?.id || '';

  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Аналитика</h1>
        <DemoBadge />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {savings.data ? (
          <>
            <Stat label="Расчётная экономия" value={uzsShort(savings.data.totalEstimatedSavings)} hint={`по ${savings.data.purchasesWithBaseline} закупкам`} />
            <Stat label="Без базы сравнения" value={savings.data.purchasesWithoutBaseline} hint="экономия не считается" />
          </>
        ) : (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        )}
      </div>
      {savings.data && <p className="mt-1 px-1 text-[11px] text-muted">{savings.data.disclaimer}</p>}

      {savings.data && savings.data.byPurchase.length > 0 && (
        <>
          <SectionTitle>Экономия по закупкам</SectionTitle>
          <Card className="p-3">
            <div className="h-36">
              <ResponsiveContainer>
                <BarChart data={savings.data.byPurchase.map((b) => ({ d: date(b.createdAt), v: Number(b.savings) }))}>
                  <XAxis dataKey="d" fontSize={10} tickLine={false} axisLine={false} stroke="var(--c-muted)" />
                  <YAxis tickFormatter={uzsShort} fontSize={10} width={44} tickLine={false} axisLine={false} stroke="var(--c-muted)" />
                  <Tooltip formatter={(v: number) => uzs(v)} contentStyle={tooltipStyle} />
                  <Bar dataKey="v" name="Экономия" radius={[4, 4, 0, 0]}>
                    {savings.data.byPurchase.map((b, i) => (
                      <Cell key={i} fill={Number(b.savings) >= 0 ? 'var(--c-success)' : 'var(--c-danger)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      <SectionTitle>Сравнение цен поставщиков</SectionTitle>
      <select
        aria-label="Товар для анализа"
        value={selected}
        onChange={(e) => setProductId(e.target.value)}
        className="mb-2 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm"
      >
        {products.data?.items.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {selected ? <PriceHistoryChart productId={selected} /> : <Skeleton className="h-64" />}

      <SectionTitle>Расходы по поставщикам</SectionTitle>
      <Card className="p-3">
        {overview.data ? (
          overview.data.spendingBySupplier.length ? (
            <div className="h-40">
              <ResponsiveContainer>
                <BarChart layout="vertical" data={overview.data.spendingBySupplier.map((s) => ({ name: s.supplierName, v: Number(s.total) }))}>
                  <XAxis type="number" tickFormatter={uzsShort} fontSize={10} stroke="var(--c-muted)" />
                  <YAxis type="category" dataKey="name" width={80} fontSize={11} stroke="var(--c-muted)" />
                  <Tooltip formatter={(v: number) => uzs(v)} contentStyle={tooltipStyle} />
                  <Bar dataKey="v" name="Расходы" radius={[0, 4, 4, 0]}>
                    {overview.data.spendingBySupplier.map((_, i) => (
                      <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted">Нет данных</p>
          )
        ) : (
          <Skeleton className="h-40" />
        )}
      </Card>

      <SectionTitle>Расходы по категориям</SectionTitle>
      <Card className="divide-y divide-line">
        {overview.data?.spendingByCategory.map((c) => (
          <div key={c.category} className="flex justify-between px-3 py-2 text-sm">
            <span>{c.category}</span>
            <span className="tabular font-medium">{uzs(c.total)}</span>
          </div>
        )) ?? <div className="p-3"><Skeleton className="h-24" /></div>}
      </Card>
    </div>
  );
}
