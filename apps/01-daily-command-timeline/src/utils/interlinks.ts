/**
 * Cross-app interlinks for 01 Daily Command Timeline.
 *
 * Inbound over the @aurelia/core event bus (live via BroadcastChannel, or from
 * the IndexedDB outbox when 01 was closed at the time):
 * - invoice.due_set              ← 06 Tax Invoice   (hard report deadline)
 * - timeline.deadline_requested  ← any app
 * Each becomes one timeline item keyed by `externalKey`, so repeats update the
 * existing item instead of adding duplicates.
 */
import { configureEvents, type AureliaEvent } from '@aurelia/core/events'
import type { TimelineCategory, TimelineItem, TimelineTag } from '../types'

export const APP_ID_TIMELINE = '01'

configureEvents({ appId: APP_ID_TIMELINE })

export type ExternalDeadline = Omit<TimelineItem, 'id' | 'createdAt' | 'completed'> & { externalKey: string }

const CATEGORIES: TimelineCategory[] = ['creator', 'linkedin-executive', 'board', 'personal', 'life']
const TAGS: TimelineTag[] = ['flexible-content-upload', 'hard-report-deadline', 'protected-life-event']

const audFormat = (n: number) =>
  n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 })

export function deadlineFromInvoice(event: AureliaEvent<'invoice.due_set'>): ExternalDeadline {
  const { dueDate, invoiceNumber, amountAud } = event.payload
  return {
    externalKey: `invoice:${invoiceNumber}`,
    title: `Tax invoice ${cleanText(invoiceNumber, 64)} due`,
    category: 'board',
    tags: ['hard-report-deadline'],
    dueDate,
    description: amountAud !== undefined ? `Amount ${audFormat(amountAud)} (incl. GST)` : undefined,
    slot: 'custom',
    sourceApp: event.source,
  }
}

function splitDue(due: string): { dueDate: string; dueTime?: string } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) return { dueDate: due }
  const d = new Date(due)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    dueDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    dueTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

/** Bus text is untrusted too: drop control characters and cap the length. */
function cleanText(value: string, max: number): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max)
}

export function deadlineFromRequest(event: AureliaEvent<'timeline.deadline_requested'>): ExternalDeadline {
  const { category, tags, due } = event.payload
  const title = cleanText(event.payload.title, 200)
  const { dueDate, dueTime } = splitDue(due)
  return {
    externalKey: `request:${event.source}:${title}:${due}`,
    title,
    category: CATEGORIES.includes(category as TimelineCategory) ? (category as TimelineCategory) : 'personal',
    tags: tags.filter((t): t is TimelineTag => TAGS.includes(t as TimelineTag)),
    dueDate,
    dueTime,
    slot: 'custom',
    sourceApp: event.source,
  }
}

/** Insert, or update the item that already has the same externalKey. */
export function upsertExternalItem(items: TimelineItem[], next: ExternalDeadline, now = new Date().toISOString()): TimelineItem[] {
  const index = items.findIndex((i) => i.externalKey === next.externalKey)
  if (index === -1) {
    return [...items, { ...next, id: crypto.randomUUID(), createdAt: now, completed: false }]
  }
  const current = items[index]
  const merged: TimelineItem = { ...current, ...next, id: current.id, createdAt: current.createdAt, completed: current.completed }
  const copy = items.slice()
  copy[index] = merged
  return copy
}
