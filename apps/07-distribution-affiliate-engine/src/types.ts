export type DistributionChannel =
  | 'velvet-cadence'
  | 'sovereign-brief'
  | 'glowgrid-studio'

export type CommissionStatus = 'pending' | 'paid' | 'clawed-back'

export interface DistributionPartner {
  id: string
  name: string
  channel: DistributionChannel
  commissionRatePercent: number
  bountyCents?: number
  status: 'active' | 'inactive'
  joinedAt: string
}

export interface CommissionEntry {
  id: string
  partnerId: string
  channel: DistributionChannel
  subscriptionCents: number
  commissionRatePercent: number
  commissionCents: number
  recurring: boolean
  month: string // YYYY-MM
  status: CommissionStatus
  paidAt?: string
  payoutDate?: string // ISO date sent to 01 Timeline
}

export interface PitchTemplate {
  id: string
  channel: DistributionChannel
  name: string
  subject: string
  body: string // {{variable}} placeholders
}

export interface PitchHistory {
  id: string
  templateId: string
  channel: DistributionChannel
  copiedAt: string
}

export type DeepLinkSource = '03' | '04' | '05' | '06'

export type DeepLinkKind = 'linkedin-draft' | 'rate-card' | 'tier-attribution'

export interface InboundDeepLink {
  kind: DeepLinkKind
  source: DeepLinkSource
  payload: Record<string, string>
  /**
   * Where it came from. Both are unverified (not signed): 'link' is a URL anyone
   * can send; 'bus' is a same-origin event from another Aurelia app. Nothing is
   * applied to pitches until the user clicks Apply.
   */
  trust: 'link' | 'bus'
}

/** An inbound payload filed from the event bus, waiting to be applied or dismissed. */
export interface InboxEntry extends InboundDeepLink {
  /** Event id (dedupe key). */
  id: string
  receivedAt: string
}
