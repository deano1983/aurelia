import type { PacketFields } from '../types'

type EncryptButtonProps = {
  fields: PacketFields
  onChange: (k: string, v: string) => void
  onSeal: () => void
}

export function EncryptButton({ fields, onChange, onSeal }: EncryptButtonProps) {
  return (
    <div className="bg-white rounded-2xl shadow border border-slate-200 p-6">
      <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
        🔐 Seal & Encrypt
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Shared Room Passphrase (min 6 chars)
          </label>
          <input
            type="password"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            value={fields.passphrase}
            onChange={(e) => onChange('passphrase', e.target.value)}
            placeholder="••••••"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Never stored — used only for this session
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Confidential Interoffice Note / Sign-Off Instruction
          </label>
          <textarea
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            rows={4}
            value={fields.confidentialNote}
            onChange={(e) => onChange('confidentialNote', e.target.value)}
            placeholder="e.g. Approved Q3 EBITDA slide and LinkedIn carousel draft. Hold external release until 09:30 AEST after board chair sign-off."
          />
        </div>
        <button
          onClick={onSeal}
          disabled={fields.passphrase.length < 6}
          className={`w-full py-3 rounded-lg font-semibold transition-colors ${
            fields.passphrase.length < 6
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          Seal & Encrypt Packet (AES-256-GCM)
        </button>
      </div>
    </div>
  )
}