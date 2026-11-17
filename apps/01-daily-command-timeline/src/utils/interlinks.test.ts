// @vitest-environment jsdom
// End-to-end 06 -> 01 flow with two simulated "apps" sharing one origin
// (in-memory BroadcastChannel, one fake IndexedDB, one localStorage).
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventBus } from '../../../../packages/core/src/events/bus'
import { createFakeOrigin, settle } from '../../../../packages/core/src/events/testing'
import type { TimelineItem } from '../types'
import { deadlineFromInvoice, deadlineFromRequest, upsertExternalItem } from './interlinks'
import { parseDeepLink, buildTimelineShareLink } from './deepLink'
import { inboxEntryFromEvent, addInboxEntry, parseInboundDeepLink } from '../../../07-distribution-affiliate-engine/src/utils/interlinks'

let origin: ReturnType<typeof createFakeOrigin>
let idb: IDBFactory
const open: EventBus[] = []

function boot(appId: EventBus['appId']) {
  const bus = new EventBus({ appId, BroadcastChannel: origin.BroadcastChannel, indexedDB: idb, storage: origin.storage })
  open.push(bus)
  return bus
}

/** Minimal model of 01: its timeline state plus the same subscriptions App.tsx makes. */
function bootTimeline() {
  const bus = boot('01')
  const state = { items: [] as TimelineItem[] }
  bus.on('invoice.due_set', (e) => {
    state.items = upsertExternalItem(state.items, deadlineFromInvoice(e))
  })
  bus.on('timeline.deadline_requested', (e) => {
    state.items = upsertExternalItem(state.items, deadlineFromRequest(e))
  })
  return { bus, state }
}

beforeEach(() => {
  origin = createFakeOrigin()
  idb = new IDBFactory()
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => {
  open.splice(0).forEach((b) => b.close())
  vi.restoreAllMocks()
})

describe('06 Tax Invoice -> 01 Timeline', () => {
  it('adds a hard deadline live, and updates it (no duplicate) when the due date changes', async () => {
    const invoiceApp = boot('06')
    const timeline = bootTimeline()

    invoiceApp.emit('invoice.due_set', { dueDate: '2026-12-01', invoiceNumber: 'INV-20261117-0042', amountAud: 1650 })
    await settle()
    expect(timeline.state.items).toHaveLength(1)
    const [item] = timeline.state.items
    expect(item).toMatchObject({
      title: 'Tax invoice INV-20261117-0042 due',
      dueDate: '2026-12-01',
      category: 'board',
      tags: ['hard-report-deadline'],
      sourceApp: '06',
      externalKey: 'invoice:INV-20261117-0042',
    })
    expect(item.description).toContain('1,650.00')

    invoiceApp.emit('invoice.due_set', { dueDate: '2026-12-15', invoiceNumber: 'INV-20261117-0042' })
    await settle()
    expect(timeline.state.items).toHaveLength(1)
    expect(timeline.state.items[0].dueDate).toBe('2026-12-15')
    expect(timeline.state.items[0].id).toBe(item.id)
  })

  it('delivers to 01 when it opens later, exactly once', async () => {
    const invoiceApp = boot('06')
    invoiceApp.emit('invoice.due_set', { dueDate: '2027-01-10', invoiceNumber: 'INV-LATE' })
    await invoiceApp.flush()

    const first = bootTimeline()
    await settle()
    await first.bus.replay()
    expect(first.state.items.map((i) => i.externalKey)).toEqual(['invoice:INV-LATE'])

    first.bus.close()
    const second = bootTimeline()
    await settle()
    await second.bus.replay()
    expect(second.state.items).toHaveLength(0)
  })

  it('maps timeline.deadline_requested from any app (07 payout) and dedupes', async () => {
    const affiliate = boot('07')
    const timeline = bootTimeline()
    const payload = { title: 'Affiliate payout', due: '2026-12-31', category: 'nope', tags: ['hard-report-deadline', 'junk'] }
    affiliate.emit('timeline.deadline_requested', payload)
    affiliate.emit('timeline.deadline_requested', payload)
    await settle()
    expect(timeline.state.items).toHaveLength(1)
    expect(timeline.state.items[0]).toMatchObject({ category: 'personal', tags: ['hard-report-deadline'], sourceApp: '07' })
  })
})

describe('01 deep links', () => {
  it('reads the new, legacy and cross-device formats', () => {
    expect(parseDeepLink('#timeline/add?title=Board%20pack&due=2026-12-01&tags=hard-report-deadline')).toMatchObject({
      title: 'Board pack',
      dueDate: '2026-12-01',
      tags: ['hard-report-deadline'],
    })
    expect(parseDeepLink('#?title=Legacy&category=board')).toMatchObject({ title: 'Legacy', category: 'board' })
    expect(parseDeepLink('#ctl=abc')).toBeNull()
    expect(parseDeepLink('#affiliate/inbox?kind=rate-card&source=05&title=x')).toBeNull()
    const link = buildTimelineShareLink({ title: 'From phone', dueDate: '2026-12-02' }, 'https://aurelia.example')
    expect(link).toBe('https://aurelia.example/apps/01-daily-command-timeline/#timeline/add?title=From+phone&due=2026-12-02')
    expect(parseDeepLink(new URL(link).hash)).toMatchObject({ title: 'From phone', dueDate: '2026-12-02' })
  })
})

describe('07 inbox', () => {
  it('files bus events as inbox entries, deduped by event id', async () => {
    const glow = boot('05')
    const e = glow.emit('glowgrid.rate_card_set', { tier: 'Micro', rateAud: 450 })!
    const entry = inboxEntryFromEvent(e)!
    expect(entry).toMatchObject({ kind: 'rate-card', source: '05', payload: { tier: 'Micro', rateAud: '450.00' } })
    const once = addInboxEntry([], entry)
    expect(addInboxEntry(once, entry)).toBe(once)
    expect(parseInboundDeepLink('#affiliate/inbox?kind=rate-card&source=05&creator=Ava')).toEqual({
      kind: 'rate-card',
      source: '05',
      payload: { creator: 'Ava' },
      trust: 'link',
    })
    expect(entry.trust).toBe('bus')
    expect(parseInboundDeepLink('#affiliate/inbox?kind=evil&source=05')).toBeNull()
    expect(parseInboundDeepLink('#affiliate/inbox?kind=rate-card&source=99')).toBeNull()
    // Unknown fields are dropped, control characters removed, lengths capped.
    const hostile = parseInboundDeepLink(
      `#affiliate/inbox?kind=linkedin-draft&source=04&draft=${'x'.repeat(6000)}%0D&bsb=000-000&__proto__=1`,
    )!
    expect(Object.keys(hostile.payload)).toEqual(['draft'])
    expect(hostile.payload.draft).toHaveLength(5000)
    expect(hostile.trust).toBe('link')
  })
})
