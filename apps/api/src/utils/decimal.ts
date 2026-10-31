import Decimal from 'decimal.js';

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

/** Prisma Decimal / number / string → decimal.js */
export const D = (v: { toString(): string } | number | string): Decimal => new Decimal(v.toString());

export const money = (v: Decimal) => v.toDecimalPlaces(2).toFixed(2);
export const qty = (v: Decimal) => v.toDecimalPlaces(3).toString();
export const moneyOrNull = (v: Decimal | null | undefined) => (v == null ? null : money(v));
