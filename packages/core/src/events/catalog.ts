/**
 * Aurelia event catalog: every cross-app event, who may send it, who it is for,
 * and a hand-written runtime validator for its payload (no dependencies).
 *
 * NOTE for the lead: packages/core/src/manifest/events-catalog.ts (owned by the
 * manifests agent) exports EVENT_CATALOG too. The names below are kept the same
 * so the two can be reconciled into one module.
 */

/** Two-digit app id: 00 is the hub, 01..07 the apps. */
export type AppId = '00' | '01' | '02' | '03' | '04' | '05' | '06' | '07'

export const APP_IDS: readonly AppId[] = ['00', '01', '02', '03', '04', '05', '06', '07']

/** Folder name of each app under /apps/<folder>/ (the hub lives at /). */
export const APP_FOLDERS: Record<AppId, string> = {
  '00': '00-central-hub',
  '01': '01-daily-command-timeline',
  '02': '02-cross-cloud-asset-vault',
  '03': '03-voice-authority-studio',
  '04': '04-ctl-encrypted-relay',
  '05': '05-glowgrid-creator-radar',
  '06': '06-expense-tax-invoice',
  '07': '07-distribution-affiliate-engine',
}

export function isAppId(value: unknown): value is AppId {
  return typeof value === 'string' && (APP_IDS as readonly string[]).includes(value)
}

export interface EventPayloads {
  'invoice.due_set': { dueDate: string; invoiceNumber: string; amountAud?: number }
  'invoice.tier_selected': { tierId: string; partnerId?: string }
  /** The PDF itself is never on the bus: fileId points into IndexedDB aurelia.06.files. */
  'invoice.pdf_exported': { invoiceNumber: string; fileName: string; sizeBytes: number; fileId?: string }
  'vault.pointer_created': { provider: string; pointer: string; label: string }
  'voice.draft_sealed': { packet: string }
  'voice.draft_ready': { text: string; audience: string }
  'glowgrid.rate_card_set': { tier: string; rateAud: number }
  'timeline.deadline_requested': { title: string; category: string; tags: string[]; due: string }
  'hub.session_changed': { status: string }
  'chat.message_received': { roomId: string; count: number }
  'share.posted': { network: string; appId: string }
}

export type EventType = keyof EventPayloads

export interface EventCatalogEntry {
  /** Apps allowed to emit it, or 'any'. */
  from: readonly AppId[] | 'any'
  /** Apps it is addressed to (outbox replay), or 'all'. */
  to: readonly AppId[] | 'all'
  description: string
}

export const EVENT_CATALOG: Record<EventType, EventCatalogEntry> = {
  'invoice.due_set': { from: ['06'], to: ['01'], description: 'Invoice due date becomes a hard deadline in the Timeline' },
  'invoice.tier_selected': { from: ['06'], to: ['07'], description: 'Subscription tier selected, for partner attribution' },
  'invoice.pdf_exported': { from: ['06'], to: ['02'], description: 'Tax invoice PDF exported, pending a vault pointer' },
  'vault.pointer_created': { from: ['02'], to: ['03', '04'], description: 'Cloud proof pointer created in the Asset Vault' },
  'voice.draft_sealed': { from: ['03'], to: ['04'], description: 'Voice draft sealed into a CTL packet' },
  'voice.draft_ready': { from: ['03'], to: ['07'], description: 'Voice drafts generated, ready for distribution' },
  'glowgrid.rate_card_set': { from: ['05'], to: ['07'], description: 'Sponsor rate card calculated' },
  'timeline.deadline_requested': { from: 'any', to: ['01'], description: 'Any app asks the Timeline to add a deadline' },
  'hub.session_changed': { from: ['00'], to: 'all', description: 'Hub session signed in / out / locked' },
  'chat.message_received': { from: ['04'], to: ['00'], description: 'New relay chat messages' },
  'share.posted': { from: 'any', to: ['00'], description: 'Content shared to a social network' },
}

