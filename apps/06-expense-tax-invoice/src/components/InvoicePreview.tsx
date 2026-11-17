import type { Invoice } from '../types'
import { ABN } from '../utils/constants'
import { centsToAud } from '../utils/currency'

interface InvoicePreviewProps {
  invoice: Invoice | null
  onDueDateChange: (date: string) => void
}

export function InvoicePreview({ invoice, onDueDateChange }: InvoicePreviewProps) {
  if (!invoice) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Tax Invoice — Preview</h2>
        <p className="text-xs text-slate-500">
          Select a subscription tier to preview the tax invoice.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">Tax Invoice — Preview</h2>
        <span className="text-[10px] px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500">
          ABN {ABN}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            Invoice
          </p>
          <p className="text-sm font-mono font-bold">{invoice.invoiceNumber}</p>
          <p className="text-sm">{invoice.issueDate}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            Due date
          </p>
          <input
            type="date"
            value={invoice.dueDate}
            onChange={(e) => onDueDateChange(e.target.value)}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            From
          </p>
          <p className="text-sm font-semibold">Aurelia OS</p>
          <p className="text-xs text-slate-500">ABN {ABN}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            Bill to
          </p>
          <p className="text-sm font-semibold">{invoice.buyer.executiveName}</p>
          <p className="text-sm">{invoice.buyer.companyEntityName}</p>
          <p className="text-xs text-slate-500">{invoice.buyer.email}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 mb-4">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Description
              </th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold text-right">
                Qty
              </th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold text-right">
                Ex GST
              </th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold text-right">
                GST
              </th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.description} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-3">{line.description}</td>
                <td className="px-3 py-3 text-right">{line.quantity}</td>
                <td className="px-3 py-3 text-right font-mono">{centsToAud(line.unitExGstCents)}</td>
                <td className="px-3 py-3 text-right font-mono">{centsToAud(line.gstCents)}</td>
                <td className="px-3 py-3 text-right font-mono">{centsToAud(line.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end space-x-3 pt-2">
        <div className="text-right">
          <p className="text-xs text-slate-500">Ex GST</p>
          <p className="text-sm font-mono font-bold">{centsToAud(invoice.exGstCents)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">GST (10%)</p>
          <p className="text-sm font-mono font-bold">{centsToAud(invoice.gstCents)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Total payable</p>
          <p className="text-sm font-bold text-expense-dark">{centsToAud(invoice.totalCents)}</p>
        </div>
      </div>

      <p className="mt-4 text-[10px] text-slate-400">
        Pre-coded expense category: <strong>{invoice.category} / {invoice.subCategory}</strong> •
        GST inclusive • Payment terms: 14 days.
      </p>
    </section>
  )
}