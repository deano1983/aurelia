/**
 * AUD currency math using integer cent math.
 *
 * All amounts are stored and manipulated as integer cents (e.g. $1,250.00 = 125000).
 * This avoids binary floating-point rounding errors entirely. Decimal.js is the
 * recommended swap-in (see README), but integer math is exact for 2-dp currency.
 */

export type Cents = number;

export const CENTS_PER_AUD = 100;

export function toCents(aud: number): Cents {
  return Math.round(aud * CENTS_PER_AUD);
}

export function fromCents(cents: Cents): number {
  return cents / CENTS_PER_AUD;
}

/** Format cents as an AUD currency string, e.g. $1,250.00 */
export function formatAUD(cents: Cents): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromCents(cents));
}

/** Format cents as a short AUD string without trailing cents when zero, e.g. $1,250 */
export function formatAUDShort(cents: Cents): string {
  const aud = fromCents(cents);
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: aud % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(aud);
}

/** Multiply cents by a rational rate (num/den), rounding to whole cents. */
export function applyRate(cents: Cents, num: number, den: number): Cents {
  return Math.round((cents * num) / den);
}

/** Parse a user-entered AUD string (e.g. "$1,250.00" or "1250") into cents. */
export function parseAUDInput(value: string): Cents | null {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (cleaned === '') return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return toCents(num);
}