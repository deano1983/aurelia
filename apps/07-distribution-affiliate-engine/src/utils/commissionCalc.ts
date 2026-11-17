import type { DistributionChannel } from '../types'

/**
 * Affiliate commission maths, integer cents only.
 *
 * Rates from the velvetcadence partner page:
 *   Velvet Cadence         → 30% recurring  (LinkedIn ghostwriters / personal brand agencies)
 *   Sovereign Brief        → 25% recurring + $100 AUD one-time bounty (EA / virtual PA networks)
 *   GlowGrid Studio        → 35% recurring  (TikTok / IG Reels UGC / creator coaches)
 *
 * Integer arithmetic avoids floating-point rounding errors on money — the same
 * pattern used by 06-expense-tax-invoice/src/utils/currency.ts.
 */

export const COMMISSION_RATES: Record<DistributionChannel, number> = {
  'velvet-cadence': 30,
  'sovereign-brief': 25,
  'glowgrid-studio': 35,
} as const

export const BOUNTY_CENTS: Record<DistributionChannel, number | undefined> = {
  'velvet-cadence': undefined,
  'sovereign-brief': 10_000, // $100.00 AUD one-time bounty
  'glowgrid-studio': undefined,
} as const

/** Commission cents for a subscription amount at a given rate. No float errors. */
export function computeCommission(
  subscriptionCents: number,
  ratePercent: number,
): number {
  return Math.round((subscriptionCents * ratePercent) / 100)
}

/** Commission cents for a subscription amount on a given channel. */
export function commissionForChannel(
  subscriptionCents: number,
  channel: DistributionChannel,
): number {
  return computeCommission(subscriptionCents, COMMISSION_RATES[channel])
}

export function formatAUD(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function channelLabel(channel: DistributionChannel): string {
  const labels: Record<DistributionChannel, string> = {
    'velvet-cadence': 'Velvet Cadence',
    'sovereign-brief': 'Sovereign Brief',
    'glowgrid-studio': 'GlowGrid Studio',
  }
  return labels[channel]
}

export function channelHub(channel: DistributionChannel): string {
  const hubs: Record<DistributionChannel, string> = {
    'velvet-cadence': 'LinkedIn Ghostwriters / Personal Brand Agencies',
    'sovereign-brief': 'Executive Assistant (EA) Networks / Virtual PA Agencies',
    'glowgrid-studio': 'TikTok / IG Reels UGC / Creator Coaches',
  }
  return hubs[channel]
}
