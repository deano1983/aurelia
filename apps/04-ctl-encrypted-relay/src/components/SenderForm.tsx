import type { PacketFields } from '../types'

type SenderFormProps = {
  fields: PacketFields
  onChange: (k: string, v: string) => void
}

export function SenderForm({ fields, onChange }: SenderFormProps) {
  return (
    <div className="bg-white rounded-2xl shadow border border-slate-200 p-6">
      <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
        👤 Sender Desk
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Desk / Role
          </label>
          <input
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            value={fields.senderDesk}
            onChange={(e) => onChange('senderDesk', e.target.value)}
            placeholder="e.g. Executive Office"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Your Role
          </label>
          <input
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            value={fields.senderRole}
            onChange={(e) => onChange('senderRole', e.target.value)}
            placeholder="e.g. Chief of Staff"
          />
        </div>
      </div>
    </div>
  )
}