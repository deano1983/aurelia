import type { TimelineItem } from '../types'

export interface BusNotice {
  key: string
  title: string
  sourceApp?: string
  /** The item as it was before the event changed it; null when the event added it. */
  before: TimelineItem | null
}

const APP_NAMES: Record<string, string> = {
  '00': 'Hub',
  '02': 'Asset Vault',
  '03': 'Voice Studio',
  '04': 'CTL Relay',
  '05': 'GlowGrid',
  '06': 'Tax Invoice',
  '07': 'Affiliate Engine',
}

interface BusNoticesProps {
  notices: BusNotice[]
  onUndo: (notice: BusNotice) => void
  onClose: (key: string) => void
}

/**
 * Every timeline change another app makes over the event bus is announced here
 * with an Undo, so nothing changes silently. Cross-app data is labelled unverified.
 */
export function BusNotices({ notices, onUndo, onClose }: BusNoticesProps) {
  if (notices.length === 0) return null
  return (
    <div aria-live="polite" className="fixed left-4 bottom-4 z-40 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
      {notices.map((n) => (
        <div key={n.key} role="status" className="rounded-xl border border-slate-200 bg-white shadow-lg p-3 text-sm">
          <p className="text-slate-800 break-words">
            {n.before ? 'Updated' : 'Added'} <strong>{n.title}</strong>
          </p>
          <p className="text-xs text-slate-500">
            from {n.sourceApp ? `${n.sourceApp} ${APP_NAMES[n.sourceApp] ?? ''}`.trim() : 'another app'} · unverified
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onUndo(n)}
              className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => onClose(n.key)}
              className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Keep
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
