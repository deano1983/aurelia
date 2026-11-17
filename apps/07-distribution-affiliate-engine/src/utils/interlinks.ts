import type {
  DeepLinkKind,
  DeepLinkSource,
  InboundDeepLink,
} from '../types'

/**
 * Cross-app interlinks for the Aurelia OS Command Suite.
 *
 * App 07 (Distribution & Partner Affiliate Engine) links to four sibling apps.
 * These are exposed as pure functions/callbacks so App 07 stays decoupled — the
 * host shell wires them to deep links / message channels.
 *
 * Interlink decisions:
 * - Inbound: approved LinkedIn drafts       ← 04 CTL Relay   (#affiliate/inbox?kind=linkedin-draft)
 * - Inbound: sponsor rate cards             ← 05 GlowGrid    (#affiliate/inbox?kind=rate-card)
 * - Inbound: subscription tier attribution  ← 06 Tax Invoice (#affiliate/inbox?kind=tier-attribution)
 * - Outbound: affiliate payout dates        → 01 Timeline     (#timeline/add?…&source=07)
 */

export const APP_ID_AFFILIATE = '07'
export const APP_ID_CTL_RELAY = '04'
export const APP_ID_GLOWGRID = '05'
export const APP_ID_TAX_INVOICE = '06'
export const APP_ID_TIMELINE = '01'

/**
 * Dev-default origin of the 01 Timeline app. Override via onTimelinePayout when
 * the host shell wires the real cross-app channel.
 */
export const TIMELINE_APP_ORIGIN = 'http://localhost:5175'

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

const HASH_PREFIX = '#affiliate/inbox?'

/**
 * Parse an inbound affiliate deep link from the current URL hash.
 *
 * Example: #affiliate/inbox?kind=linkedin-draft&source=04&draft=…&channel=velvet-cadence
 */
export function parseInboundDeepLink(): InboundDeepLink | null {
  const hash = window.location.hash
  if (!hash.startsWith(HASH_PREFIX)) return null

  const queryString = hash.slice(HASH_PREFIX.length)
  const params = new URLSearchParams(queryString)
  const kind = params.get('kind')
  const source = params.get('source')
  if (!kind || !source) return null

  const payload: Record<string, string> = {}
  params.forEach((value, key) => {
    if (key !== 'kind' && key !== 'source') {
      payload[key] = value
    }
  })

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
  search.set('source', APP_ID_AFFILIATE)
  return `${TIMELINE_APP_ORIGIN}#timeline/add?${search.toString()}`
}

/** Build an outbound affiliate inbound link (useful for testing the inbox flow). */
export function buildInboundAffiliateLink(params: {
  kind: DeepLinkKind
  source: DeepLinkSource
  extra?: Record<string, string>
}): string {
  const search = new URLSearchParams()
  search.set('kind', params.kind)
  search.set('source', params.source)
  if (params.extra) {
    Object.entries(params.extra).forEach(([key, value]) => {
      search.set(key, value)
    })
  }
  return `#affiliate/inbox?${search.toString()}`
}
