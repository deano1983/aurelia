import { describe, it, expect } from 'vitest'
import { EVENT_CATALOG as BUS } from './catalog'
import { EVENT_CATALOG as MANIFEST } from '../manifest/events-catalog'

// The bus and the manifest validator each keep a catalog; they must never drift.
describe('event catalogs stay in sync', () => {
  it('have the same event types', () => {
    expect(Object.keys(BUS).sort()).toEqual(Object.keys(MANIFEST).sort())
  })
  it('have the same senders and recipients', () => {
    for (const [type, entry] of Object.entries(MANIFEST)) {
      const bus = BUS[type as keyof typeof BUS]
      expect(bus.from, `${type}.from`).toEqual(entry.from)
      expect(bus.to, `${type}.to`).toEqual(entry.to)
    }
  })
})
