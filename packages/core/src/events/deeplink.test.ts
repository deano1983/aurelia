import { describe, expect, it } from 'vitest'
import { buildDeepLink, buildDeepLinkHash, parseDeepLink, resolveHubDeepLink } from './deeplink'

describe('deep links', () => {
  it('round-trips a cross-device link', () => {
    const url = buildDeepLink('01-daily-command-timeline', 'timeline/add', {
      title: 'Invoice INV-1 due',
      due: '2026-12-01',
      category: 'board',
      tags: ['hard-report-deadline', 'protected-life-event'],
      source: '06',
      empty: '',
    }, { origin: 'https://aurelia.example' })
    expect(url).toMatch(/^https:\/\/aurelia\.example\/apps\/01-daily-command-timeline\/#timeline\/add\?/)
    const parsed = parseDeepLink(url)!
    expect(parsed.kind).toBe('timeline/add')
    expect(parsed.target).toBe('01')
    expect(parsed.folder).toBe('01-daily-command-timeline')
    expect(parsed.params.title).toBe('Invoice INV-1 due')
    expect(parsed.all.tags).toEqual(['hard-report-deadline', 'protected-life-event'])
    expect('empty' in parsed.params).toBe(false)
    expect(parsed.legacy).toBeNull()
  })

  it('accepts a two-digit id and builds the hub path', () => {
    expect(buildDeepLink('07', 'affiliate/inbox', { kind: 'rate-card', source: '05' }, { origin: '' })).toBe(
      '/apps/07-distribution-affiliate-engine/#affiliate/inbox?kind=rate-card&source=05',
    )
    expect(buildDeepLink('00-central-hub', 'hub', {}, { origin: '' })).toBe('/#hub')
    expect(() => buildDeepLink('99-nope', 'x')).toThrow()
    expect(() => buildDeepLinkHash('Bad Kind!')).toThrow()
  })

  it('parses legacy #ctl= and #vault= packets', () => {
    const ctl = parseDeepLink('https://x.test/#ctl=eyJhYmMiOjF9')!
    expect(ctl).toMatchObject({ kind: 'ctl', legacy: 'ctl', target: '04', params: { packet: 'eyJhYmMiOjF9' } })
    const vault = parseDeepLink('#vault=QUJD')!
    expect(vault).toMatchObject({ kind: 'vault', legacy: 'vault', target: '02', params: { packet: 'QUJD' } })
  })

  it("parses 01's legacy #?title=&category=&tags= format", () => {
    const p = parseDeepLink('/apps/01-daily-command-timeline/#?title=Board%20pack&category=board&tags=hard-report-deadline')!
    expect(p).toMatchObject({ kind: 'timeline/add', legacy: 'timeline-query', target: '01' })
    expect(p.params.title).toBe('Board pack')
    expect(parseDeepLink('#?category=board')).toBeNull()
    expect(parseDeepLink('#')).toBeNull()
    expect(parseDeepLink('#creator')).toMatchObject({ kind: 'creator', target: null })
  })

  it('routes hub deep links to the owning app, never off-origin', () => {
    expect(resolveHubDeepLink('#ctl=abc')).toBe('/apps/04-ctl-encrypted-relay/#ctl=abc')
    expect(resolveHubDeepLink('#vault=abc')).toBe('/apps/02-cross-cloud-asset-vault/#vault=abc')
    expect(resolveHubDeepLink('#timeline/add?title=x')).toBe('/apps/01-daily-command-timeline/#timeline/add?title=x')
    expect(resolveHubDeepLink('#affiliate/inbox?kind=rate-card&source=05')).toBe(
      '/apps/07-distribution-affiliate-engine/#affiliate/inbox?kind=rate-card&source=05',
    )
    expect(resolveHubDeepLink('#unknown/thing')).toBeNull()
  })

  it('never lets a link reach Object.prototype', () => {
    const p = parseDeepLink('#timeline/add?__proto__=x&constructor=y&prototype=z&title=t')!
    expect(Object.keys(p.params)).toEqual(['title'])
    expect(({} as Record<string, unknown>).x).toBeUndefined()
    expect(resolveHubDeepLink('#//evil.example')).toBeNull()
  })
})
