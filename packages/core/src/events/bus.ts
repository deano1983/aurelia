import { isAddressedTo, isAppId, isEventType, type AppId, type EventPayloads, type EventType } from './catalog'
import { createEnvelope, validateEnvelope, type AnyAureliaEvent, type AureliaEvent } from './envelope'
import { Outbox } from './outbox'

/**
 * Aurelia event bus.
 *
 * Live delivery: BroadcastChannel('aurelia') between every tab/app on the origin
 * (falls back to localStorage 'storage' events where BroadcastChannel is missing).
 * Late delivery: the IndexedDB outbox. When an app registers a handler it replays
 * the outbox events addressed to it that its cursor has not acked yet.
 * Everything degrades to a no-op without BroadcastChannel / IndexedDB / storage.
 */

export type EventHandler<T extends EventType> = (event: AureliaEvent<T>) => void
export type AnyEventHandler = (event: AnyAureliaEvent) => void

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

type ChannelCtor = new (name: string) => BroadcastChannel

export interface EventBusOptions {
  appId: AppId
  BroadcastChannel?: ChannelCtor | null
  indexedDB?: IDBFactory | null
  storage?: StorageLike | null
  channelName?: string
  dbName?: string
}

export interface EventCursor {
  /** Newest acked event timestamp. */
  ts: string
  /** Recently acked ids (bounded), so out-of-order events near ts are not lost. */
  seen: string[]
}

export const CHANNEL_NAME = 'aurelia'
const STORAGE_BUS_KEY = 'aurelia.events.bus'
const CURSOR_SEEN_MAX = 500
/** Events up to this much older than the cursor are still replayed if not seen. */
const CURSOR_SKEW_MS = 60_000

export const cursorKey = (appId: AppId) => `aurelia.${appId}.events.cursor`

const warned = new Set<string>()
/** Log a rejected event once per reason; never throws into UI code. */
export function warnOnce(reason: string): void {
  if (warned.has(reason)) return
  warned.add(reason)
  try {
    console.warn(`[aurelia/events] rejected: ${reason}`)
  } catch {
    /* console unavailable */
  }
}

function defaultChannel(): ChannelCtor | null {
  return typeof globalThis.BroadcastChannel === 'function' ? globalThis.BroadcastChannel : null
}
function defaultIdb(): IDBFactory | null {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB ? indexedDB : null
  } catch {
    return null
  }
}
function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' && localStorage ? localStorage : null
  } catch {
    return null
  }
}

export function readCursor(storage: StorageLike | null, appId: AppId): EventCursor {
  const empty: EventCursor = { ts: new Date(0).toISOString(), seen: [] }
  if (!storage) return empty
  try {
    const raw = storage.getItem(cursorKey(appId))
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<EventCursor>
    return {
      ts: typeof parsed.ts === 'string' && !Number.isNaN(Date.parse(parsed.ts)) ? parsed.ts : empty.ts,
      seen: Array.isArray(parsed.seen) ? parsed.seen.filter((s): s is string => typeof s === 'string') : [],
    }
  } catch {
    return empty
  }
}

/** True when the cursor has not acked this event yet. */
export function isPending(cursor: EventCursor, event: AnyAureliaEvent): boolean {
  if (cursor.seen.includes(event.id)) return false
  return Date.parse(event.ts) > Date.parse(cursor.ts) - CURSOR_SKEW_MS
}

