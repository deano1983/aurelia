// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { TimelineItem } from '../types'
import { parseDeepLink } from './deepLink'
import { escapeIcsText, foldLine, generateIcs } from './icsGenerator'

// The pentest F-05 payload: a #timeline/add link whose `due` smuggles a VALARM,
// an ATTENDEE and a URL property through CRLF.
const CRLF_LINK =
  '#timeline/add?title=Board+pack&due=2026-12-01%0D%0ABEGIN%3AVALARM%0D%0AACTION%3ADISPLAY%0D%0ATRIGGER%3APT1M%0D%0ADESCRIPTION%3ACall+%2B61...%0D%0AEND%3AVALARM%0D%0AATTENDEE%3BCN%3DAttacker%3Amailto%3Aattacker%40evil.example%0D%0AURL%3Ahttps%3A%2F%2Fevil.example%2Fphish'

const INJECTION = '\r\nBEGIN:VALARM\r\nTRIGGER:PT1M\r\nEND:VALARM\r\nATTENDEE;CN=Attacker:mailto:attacker@evil.example\rURL:https://evil.example/phish\n'

function item(patch: Partial<TimelineItem>): TimelineItem {
  return {
    id: 'a1b2',
    title: 'Board pack',
    category: 'board',
    tags: ['hard-report-deadline'],
    dueDate: '2026-12-01',
    slot: 'custom',
    createdAt: '2026-11-17T00:00:00Z',
    completed: false,
    ...patch,
  }
}

/** Every unfolded content line must start with a property we emitted. */
function propertyNames(ics: string): string[] {
  return ics
    .replace(/\r\n /g, '')
    .split('\r\n')
    .map((l) => l.split(/[:;]/)[0])
}

describe('01 deep link validation (pentest F-05)', () => {
  it('rejects the CRLF due-date payload', () => {
    expect(parseDeepLink(CRLF_LINK)).toBeNull()
  })

  it('rejects malformed dates/times and control characters, filters allow-lists, caps lengths', () => {
    expect(parseDeepLink('#timeline/add?title=x&due=2026-02-30')).toBeNull()
    expect(parseDeepLink('#timeline/add?title=x&due=tomorrow')).toBeNull()
    expect(parseDeepLink('#timeline/add?title=x&time=25:00')).toBeNull()
    expect(parseDeepLink('#timeline/add?title=a%0Db')).toBeNull()
    expect(parseDeepLink('#timeline/add?title=a&desc=x%0Dy')).toBeNull()
    const ok = parseDeepLink(
      `#timeline/add?title=${'T'.repeat(500)}&due=2026-12-01T09:30&category=evil&tags=hard-report-deadline&tags=evil%0D%0AX&source=..%2F&desc=line1%0Aline2`,
    )!
    expect(ok.title).toHaveLength(200)
    expect(ok).toMatchObject({ dueDate: '2026-12-01', dueTime: '09:30', category: undefined, tags: ['hard-report-deadline'], sourceApp: undefined })
    expect(ok.description).toBe('line1\nline2')
  })
})

describe('ICS generation (RFC 5545 escaping)', () => {
  it('escapes backslash, semicolon, comma and every kind of line break', () => {
    expect(escapeIcsText('a\\b;c,d')).toBe('a\\\\b\\;c\\,d')
    expect(escapeIcsText('1\r\n2\r3\n4 5')).toBe('1\\n2\\n3\\n4\\n5')
    expect(escapeIcsText('x\u0000\u001b\u007fy')).toBe('xy')
    expect(escapeIcsText(INJECTION)).not.toMatch(/[\r\n]/)
  })

  it('cannot be made to emit extra properties from any field', () => {
    const ics = generateIcs([
      item({
        id: `evil${INJECTION}`,
        title: `Board pack${INJECTION}`,
        description: `Notes${INJECTION}`,
        category: `board${INJECTION}` as TimelineItem['category'],
        tags: [`hard-report-deadline${INJECTION}` as TimelineItem['tags'][number]],
        sourceApp: `06${INJECTION}`,
      }),
      item({ id: 'bad-date', dueDate: `2026-12-01${INJECTION}` }),
      item({ id: 'bad-time', dueTime: `09:00${INJECTION}` }),
    ])
    const names = propertyNames(ics)
    expect(names).not.toContain('BEGIN:VALARM')
    expect(names.filter((n) => n === 'BEGIN')).toHaveLength(3) // VCALENDAR + 2 VEVENTs (bad-date skipped)
    for (const forbidden of ['ATTENDEE', 'URL', 'TRIGGER', 'ACTION']) expect(names).not.toContain(forbidden)
    expect(ics).not.toMatch(/\r(?!\n)|(?<!\r)\n/) // only CRLF line endings
    expect(ics.replace(/\r\n /g, '')).toMatch(/^UID:evilBEGINVALARM[A-Za-z0-9._@-]*@aurelia-os\.timeline\r?$/m)
  })

  it('folds at 75 octets without splitting multi-byte characters', () => {
    const folded = foldLine(`SUMMARY:${'é'.repeat(100)}`)
    const lines = folded.split('\r\n')
    expect(lines.length).toBeGreaterThan(1)
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
    expect(folded).not.toContain('�')
    expect(lines.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(`SUMMARY:${'é'.repeat(100)}`)
  })
})
