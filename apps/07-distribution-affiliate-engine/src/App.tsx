import { useCallback, useEffect, useState } from 'react'
import { ChannelSelector } from './components/ChannelSelector'
import { PartnerCards } from './components/PartnerCards'
import { PitchTemplates } from './components/PitchTemplates'
import { CommissionLedger } from './components/CommissionLedger'
import { DeepLinkInbox, InboxList } from './components/DeepLinkInbox'
import { CopyButton } from './components/CopyButton'
import { parseInboundDeepLink, useAffiliateInbox } from './utils/interlinks'
import { UpdateBanner } from '@aurelia/core/events'
import { loadJSON, saveJSON, STORAGE_KEYS } from './utils/storage'
import type {
  DistributionChannel,
  DistributionPartner,
  InboundDeepLink,
} from './types'

const DEFAULT_CHANNEL: DistributionChannel = 'velvet-cadence'

const DEFAULT_PARTNERS: DistributionPartner[] = [
  {
    id: 'vc-001',
    name: 'Velvet Cadence Agency',
    channel: 'velvet-cadence',
    commissionRatePercent: 30,
    status: 'active',
    joinedAt: new Date().toISOString(),
  },
  {
    id: 'sb-001',
    name: 'Sovereign Brief EA Network',
    channel: 'sovereign-brief',
    commissionRatePercent: 25,
    bountyCents: 10_000,
    status: 'active',
    joinedAt: new Date().toISOString(),
  },
  {
    id: 'gg-001',
    name: 'GlowGrid Creator Coaches',
    channel: 'glowgrid-studio',
    commissionRatePercent: 35,
    status: 'active',
    joinedAt: new Date().toISOString(),
  },
]

export default function App() {
  const [partners, setPartners] = useState<DistributionPartner[]>(() =>
    loadJSON(STORAGE_KEYS.partners, DEFAULT_PARTNERS),
  )
  const [selectedChannel, setSelectedChannel] = useState<DistributionChannel>(
    DEFAULT_CHANNEL,
  )
  const [prefillDraft, setPrefillDraft] = useState<string | null>(null)
  const [prefillPartner, setPrefillPartner] = useState<string | null>(null)
  const [inbound, setInbound] = useState<InboundDeepLink | null>(null)
  const [timelinePayoutUrl, setTimelinePayoutUrl] = useState<string | null>(
    null,
  )

  useEffect(() => {
    if (partners.length === 0) {
      setPartners(DEFAULT_PARTNERS)
      saveJSON(STORAGE_KEYS.partners, DEFAULT_PARTNERS)
    }
  }, [partners])

  useEffect(() => {
    const link = parseInboundDeepLink()
    if (link) {
      setInbound(link)
    }
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ url: string }>).detail
      setTimelinePayoutUrl(detail.url)
    }
    window.addEventListener('affiliate:payout-scheduled', handler)
    return () =>
      window.removeEventListener('affiliate:payout-scheduled', handler)
  }, [])

  const handleSelectChannel = useCallback((channel: DistributionChannel) => {
    setSelectedChannel(channel)
  }, [])

  // Payloads from 03 / 05 / 06 on the event bus.
  const { entries: inboxEntries, remove: dropInboxEntry } = useAffiliateInbox()

  const applyInbound = useCallback(
    (link: InboundDeepLink) => {
      const payload = link.payload
      if (link.kind === 'linkedin-draft') {
        setSelectedChannel('velvet-cadence')
        setPrefillDraft(payload.draft ?? null)
      } else if (link.kind === 'rate-card') {
        setSelectedChannel('glowgrid-studio')
        setPrefillPartner(payload.creator ?? null)
      } else if (link.kind === 'tier-attribution') {
        const partner = partners.find((p) => p.id === payload.partnerId)
        if (partner) {
          setSelectedChannel(partner.channel)
          setPrefillPartner(partner.name)
        }
      }
    },
    [partners],
  )

  const handleAcceptInbound = useCallback(
    (payload: Record<string, string>) => {
      if (!inbound) return
      applyInbound({ ...inbound, payload })
      setInbound(null)
      window.location.hash = ''
    },
    [inbound, applyInbound],
  )

  const handleDismissInbound = useCallback(() => {
    setInbound(null)
    window.location.hash = ''
  }, [])

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-affiliate-emerald flex items-center justify-center text-white font-bold">
              🤝
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Affiliate Engine</h1>
              <p className="text-xs text-slate-500">
                Zero-Ad-Spend Distribution &amp; Partner Commissions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded border border-slate-200 text-slate-500">
              ← 04 CTL Relay drafts
            </span>
            <span className="px-2 py-0.5 rounded border border-slate-200 text-slate-500">
              ← 05 GlowGrid rate cards
            </span>
            <span className="px-2 py-0.5 rounded border border-slate-200 text-slate-500">
              ← 06 Tax Invoice tiers
            </span>
            <span className="px-2 py-0.5 rounded border border-slate-200 text-slate-500">
              → 01 Timeline payouts
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <InboxList
          entries={inboxEntries}
          onApply={(entry) => {
            applyInbound(entry)
            dropInboxEntry(entry.id)
          }}
          onDismiss={dropInboxEntry}
        />
        {timelinePayoutUrl && (
          <div className="mb-4 p-4 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
            <p className="font-semibold mb-1">Payout scheduled → 01 Timeline</p>
            <div className="flex items-center gap-2">
              <CopyButton
                text={timelinePayoutUrl}
                label="Copy timeline link"
                size="sm"
              />
              <a
                href={timelinePayoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 underline hover:text-emerald-700"
              >
                Open in 01 Timeline
              </a>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-3 space-y-6">
            <ChannelSelector
              value={selectedChannel}
              onChange={handleSelectChannel}
            />
            <PartnerCards
              selectedChannel={selectedChannel}
              onSelectChannel={handleSelectChannel}
            />
          </aside>
          <section className="lg:col-span-1 space-y-6">
            <PitchTemplates
              channel={selectedChannel}
              prefillDraft={prefillDraft}
              prefillPartner={prefillPartner}
            />
          </section>
          <section className="lg:col-span-2 space-y-6">
            <CommissionLedger partners={partners} />
          </section>
        </div>
      </main>

      {inbound && (
        <DeepLinkInbox
          link={inbound}
          onAccept={handleAcceptInbound}
          onDismiss={handleDismissInbound}
        />
      )}
      <UpdateBanner />
    </div>
  )
}

