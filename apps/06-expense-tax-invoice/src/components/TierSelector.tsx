import { useCallback } from 'react'
import type { SubscriptionTier } from '../types'
import { centsToAud } from '../utils/currency'

const CATEGORY_LABEL: Record<string, string> = {
  'professional-development': 'Professional Development',
}

const SUBCATEGORY_LABEL: Record<string, string> = {
  'executive-communications-pr': 'Executive Communications & PR',
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'door-starter',
    door: 'Starter Door',
    name: 'Starter Product Door',
    priceCents: 4900,
    interval: 'month',
    category: 'professional-development',
    subCategory: 'executive-communications-pr',
  },
  {
    id: 'door-professional',
    door: 'Professional Door',
    name: 'Professional Product Door',
    priceCents: 14900,
    interval: 'month',
    category: 'professional-development',
    subCategory: 'executive-communications-pr',
  },
  {
    id: 'door-executive',
    door: 'Executive Door',
    name: 'Executive Product Door',
    priceCents: 39900,
    interval: 'month',
    category: 'professional-development',
    subCategory: 'executive-communications-pr',
    affiliatePartnerId: 'partner-executive-comms',
  },
  {
    id: 'door-enterprise',
    door: 'Enterprise Door',
    name: 'Enterprise Product Door',
    priceCents: 99900,
    interval: 'month',
    category: 'professional-development',
    subCategory: 'executive-communications-pr',
    affiliatePartnerId: 'partner-enterprise',
  },
] as const

interface TierSelectorProps {
  onSelect: (tier: SubscriptionTier) => void
  selected: SubscriptionTier | null
}

export function TierSelector({ onSelect, selected }: TierSelectorProps) {
  const handleSelect = useCallback(
    (tier: SubscriptionTier) => {
      onSelect(tier)
    },
    [onSelect],
  )

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-2">
        Select Product Door / Subscription Tier
      </h2>
      <p className="text-[10px] text-slate-500 mb-4">
        Prices are GST-inclusive AUD. Pre-coded expense:
        {CATEGORY_LABEL['professional-development']} /
        {SUBCATEGORY_LABEL['executive-communications-pr']}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SUBSCRIPTION_TIERS.map((tier) => {
          const isSelected = selected?.id === tier.id
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => handleSelect(tier)}
              className={`flex flex-col items-center p-4 rounded-lg border transition-all ${
                isSelected
                  ? 'bg-blue-50 border-blue-200 text-blue-900 ring-2 ring-blue-600'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {tier.door}
              </div>
              <div className="mb-1 text-base font-bold">{centsToAud(tier.priceCents)}</div>
              <div className="text-xs text-slate-500">{tier.name}</div>
              <div className="text-[10px] text-slate-400 mt-auto">
                / {tier.interval} • {CATEGORY_LABEL[tier.category] ?? tier.category} /
                {SUBCATEGORY_LABEL[tier.subCategory] ?? tier.subCategory}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}