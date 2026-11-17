import { canEmit, isAppId, isEventType, validatePayload, type AppId, type EventPayloads, type EventType } from './catalog'

/** Wire format of every Aurelia event. */
export interface AureliaEvent<T extends EventType = EventType> {
  v: 1
  id: string
  type: T
  source: AppId
  ts: string
  payload: EventPayloads[T]
}

export type AnyAureliaEvent = { [K in EventType]: AureliaEvent<K> }[EventType]

/** Payloads larger than this (as JSON) are rejected: blobs never go on the bus. */
export const MAX_PAYLOAD_BYTES = 64 * 1024

export function newEventId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // Fallback for very old WebViews: RFC 4122 v4 from getRandomValues or Math.random.
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function createEnvelope<T extends EventType>(type: T, payload: EventPayloads[T], source: AppId): AureliaEvent<T> {
  return { v: 1, id: newEventId(), type, source, ts: new Date().toISOString(), payload }
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** Prototype-pollution guard: true when any nested own key is __proto__/constructor/prototype. */
export function hasForbiddenKey(value: unknown, depth = 0): boolean {
  if (typeof value !== 'object' || value === null) return false
  if (depth > 8) return true
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) return true
    if (hasForbiddenKey((value as Record<string, unknown>)[key], depth + 1)) return true
  }
  return false
}

/** Returns null when the value is a valid envelope, or a short reason. */
export function validateEnvelope(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return 'not an object'
  const e = value as Record<string, unknown>
  if (e.v !== 1) return 'unsupported version'
  if (typeof e.id !== 'string' || e.id.length < 8 || e.id.length > 64) return 'invalid id'
  if (!isEventType(e.type)) return `unknown type "${String(e.type).slice(0, 64)}"`
  if (!isAppId(e.source)) return 'invalid source'
  if (!canEmit(e.type, e.source)) return `source ${e.source} may not emit ${e.type}`
  if (typeof e.ts !== 'string' || Number.isNaN(Date.parse(e.ts))) return 'invalid ts'
  let size = 0
  try {
    size = JSON.stringify(e.payload ?? null).length
  } catch {
    return 'payload not serialisable'
  }
  if (size > MAX_PAYLOAD_BYTES) return 'payload too large'
  if (hasForbiddenKey(e.payload)) return 'payload has a forbidden key'
  const reason = validatePayload(e.type, e.payload)
  return reason ? `${e.type}: ${reason}` : null
}

export function isAureliaEvent(value: unknown): value is AnyAureliaEvent {
  return validateEnvelope(value) === null
}
