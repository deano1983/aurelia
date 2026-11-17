import { useCallback, useState } from 'react'
import type { Invoice } from '../types'
import { centsToAud } from '../utils/currency'
import { EXPENSE_CATEGORY, EXPENSE_SUBCATEGORY } from '../utils/constants'

interface FinanceMemoProps {
  invoice: Invoice | null
  onApprove?: (memo: string) => void
}

export function FinanceMemo({ invoice, onApprove }: FinanceMemoProps) {
  const [copied, setCopied] = useState(false)

  const memoText = useCallback(() => {
    if (!invoice) return ''
    return `FINANCE APPROVAL MEMO

To: Finance Department
From: ${invoice.buyer.executiveName} — ${invoice.buyer.companyEntityName}
Re: Approval for payment — Tax Invoice ${invoice.invoiceNumber}

Expense category: ${EXPENSE_CATEGORY} / ${EXPENSE_SUBCATEGORY}
Amount payable (incl. GST): ${centsToAud(invoice.totalCents)}
GST component: ${centsToAud(invoice.gstCents)}
Ex GST: ${centsToAud(invoice.exGstCents)}
Invoice date: ${invoice.issueDate}
Due date: ${invoice.dueDate}
Seller ABN: ${invoice.abn}

Approval: [ ] Approved for payment
Cost centre: ____________________
Signature: ____________________  Date: ____________
`
  }, [invoice])

  const handleCopy = useCallback(() => {
    const text = memoText()
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [memoText])

  const handleApprove = useCallback(() => {
    const text = memoText()
    if (!text) return
    onApprove?.(text)
  }, [memoText, onApprove])

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">
        1-Click Finance Approval Memo
      </h2>
      {invoice ? (
        <>
          <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 font-mono whitespace-pre-wrap break-words">
            {memoText()}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-700 transition-colors hover:bg-slate-50"
            >
              {copied ? 'Copied!' : 'Copy memo'}
            </button>
            <button
              onClick={handleApprove}
              className="px-4 py-2 rounded-md bg-expense-primary text-white text-sm font-medium transition-colors hover:bg-blue-700"
            >
              Approve for payment
            </button>
          </div>
          <p className="mt-3 text-[10px] text-slate-400">
            Copy the memo into your finance system, or approve to log the payment
            authorization against Tax Invoice {invoice.invoiceNumber}.
          </p>
        </>
      ) : (
        <p className="text-xs text-slate-500">
          Select a subscription tier and complete buyer details to generate the memo.
        </p>
      )}
    </section>
  )
}