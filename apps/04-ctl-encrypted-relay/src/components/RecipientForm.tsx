import type { PacketFields } from '../types'

type RecipientFormProps = {
  fields: PacketFields
  onChange: (k: string, v: string) => void
}

export function RecipientForm({ fields, onChange }: RecipientFormProps) {
  return (
    <div className="bg-white rounded-2xl shadow border border-slate-200 p-6">
      <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
        📨 Recipient
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Recipient Role
          </label>
          <input
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            value={fields.recipientRole}
            onChange={(e) => onChange('recipientRole', e.target.value)}
            placeholder="e.g. Board Chair"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Channel / Subject
          </label>
          <input
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            value={fields.channel}
            onChange={(e) => onChange('channel', e.target.value)}
            placeholder="e.g. Secure Room — Q3"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Subject Line
          </label>
          <input
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            value={fields.subject}
            onChange={(e) => onChange('subject', e.target.value)}
            placeholder="e.g. Approved Q3 EBITDA slide"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Cloud Proof Pointer (optional)
          </label>
          <input
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            value={fields.cloudProofPointer}
            onChange={(e) => onChange('cloudProofPointer', e.target.value)}
            placeholder="e.g. #vault=abc123"
          />
        </div>
      </div>
    </div>
  )
}