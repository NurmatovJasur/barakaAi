import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../services/api';
import { Card, ErrorState, Segmented, Skeleton } from '../../components/ui';
import { percent, pricePerUnit, shortDate, uzsShort } from '../../utils/format';

export const SERIES_COLORS = ['#1e3a8a', '#15803d', '#b45309', '#b91c1c', '#7c3aed'];

/** Multi-supplier price history. One line per offer (supplier + unit + currency) — never merged. */
export function PriceHistoryChart({ productId }: { productId: string }) {
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const q = useQuery({
    queryKey: ['prices', productId, range],
    queryFn: () => api.analytics.prices(productId, range),
    enabled: Boolean(productId),
  });

  const rows = (() => {
    if (!q.data) return [];
    const byDay = new Map<string, Record<string, number | string>>();
    for (const s of q.data.series) {
      for (const p of s.points) {
        const day = p.date.slice(0, 10);
        const row = byDay.get(day) ?? { day };
        row[s.supplierName] = Number(p.price);
        byDay.set(day, row);
      }
    }
    return [...byDay.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)));
  })();

  return (
    <Card className="p-3">
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: '7', label: '7 дней' },
          { value: '30', label: '30 дней' },
          { value: '90', label: '90 дней' },
        ]}
      />
      {q.isPending ? (
        <Skeleton className="mt-3 h-48" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          <div className="mt-3 h-52">
            <ResponsiveContainer>
              <LineChart data={rows}>
                <CartesianGrid vertical={false} stroke="var(--c-border)" />
                <XAxis dataKey="day" tickFormatter={shortDate} tickLine={false} axisLine={false} fontSize={11} minTickGap={24} stroke="var(--c-muted)" />
                <YAxis domain={['auto', 'auto']} tickFormatter={uzsShort} tickLine={false} axisLine={false} fontSize={11} width={48} stroke="var(--c-muted)" />
                <Tooltip
                  labelFormatter={(d: string) => shortDate(d)}
                  formatter={(v: number) => `${Math.round(v).toLocaleString('ru-RU')} UZS`}
                  contentStyle={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 12 }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                {q.data.series.map((s, i) => (
                  <Line key={s.offerId} type="monotone" dataKey={s.supplierName} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={1.75} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="py-1 text-left font-medium">Поставщик</th>
                  <th className="text-right font-medium">Сейчас</th>
                  <th className="text-right font-medium">Мин</th>
                  <th className="text-right font-medium">Макс</th>
                  <th className="text-right font-medium">Δ</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {q.data.series.map((s) => (
                  <tr key={s.offerId} className="border-t border-line">
                    <td className="py-1.5">{s.supplierName}</td>
                    <td className="text-right">{pricePerUnit(s.current, s.unit)}</td>
                    <td className="text-right">{uzsShort(s.min)}</td>
                    <td className="text-right">{uzsShort(s.max)}</td>
                    <td className={`text-right ${s.changePercent && s.changePercent > 0 ? 'text-danger' : 'text-success'}`}>
                      {s.changePercent == null ? '—' : percent(s.changePercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted">Демонстрационные исторические данные. Δ — изменение за выбранный период.</p>
        </>
      )}
    </Card>
  );
}
