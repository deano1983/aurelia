import type { InboundDeepLink } from '../types'
import { traceInterlink } from '../utils/interlinks'

interface DeepLinkInboxProps {
  link: InboundDeepLink
  onAccept: (payload: Record<string, string>) => void
  onDismiss: () => void
}

export function DeepLinkInbox({ link, onAccept, onDismiss }: DeepLinkInboxProps) {
  const { kind, source, payload } = link

  const sourceLabel: Record<string, string> = {
    '04': '04 CTL Relay',
    '05': '05 GlowGrid Studio',
    '06': '06 Tax Invoice',
  }

  const kindLabel: Record<string, string> = {
    'linkedin-draft': 'Approved LinkedIn draft',
    'rate-card': 'Sponsor rate card',
    'tier-attribution': 'Subscription tier attribution',
  }

  return (
    <div className="min-h-screen bg-slate-50/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
            🔗
          </div>
          <h2 className="text-xl font-bold text-slate-900">Incoming Partner Payload</h2>
        </div>
        <p className="text-slate-600 mb-6">
          A payload was shared from another Aurelia OS app. Apply it to your affiliate engine?
        </p>
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
            Apply to affiliate engine
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
