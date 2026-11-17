import { useState, useCallback } from 'react';
import type { SponsorshipTier } from '../utils/sponsorshipTier';
import {
  SPONSORSHIP_TIERS,
  tierForFollowers,
  calculateRateCard,
  USAGE_OPTIONS,
  CONTENT_TYPES,
} from '../utils/sponsorshipTier';
import { formatAUD } from '../utils/audMoney';

export interface RateCardCalculatorProps {
  followers?: number;
  onRateCardChange?: (result: { lines: { label: string; qty: number; unitCents: number; lineCents: number }[]; totalCents: number; tier?: string }) => void;
}

export default function RateCardCalculator({ followers, onRateCardChange }: RateCardCalculatorProps) {
  const autoTier = tierForFollowers(followers ?? 0);
  const [tier, setTier] = useState<SponsorshipTier>(autoTier);
  const [contentType, setContentType] = useState('static');
  const [qty, setQty] = useState(1);
  const [usageKey, setUsageKey] = useState('30');
  const [exclusive, setExclusive] = useState(false);
  const [manualTier, setManualTier] = useState(false);

  const result = calculateRateCard({ tier, contentType, qty, usageKey, exclusive });

  const updateTier = useCallback((key: string) => {
    const next = SPONSORSHIP_TIERS.find((t) => t.key === key);
    if (next) setTier(next);
  }, []);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm no-print">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Rate-Card Calculator (AUD)</h2>
        <span className="badge">Feeds 07 Affiliate Engine · sponsor pitches</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="col-span-2 md:col-span-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Sponsorship Tier</label>
          <div className="flex flex-wrap gap-2">
            {SPONSORSHIP_TIERS.map((t) => (
              <button
                key={t.key}
                onClick={() => { updateTier(t.key); setManualTier(true); }}
                className={`px-3 py-1.5 rounded-md border text-sm font-medium ${
                  tier.key === t.key ? 'border-glowgrid-primary bg-glowgrid-primary/10 text-glowgrid-primary' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                }`}
              >
                {t.label} ({t.min.toLocaleString('en-AU')}+)
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Auto tier from followers: <strong>{autoTier.label}</strong>{manualTier ? ' (manual override)' : ''}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
          <select className="input-field" value={contentType} onChange={(e) => setContentType(e.target.value)}>
            {CONTENT_TYPES.map((c) => ( <option key={c.key} value={c.key}>{c.label}</option> ))}
          </select>
        </div>
        <div className="flex h-[30px]">
          <label className="block text-sm font-medium text-gray-700 mb-1 flex h-full items-center">Qty</label>
          <input className="input-field w-20 ml-2" type="number" min="1" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Usage Rights</label>
          <select className="input-field" value={usageKey} onChange={(e) => setUsageKey(e.target.value)}>
            {USAGE_OPTIONS.map((o) => ( <option key={o.key} value={o.key}>{o.label}</option> ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input id="exclusive" type="checkbox" checked={exclusive} onChange={(e) => setExclusive(e.target.checked)} className="rounded border-gray-300 text-glowgrid-primary focus:ring-glowgrid-primary" />
          <label htmlFor="exclusive" className="text-sm font-medium text-gray-700">Exclusivity (+50%)</label>
        </div>
      </div>

      <div className="glass-panel">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Estimated Rate</h3>
          <div className="text-xl font-bold text-glowgrid-primary">{formatAUD(result.totalCents)}</div>
        </div>
        <ul className="space-y-2 text-sm mb-3">
          {result.lines.map((line, i) => (
            <li key={i} className="flex justify-between">
              <span className="text-gray-600">{line.label}</span>
              <span className="font-mono font-semibold">{formatAUD(line.lineCents)}</span>
            </li>
          ))}
        </ul>
        <details className="text-xs text-gray-500 space-y-1">
          <summary className="cursor-pointer font-medium">Calculation breakdown</summary>
          {result.breakdown.map((b, i) => ( <div key={i} className="pl-2">· {b}</div> ))}
        </details>
      </div>

      <div className="mt-4">
        <button
          onClick={() => onRateCardChange?.({ ...result, tier: tier.label })}
          className="inline-flex items-center gap-2 rounded-md border border-transparent bg-glowgrid-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-glowgrid-primaryHover focus:outline-none focus:ring-2 focus:ring-glowgrid-primary focus:ring-offset-2"
        >
          📋 Add to Media Kit
        </button>
      </div>
    </section>
  );
}