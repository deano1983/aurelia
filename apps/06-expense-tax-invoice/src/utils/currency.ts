/**
 * AUD money handling in integer cents only.
 *
 * All GST/AUD calculations use integer arithmetic so there are no
 * floating-point rounding errors on monetary values.
 *
 * GST rate is 10%. For GST-inclusive prices the ATO-conform formula is:
 *   GST = total * 10 / 11, rounded to the nearest cent
 */

export const GST_RATE_PERCENT = 10

export function centsToAud(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/** GST component of a GST-inclusive total, rounded to cents. No float errors. */
export function gstCentsFromTotal(totalCents: number): number {
  return Math.round((totalCents * GST_RATE_PERCENT) / (100 + GST_RATE_PERCENT))
}

/** Ex-GST component of a GST-inclusive total. */
export function exGstCentsFromTotal(totalCents: number): number {
  return totalCents - gstCentsFromTotal(totalCents)
}

export interface LineAmounts {
  totalCents: number
  gstCents: number
  exGstCents: number
}

/** Amounts for a single line item, computed with integer math. */
export function lineAmounts(quantity: number, unitPriceCents: number): LineAmounts {
  const totalCents = quantity * unitPriceCents
  const gstCents = gstCentsFromTotal(totalCents)
  return { totalCents, gstCents, exGstCents: totalCents - gstCents }
}