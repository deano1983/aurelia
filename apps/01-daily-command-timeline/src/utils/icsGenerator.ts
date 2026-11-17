import type { TimelineItem } from '../types'

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function foldLine(line: string): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(line)
  if (bytes.length <= 75) return line
  const chunks: string[] = []
  let offset = 0
  while (offset < bytes.length) {
    chunks.push(new TextDecoder().decode(bytes.slice(offset, offset + 75)))
    offset += 75
  }
  return chunks.map((chunk, index) => (index === 0 ? chunk : ` ${chunk}`)).join('\r\n')
}

function formatIcsDate(isoDate: string): string {
  return isoDate.replace(/-/g, '')
}

function formatIcsDateTime(isoDate: string, time?: string): string {
  const datePart = formatIcsDate(isoDate)
  if (!time) return datePart
  const [hours, minutes] = time.split(':')
  const seconds = '00'
  return `${datePart}T${hours}${minutes}${seconds}`
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

  const dtStamp = formatIcsDateTime(new Date().toISOString())

  for (const item of items) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${item.id}@aurelia-os.timeline`)
    lines.push(`DTSTAMP:${dtStamp}`)
    lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(item.dueDate)}`)
    if (item.dueTime) {
      lines.push(`DTEND;VALUE=DATE:${formatIcsDate(item.dueDate)}`)
    }
    lines.push(`SUMMARY:${escapeIcsText(item.title)}`)
    if (item.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(item.description)}`)
    }
    lines.push(`CATEGORIES:${escapeIcsText(item.category)}`)
    if (item.tags.length) {
      lines.push(`X-AURELIA-TAGS:${escapeIcsText(item.tags.join(', '))}`)
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
