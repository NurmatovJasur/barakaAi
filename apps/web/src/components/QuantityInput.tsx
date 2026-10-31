import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MAX_BASKET_QUANTITY, type Unit } from '@smp/shared';
import { unitLabel } from '../utils/format';

/** Validates a user-typed quantity. Returns an error message or null. */
export function validateQuantity(raw: string): string | null {
  const normalized = raw.replace(',', '.').trim();
  if (normalized === '') return 'Введите количество';
  const n = Number(normalized);
  if (!Number.isFinite(n)) return 'Введите число';
  if (n <= 0) return 'Количество должно быть больше нуля';
  if (n > MAX_BASKET_QUANTITY) return `Максимум ${MAX_BASKET_QUANTITY.toLocaleString('ru-RU')}`;
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) return 'Не более 3 знаков после запятой';
  return null;
}

export function QuantityInput({
  value,
  unit,
  onCommit,
  step = 1,
  label = 'Количество',
}: {
  value: number;
  unit: Unit;
  onCommit: (v: number) => void;
  step?: number;
  label?: string;
}) {
  const [raw, setRaw] = useState(String(value));
  useEffect(() => setRaw(String(value)), [value]);
  const error = validateQuantity(raw);

  const commit = (next: string) => {
    if (validateQuantity(next) === null) {
      const n = Number(next.replace(',', '.'));
      if (n !== value) onCommit(n);
    }
  };
  const bump = (d: number) => {
    const cur = Number(raw.replace(',', '.')) || 0;
    const next = Math.max(step, Math.round((cur + d) * 1000) / 1000);
    setRaw(String(next));
    commit(String(next));
  };

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Уменьшить"
          onClick={() => bump(-step)}
          className="flex size-8 items-center justify-center rounded-lg border border-line bg-surface-2"
        >
          <Minus className="size-4" />
        </button>
        <div className="relative">
          <input
            aria-label={label}
            aria-invalid={error !== null}
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={() => commit(raw)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className={`tabular h-8 w-20 rounded-lg border bg-surface pr-7 pl-2 text-right text-sm font-medium outline-none focus:border-primary ${error ? 'border-danger' : 'border-line'}`}
          />
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted">
            {unitLabel(unit)}
          </span>
        </div>
        <button
          type="button"
          aria-label="Увеличить"
          onClick={() => bump(step)}
          className="flex size-8 items-center justify-center rounded-lg border border-line bg-surface-2"
        >
          <Plus className="size-4" />
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
    </div>
  );
}
