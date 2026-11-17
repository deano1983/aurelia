import { recipientsOf, useRecentEvents } from '@aurelia/core/events'
import { APP_SHORT_NAMES, describeEvent } from '../utils/interlinks'

function timeAgo(ts: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(ts)) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

/** Last 20 events across the suite, live (BroadcastChannel) and from the outbox. */
export function ActivityFeed({ limit = 20 }: { limit?: number }) {
  const events = useRecentEvents(limit)
  return (
    <section aria-label="Activity" className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
      <h3 className="font-bold text-aurelia-dark mb-4">Activity</h3>
      {events.length === 0 ? (
        <p className="text-sm text-slate-500">No cross-app activity yet. Events from all eight apps appear here.</p>
      ) : (
        <ol className="space-y-3">
          {events.map((e) => {
            const to = recipientsOf(e.type)
            const toLabel = to.length > 3 ? 'all apps' : to.map((id) => APP_SHORT_NAMES[id]).join(', ')
            return (
              <li key={e.id} className="text-sm">
                <p className="text-slate-800 break-words">{describeEvent(e)}</p>
                <p className="text-[11px] text-slate-500">
                  {APP_SHORT_NAMES[e.source]} → {toLabel} · <time dateTime={e.ts}>{timeAgo(e.ts)}</time>
                </p>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
