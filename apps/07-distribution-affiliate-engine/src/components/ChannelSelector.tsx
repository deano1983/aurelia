import type { DistributionChannel } from '../types'
import {
  COMMISSION_RATES,
  BOUNTY_CENTS,
  channelLabel,
  channelHub,
  formatAUD,
} from '../utils/commissionCalc'

interface ChannelSelectorProps {
  value: DistributionChannel
  onChange: (channel: DistributionChannel) => void
}

const CHANNELS: DistributionChannel[] = [
  'velvet-cadence',
  'sovereign-brief',
  'glowgrid-studio',
]

export function ChannelSelector({ value, onChange }: ChannelSelectorProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">
        Select Distribution Partner Channel
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {CHANNELS.map((channel) => {
          const rate = COMMISSION_RATES[channel]
          const bounty = BOUNTY_CENTS[channel]
          const selected = value === channel
          return (
            <button
              key={channel}
              onClick={() => onChange(channel)}
              className={[
                'flex flex-col gap-2 p-4 rounded-lg border transition-colors',
                selected
                  ? 'border-affiliate-emerald bg-emerald-50 text-affiliate-dark'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{channelIcon(channel)}</span>
                {selected && (
                  <span className="ml-auto text-emerald-600 font-bold">✓</span>
                )}
              </div>
              <div className="flex justify-between items-start">
                <span className="font-semibold">{channelLabel(channel)}</span>
                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  {rate}%
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-snug">
                {channelHub(channel)}
              </p>
              {bounty !== undefined && (
                <p className="text-xs font-semibold text-amber-700">
                  + {formatAUD(bounty)} one-time bounty
                </p>
              )}
              <p className="text-xs font-medium text-slate-600 mt-auto">
                {rate}% recurring commission
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function channelIcon(channel: DistributionChannel): string {
  switch (channel) {
    case 'velvet-cadence':
      return '🖋️'
    case 'sovereign-brief':
      return '🧳'
    case 'glowgrid-studio':
      return '🎬'
  }
}
