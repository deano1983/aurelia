import type { DistributionChannel } from '../types'
import { CopyButton } from './CopyButton'
import {
  COMMISSION_RATES,
  BOUNTY_CENTS,
  channelLabel,
  channelHub,
  formatAUD,
} from '../utils/commissionCalc'

interface PartnerCardProps {
  channel: DistributionChannel
  selected: boolean
  onSelect: (channel: DistributionChannel) => void
}

interface PartnerCardsProps {
  selectedChannel: DistributionChannel
  onSelectChannel: (channel: DistributionChannel) => void
}

const CHANNELS: DistributionChannel[] = [
  'velvet-cadence',
  'sovereign-brief',
  'glowgrid-studio',
]

const PITCH_BY_CHANNEL: Record<DistributionChannel, string> = {
  'velvet-cadence':
    "Hi {{partner_name}}, I've been running my LinkedIn executive presence on Aurelia OS and think the Velvet Cadence network is a perfect fit — you earn 30% recurring on every referral, with approved LinkedIn drafts ready to share. {{your_name}} {{draft_link}}",
  'sovereign-brief':
    'Hi {{partner_name}}, Sovereign Brief EAs earn a $100 one-time bounty plus 25% recurring on every executive referral to Aurelia OS. Ready when you are. {{your_name}}',
  'glowgrid-studio':
    'Hi {{partner_name}}, GlowGrid creators get 35% recurring on UGC creator referrals to Aurelia OS — copy your one-click pitch below and start your viral loop. {{your_name}}',
}

export function PartnerCard({ channel, selected, onSelect }: PartnerCardProps) {
  const rate = COMMISSION_RATES[channel]
  const bounty = BOUNTY_CENTS[channel]
  const pitch = PITCH_BY_CHANNEL[channel]

  return (
    <article
      className={[
        'rounded-xl border p-5 transition-colors',
        selected
          ? 'border-affiliate-emerald bg-emerald-50/40 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{channelIcon(channel)}</span>
        <span className="font-semibold text-slate-800">{channelLabel(channel)}</span>
      </div>
      <p className="text-xs text-slate-500 mb-3 leading-snug">
        {channelHub(channel)}
      </p>
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-emerald-600">{rate}%</span>
          <span className="text-xs text-slate-500">recurring commission</span>
        </div>
        {bounty !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-amber-700">+ {formatAUD(bounty)}</span>
            <span className="text-xs text-slate-500">one-time bounty</span>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <button
          onClick={() => onSelect(channel)}
          className="w-full py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Select channel
        </button>
        <CopyButton text={pitch} label="Copy pitch" size="sm" />
      </div>
    </article>
  )
}

export function PartnerCards({
  selectedChannel,
  onSelectChannel,
}: PartnerCardsProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-700">Distribution Hubs</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {CHANNELS.map((channel) => (
          <PartnerCard
            key={channel}
            channel={channel}
            selected={selectedChannel === channel}
            onSelect={onSelectChannel}
          />
        ))}
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
