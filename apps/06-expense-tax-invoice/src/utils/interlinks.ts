/**
 * Cross-app interlinks for the Aurelia OS Command Suite.
 *
 * App 06 (Expense Checkout & Tax Invoice) links to three sibling apps.
 * These are intentionally exposed as callback entry points so App 06 stays
 * decoupled — the host shell wires them to deep links / message channels.
 *
 * Interlink decisions:
 * - Invoice due dates       → 01 Timeline (hard report deadline)
 * - Subscription tier       → 07 Affiliate Engine (partner attribution/commission)
 * - Invoice PDF             → 02 Asset Vault (cloud proof pointer)
 */
export const APP_ID_TIMELINE = '01'
export const APP_ID_ASSET_VAULT = '02'
export const APP_ID_AFFILIATE = '07'

export interface ExpenseInterlinks {
  /** Fired when an invoice due date is confirmed (→ 01 Timeline). */
  onDueDateSet?: (dueDate: string, invoiceNumber: string) => void
  /** Fired when a subscription tier is selected (→ 07 Affiliate Engine). */
  onTierSelected?: (tierId: string, partnerId?: string) => void
  /** Fired when the tax invoice PDF is exported (→ 02 Asset Vault). */
  onPdfExported?: (pdfBlob: Blob, invoiceNumber: string) => void
}

/** Dev-only trace for interlink events until the host shell wires the real channels. */
export function traceInterlink(target: string, event: string, payload: unknown): void {
  if (import.meta.env.DEV) {
    console.log(`[interlink:${target}] ${event}`, payload)
  }
}