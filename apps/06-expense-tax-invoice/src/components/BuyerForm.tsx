import { useCallback } from 'react'
import type { BuyerDetails } from '../types'

export const EMPTY_BUYER: BuyerDetails = {
  executiveName: '',
  companyEntityName: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  suburb: '',
  postcode: '',
  state: '',
}

interface BuyerFormProps {
  buyer: BuyerDetails
  onChange: (buyer: BuyerDetails) => void
}

const FIELDS: Array<{ key: keyof BuyerDetails; label: string; type: string }> = [
  { key: 'executiveName', label: 'Executive / Buyer Name', type: 'text' },
  { key: 'companyEntityName', label: 'Company / Entity Name', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'addressLine1', label: 'Address Line 1', type: 'text' },
  { key: 'addressLine2', label: 'Address Line 2', type: 'text' },
  { key: 'suburb', label: 'Suburb', type: 'text' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'postcode', label: 'Postcode', type: 'text' },
]

export function BuyerForm({ buyer, onChange }: BuyerFormProps) {
  const setField = useCallback(
    (key: keyof BuyerDetails, value: string) => {
      onChange({ ...buyer, [key]: value })
    },
    [buyer, onChange],
  )

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">Buyer Details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">
              {field.label}
            </label>
            <input
              type={field.type}
              value={buyer[field.key]}
              onChange={(e) => setField(field.key, e.target.value)}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-slate-400">
        Buyer details appear on the Tax Invoice and Finance Approval Memo.
      </p>
    </section>
  )
}