export class EventBus {
  appId: AppId
  readonly outbox: Outbox
  private readonly storage: StorageLike | null
  private channel: BroadcastChannel | null = null
  private readonly handlers = new Map<EventType, Set<EventHandler<EventType>>>()
  private readonly anyHandlers = new Set<AnyEventHandler>()
  /** Ids already given to type handlers / any-handlers in this instance. */
  private readonly delivered = new Set<string>()
  private readonly anyDelivered = new Set<string>()
  private readonly pendingWrites = new Set<Promise<void>>()
  private replayTimer: ReturnType<typeof setTimeout> | null = null
  private replayChain: Promise<number> = Promise.resolve(0)
  private readonly onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_BUS_KEY || !e.newValue) return
    try {
      this.receive(JSON.parse(e.newValue), 'live')
    } catch {
      warnOnce('unparseable storage message')
    }
  }
  private closed = false

  constructor(opts: EventBusOptions) {
    this.appId = opts.appId
    this.storage = opts.storage === undefined ? defaultStorage() : opts.storage
    this.outbox = new Outbox(opts.indexedDB === undefined ? defaultIdb() : opts.indexedDB, opts.dbName)
    const Ctor = opts.BroadcastChannel === undefined ? defaultChannel() : opts.BroadcastChannel
    if (Ctor) {
      try {
        this.channel = new Ctor(opts.channelName ?? CHANNEL_NAME)
        this.channel.onmessage = (msg: MessageEvent) => this.receive(msg.data, 'live')
      } catch {
        this.channel = null
      }
    }
    if (!this.channel && this.storage && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', this.onStorage)
    }
  }

  /**
   * Validate, deliver locally, broadcast and persist an event.
   * Returns the envelope, or null when rejected (logged once, never throws).
   */
  emit<T extends EventType>(type: T, payload: EventPayloads[T], opts: { source?: AppId } = {}): AureliaEvent<T> | null {
    if (this.closed) return null
    if (!isEventType(type)) {
      warnOnce(`unknown type "${String(type)}"`)
      return null
    }
    const source = opts.source ?? this.appId
    if (!isAppId(source)) {
      warnOnce('invalid source')
      return null
    }
    const event = createEnvelope(type, payload, source)
    const reason = validateEnvelope(event)
    if (reason) {
      warnOnce(reason)
      return null
    }
    // Same-tab listeners first (BroadcastChannel does not echo to its sender).
    this.receive(event, 'local')
    if (this.channel) {
      try {
        this.channel.postMessage(event)
      } catch {
        /* closed channel */
      }
    } else if (this.storage) {
      try {
        this.storage.setItem(STORAGE_BUS_KEY, JSON.stringify(event))
        this.storage.removeItem(STORAGE_BUS_KEY)
      } catch {
        /* quota / private mode */
      }
    }
    const write = this.outbox.put(event as AnyAureliaEvent).catch(() => undefined)
    this.pendingWrites.add(write)
    void write.finally(() => this.pendingWrites.delete(write))
    return event
  }

  /** Subscribe to one event type. Returns an unsubscribe function. */
  on<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
    if (!isEventType(type)) {
      warnOnce(`unknown type "${String(type)}"`)
      return () => undefined
    }
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler as EventHandler<EventType>)
    if (isAddressedTo(type, this.appId)) this.scheduleReplay()
    return () => {
      set?.delete(handler as EventHandler<EventType>)
    }
  }

  /** Subscribe to every live event (hub activity feed, unread badges). */
  onAny(handler: AnyEventHandler): () => void {
    this.anyHandlers.add(handler)
    return () => {
      this.anyHandlers.delete(handler)
    }
  }

  private receive(data: unknown, origin: 'live' | 'local' | 'outbox'): void {
    if (this.closed) return
    const reason = validateEnvelope(data)
    if (reason) {
      warnOnce(reason)
      return
    }
    const event = data as AnyAureliaEvent

    if (origin !== 'outbox' && !this.anyDelivered.has(event.id)) {
      this.anyDelivered.add(event.id)
      for (const h of [...this.anyHandlers]) {
        try {
          h(event)
        } catch (err) {
          warnOnce(`any-handler threw on ${event.type}: ${String(err)}`)
        }
      }
    }

    if (this.delivered.has(event.id)) return
    const set = this.handlers.get(event.type)
    if (!set || set.size === 0) return // stays pending in the outbox until a handler registers
    // Another tab of this same app already handled it.
    if (origin !== 'local' && readCursor(this.storage, this.appId).seen.includes(event.id)) {
      this.delivered.add(event.id)
      return
    }
    this.delivered.add(event.id)
    let ok = true
    for (const h of [...set]) {
      try {
        h(event as AureliaEvent<EventType>)
      } catch (err) {
        ok = false
        warnOnce(`handler threw on ${event.type}: ${String(err)}`)
      }
    }
    if (ok) this.ack(event)
  }

  /** Mark an event as handled by this app (per-app cursor in localStorage). */
  ack(event: AnyAureliaEvent): void {
    if (!this.storage) return
    const cursor = readCursor(this.storage, this.appId)
    if (cursor.seen.includes(event.id)) return
    const seen = [...cursor.seen, event.id].slice(-CURSOR_SEEN_MAX)
    const ts = Date.parse(event.ts) > Date.parse(cursor.ts) ? event.ts : cursor.ts
    try {
      this.storage.setItem(cursorKey(this.appId), JSON.stringify({ ts, seen }))
    } catch {
      /* quota */
    }
  }

  cursor(appId: AppId = this.appId): EventCursor {
    return readCursor(this.storage, appId)
  }

  private scheduleReplay(): void {
    if (this.replayTimer !== null) return
    this.replayTimer = setTimeout(() => {
      this.replayTimer = null
      void this.replay()
    }, 0)
  }

  /** Deliver outbox events addressed to this app that it has not acked. Resolves to the count delivered. */
  replay(): Promise<number> {
    this.replayChain = this.replayChain.then(async () => {
      if (this.closed) return 0
      const events = await this.outbox.list()
      const cursor = readCursor(this.storage, this.appId)
      let count = 0
      for (const e of events) {
        if (validateEnvelope(e)) continue
        if (!isAddressedTo(e.type, this.appId) || e.source === this.appId) continue
        if (this.delivered.has(e.id) || !isPending(cursor, e)) continue
        if (!this.handlers.get(e.type)?.size) continue
        this.receive(e, 'outbox')
        count++
      }
      return count
    })
    return this.replayChain
  }

  /** Most recent events across the suite, newest first. */
  async recent(limit = 20): Promise<AnyAureliaEvent[]> {
    const events = await this.outbox.list()
    return events.filter((e) => !validateEnvelope(e)).reverse().slice(0, limit)
  }

  /** Events addressed to appId (not sent by it) that its cursor has not acked. */
  async unreadCount(appId: AppId): Promise<number> {
    const cursor = readCursor(this.storage, appId)
    const events = await this.outbox.list()
    return events.filter((e) => e.source !== appId && isAddressedTo(e.type, appId) && isPending(cursor, e)).length
  }

  /** Resolves once every outbox write started so far has finished. */
  async flush(): Promise<void> {
    await Promise.all([...this.pendingWrites])
  }

  close(): void {
    this.closed = true
    if (this.replayTimer !== null) clearTimeout(this.replayTimer)
    try {
      this.channel?.close()
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('storage', this.onStorage)
    }
    this.outbox.close()
    this.handlers.clear()
    this.anyHandlers.clear()
  }
}

