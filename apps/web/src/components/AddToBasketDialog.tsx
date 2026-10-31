import { useState } from 'react';
import type { Unit } from '@smp/shared';
import { Button } from './ui';
import { validateQuantity } from './QuantityInput';
import { useBasketMutations } from '../hooks/useBasket';
import { unitLabel } from '../utils/format';

const PRESETS: Record<Unit, number[]> = {
  KG: [10, 25, 50, 100],
  L: [5, 10, 20, 50],
  PCS: [30, 90, 180, 360],
  PACK: [5, 10, 20, 50],
  DOZEN: [5, 10, 20, 30],
};

export function AddToBasketDialog({
  productId,
  productName,
  unit,
  initial,
  onClose,
}: {
  productId: string;
  productName: string;
  unit: Unit;
  initial?: number;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState(String(initial ?? PRESETS[unit][1]));
  const error = validateQuantity(raw);
  const { add } = useBasketMutations();

  const submit = () => {
    if (error) return;
    add.mutate(
      { productId, quantity: Number(raw.replace(',', '.')), unit },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Добавить ${productName}`}
        className="w-full max-w-md rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+var(--safe-bottom))] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">{productName}</h3>
        <p className="text-sm text-muted">Сколько нужно закупить?</p>
        <label className="mt-4 block">
          <span className="sr-only">Количество</span>
          <div className="relative">
            <input
              autoFocus
              inputMode="decimal"
              aria-label="Количество"
              aria-invalid={error !== null}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className={`tabular h-12 w-full rounded-xl border bg-surface-2 pr-14 pl-4 text-xl font-semibold outline-none focus:border-primary ${error ? 'border-danger' : 'border-line'}`}
            />
            <span className="absolute top-1/2 right-4 -translate-y-1/2 text-muted">{unitLabel(unit)}</span>
          </div>
        </label>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        <div className="mt-3 flex gap-2">
          {PRESETS[unit].map((p) => (
            <button
              key={p}
              onClick={() => setRaw(String(p))}
              className="flex-1 rounded-lg border border-line py-1.5 text-sm font-medium"
            >
              {p}
            </button>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={error !== null} loading={add.isPending}>
            В закупку
          </Button>
        </div>
      </div>
    </div>
  );
}
