import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Info, Lightbulb, Phone, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ScenarioKind, ScenarioResultDto } from '@smp/shared';
import { api, errorMessage } from '../../services/api';
import { useMainButton } from '../../hooks/useTelegramButtons';
import { haptic } from '../../lib/telegram';
import { toast } from '../../stores/toast';
import { Badge, Button, Card, ConfirmDialog, DemoBadge, EmptyState, ErrorState, SectionTitle, Skeleton } from '../../components/ui';
import { quantity, uzs } from '../../utils/format';

const SHORT: Record<ScenarioKind, string> = {
  SINGLE: '1 поставщик',
  BALANCED_2: '≤ 2',
  BALANCED_3: '≤ 3',
  MULTI: 'Без ограничений',
};
const ORDER: ScenarioKind[] = ['MULTI', 'BALANCED_2', 'BALANCED_3', 'SINGLE'];

export function OptimizationPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const run = useQuery({ queryKey: ['run', id], queryFn: () => api.optimizer.get(id) });
  const [selected, setSelected] = useState<ScenarioKind | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);

  useEffect(() => {
    if (run.data && !selected) setSelected(run.data.recommended ?? 'MULTI');
  }, [run.data, selected]);

  const scenario = run.data?.scenarios.find((s) => s.kind === selected) ?? null;
  const saved = run.data?.savedPurchaseId ?? null;

  const save = useMutation({
    mutationFn: () => api.optimizer.save(id, selected!),
    onSuccess: (p) => {
      haptic.success();
      toast.success('План закупки сохранён');
      setConfirm(false);
      qc.invalidateQueries({ queryKey: ['run', id] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['purchases'] });
      navigate(`/purchases/${p.id}`);
    },
    onError: (e) => {
      haptic.error();
      toast.error(errorMessage(e));
    },
  });

  const canSave = Boolean(scenario?.feasible && !saved);
  const native = useMainButton({
    text: saved ? 'Открыть сохранённую закупку' : 'Сохранить план закупки',
    onClick: () => (saved ? navigate(`/purchases/${saved}`) : canSave && setConfirm(true)),
    visible: Boolean(scenario?.feasible || saved),
    disabled: !saved && !canSave,
    loading: save.isPending,
  });

  if (run.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-10" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (run.isError) return <ErrorState error={run.error} onRetry={() => run.refetch()} />;
  const r = run.data;
  const excluded = r.warnings.filter((w) => w.code.startsWith('OFFER_EXCLUDED_'));
  const important = r.warnings.filter((w) => !w.code.startsWith('OFFER_EXCLUDED_'));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Результат оптимизации</h1>
        <DemoBadge />
      </div>

      <StatusBanner status={r.optimizationStatus} />

      {r.optimizationStatus === 'INFEASIBLE' ? (
        <>
          <EmptyState
            icon={<AlertTriangle className="size-6" />}
            title="Допустимый план не найден"
            text="Ни одна комбинация поставщиков не может выполнить корзину с учётом остатков, минимальных объёмов и зон доставки."
            action={
              <Link to="/basket">
                <Button>Изменить корзину</Button>
              </Link>
            }
          />
          <Warnings items={[...important, ...excluded]} />
        </>
      ) : (
        <>
          <div role="tablist" className="scrollbar-none -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4">
            {ORDER.map((k) => {
              const s = r.scenarios.find((x) => x.kind === k)!;
              return (
                <button
                  key={k}
                  role="tab"
                  aria-selected={selected === k}
                  onClick={() => {
                    haptic.select();
                    setSelected(k);
                  }}
                  className={clsx(
                    'shrink-0 rounded-xl border px-3 py-2 text-left',
                    selected === k ? 'border-primary bg-primary-soft' : 'border-line bg-surface',
                    !s.feasible && 'opacity-50',
                  )}
                >
                  <p className="flex items-center gap-1 text-xs font-medium text-muted">
                    {SHORT[k]}
                    {r.recommended === k && <CheckCircle2 className="size-3.5 text-success" />}
                  </p>
                  <p className="tabular text-sm font-semibold">{s.feasible ? uzs(s.totalCost) : 'невозможно'}</p>
                </button>
              );
            })}
          </div>

          {scenario && <ScenarioView s={scenario} recommended={r.recommended === scenario.kind} />}

          {r.explanation.length > 0 && (
            <>
              <SectionTitle>Почему этот вариант</SectionTitle>
              <Card className="space-y-2 p-3 text-sm">
                {r.explanation.map((line, i) => (
                  <p key={i} className="flex gap-2">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                    {line}
                  </p>
                ))}
                <Link to={`/assistant?run=${r.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  Спросить помощника об этом расчёте <ChevronRight className="size-3" />
                </Link>
              </Card>
            </>
          )}

          {important.length > 0 && <Warnings items={important} />}
          {excluded.length > 0 && (
            <div className="mt-3">
              <button onClick={() => setShowWarnings((v) => !v)} className="flex items-center gap-1 text-xs font-medium text-muted">
                <ChevronDown className={clsx('size-4 transition', showWarnings && 'rotate-180')} />
                Исключённые предложения ({excluded.length})
              </button>
              {showWarnings && <Warnings items={excluded} compact />}
            </div>
          )}

          {!native && (scenario?.feasible || saved) && (
            <div className="sticky bottom-[calc(76px+var(--safe-bottom))] z-20 mt-4">
              {saved ? (
                <Button size="lg" variant="secondary" className="w-full" onClick={() => navigate(`/purchases/${saved}`)}>
                  Открыть сохранённую закупку
                </Button>
              ) : (
                <Button size="lg" className="w-full shadow-lg" onClick={() => setConfirm(true)} disabled={!canSave}>
                  Сохранить план закупки
                </Button>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirm}
        title="Сохранить план закупки?"
        text={
          scenario && (
            <>
              Сценарий «{scenario.title}» на сумму <b className="text-ink">{uzs(scenario.totalCost)}</b>, поставщиков: {scenario.supplierCount}.
              Оплата в приложении не производится — свяжитесь с поставщиками по контактам.
            </>
          )
        }
        confirmText="Сохранить"
        loading={save.isPending}
        onConfirm={() => save.mutate()}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}

function StatusBanner({ status }: { status: string }) {
  if (status === 'OPTIMAL') {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-sm text-success">
        <CheckCircle2 className="size-4" /> Оптимальность подтверждена полным перебором
      </div>
    );
  }
  if (status === 'FEASIBLE_LIMIT_REACHED') {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
        <AlertTriangle className="size-4" /> План допустим, но достигнут лимит вычислений — оптимальность не подтверждена
      </div>
    );
  }
  return null;
}

function ScenarioView({ s, recommended }: { s: ScenarioResultDto; recommended: boolean }) {
  if (!s.feasible) {
    return (
      <Card className="mt-3 flex gap-2 p-4 text-sm">
        <Info className="size-4 shrink-0 text-muted" />
        {s.message}
      </Card>
    );
  }
  const savings = s.savings == null ? null : Number(s.savings);
  return (
    <>
      <Card className="mt-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{s.title}</p>
          {recommended && <Badge tone="success">Рекомендуем</Badge>}
        </div>
        <p className="tabular mt-1 text-3xl font-semibold tracking-tight">{uzs(s.totalCost)}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted">Товары</p>
            <p className="tabular font-semibold">{uzs(s.productsCost)}</p>
          </div>
          <div>
            <p className="text-muted">Доставка</p>
            <p className="tabular font-semibold">{uzs(s.deliveryCost)}</p>
          </div>
          <div>
            <p className="text-muted">Поставщиков</p>
            <p className="font-semibold">{s.supplierCount}</p>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-surface-2 p-2.5 text-xs">
          {savings == null ? (
            <span className="text-muted">Базовая стоимость недоступна: ни один поставщик не выполняет заказ целиком.</span>
          ) : (
            <span>
              Экономия vs лучший единственный поставщик ({uzs(s.baselineCost)}):{' '}
              <b className={savings > 0 ? 'text-success' : savings < 0 ? 'text-danger' : ''}>
                {savings < 0 ? `дороже на ${uzs(-savings)}` : uzs(savings)}
              </b>
              <span className="block text-muted">Расчётная оценка, не подтверждена сделками.</span>
            </span>
          )}
        </div>
      </Card>

      <SectionTitle>Распределение по поставщикам</SectionTitle>
      <div className="space-y-2">
        {s.suppliers.map((g) => (
          <Card key={g.supplierId} className="overflow-hidden">
            <Link to={`/suppliers/${g.supplierId}`} className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
              <span className="font-semibold">{g.supplierName}</span>
              <span className="ml-auto flex items-center gap-1 text-xs text-muted">
                <Truck className="size-3.5" /> {uzs(g.deliveryCost)} · {g.estimatedDeliveryDays} дн
              </span>
              <ChevronRight className="size-4 text-muted" />
            </Link>
            <table className="w-full text-sm">
              <tbody className="tabular">
                {g.allocations.map((a) => (
                  <tr key={a.offerId} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">{a.productName}</td>
                    <td className="text-right text-muted">{quantity(a.quantity, a.unit)}</td>
                    <td className="text-right text-xs text-muted">× {Number(a.unitPrice).toLocaleString('ru-RU')}</td>
                    <td className="px-3 text-right font-medium">{uzs(a.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-3 py-2 text-xs">
              <Link to={`/suppliers/${g.supplierId}`} className="inline-flex items-center gap-1 font-medium text-primary">
                <Phone className="size-3.5" /> Контакты
              </Link>
              <span className="tabular">
                Итого: <b>{uzs(Number(g.productsCost) + Number(g.deliveryCost))}</b>
              </span>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function Warnings({ items, compact }: { items: { code: string; message: string }[]; compact?: boolean }) {
  if (!items.length) return null;
  return (
    <Card className={clsx('mt-3 space-y-1.5 p-3', compact ? 'text-xs' : 'text-sm')}>
      {items.map((w, i) => (
        <p key={i} className="flex gap-2 text-muted">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          {w.message}
        </p>
      ))}
    </Card>
  );
}
