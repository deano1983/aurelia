import { useCallback, useState } from 'react'
import {
  buildDeepLink,
  buildDeepLinkHash,
  configureEvents,
  emit,
  parseDeepLink,
  useAureliaEvent,
  type AnyAureliaEvent,
  type AureliaEvent,
} from '@aurelia/core/events'
import type {
  DeepLinkKind,
  DeepLinkSource,
  InboundDeepLink,
  InboxEntry,
} from '../types'
import { loadJSON, saveJSON, STORAGE_KEYS } from './storage'

/**
 * Cross-app interlinks for the Aurelia OS Command Suite.
 *
 * App 07 (Distribution & Partner Affiliate Engine) links to its sibling apps
 * over the @aurelia/core event bus, plus cross-device #affiliate/inbox deep links.
 *
 * Interlink decisions:
 * - Inbound: LinkedIn drafts                ← 03 Voice Studio (voice.draft_ready)
 *                                           ← 04 CTL Relay   (#affiliate/inbox?kind=linkedin-draft)
 * - Inbound: sponsor rate cards             ← 05 GlowGrid    (glowgrid.rate_card_set, #affiliate/inbox?kind=rate-card)
 * - Inbound: subscription tier attribution  ← 06 Tax Invoice (invoice.tier_selected, #affiliate/inbox?kind=tier-attribution)
 * - Outbound: affiliate payout dates        → 01 Timeline     (timeline.deadline_requested + #timeline/add link)
 */

export const APP_ID_AFFILIATE = '07'
export const APP_ID_CTL_RELAY = '04'
export const APP_ID_GLOWGRID = '05'
export const APP_ID_TAX_INVOICE = '06'
export const APP_ID_TIMELINE = '01'

configureEvents({ appId: APP_ID_AFFILIATE })

/** Folder of the 01 Timeline app on the shared origin (/apps/<folder>/). */
export const TIMELINE_APP_FOLDER = '01-daily-command-timeline'

export interface AffiliateInterlinks {
  /** Fired when an affiliate payout date is confirmed (→ 01 Timeline). */
  onTimelinePayout?: (payload: {
    title: string
    due: string
    desc?: string
    partnerId?: string
    amountCents?: number
  }) => void
}

/** Dev-only trace for interlink events until the host shell wires real channels. */
export function traceInterlink(target: string, event: string, payload: unknown): void {
  if (import.meta.env.DEV) {
    console.log(`[interlink:${target}] ${event}`, payload)
  }
}

const KINDS: DeepLinkKind[] = ['linkedin-draft', 'rate-card', 'tier-attribution']
const SOURCES: DeepLinkSource[] = ['03', '04', '05', '06']

/**
 * Parse an inbound affiliate deep link from the current URL hash.
 *
 * Example: #affiliate/inbox?kind=linkedin-draft&source=04&draft=…&channel=velvet-cadence
 */
export function parseInboundDeepLink(hash: string = window.location.hash): InboundDeepLink | null {
  const link = parseDeepLink(hash)
  if (!link || link.kind !== 'affiliate/inbox') return null

  const { kind, source, ...payload } = link.params
  if (!KINDS.includes(kind as DeepLinkKind) || !SOURCES.includes(source as DeepLinkSource)) return null

  return {
    kind: kind as DeepLinkKind,
    source: source as DeepLinkSource,
    payload,
  }
}

/** Build a 01 Timeline deep-link URL for an affiliate payout date. */
export function buildTimelinePayoutUrl(params: {
  title: string
  due: string
  desc?: string
  tags?: string[]
}): string {
  const search = new URLSearchParams()
  search.set('title', params.title)
  search.set('due', params.due)
  if (params.desc) search.set('desc', params.desc)
  params.tags?.forEach((tag) => search.append('tags', tag))
  return buildDeepLink(TIMELINE_APP_FOLDER, 'timeline/add', {
    title: params.title,
    due: params.due,
    desc: params.desc,
    tags: params.tags,
    source: APP_ID_AFFILIATE,
  })
}

/** Ask 01 Timeline to add a payout deadline (timeline.deadline_requested). */
export function requestTimelineDeadline(params: { title: string; due: string; tags?: string[]; category?: string }): void {
  emit('timeline.deadline_requested', {
    title: params.title,
    due: params.due,
    category: params.category ?? 'personal',
    tags: params.tags ?? [],
  })
}

/** Build an outbound affiliate inbound link (useful for testing the inbox flow). */
export function buildInboundAffiliateLink(params: {
  kind: DeepLinkKind
  source: DeepLinkSource
  extra?: Record<string, string>
}): string {
  return buildDeepLinkHash('affiliate/inbox', { kind: params.kind, source: params.source, ...params.extra })
}

// ---------- event inbox ----------

const INBOX_MAX = 50

/** Turn a bus event into an inbox entry (null for events 07 does not file). */
export function inboxEntryFromEvent(event: AnyAureliaEvent): InboxEntry | null {
  const base = { id: event.id, receivedAt: event.ts }
  switch (event.type) {
    case 'invoice.tier_selected':
      return {
        ...base,
        kind: 'tier-attribution',
        source: '06',
        payload: { tierId: event.payload.tierId, ...(event.payload.partnerId ? { partnerId: event.payload.partnerId } : {}) },
      }
    case 'voice.draft_ready':
      return { ...base, kind: 'linkedin-draft', source: '03', payload: { draft: event.payload.text, audience: event.payload.audience } }
    case 'glowgrid.rate_card_set':
      return {
        ...base,
        kind: 'rate-card',
        source: '05',
        payload: { tier: event.payload.tier, rateAud: event.payload.rateAud.toFixed(2) },
      }
    default:
      return null
  }
}

/** Add an entry unless one with the same id is already filed; newest first, capped. */
export function addInboxEntry(entries: InboxEntry[], entry: InboxEntry): InboxEntry[] {
  if (entries.some((e) => e.id === entry.id)) return entries
  return [entry, ...entries].slice(0, INBOX_MAX)
}

/** Inbox fed by invoice.tier_selected, voice.draft_ready and glowgrid.rate_card_set. */
export function useAffiliateInbox() {
  const [entries, setEntries] = useState<InboxEntry[]>(() => loadJSON<InboxEntry[]>(STORAGE_KEYS.inbox, []))

  const file = useCallback((event: AureliaEvent) => {
    const entry = inboxEntryFromEvent(event as AnyAureliaEvent)
    if (!entry) return
    setEntries((prev) => {
      const next = addInboxEntry(prev, entry)
      if (next !== prev) saveJSON(STORAGE_KEYS.inbox, next)
      return next
    })
  }, [])

  useAureliaEvent('invoice.tier_selected', file)
  useAureliaEvent('voice.draft_ready', file)
  useAureliaEvent('glowgrid.rate_card_set', file)

  const remove = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id)
      saveJSON(STORAGE_KEYS.inbox, next)
      return next
    })
  }, [])

  return { entries, remove }
}
