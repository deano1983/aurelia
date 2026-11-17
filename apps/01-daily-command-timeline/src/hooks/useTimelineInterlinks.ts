import { useAureliaEvent } from '@aurelia/core/events'
import { deadlineFromInvoice, deadlineFromRequest, type ExternalDeadline } from '../utils/interlinks'

/**
 * Subscribe 01 to the deadlines other apps send. `enabled` should be false until
 * the timeline has hydrated from localStorage, so nothing is overwritten.
 */
export function useTimelineInterlinks(upsertExternal: (item: ExternalDeadline) => void, enabled: boolean): void {
  useAureliaEvent('invoice.due_set', (e) => upsertExternal(deadlineFromInvoice(e)), enabled)
  useAureliaEvent('timeline.deadline_requested', (e) => upsertExternal(deadlineFromRequest(e)), enabled)
}
