import { buildDeepLink, buildDeepLinkHash, parseDeepLink as parseAureliaDeepLink } from '@aurelia/core/events'
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
export function parseDeepLink(hash: string = window.location.hash): DeepLinkDeadline | null {
  if (!hash) return null
  const link = parseAureliaDeepLink(hash.startsWith('#') ? hash : `#${hash}`)
  if (!link || link.legacy === 'ctl' || link.legacy === 'vault') return null
  if (link.target && link.target !== '01') return null

  const params = link.params
  const title = params.title
  if (!title) return null

  const category = params.category
  const tags = (link.all.tags ?? []) as TimelineTag[]
  const parsedCategory = VALID_CATEGORIES.includes(category as TimelineCategory)
    ? (category as TimelineCategory)
    : undefined

  return {
    title,
    dueDate: params.due || undefined,
    dueTime: params.time || undefined,
    category: parsedCategory,
    tags: tags.length ? tags : undefined,
    sourceApp: params.source || undefined,
    description: params.desc || undefined,
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
