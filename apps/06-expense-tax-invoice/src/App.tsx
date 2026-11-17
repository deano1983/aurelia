import { useCallback, useMemo, useState } from 'react'
import { BuyerForm, EMPTY_BUYER } from './components/BuyerForm'
import { FinanceMemo } from './components/FinanceMemo'
import { InvoicePreview } from './components/InvoicePreview'
import { PdfExportButton } from './components/PdfExportButton'
import { TierSelector } from './components/TierSelector'
import { expenseInterlinks, traceInterlink } from './utils/interlinks'
import { generateInvoiceNumber } from './utils/invoiceNumber'
import { UpdateBanner } from '@aurelia/core/events'
import { buildInvoice } from './utils/invoice'
import type { BuyerDetails, SubscriptionTier } from './types'
import { APP_ID_AFFILIATE, APP_ID_ASSET_VAULT, APP_ID_TIMELINE } from './utils/interlinks'
import { ABN, EXPENSE_CATEGORY, EXPENSE_SUBCATEGORY } from './utils/constants'

export default function App() {
  const [tier, setTier] = useState<SubscriptionTier | null>(null)
  const [buyer, setBuyer] = useState<BuyerDetails>(EMPTY_BUYER)
  const [dueDate, setDueDate] = useState<string>('')

  // One invoice number per selected tier, so editing the due date updates the
  // same 01 Timeline deadline instead of creating a new one each time.
  const invoiceNumber = useMemo(() => (tier ? generateInvoiceNumber() : ''), [tier])
  const invoice = useMemo(
    () => buildInvoice(tier, buyer, dueDate, invoiceNumber || undefined),
    [tier, buyer, dueDate, invoiceNumber],
  )

  const handleTierSelect = useCallback((next: SubscriptionTier) => {
    setTier(next)
    // Interlink: subscription tier selected → 07 Affiliate Engine
    // (partner attribution / commission).
    expenseInterlinks.onTierSelected(next.id, next.affiliatePartnerId)
    traceInterlink(APP_ID_AFFILIATE, 'tierSelected', {
      tierId: next.id,
      partnerId: next.affiliatePartnerId,
    })
  }, [])

  const handleBuyerChange = useCallback((next: BuyerDetails) => {
    setBuyer(next)
  }, [])

  const handleDueDateChange = useCallback((next: string) => {
    setDueDate(next)
    // Interlink: invoice due dates → 01 Timeline (hard report deadline).
    if (next && invoice) {
      expenseInterlinks.onDueDateSet(next, invoice.invoiceNumber, invoice.totalCents / 100)
      traceInterlink(APP_ID_TIMELINE, 'dueDateSet', {
        dueDate: next,
        invoiceNumber: invoice.invoiceNumber,
      })
    }
  }, [invoice])

  const handleApprove = useCallback((memo: string) => {
    // 1-click approval: memo is copied to the clipboard for the finance system.
    navigator.clipboard.writeText(memo)
  }, [])

  const handlePdfExport = useCallback((blob: Blob, fileName?: string) => {
    // Interlink: invoice PDF → 02 Asset Vault (cloud proof pointer).
    if (invoice) void expenseInterlinks.onPdfExported(blob, invoice.invoiceNumber, fileName)
    traceInterlink(APP_ID_ASSET_VAULT, 'pdfExported', {
      invoiceNumber: invoice?.invoiceNumber,
      bytes: blob.size,
    })
  }, [invoice])

  return (
    <div className="min-h-screen bg-expense-surface">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-expense-primary flex items-center justify-center text-white font-bold">
              E
            </div>
            <div>
              <h1 className="text-lg font-bold text-expense-dark">
                Expense Checkout &amp; Tax Invoice
              </h1>
              <p className="text-xs text-slate-500">
                B2B corporate expense checkout • 100% expensable Australian Tax Invoice
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PdfExportButton invoice={invoice} disabled={!invoice} onExport={handlePdfExport} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="lg:grid lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-5 space-y-4">
            <TierSelector onSelect={handleTierSelect} selected={tier ?? null} />
            <BuyerForm buyer={buyer} onChange={handleBuyerChange} />
            <FinanceMemo invoice={invoice} onApprove={handleApprove} />
          </div>

          <div className="lg:col-span-7 space-y-4">
            <InvoicePreview
              invoice={invoice}
              onDueDateChange={handleDueDateChange}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-3 text-[10px] text-slate-400">
        Aurelia OS Command Suite — App 06 • ABN {ABN} • Pre-coded expense category:
        {EXPENSE_CATEGORY} / {EXPENSE_SUBCATEGORY}
      </footer>
      <UpdateBanner />
    </div>
  )
}