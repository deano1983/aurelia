/**
 * The cross-app event catalog: every event name an app may list in its
 * manifest's `emits` / `accepts`, with who sends it and who receives it.
 *
 * Names and routing only. The event bus and the payload schemas live in
 * @aurelia/core/events, which imports this catalog.
 *
 *   from: the app ids that emit it, or 'any' (any app may emit)
 *   to:   the app ids that accept it, or 'all' (every internal app)
 */
export const APP_IDS = ['00', '01', '02', '03', '04', '05', '06', '07'] as const
export type AppId = (typeof APP_IDS)[number]

export type EventRoute = {
  readonly from: readonly AppId[] | 'any'
  readonly to: readonly AppId[] | 'all'
  readonly description: string
}

export const EVENT_CATALOG = {
  'invoice.due_set': { from: ['06'], to: ['01'], description: 'An invoice due date was set; Timeline adds a deadline.' },
  'invoice.tier_selected': { from: ['06'], to: ['07'], description: 'A pricing tier was picked on an invoice; Affiliate Engine updates commission.' },
  'invoice.pdf_exported': { from: ['06'], to: ['02'], description: 'An invoice PDF was exported; Asset Vault records a pointer to it.' },
  'vault.pointer_created': { from: ['02'], to: ['03', '04'], description: 'A cloud pointer was created in the vault.' },
  'voice.draft_sealed': { from: ['03'], to: ['04'], description: 'A voice draft was sealed into a C.T.L. packet.' },
  'voice.draft_ready': { from: ['03'], to: ['07'], description: 'LinkedIn draft options are ready for partner pitches.' },
  'glowgrid.rate_card_set': { from: ['05'], to: ['07'], description: 'The creator rate card changed.' },
  'timeline.deadline_requested': { from: 'any', to: ['01'], description: 'Any app asks Timeline to add a deadline.' },
  'hub.session_changed': { from: ['00'], to: 'all', description: 'The hub session signed in, out, or changed.' },
  'chat.message_received': { from: ['04'], to: ['00'], description: 'An encrypted relay message arrived; the hub shows a notification.' },
  'share.posted': { from: 'any', to: ['00'], description: 'Something was shared to the hub feed.' },
} as const satisfies Record<string, EventRoute>

export type EventType = keyof typeof EVENT_CATALOG

export const EVENT_TYPES = Object.keys(EVENT_CATALOG) as EventType[]

export function isEventType(name: string): name is EventType {
  return Object.prototype.hasOwnProperty.call(EVENT_CATALOG, name)
}
