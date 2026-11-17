import { buildDeepLink, buildDeepLinkHash, isIsoDate, parseDeepLink as parseAureliaDeepLink } from '@aurelia/core/events'
import type { DeepLinkDeadline, TimelineCategory, TimelineTag } from '../types'

const VALID_CATEGORIES: TimelineCategory[] = [
  'creator',
  'linkedin-executive',
  'board',
  'personal',
  'life',
]

/**
 * Read an incoming deadline from the URL fragment. Accepts
 *   #timeline/add?title=…&due=…&category=…&tags=…  (current format)
 *   #?title=…&category=…&tags=…                    (legacy 01 format)
 * and any other `#<kind>?title=…` that is not meant for another app.
 */
const VALID_TAGS: TimelineTag[] = ['flexible-content-upload', 'hard-report-deadline', 'protected-life-event']

export const MAX_TITLE = 200
export const MAX_DESC = 2000
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})T(([01]\d|2[0-3]):[0-5]\d)(:[0-5]\d(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/
/** Control characters other than \n (CR, NUL, ESC, DEL, …): never accepted from a link. */
// eslint-disable-next-line no-control-regex -- intentional: strips control characters from untrusted input
const CONTROL_RE = /[\u0000-\u0009\u000B-\u001F\u007F]/
const APP_ID_RE = /^0[0-7]$/

function cleanText(value: string | undefined, max: number, allowNewline: boolean): string | undefined | null {
  if (value === undefined) return undefined
  if (CONTROL_RE.test(value) || (!allowNewline && value.includes('\n'))) return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || undefined
}

/**
 * Read an incoming deadline from the URL fragment. Accepts
 *   #timeline/add?title=…&due=…&category=…&tags=…  (current format)
 *   #?title=…&category=…&tags=…                    (legacy 01 format)
 * and any other `#<kind>?title=…` that is not meant for another app.
 *
 * Links are untrusted (anyone can send one), so every field is validated:
 * due is YYYY-MM-DD (or YYYY-MM-DDTHH:MM…), time is HH:MM, category/tags/source
 * come from allow-lists, text is length-capped and may not carry control
 * characters. A link with a malformed due/time/title is rejected outright.
 */
export function parseDeepLink(hash: string = window.location.hash): DeepLinkDeadline | null {
  if (!hash) return null
  const link = parseAureliaDeepLink(hash.startsWith('#') ? hash : `#${hash}`)
  if (!link || link.legacy === 'ctl' || link.legacy === 'vault') return null
  if (link.target && link.target !== '01') return null

  const params = link.params
  const title = cleanText(params.title, MAX_TITLE, false)
  if (!title) return null
  const description = cleanText(params.desc, MAX_DESC, true)
  if (description === null) return null

  let dueDate: string | undefined
  let dueTime: string | undefined
  if (params.due) {
    const dt = DATE_TIME_RE.exec(params.due)
    if (isIsoDate(params.due)) dueDate = params.due
    else if (dt && isIsoDate(dt[1])) {
      dueDate = dt[1]
      dueTime = dt[2]
    } else return null
  }
  if (params.time) {
    if (!TIME_RE.test(params.time)) return null
    dueTime = params.time
  }

  const category = params.category
  const parsedCategory = VALID_CATEGORIES.includes(category as TimelineCategory)
    ? (category as TimelineCategory)
    : undefined
  const tags = [...new Set(link.all.tags ?? [])].filter((t): t is TimelineTag =>
    VALID_TAGS.includes(t as TimelineTag),
  )
  const sourceApp = params.source && APP_ID_RE.test(params.source) ? params.source : undefined

  return {
    title,
    dueDate,
    dueTime,
    category: parsedCategory,
    tags: tags.length ? tags : undefined,
    sourceApp,
    description,
  }
}

function toParams(deadline: Partial<DeepLinkDeadline>) {
  return {
    title: deadline.title,
    due: deadline.dueDate,
    time: deadline.dueTime,
    category: deadline.category,
    tags: deadline.tags,
    source: deadline.sourceApp,
    desc: deadline.description,
  }
}

/** Fragment only: `#timeline/add?…` (same-app link). */
export function buildDeepLinkUrl(deadline: Partial<DeepLinkDeadline>): string {
  return buildDeepLinkHash('timeline/add', toParams(deadline))
}

/** Absolute cross-device link: `<origin>/apps/01-daily-command-timeline/#timeline/add?…`. */
export function buildTimelineShareLink(deadline: Partial<DeepLinkDeadline>, origin?: string): string {
  return buildDeepLink('01-daily-command-timeline', 'timeline/add', toParams(deadline), origin === undefined ? {} : { origin })
}
