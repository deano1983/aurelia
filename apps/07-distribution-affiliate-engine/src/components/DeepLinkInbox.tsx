import type { InboundDeepLink, InboxEntry } from '../types'
import { traceInterlink } from '../utils/interlinks'

interface DeepLinkInboxProps {
  link: InboundDeepLink
  onAccept: (payload: Record<string, string>) => void
  onDismiss: () => void
}

const sourceLabel: Record<string, string> = {
  '03': '03 Voice Studio',
  '04': '04 CTL Relay',
  '05': '05 GlowGrid Studio',
  '06': '06 Tax Invoice',
}

const kindLabel: Record<string, string> = {
  'linkedin-draft': 'Approved LinkedIn draft',
  'rate-card': 'Sponsor rate card',
  'tier-attribution': 'Subscription tier attribution',
}

export function DeepLinkInbox({ link, onAccept, onDismiss }: DeepLinkInboxProps) {
  const { kind, source, payload } = link

  return (
    <div className="min-h-screen bg-slate-50/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
            🔗
          </div>
          <h2 className="text-xl font-bold text-slate-900">Incoming Partner Payload</h2>
        </div>
        <div role="alert" className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm">
          <p className="font-semibold">Unverified link</p>
          <p>
            Anyone can create a link like this, so it may not really come from{' '}
            {sourceLabel[source] ?? source}. Read the text below before you apply it: nothing is
            added to your pitches until you do.
          </p>
        </div>
        <p className="text-slate-600 mb-6">Apply this payload to your affiliate engine?</p>
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Source
          </p>
          <p className="text-sm font-semibold text-slate-800">
            {sourceLabel[source] ?? source}
          </p>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-3 mb-1">
            Payload type
          </p>
          <p className="text-sm font-semibold text-slate-800">
            {kindLabel[kind] ?? kind}
          </p>
          {Object.entries(payload).map(([key, value]) => (
            <div key={key} className="mt-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {key}
              </p>
              <p className="text-sm text-slate-700 break-words">{value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <button
            onClick={() => {
              onAccept(payload)
              traceInterlink(source, `affiliate-inbox-accepted:${kind}`, payload)
            }}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            I have checked it: apply
          </button>
          <button
            onClick={onDismiss}
            className="w-full bg-white border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-colors hover:bg-slate-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}

interface InboxListProps {
  entries: InboxEntry[]
  onApply: (entry: InboxEntry) => void
  onDismiss: (id: string) => void
}

function summary(entry: InboxEntry): string {
  const p = entry.payload
  if (entry.kind === 'rate-card') return `${p.tier ?? 'Tier'} · A$${p.rateAud ?? '?'}`
  if (entry.kind === 'tier-attribution') return `${p.tierId ?? ''}${p.partnerId ? ` · ${p.partnerId}` : ''}`
  const text = p.draft ?? ''
  return text.length > 90 ? `${text.slice(0, 90)}…` : text
}

/** Payloads other apps sent on the event bus, waiting to be applied. */
export function InboxList({ entries, onApply, onDismiss }: InboxListProps) {
  if (entries.length === 0) return null
  return (
    <section aria-label="Partner inbox" className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-900">Partner inbox</h2>
        <span className="text-xs text-slate-500">{entries.length} waiting</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {entries.map((entry) => (
          <li key={entry.id} className="py-2 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">
                {kindLabel[entry.kind] ?? entry.kind}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  from {sourceLabel[entry.source] ?? entry.source} · unverified
                </span>
              </p>
              <p className="text-xs text-slate-600 break-words">{summary(entry)}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onApply(entry)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => onDismiss(entry.id)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
