import type { PacketFields } from '../types'

type DecryptBoxProps = {
  fields: PacketFields
  onChange: (k: string, v: string) => void
  onDecrypt: () => void
  /** A #ctl= packet arrived in the URL (already removed from the address bar). */
  hasIncoming: boolean
  linkInput: string
  onLinkInput: (v: string) => void
  working: boolean
}

export function DecryptBox({ fields, onChange, onDecrypt, hasIncoming, linkInput, onLinkInput, working }: DecryptBoxProps) {
  const ready = fields.passphrase.length > 0 && (hasIncoming || linkInput.trim().length > 0) && !working

  return (
    <div className="bg-white rounded-2xl shadow border border-slate-200 p-6">
      <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">🔓 Decrypt Incoming</h3>
      <div className="space-y-4">
        {hasIncoming ? (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
            #ctl= packet received. It has been removed from the address bar and history. Enter the shared passphrase to
            decrypt it.
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Open a{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">#ctl=…</code> link, or paste one
            below.
          </p>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1" htmlFor="ctl-link">
            {hasIncoming ? 'Or paste a different link' : 'Paste #ctl= link'}
          </label>
          <input
            id="ctl-link"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            value={linkInput}
            onChange={(e) => onLinkInput(e.target.value)}
            placeholder="https://…/apps/04-ctl-encrypted-relay/#ctl=…"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1" htmlFor="decrypt-pass">
            Shared Room Passphrase
          </label>
          <input
            id="decrypt-pass"
            type="password"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            value={fields.passphrase}
            onChange={(e) => onChange('passphrase', e.target.value)}
            placeholder="••••••"
            autoComplete="off"
          />
        </div>
        <button
          onClick={onDecrypt}
          disabled={!ready}
          className={`w-full py-3 rounded-lg font-semibold transition-colors ${
            !ready ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {working ? 'Decrypting…' : 'Decrypt & Check Signature'}
        </button>
        <p className="text-[10px] text-slate-400">
          Decryption proves only that the sender knew the passphrase. The sender is verified only when the packet carries
          a valid device signature.
        </p>
      </div>
    </div>
  )
}