// ---------- default per-page bus ----------

let defaultBus: EventBus | null = null
let configured: Omit<EventBusOptions, 'appId'> & { appId?: AppId } = {}

/** Infer the app id from /apps/NN-folder/ in the URL; the hub (/) is 00. */
export function inferAppId(): AppId {
  try {
    const m = /\/apps\/(\d\d)-/.exec(globalThis.location?.pathname ?? '')
    if (m && isAppId(m[1])) return m[1]
  } catch {
    /* no location (SSR) */
  }
  return '00'
}

/** Set this page's app id (and optionally transports) before the first emit/on. */
export function configureEvents(opts: Partial<EventBusOptions>): EventBus {
  configured = { ...configured, ...opts }
  if (defaultBus && opts.appId && Object.keys(opts).length === 1) {
    defaultBus.appId = opts.appId
    return defaultBus
  }
  defaultBus?.close()
  defaultBus = null
  return getEventBus()
}

export function getEventBus(): EventBus {
  if (!defaultBus) defaultBus = new EventBus({ ...configured, appId: configured.appId ?? inferAppId() })
  return defaultBus
}

/** Test helper: drop the default bus. */
export function resetEventBus(): void {
  defaultBus?.close()
  defaultBus = null
  configured = {}
  warned.clear()
}

export function emit<T extends EventType>(type: T, payload: EventPayloads[T], opts: { source?: AppId } = {}): AureliaEvent<T> | null {
  try {
    return getEventBus().emit(type, payload, opts)
  } catch (err) {
    warnOnce(`emit failed: ${String(err)}`)
    return null
  }
}

export function on<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
  try {
    return getEventBus().on(type, handler)
  } catch (err) {
    warnOnce(`on failed: ${String(err)}`)
    return () => undefined
  }
}

export function onAny(handler: AnyEventHandler): () => void {
  try {
    return getEventBus().onAny(handler)
  } catch {
    return () => undefined
  }
}
