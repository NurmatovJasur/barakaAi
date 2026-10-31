import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Boxes, Package, PiggyBank, Receipt, ShoppingCart, Tag, Truck, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../services/api';
import { useAuth } from '../../stores/auth';
import { getUnsafeUser } from '../../lib/telegram';
import { Badge, Card, ErrorState, SectionTitle, Skeleton, Stat, VerificationBadge } from '../../components/ui';
import { percent, pricePerUnit, relativeTime, shortDate, uzs, uzsShort } from '../../utils/format';
import { PurchaseRow } from '../purchases/PurchasesPage';

export function DashboardPage() {
  const user = useAuth((s) => s.user);
  const greetingName = getUnsafeUser()?.first_name ?? user?.firstName ?? '';
  const stats = useQuery({ queryKey: ['dashboard', 'stats'], queryFn: api.dashboard.stats });
  const recent = useQuery({ queryKey: ['dashboard', 'recent'], queryFn: api.dashboard.recentPurchases });
  const changes = useQuery({ queryKey: ['dashboard', 'changes'], queryFn: () => api.dashboard.priceChanges() });
  const drops = useQuery({ queryKey: ['dashboard', 'drops'], queryFn: () => api.dashboard.priceChanges('down') });
  const overview = useQuery({ queryKey: ['analytics', 'overview'], queryFn: api.analytics.overview });
  const suppliers = useQuery({ queryKey: ['suppliers', 'top'], queryFn: () => api.suppliers.list({ pageSize: 3 }) });

  if (stats.isError) return <ErrorState error={stats.error} onRetry={() => stats.refetch()} />;
  const s = stats.data;

  return (
    <div>
      <div className="mb-3">
        <h1 className="text-xl font-semibold">{greetingName ? `Здравствуйте, ${greetingName}` : 'Обзор закупок'}</h1>
        <p className="text-sm text-muted">{user?.business?.name ?? 'Ваш бизнес'} · {user?.business?.district ?? 'район не указан'}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {s ? (
          <>
            <Stat icon={<Wallet className="size-3.5" />} label="Объём закупок" value={uzsShort(s.totalProcurementValue)} hint="UZS, без отменённых" />
            <Stat icon={<PiggyBank className="size-3.5" />} label="Расчётная экономия" value={uzsShort(s.estimatedSavings)} hint="не подтверждена сделками" />
            <Stat icon={<Truck className="size-3.5" />} label="Поставщики" value={s.availableSuppliers} hint="активные" />
            <Stat icon={<Package className="size-3.5" />} label="Товары" value={s.availableProducts} hint="с предложениями" />
            <Stat icon={<Receipt className="size-3.5" />} label="Закупки" value={s.totalPurchases} />
            <Stat icon={<Tag className="size-3.5" />} label="Активные предложения" value={s.activeOffers} />
          </>
        ) : (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[82px]" />)
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <QuickAction to="/catalog" icon={<Boxes className="size-5" />} label="Каталог" />
        <QuickAction to="/basket" icon={<ShoppingCart className="size-5" />} label="Оптимизировать" />
        <QuickAction to="/purchases" icon={<Receipt className="size-5" />} label="Мои закупки" />
      </div>

      <SectionTitle>Расходы на закупки</SectionTitle>
      <Card className="p-3">
        {overview.data ? (
          overview.data.spendingByMonth.length ? (
            <div className="h-40">
              <ResponsiveContainer>
                <AreaChart data={overview.data.spendingByMonth.map((m) => ({ month: m.month.slice(5), total: Number(m.total) }))}>
                  <defs>
                    <linearGradient id="spend" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--c-primary)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--c-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--c-border)" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} stroke="var(--c-muted)" />
                  <YAxis tickFormatter={uzsShort} tickLine={false} axisLine={false} fontSize={11} width={52} stroke="var(--c-muted)" />
                  <Tooltip formatter={(v: number) => uzs(v)} contentStyle={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="total" name="Расходы" stroke="var(--c-primary)" strokeWidth={2} fill="url(#spend)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted">Пока нет закупок</p>
          )
        ) : (
          <Skeleton className="h-40" />
        )}
      </Card>

      <SectionTitle>Индекс цен, 30 дней</SectionTitle>
      <Card className="p-3">
        {overview.data ? (
          <div className="h-32">
            <ResponsiveContainer>
              <LineChart data={overview.data.priceIndex}>
                <XAxis dataKey="date" tickFormatter={(d: string) => shortDate(d)} tickLine={false} axisLine={false} fontSize={11} minTickGap={30} stroke="var(--c-muted)" />
                <YAxis domain={['auto', 'auto']} tickLine={false} axisLine={false} fontSize={11} width={36} stroke="var(--c-muted)" />
                <Tooltip formatter={(v: number) => v.toFixed(1)} labelFormatter={(d: string) => shortDate(d)} contentStyle={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="index" name="Индекс" stroke="var(--c-warning)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Skeleton className="h-32" />
        )}
        <p className="mt-1 text-[11px] text-muted">100 = средняя цена месяц назад по всем предложениям. Демо-данные.</p>
      </Card>

      <SectionTitle action={<Link to="/analytics" className="text-xs font-medium text-primary">Аналитика</Link>}>
        Последние изменения цен
      </SectionTitle>
      <Card className="divide-y divide-line">
        {changes.data ? (
          changes.data.length ? (
            changes.data.slice(0, 5).map((c) => (
              <Link key={`${c.productId}${c.supplierId}`} to={`/products/${c.productId}`} className="flex items-center gap-3 px-3 py-2.5">
                {c.changePercent > 0 ? <ArrowUpRight className="size-4 text-danger" /> : <ArrowDownRight className="size-4 text-success" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.productName}</p>
                  <p className="text-xs text-muted">{c.supplierName} · {relativeTime(c.changedAt)}</p>
                </div>
                <div className="text-right">
                  <p className="tabular text-sm">{pricePerUnit(c.currentPrice, c.unit)}</p>
                  <p className={`tabular text-xs font-medium ${c.changePercent > 0 ? 'text-danger' : 'text-success'}`}>{percent(c.changePercent)}</p>
                </div>
              </Link>
            ))
          ) : (
            <p className="p-4 text-center text-sm text-muted">Изменений нет</p>
          )
        ) : (
          <div className="p-3"><Skeleton className="h-24" /></div>
        )}
      </Card>

      {drops.data && drops.data.length > 0 && (
        <>
          <SectionTitle>Рекомендуем: подешевело</SectionTitle>
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
            {drops.data.slice(0, 6).map((c) => (
              <Link key={`${c.productId}${c.supplierId}`} to={`/products/${c.productId}`} className="w-40 shrink-0">
                <Card className="p-3">
                  <p className="truncate text-sm font-semibold">{c.productName}</p>
                  <p className="text-xs text-muted">{c.supplierName}</p>
                  <p className="tabular mt-2 text-sm">{pricePerUnit(c.currentPrice, c.unit)}</p>
                  <Badge tone="success" className="mt-1">{percent(c.changePercent)}</Badge>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      <SectionTitle action={<Link to="/suppliers" className="text-xs font-medium text-primary">Все</Link>}>Топ поставщиков</SectionTitle>
      <Card className="divide-y divide-line">
        {suppliers.data?.items.map((sp) => (
          <Link key={sp.id} to={`/suppliers/${sp.id}`} className="flex items-center gap-3 px-3 py-2.5">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">{sp.companyName.slice(-1)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{sp.companyName}</p>
              <p className="text-xs text-muted">★ {sp.rating ?? '—'} · {sp.offerCount} предложений</p>
            </div>
            <VerificationBadge status={sp.verificationStatus} />
          </Link>
        )) ?? <div className="p-3"><Skeleton className="h-24" /></div>}
      </Card>

      <SectionTitle action={<Link to="/purchases" className="text-xs font-medium text-primary">Все</Link>}>Последние закупки</SectionTitle>
      <Card className="divide-y divide-line">
        {recent.data ? (
          recent.data.length ? (
            recent.data.map((p) => <PurchaseRow key={p.id} p={p} />)
          ) : (
            <p className="p-4 text-center text-sm text-muted">Закупок пока нет</p>
          )
        ) : (
          <div className="p-3"><Skeleton className="h-24" /></div>
        )}
      </Card>
    </div>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface py-3 text-xs font-medium">
      <span className="text-primary">{icon}</span>
      {label}
    </Link>
  );
}