export const EVENT_TYPES = Object.keys(EVENT_CATALOG) as EventType[]

export function isEventType(value: unknown): value is EventType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EVENT_CATALOG, value)
}

/** Apps an event type is addressed to. */
export function recipientsOf(type: EventType): AppId[] {
  const to = EVENT_CATALOG[type].to
  return to === 'all' ? [...APP_IDS] : [...to]
}

export function isAddressedTo(type: EventType, appId: AppId): boolean {
  return recipientsOf(type).includes(appId)
}

export function canEmit(type: EventType, source: AppId): boolean {
  const from = EVENT_CATALOG[type].from
  return from === 'any' || from.includes(source)
}

// ---------- payload validators ----------

/** Returns null when valid, or a short reason. */
export type PayloadValidator = (payload: unknown) => string | null

const MAX_TEXT = 20_000
const MAX_SHORT = 200

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function str(v: unknown, max = MAX_SHORT, allowEmpty = false): boolean {
  return typeof v === 'string' && v.length <= max && (allowEmpty || v.trim().length > 0)
}
function optStr(v: unknown, max = MAX_SHORT): boolean {
  return v === undefined || str(v, max)
}
function nonNegNumber(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}
function nonNegInt(v: unknown): boolean {
  return nonNegNumber(v) && Number.isInteger(v)
}

/** YYYY-MM-DD that is a real calendar date. */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** YYYY-MM-DD or a full ISO-8601 date-time. */
export function isIsoDateOrDateTime(v: unknown): v is string {
  if (isIsoDate(v)) return true
  return (
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(v) &&
    !Number.isNaN(Date.parse(v))
  )
}

function shape(checks: Record<string, (v: unknown) => boolean>): PayloadValidator {
  return (payload) => {
    if (!isObj(payload)) return 'payload is not an object'
    for (const [key, check] of Object.entries(checks)) {
      if (!check(payload[key])) return `invalid field "${key}"`
    }
    return null
  }
}

export const PAYLOAD_VALIDATORS: Record<EventType, PayloadValidator> = {
  'invoice.due_set': shape({
    dueDate: isIsoDate,
    invoiceNumber: (v) => str(v, 64),
    amountAud: (v) => v === undefined || nonNegNumber(v),
  }),
  'invoice.tier_selected': shape({ tierId: (v) => str(v, 64), partnerId: (v) => optStr(v, 64) }),
  'invoice.pdf_exported': shape({
    invoiceNumber: (v) => str(v, 64),
    fileName: (v) => str(v, 255),
    sizeBytes: nonNegInt,
    fileId: (v) => optStr(v, 128),
  }),
  'vault.pointer_created': shape({ provider: (v) => str(v, 64), pointer: (v) => str(v, 4096), label: (v) => str(v, 255, true) }),
  'voice.draft_sealed': shape({ packet: (v) => str(v, 64_000) }),
  'voice.draft_ready': shape({ text: (v) => str(v, MAX_TEXT), audience: (v) => str(v, 64) }),
  'glowgrid.rate_card_set': shape({ tier: (v) => str(v, 64), rateAud: nonNegNumber }),
  'timeline.deadline_requested': shape({
    title: (v) => str(v, 255),
    category: (v) => str(v, 64),
    tags: (v) => Array.isArray(v) && v.length <= 20 && v.every((t) => str(t, 64)),
    due: isIsoDateOrDateTime,
  }),
  'hub.session_changed': shape({ status: (v) => typeof v === 'string' && /^[a-z][a-z_-]{0,31}$/.test(v) }),
  'chat.message_received': shape({ roomId: (v) => str(v, 128), count: nonNegInt }),
  'share.posted': shape({ network: (v) => str(v, 64), appId: isAppId }),
}

export function validatePayload<T extends EventType>(type: T, payload: unknown): string | null {
  return PAYLOAD_VALIDATORS[type](payload)
}
