/**
 * Cross-app interlinks for the Aurelia OS Command Suite.
 *
 * App 06 (Expense Checkout & Tax Invoice) links to three sibling apps over the
 * shared @aurelia/core event bus (BroadcastChannel + IndexedDB outbox):
 * - Invoice due dates  → 01 Timeline     invoice.due_set
 * - Subscription tier  → 07 Affiliate    invoice.tier_selected
 * - Invoice PDF        → 02 Asset Vault  invoice.pdf_exported (file id only; the
 *                                         PDF stays in IndexedDB aurelia.06.files)
 */
import { configureEvents, emit } from '@aurelia/core/events'
import { storeFile } from './fileStore'

export const APP_ID_EXPENSE = '06'
export const APP_ID_TIMELINE = '01'
export const APP_ID_ASSET_VAULT = '02'
export const APP_ID_AFFILIATE = '07'

configureEvents({ appId: APP_ID_EXPENSE })

export interface ExpenseInterlinks {
  /** Fired when an invoice due date is confirmed (→ 01 Timeline). */
  onDueDateSet: (dueDate: string, invoiceNumber: string, amountAud?: number) => void
  /** Fired when a subscription tier is selected (→ 07 Affiliate Engine). */
  onTierSelected: (tierId: string, partnerId?: string) => void
  /** Fired when the tax invoice PDF is exported (→ 02 Asset Vault). */
  onPdfExported: (pdfBlob: Blob, invoiceNumber: string, fileName?: string) => Promise<void>
}

export const expenseInterlinks: ExpenseInterlinks = {
  onDueDateSet(dueDate, invoiceNumber, amountAud) {
    emit('invoice.due_set', { dueDate, invoiceNumber, ...(amountAud !== undefined ? { amountAud } : {}) })
  },
  onTierSelected(tierId, partnerId) {
    emit('invoice.tier_selected', { tierId, ...(partnerId ? { partnerId } : {}) })
  },
  async onPdfExported(pdfBlob, invoiceNumber, fileName = `Tax Invoice ${invoiceNumber}.pdf`) {
    const fileId = await storeFile(pdfBlob, fileName, invoiceNumber).catch(() => null)
    emit('invoice.pdf_exported', {
      invoiceNumber,
      fileName,
      sizeBytes: pdfBlob.size,
      ...(fileId ? { fileId } : {}),
    })
  },
}

/** Dev-only trace for interlink events. */
export function traceInterlink(target: string, event: string, payload: unknown): void {
  if (import.meta.env.DEV) {
    console.log(`[interlink:${target}] ${event}`, payload)
  }
}
