import { UNIT_LABELS, type Unit } from '@smp/shared';

const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const nf3 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 });

export const uzs = (v: string | number | null | undefined) =>
  v == null ? '—' : `${nf0.format(Number(v))} UZS`;

/** Short form for dense UI: 1,2 млн / 350 тыс. */
export const uzsShort = (v: string | number) => {
  const n = Number(v);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} млн`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)} тыс`;
  return nf0.format(n);
};

export const unitLabel = (u: Unit) => UNIT_LABELS[u];

/** Price is never shown without its unit. */
export const pricePerUnit = (price: string | number | null | undefined, unit: Unit) =>
  price == null ? '—' : `${nf0.format(Number(price))} UZS/${UNIT_LABELS[unit]}`;

export const quantity = (q: string | number, unit: Unit) => `${nf3.format(Number(q))} ${UNIT_LABELS[unit]}`;

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const h = diff / 3_600_000;
  if (h < 1) return 'менее часа назад';
  if (h < 24) return `${Math.floor(h)} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} дн назад`;
}

export const date = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

export const percent = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`;
