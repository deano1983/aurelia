// @vitest-environment jsdom
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventBus, cursorKey, readCursor } from './bus'
import { EVENT_CATALOG, EVENT_TYPES, validatePayload } from './catalog'
import { createEnvelope, validateEnvelope } from './envelope'
import { OUTBOX_MAX, OUTBOX_RETENTION_MS } from './outbox'
import { createFakeOrigin, settle } from './testing'

let origin: ReturnType<typeof createFakeOrigin>
let idb: IDBFactory
const buses: EventBus[] = []

function app(appId: EventBus['appId'], extra: Partial<ConstructorParameters<typeof EventBus>[0]> = {}) {
  const bus = new EventBus({ appId, BroadcastChannel: origin.BroadcastChannel, indexedDB: idb, storage: origin.storage, ...extra })
  buses.push(bus)
  return bus
}

beforeEach(() => {
  origin = createFakeOrigin()
  idb = new IDBFactory()
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => {
  buses.splice(0).forEach((b) => b.close())
  vi.restoreAllMocks()
})

describe('envelope validation', () => {
  it('accepts a well-formed envelope', () => {
    const e = createEnvelope('invoice.due_set', { dueDate: '2026-12-01', invoiceNumber: 'INV-1' }, '06')
    expect(e.v).toBe(1)
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(validateEnvelope(e)).toBeNull()
  })

  it('rejects unknown types, bad versions, bad sources and wrong senders', () => {
    const good = createEnvelope('invoice.due_set', { dueDate: '2026-12-01', invoiceNumber: 'INV-1' }, '06')
    expect(validateEnvelope({ ...good, type: 'invoice.nope' })).toMatch(/unknown type/)
    expect(validateEnvelope({ ...good, v: 2 })).toMatch(/version/)
    expect(validateEnvelope({ ...good, source: '9' })).toMatch(/source/)
    expect(validateEnvelope({ ...good, source: '03' })).toMatch(/may not emit/)
    expect(validateEnvelope({ ...good, ts: 'yesterday' })).toMatch(/ts/)
    expect(validateEnvelope(null)).toBeTruthy()
  })

  it('validates every catalog payload', () => {
    expect(EVENT_TYPES).toHaveLength(11)
    expect(Object.keys(EVENT_CATALOG)).toEqual(EVENT_TYPES)
    expect(validatePayload('invoice.due_set', { dueDate: '2026-02-30', invoiceNumber: 'X' })).toMatch(/dueDate/)
    expect(validatePayload('invoice.due_set', { dueDate: '2026-02-28', invoiceNumber: 'X', amountAud: -1 })).toMatch(/amountAud/)
    expect(validatePayload('invoice.pdf_exported', { invoiceNumber: 'X', fileName: 'a.pdf', sizeBytes: 1.5 })).toMatch(/sizeBytes/)
    expect(validatePayload('timeline.deadline_requested', { title: 't', category: 'board', tags: ['a'], due: '2026-12-01T09:00:00Z' })).toBeNull()
    expect(validatePayload('timeline.deadline_requested', { title: 't', category: 'board', tags: 'a', due: '2026-12-01' })).toMatch(/tags/)
    expect(validatePayload('share.posted', { network: 'linkedin', appId: '42' })).toMatch(/appId/)
    expect(validatePayload('glowgrid.rate_card_set', { tier: 'Micro', rateAud: 450 })).toBeNull()
    expect(validatePayload('hub.session_changed', { status: 'signed_in' })).toBeNull()
    expect(validatePayload('chat.message_received', { roomId: 'r', count: 2 })).toBeNull()
  })
})

describe('event bus', () => {
  it('delivers live across apps, and to same-page listeners', async () => {
    const a06 = app('06')
    const a01 = app('01')
    const remote = vi.fn()
    const local = vi.fn()
    a01.on('invoice.due_set', remote)
    a06.on('invoice.due_set', local)
    a06.emit('invoice.due_set', { dueDate: '2026-12-01', invoiceNumber: 'INV-7' })
    await settle()
    expect(remote).toHaveBeenCalledTimes(1)
    expect(local).toHaveBeenCalledTimes(1)
    expect(remote.mock.calls[0][0].payload.invoiceNumber).toBe('INV-7')
    expect(remote.mock.calls[0][0].source).toBe('06')
  })

  it('rejects invalid payloads and unknown types without throwing, logging once', async () => {
    const a06 = app('06')
    const a01 = app('01')
    const h = vi.fn()
    a01.on('invoice.due_set', h)
    // @ts-expect-error deliberately wrong payload
    expect(a06.emit('invoice.due_set', { dueDate: 'soon' })).toBeNull()
    // @ts-expect-error deliberately wrong payload
    expect(a06.emit('invoice.due_set', { dueDate: 'soon' })).toBeNull()
    // @ts-expect-error unknown type
    expect(a06.emit('nope.event', {})).toBeNull()
    // A forged message straight on the channel is dropped too.
    const raw = new origin.BroadcastChannel('aurelia')
    raw.postMessage({ v: 1, id: 'abcdefgh-1', type: 'invoice.due_set', source: '06', ts: new Date().toISOString(), payload: { dueDate: 'x' } })
    raw.close()
    await settle()
    expect(h).not.toHaveBeenCalled()
    const warns = (console.warn as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]))
    expect(warns.filter((w) => w.includes('dueDate'))).toHaveLength(1)
    expect(warns.some((w) => w.includes('unknown type'))).toBe(true)
  })

  it('dedupes by id (live + outbox + re-broadcast)', async () => {
    const a06 = app('06')
    const a01 = app('01')
    const h = vi.fn()
    a01.on('invoice.due_set', h)
    const e = a06.emit('invoice.due_set', { dueDate: '2026-12-01', invoiceNumber: 'INV-8' })!
    await a06.flush()
    await settle()
    const raw = new origin.BroadcastChannel('aurelia')
    raw.postMessage(e)
    raw.postMessage(e)
    raw.close()
    await a01.replay()
    await settle()
    expect(h).toHaveBeenCalledTimes(1)
  })

  it('delivers outbox events to a late subscriber, then acks via the per-app cursor', async () => {
    const a06 = app('06')
    a06.emit('invoice.due_set', { dueDate: '2026-12-01', invoiceNumber: 'INV-9' })
    a06.emit('invoice.tier_selected', { tierId: 'pro' }) // addressed to 07, not 01
    await a06.flush()

    const unread = await a06.unreadCount('01')
    expect(unread).toBe(1)

    // 01 opens later: nothing was listening when the event was broadcast.
    const a01 = app('01')
    const h = vi.fn()
    a01.on('invoice.due_set', h)
    a01.on('invoice.tier_selected', h) // not addressed to 01: never replayed
    await settle()
    await a01.replay()
    expect(h).toHaveBeenCalledTimes(1)
    expect(h.mock.calls[0][0].payload.invoiceNumber).toBe('INV-9')

    const cursor = readCursor(origin.storage, '01')
    expect(cursor.seen).toContain(h.mock.calls[0][0].id)
    expect(origin.storage.getItem(cursorKey('01'))).toBeTruthy()
    expect(await a06.unreadCount('01')).toBe(0)

    // Re-opening 01 does not deliver it again.
    a01.close()
    const again = app('01')
    const h2 = vi.fn()
    again.on('invoice.due_set', h2)
    await settle()
    await again.replay()
    expect(h2).not.toHaveBeenCalled()
  })

  it('does not ack when the handler throws, so the event is retried', async () => {
    const a06 = app('06')
    a06.emit('invoice.due_set', { dueDate: '2026-12-01', invoiceNumber: 'INV-10' })
    await a06.flush()
    const a01 = app('01')
    a01.on('invoice.due_set', () => {
      throw new Error('boom')
    })
    await settle()
    await a01.replay()
    expect(readCursor(origin.storage, '01').seen).toHaveLength(0)
    a01.close()
    const retry = app('01')
    const h = vi.fn()
    retry.on('invoice.due_set', h)
    await settle()
    await retry.replay()
    expect(h).toHaveBeenCalledTimes(1)
  })

  it('prunes the outbox to 7 days and 500 events', async () => {
    const bus = app('06')
    const old = createEnvelope('invoice.due_set', { dueDate: '2026-01-01', invoiceNumber: 'OLD' }, '06')
    old.ts = new Date(Date.now() - OUTBOX_RETENTION_MS - 1000).toISOString()
    await bus.outbox.put(old)
    for (let i = 0; i < OUTBOX_MAX + 5; i++) {
      const e = createEnvelope('share.posted', { network: 'x', appId: '05' }, '05')
      e.ts = new Date(Date.now() - (OUTBOX_MAX + 5 - i) * 1000).toISOString()
      await bus.outbox.put(e)
    }
    const all = await bus.outbox.list()
    expect(all).toHaveLength(OUTBOX_MAX)
    expect(all.some((e) => e.type === 'invoice.due_set')).toBe(false)
    const recent = await bus.recent(20)
    expect(recent).toHaveLength(20)
    expect(Date.parse(recent[0].ts)).toBeGreaterThan(Date.parse(recent[19].ts))
  })

  it('is a graceful no-op without BroadcastChannel, IndexedDB or storage', async () => {
    const bus = new EventBus({ appId: '06', BroadcastChannel: null, indexedDB: null, storage: null })
    buses.push(bus)
    const h = vi.fn()
    bus.on('invoice.due_set', h)
    expect(bus.emit('invoice.due_set', { dueDate: '2026-12-01', invoiceNumber: 'INV-11' })).not.toBeNull()
    expect(h).toHaveBeenCalledTimes(1)
    expect(await bus.recent()).toEqual([])
    expect(await bus.replay()).toBe(0)
    expect(await bus.unreadCount('01')).toBe(0)
  })
})
