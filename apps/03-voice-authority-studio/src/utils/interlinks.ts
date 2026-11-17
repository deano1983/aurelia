/**
 * Cross-app interlinks for 03 Voice-to-Authority Studio over the @aurelia/core bus.
 * (The encrypted #ctl= link to 04 stays in ctlLink.ts.)
 *
 * - voice.draft_ready → 07 Affiliate Engine: the lead draft, once drafts are generated.
 */
import { configureEvents, emit } from '@aurelia/core/events'
import type { Audience, Draft } from '../types'

export const APP_ID_VOICE = '03'

configureEvents({ appId: APP_ID_VOICE })

const MAX_TEXT = 20_000

/** Tell 07 that drafts are ready (sends the first draft's text). Never throws. */
export function announceDraftsReady(drafts: Draft[], audience: Audience): void {
  const lead = drafts[0]
  if (!lead || !lead.body.trim()) return
  emit('voice.draft_ready', { text: lead.body.slice(0, MAX_TEXT), audience })
}
