import { generatePassphrase, MIN_PASSPHRASE_LENGTH } from '@aurelia/core/crypto'
import type { PacketFields } from '../types'

type EncryptButtonProps = {
  fields: PacketFields
  onChange: (k: string, v: string) => void
  onSeal: () => void
  working: boolean
  /** True when a signed-in device will sign the packet. */
  signing: boolean
}

export function EncryptButton({ fields, onChange, onSeal, working, signing }: EncryptButtonProps) {
  const tooShort = fields.passphrase.length < MIN_PASSPHRASE_LENGTH
  const disabled = tooShort || working
  return (
    <div className="bg-white rounded-2xl shadow border border-slate-200 p-6">
      <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">🔐 Seal & Encrypt</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1" htmlFor="seal-pass">
            Shared Room Passphrase (min {MIN_PASSPHRASE_LENGTH} chars)
          </label>
          <div className="flex gap-2">
            <input
              id="seal-pass"
              type="password"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              value={fields.passphrase}
              onChange={(e) => onChange('passphrase', e.target.value)}
              placeholder="••••••••••••"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => onChange('passphrase', generatePassphrase())}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 hover:bg-slate-50"
              title="Generate a random passphrase (share it by another channel)"
            >
              Generate
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Never stored and never sealed into the packet. Share it by a different channel than the link.
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
          disabled={disabled}
          className={`w-full py-3 rounded-lg font-semibold transition-colors ${
            disabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {working ? 'Sealing…' : signing ? 'Seal, Encrypt & Sign Packet' : 'Seal & Encrypt Packet (AES-256-GCM)'}
        </button>
        <p className="text-[10px] text-slate-400">
          {signing
            ? 'Signed with this device’s key so recipients can verify you sent it.'
            : 'Not signed (sign in to sign packets): recipients cannot verify who sealed it.'}
        </p>
      </div>
    </div>
  )
}
