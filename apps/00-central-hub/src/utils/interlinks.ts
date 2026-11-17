/**
 * Hub (00) side of the Aurelia event bus: it reads the whole suite's outbox for
 * the activity feed, and routes deep links that land on / to the owning app.
 */
import { APP_FOLDERS, configureEvents, resolveHubDeepLink, type AnyAureliaEvent, type AppId } from '@aurelia/core/events'

export const APP_ID_HUB = '00'

configureEvents({ appId: APP_ID_HUB })

export const APP_SHORT_NAMES: Record<AppId, string> = {
  '00': 'Hub',
  '01': 'Timeline',
  '02': 'Asset Vault',
  '03': 'Voice Studio',
  '04': 'CTL Relay',
  '05': 'GlowGrid',
  '06': 'Tax Invoice',
  '07': 'Affiliate',
}

/** The app URL a hub deep link should open, or null when it is not for an app. */
export function hubDeepLinkTarget(hash: string = window.location.hash): { url: string; appId: AppId } | null {
  if (!hash || hash === '#') return null
  const url = resolveHubDeepLink(hash)
  if (!url) return null
  const entry = (Object.entries(APP_FOLDERS) as [AppId, string][]).find(([, folder]) => url.startsWith(`/apps/${folder}/`))
  return entry ? { url, appId: entry[0] } : null
}

/** One-line human summary of an event for the activity feed (no secrets: packets are never shown). */
export function describeEvent(e: AnyAureliaEvent): string {
  switch (e.type) {
    case 'invoice.due_set':
      return `Invoice ${e.payload.invoiceNumber} due ${e.payload.dueDate}`
    case 'invoice.tier_selected':
      return `Tier ${e.payload.tierId} selected${e.payload.partnerId ? ` via ${e.payload.partnerId}` : ''}`
    case 'invoice.pdf_exported':
      return `PDF exported: ${e.payload.fileName}`
    case 'vault.pointer_created':
      return `Pointer linked on ${e.payload.provider}: ${e.payload.label}`
    case 'voice.draft_sealed':
      return 'Voice draft sealed for CTL Relay'
    case 'voice.draft_ready':
      return `Drafts ready for ${e.payload.audience}`
    case 'glowgrid.rate_card_set':
      return `Rate card ${e.payload.tier}: A$${e.payload.rateAud.toFixed(2)}`
    case 'timeline.deadline_requested':
      return `Deadline requested: ${e.payload.title} (${e.payload.due.slice(0, 10)})`
    case 'hub.session_changed':
      return `Session ${e.payload.status.replace(/[_-]/g, ' ')}`
    case 'chat.message_received':
      return `${e.payload.count} new chat message${e.payload.count === 1 ? '' : 's'}`
    case 'share.posted':
      return `Shared to ${e.payload.network}`
  }
}
