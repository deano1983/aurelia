import type { SponsorshipTier } from '../types';

export type { SponsorshipTier };
import { applyRate, formatAUD } from './audMoney';

export interface RateCardInput {
  tier: SponsorshipTier;
  contentType: string;
  qty: number;
  usageKey: string;
  exclusive: boolean;
}

export interface RateCardResult {
  lines: { label: string; qty: number; unitCents: number; lineCents: number }[];
  totalCents: number;
  breakdown: string[];
}

export const CONTENT_TYPES: { key: string; label: string }[] = [
  { key: 'static', label: 'Static Post' },
  { key: 'story', label: 'Story / Reel' },
  { key: 'reel', label: 'Reel' },
  { key: 'video', label: 'Long-form Video' },
  { key: 'bundle', label: 'Content Bundle' },
];

export const USAGE_OPTIONS: { key: string; label: string; num: number; den: number }[] = [
  { key: '30', label: '30 days usage', num: 100, den: 100 },
  { key: '60', label: '60 days usage', num: 130, den: 100 },
  { key: '90', label: '90 days usage', num: 160, den: 100 },
  { key: 'perpetual', label: 'Perpetual usage', num: 200, den: 100 },
];

export const SPONSORSHIP_TIERS: SponsorshipTier[] = [
  {
    key: 'nano',
    label: 'Nano',
    min: 1,
    max: 9_999,
    baseCents: { static: 150_00, story: 100_00, reel: 200_00, video: 300_00, bundle: 500_00 },
  },
  {
    key: 'micro',
    label: 'Micro',
    min: 10_000,
    max: 99_999,
    baseCents: { static: 500_00, story: 350_00, reel: 750_00, video: 1200_00, bundle: 2000_00 },
  },
  {
    key: 'mid',
    label: 'Mid',
    min: 100_000,
    max: 499_999,
    baseCents: { static: 1500_00, story: 1000_00, reel: 2500_00, video: 4000_00, bundle: 7000_00 },
  },
  {
    key: 'macro',
    label: 'Macro',
    min: 500_000,
    max: 999_999,
    baseCents: { static: 4000_00, story: 3000_00, reel: 7000_00, video: 12000_00, bundle: 20000_00 },
  },
  {
    key: 'mega',
    label: 'Mega',
    min: 1_000_000,
    max: Infinity,
    baseCents: { static: 10000_00, story: 8000_00, reel: 18000_00, video: 30000_00, bundle: 50000_00 },
  },
];

export function tierForFollowers(followers: number): SponsorshipTier {
  return (
    SPONSORSHIP_TIERS.find((t) => followers >= t.min && followers <= t.max) ??
    SPONSORSHIP_TIERS[SPONSORSHIP_TIERS.length - 1]
  );
}

export function usageOption(key: string) {
  return USAGE_OPTIONS.find((o) => o.key === key) ?? USAGE_OPTIONS[0];
}

export function contentLabel(key: string): string {
  return CONTENT_TYPES.find((c) => c.key === key)?.label ?? key;
}

export function calculateRateCard(input: RateCardInput): RateCardResult {
  const { tier, contentType, qty, usageKey, exclusive } = input;
  const baseCents = tier.baseCents[contentType] ?? tier.baseCents.static;
  const usage = usageOption(usageKey);

  let unitCents = applyRate(baseCents, usage.num, usage.den);
  const breakdown: string[] = [
    `${tier.label} base — ${contentLabel(contentType)}: ${formatAUD(baseCents)}`,
    `Usage rights (${usage.label}): ×${(usage.num / usage.den).toFixed(2)}`,
  ];
  if (exclusive) {
    unitCents = applyRate(unitCents, 150, 100);
    breakdown.push('Exclusivity premium: +50%');
  }
  breakdown.push(`Quantity: ×${qty}`);

  const lineCents = unitCents * qty;
  const lines = [
    {
      label: `${tier.label} — ${contentLabel(contentType)} ×${qty}${exclusive ? ' · exclusive' : ''} · ${usage.label}`,
      qty,
      unitCents,
      lineCents,
    },
  ];

  return { lines, totalCents: lineCents, breakdown };
}