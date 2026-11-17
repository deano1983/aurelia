import type { TimelineItem } from '../types'

/**
 * RFC 5545 §3.3.11 TEXT escaping. Line breaks of any kind (CRLF, CR, LF, and the
 * Unicode line/paragraph separators) become the literal two characters "\n";
 * every other control character is dropped. The result can never contain a raw
 * CR or LF, so a value cannot start a new property (VALARM, ATTENDEE, URL, …).
 */
export function escapeIcsText(text: string): string {
  return String(text)
    .replace(/\r\n?|[\n\u2028\u2029\u0085]/g, '\n')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** Fold to 75 octets per line (RFC 5545 §3.1) without splitting a UTF-8 character. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder()
  const chunks: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = encoder.encode(ch).length
    const limit = chunks.length === 0 ? 75 : 74 // continuation lines start with a space
    if (bytes + size > limit) {
      chunks.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  chunks.push(current)
  return chunks.map((chunk, index) => (index === 0 ? chunk : ` ${chunk}`)).join('\r\n')
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function formatIcsDate(isoDate: string): string {
  return isoDate.replace(/-/g, '')
}

function formatUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Only identifier-safe characters in UIDs and X- property values. */
function safeToken(value: string): string {
  return value.replace(/[^A-Za-z0-9._@-]/g, '')
}

export function generateIcs(items: TimelineItem[]): string {
  const lines: string[] = []

  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//Aurelia OS//Daily Command Timeline//EN')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push('X-WR-CALNAME:Aurelia OS — Daily Command Timeline')
  lines.push('X-WR-TIMEZONE:Australia/Sydney')

  const dtStamp = formatUtcStamp(new Date())

  for (const item of items) {
    // Stored data can be tampered with (same-origin writers), so dates are
    // re-validated here and an item with a malformed date is skipped.
    if (!DATE_RE.test(item.dueDate)) continue
    const time = item.dueTime && TIME_RE.test(item.dueTime) ? item.dueTime : undefined
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${safeToken(item.id)}@aurelia-os.timeline`)
    lines.push(`DTSTAMP:${dtStamp}`)
    if (time) {
      const stamp = `${formatIcsDate(item.dueDate)}T${time.replace(':', '')}00`
      lines.push(`DTSTART:${stamp}`)
      lines.push(`DTEND:${stamp}`)
    } else {
      lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(item.dueDate)}`)
    }
    lines.push(`SUMMARY:${escapeIcsText(item.title)}`)
    if (item.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(item.description)}`)
    }
    lines.push(`CATEGORIES:${escapeIcsText(item.category)}`)
    if (item.tags.length) {
      lines.push(`X-AURELIA-TAGS:${item.tags.map(escapeIcsText).join(',')}`)
    }
    if (item.sourceApp) {
      lines.push(`X-AURELIA-SOURCE:${escapeIcsText(item.sourceApp)}`)
    }
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n')
}

export function exportIcsToFile(
  items: TimelineItem[],
  filename = 'aurelia-daily-command-timeline.ics',
): void {
  const ics = generateIcs(items)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
