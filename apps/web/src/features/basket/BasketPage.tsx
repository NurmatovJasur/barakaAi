import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TASHKENT_DISTRICTS } from '@smp/shared';
import { api, errorMessage } from '../../services/api';
import { useBasket, useBasketMutations } from '../../hooks/useBasket';
import { useMainButton } from '../../hooks/useTelegramButtons';
import { useAuth } from '../../stores/auth';
import { toast } from '../../stores/toast';
import { haptic } from '../../lib/telegram';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, ListSkeleton } from '../../components/ui';
import { QuantityInput } from '../../components/QuantityInput';
import { pricePerUnit, uzs } from '../../utils/format';

export function BasketPage() {
  const navigate = useNavigate();
  const basket = useBasket();
  const { update, remove, clear } = useBasketMutations();
  const user = useAuth((s) => s.user);
  const [district, setDistrict] = useState(user?.business?.district ?? '');
  const [confirmClear, setConfirmClear] = useState(false);

  const items = basket.data?.items ?? [];
  const unavailable = items.filter((i) => i.offerCount === 0);

  const optimize = useMutation({
    mutationFn: () =>
      api.optimizer.calculate({
        items: items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity), unit: i.unit })),
        deliveryDistrict: district || undefined,
      }),
    onSuccess: (run) => {
      if (run.optimizationStatus === 'INFEASIBLE') haptic.warning();
      else haptic.success();
      navigate(`/optimizer/${run.id}`);
    },
    onError: (e) => {
      haptic.error();
      toast.error(errorMessage(e));
    },
  });

  const canOptimize = items.length > 0 && !optimize.isPending;
  const native = useMainButton({
    text: 'Оптимизировать закупку',
    onClick: () => canOptimize && optimize.mutate(),
    visible: items.length > 0,
    disabled: !canOptimize,
    loading: optimize.isPending,
  });

  if (basket.isPending) return <ListSkeleton rows={4} />;
  if (basket.isError) return <ErrorState error={basket.error} onRetry={() => basket.refetch()} />;

  if (items.length === 0) {
    return (
      <EmptyState
        title="Корзина закупки пуста"
        text="Добавьте товары из каталога и укажите количество — система подберёт выгодное распределение между поставщиками."
        action={
          <Link to="/catalog">
            <Button>Перейти в каталог</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Smart Basket</h1>
        <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
          <Trash2 className="size-4" /> Очистить
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((i) => (
          <Card key={i.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <Link to={`/products/${i.productId}`} className="min-w-0">
                <p className="truncate font-medium">{i.productName}</p>
                <p className="text-xs text-muted">
                  {i.minPrice ? `от ${pricePerUnit(i.minPrice, i.unit)} · ${i.offerCount} предл.` : 'нет доступных предложений'}
                </p>
              </Link>
              <button aria-label={`Удалить ${i.productName}`} onClick={() => remove.mutate(i.id)} className="p-1 text-muted">
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="mt-2 flex items-end justify-between">
              <QuantityInput
                value={Number(i.quantity)}
                unit={i.unit}
                step={i.unit === 'PCS' ? 30 : 5}
                label={`Количество ${i.productName}`}
                onCommit={(q) => update.mutate({ id: i.id, quantity: q })}
              />
              <span className="tabular text-sm font-semibold">{i.estimatedCost ? `≈ ${uzs(i.estimatedCost)}` : '—'}</span>
            </div>
          </Card>
        ))}
      </div>

      {unavailable.length > 0 && (
        <div className="mt-3 flex gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          Для {unavailable.map((u) => u.productName).join(', ')} нет доступных предложений — оптимизация не найдёт допустимый план.
        </div>
      )}

      <Card className="mt-3 p-3">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">Район доставки</span>
          <select
            aria-label="Район доставки"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">Не указан</option>
            {TASHKENT_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-sm text-muted">Предварительно (мин. цены, без доставки)</span>
          <span className="tabular text-lg font-semibold">{uzs(basket.data.estimatedTotal)}</span>
        </div>
        <p className="mt-1 text-[11px] text-muted">
          Точная стоимость с учётом минимальных объёмов, остатков и доставки — после оптимизации.
        </p>
      </Card>

      {!native && (
        <div className="sticky bottom-[calc(76px+var(--safe-bottom))] z-20 mt-4">
          <Button size="lg" className="w-full shadow-lg" onClick={() => optimize.mutate()} disabled={!canOptimize} loading={optimize.isPending}>
            <Sparkles className="size-5" /> Оптимизировать закупку
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Очистить корзину?"
        text="Все товары будут удалены из закупки."
        confirmText="Очистить"
        danger
        loading={clear.isPending}
        onConfirm={() => clear.mutate(undefined, { onSuccess: () => setConfirmClear(false) })}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  );
}
