import { describe, expect, it } from 'vitest'
import { EVENT_CATALOG, EVENT_TYPES, isEventType, resolveManifest, validateManifest, validateRegistry, type AppManifest } from './index.ts'

const base = (): AppManifest => ({
  id: '04',
  slug: 'ctl-encrypted-relay',
  folder: '04-ctl-encrypted-relay',
  name: 'C.T.L. Encrypted Relay',
  tagline: 'Relay',
  version: '0.1.0',
  status: 'active',
  icon: 'pwa-192x192.png',
  accent: 'emerald',
  route: '/apps/04-ctl-encrypted-relay/',
  nativeId: 'com.aurelia.os.ctlrelay',
  emits: ['chat.message_received'],
  accepts: ['voice.draft_sealed'],
  deepLinks: ['ctl='],
  storageKeys: ['aurelia.04.inbox'],
  dependencies: ['02'],
})
const errorsOf = (m: unknown) => validateManifest(m, 'm').errors

describe('EVENT_CATALOG', () => {
  it('has the 11 agreed events', () => {
    expect(EVENT_TYPES).toHaveLength(11)
    expect(isEventType('hub.session_changed')).toBe(true)
    expect(isEventType('nope.nope')).toBe(false)
    expect(EVENT_CATALOG['vault.pointer_created'].to).toEqual(['03', '04'])
  })
})

describe('validateManifest', () => {
  it('accepts a good manifest', () => {
    expect(validateManifest(base())).toEqual({ errors: [], warnings: [] })
  })

  it('rejects non-objects and unknown fields', () => {
    expect(errorsOf(null)).toHaveLength(1)
    expect(errorsOf({ ...base(), colour: 'red' }).join()).toMatch(/unknown field "colour"/)
  })

  it('requires the core fields', () => {
    const { id: _id, accent: _a, ...rest } = base()
    const errs = errorsOf(rest).join('\n')
    expect(errs).toMatch(/"id" is required/)
    expect(errs).toMatch(/"accent" is required/)
  })

  it('checks id, folder/slug consistency and route', () => {
    expect(errorsOf({ ...base(), id: '4' }).join()).toMatch(/"id"/)
    expect(errorsOf({ ...base(), slug: 'relay' }).join()).toMatch(/"folder" must be "04-relay"/)
    expect(errorsOf({ ...base(), route: '/apps/04-ctl-encrypted-relay' }).join()).toMatch(/"route" must be/)
    expect(errorsOf({ ...base(), id: '00', slug: 'central-hub', folder: '00-central-hub', route: '/', emits: [], accepts: [], storageKeys: [], dependencies: [] })).toEqual([])
  })

  it('checks accent, status and version', () => {
    expect(errorsOf({ ...base(), accent: 'blue' }).join()).toMatch(/"accent"/)
    expect(errorsOf({ ...base(), status: 'live' }).join()).toMatch(/"status"/)
    expect(errorsOf({ ...base(), version: 'v1' }).join()).toMatch(/"version"/)
  })

  it('rejects unknown events and events off the catalog route', () => {
    expect(errorsOf({ ...base(), emits: ['made.up'] }).join()).toMatch(/not in EVENT_CATALOG/)
    expect(errorsOf({ ...base(), emits: ['invoice.due_set'] }).join()).toMatch(/comes from 06/)
    expect(errorsOf({ ...base(), accepts: ['invoice.due_set'] }).join()).toMatch(/routes it to 01/)
    expect(errorsOf({ ...base(), emits: ['share.posted', 'timeline.deadline_requested'], accepts: ['hub.session_changed'] })).toEqual([])
  })

  it('enforces the aurelia.<id>. storage prefix, warning only for legacy keys', () => {
    expect(errorsOf({ ...base(), storageKeys: ['relay-inbox'] }).join()).toMatch(/does not start with "aurelia.04."/)
    expect(errorsOf({ ...base(), storageKeys: ['aurelia.05.x'] })).toHaveLength(1)
    expect(errorsOf({ ...base(), storageKeys: ['aurelia.04.'] })).toHaveLength(1)
    const legacy = validateManifest({ ...base(), id: '05', slug: 'g', folder: '05-g', route: '/apps/05-g/', emits: [], accepts: [], storageKeys: ['glowgrid:streak'] })
    expect(legacy.errors).toEqual([])
    expect(legacy.warnings).toHaveLength(1)
  })

  it('rejects self-dependencies and duplicates', () => {
    expect(errorsOf({ ...base(), dependencies: ['04'] }).join()).toMatch(/itself/)
    expect(errorsOf({ ...base(), dependencies: ['02', '02'] }).join()).toMatch(/duplicate/)
  })

  it('handles external apps', () => {
    const ext = { id: '50', slug: 'pacific-dwellings', folder: '50-pacific-dwellings', name: 'Pacific Dwellings', tagline: 'Homes', version: '1.0.0', status: 'active', kind: 'external', url: 'https://example.com', accent: 'gold' }
    expect(errorsOf(ext)).toEqual([])
    expect(errorsOf({ ...ext, url: undefined }).join()).toMatch(/"url" is required/)
    expect(errorsOf({ ...ext, url: 'http://example.com' }).join()).toMatch(/url/)
    expect(errorsOf({ ...ext, route: '/' }).join()).toMatch(/"route" is not allowed/)
    expect(errorsOf({ ...base(), url: 'https://example.com' }).join()).toMatch(/only allowed for external/)
    expect(resolveManifest(ext as AppManifest).href).toBe('https://example.com')
  })

  it('applies defaults', () => {
    const { emits: _e, kind: _k, ...m } = base()
    const r = resolveManifest(m)
    expect(r.kind).toBe('internal')
    expect(r.emits).toEqual([])
    expect(r.href).toBe('/apps/04-ctl-encrypted-relay/')
    expect(r.shortName).toBe(m.name)
  })
})

describe('validateRegistry', () => {
  it('finds duplicates, unknown dependencies and folder mismatches', () => {
    const a = base()
    const b = { ...base(), nativeId: 'com.other.app' }
    const { errors } = validateRegistry([
      { manifest: a, where: 'a', diskFolder: '04-ctl-encrypted-relay' },
      { manifest: b, where: 'b', diskFolder: '04-wrong' },
    ])
    const text = errors.join('\n')
    expect(text).toMatch(/b: "folder" is "04-ctl-encrypted-relay" but the file lives in apps\/04-wrong/)
    expect(text).toMatch(/duplicate id "04"/)
    expect(text).toMatch(/dependency "02" is not a known app id/)
  })

  it('checks catalog routes against the apps they name', () => {
    const relay = { ...base(), accepts: [], dependencies: [] }
    const { errors } = validateRegistry([{ manifest: relay, where: 'r' }])
    expect(errors.join('\n')).toMatch(/app 04: catalog routes "vault.pointer_created" to it/)
  })
})
