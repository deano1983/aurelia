import { describe, expect, it } from 'vitest'
import { buildShareTargets, composeBody, fitForNetwork, graphemeLength, lengthForNetwork } from './targets'

const byId = (post: Parameters<typeof buildShareTargets>[0]) =>
  Object.fromEntries(buildShareTargets(post).map((t) => [t.id, t]))

const tricky = 'Q3 & beyond: 100% growth? #wins "quoted" + café 🚀\nline two'

describe('buildShareTargets encoding', () => {
  const t = byId({ text: tricky, url: 'https://aurelia.example/p?a=1&b=2', title: 'Board update' })

  it('LinkedIn feed composer gets the whole text and link, percent-encoded', () => {
    const u = new URL(t.linkedin.href)
    expect(u.origin + u.pathname).toBe('https://www.linkedin.com/feed/')
    expect(u.searchParams.get('shareActive')).toBe('true')
    expect(u.searchParams.get('text')).toBe(`${tricky}\n\nhttps://aurelia.example/p?a=1&b=2`)
    // encodeURIComponent: spaces are %20, never '+', and '&' inside text is escaped
    expect(t.linkedin.href).toContain('Q3%20%26%20beyond')
    expect(t.linkedin.href).not.toContain('+')
  })

  it('LinkedIn share-offsite carries only the URL', () => {
    expect(t['linkedin-link'].href).toBe(
      'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Faurelia.example%2Fp%3Fa%3D1%26b%3D2',
    )
  })

  it('X passes text and url separately', () => {
    const u = new URL(t.x.href)
    expect(u.origin + u.pathname).toBe('https://x.com/intent/post')
    expect(u.searchParams.get('text')).toBe(tricky)
    expect(u.searchParams.get('url')).toBe('https://aurelia.example/p?a=1&b=2')
  })

  it('Facebook sharer uses the link and is a copy target', () => {
    expect(t.facebook.href).toBe(
      'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Faurelia.example%2Fp%3Fa%3D1%26b%3D2',
    )
    expect(t.facebook.kind).toBe('copy')
  })

  it('Threads, WhatsApp, Bluesky put the link inside the text', () => {
    for (const [id, base] of [
      ['threads', 'https://www.threads.net/intent/post'],
      ['bluesky', 'https://bsky.app/intent/compose'],
      ['whatsapp', 'https://wa.me/'],
    ] as const) {
      const u = new URL(t[id].href)
      expect(u.origin + u.pathname).toBe(base)
      expect(u.searchParams.get('text')).toBe(`${tricky}\n\nhttps://aurelia.example/p?a=1&b=2`)
    }
  })

  it('Telegram and Reddit link posts', () => {
    const tg = new URL(t.telegram.href)
    expect(tg.origin + tg.pathname).toBe('https://t.me/share/url')
    expect(tg.searchParams.get('url')).toBe('https://aurelia.example/p?a=1&b=2')
    expect(tg.searchParams.get('text')).toBe(tricky)
    const rd = new URL(t.reddit.href)
    expect(rd.origin + rd.pathname).toBe('https://www.reddit.com/submit')
    expect(rd.searchParams.get('title')).toBe('Board update')
    expect(rd.searchParams.get('url')).toBe('https://aurelia.example/p?a=1&b=2')
  })

  it('email and SMS use percent-encoding that mail and SMS apps decode', () => {
    expect(t.email.href.startsWith('mailto:?subject=Board%20update&body=')).toBe(true)
    expect(decodeURIComponent(t.email.href.split('&body=')[1])).toBe(
      `${tricky}\n\nhttps://aurelia.example/p?a=1&b=2`,
    )
    expect(t.email.href).toContain('%0A') // newline
    expect(t.email.href).not.toContain('+')
    expect(t.sms.href.startsWith('sms:?&body=')).toBe(true)
    expect(decodeURIComponent(t.sms.href.slice('sms:?&body='.length))).toContain('🚀')
  })

  it('without a URL: no link card, Reddit text post, Telegram text as url', () => {
    const n = byId({ text: 'Hello world', hashtags: ['leadership', '#AI'] })
    expect(n['linkedin-link']).toBeUndefined()
    expect(new URL(n.linkedin.href).searchParams.get('text')).toBe('Hello world\n\n#leadership #AI')
    expect(new URL(n.x.href).searchParams.has('url')).toBe(false)
    const rd = new URL(n.reddit.href)
    expect(rd.searchParams.get('selftext')).toBe('true')
    expect(rd.searchParams.get('text')).toBe('Hello world\n\n#leadership #AI')
    expect(new URL(n.telegram.href).searchParams.get('url')).toBe('Hello world\n\n#leadership #AI')
    expect(n.facebook.href).toBe('https://www.facebook.com/')
  })
})

describe('composeBody', () => {
  it('normalises hashtags', () => {
    expect(composeBody({ text: ' Hi ', hashtags: ['#a', 'b c', '', '##d'] })).toBe('Hi\n\n#a #bc #d')
  })
})

describe('fitForNetwork', () => {
  const long = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ')

  it('leaves short text alone', () => {
    const r = fitForNetwork('short post', 'x')
    expect(r).toEqual({ text: 'short post', truncated: false, length: 10, limit: 280 })
  })

  it.each([
    ['x', 280],
    ['threads', 500],
    ['bluesky', 300],
    ['linkedin', 3000],
  ] as const)('%s cuts at a word boundary with an ellipsis within %i', (network, limit) => {
    const text = network === 'linkedin' ? long.repeat(3) : long
    const r = fitForNetwork(text, network)
    expect(r.truncated).toBe(true)
    expect(r.limit).toBe(limit)
    expect(r.length).toBeLessThanOrEqual(limit)
    expect(r.text.endsWith('…')).toBe(true)
    const body = r.text.slice(0, -1)
    // Ends on a whole word that exists in the original
    expect(text.startsWith(body)).toBe(true)
    expect(text[body.length]).toBe(' ')
  })

  it('keeps the suffix whole and counts it', () => {
    const r = fitForNetwork(long, 'bluesky', '\n\nhttps://aurelia.example/x')
    expect(r.text.endsWith('…\n\nhttps://aurelia.example/x')).toBe(true)
    expect(r.length).toBeLessThanOrEqual(300)
  })

  it('X counts links as 23 characters', () => {
    const url = `https://example.com/${'a'.repeat(100)}`
    expect(lengthForNetwork(`hi ${url}`, 'x')).toBe(3 + 23)
    const r = fitForNetwork(long, 'x', ` ${url}`)
    expect(r.length).toBeLessThanOrEqual(280)
    expect(r.text.endsWith(url)).toBe(true)
    // a 100+ char link must not eat into the body as raw characters
    expect(r.text.length).toBeGreaterThan(280)
  })

  it('counts emoji as one character and never splits them', () => {
    expect(graphemeLength('👩‍💻🚀')).toBe(2)
    const r = fitForNetwork('🚀'.repeat(400), 'bluesky')
    expect(r.length).toBe(300)
    expect(r.text).toBe('🚀'.repeat(299) + '…')
  })

  it('falls back to a hard cut when there is no nearby space', () => {
    const r = fitForNetwork('a'.repeat(600), 'threads')
    expect(r.text).toBe('a'.repeat(499) + '…')
  })

  it('reports no limit for unlimited networks', () => {
    expect(fitForNetwork(long, 'whatsapp')).toMatchObject({ truncated: false, limit: null })
  })
})
