import type { PacketFields } from '../types'

type DecryptBoxProps = {
  fields: PacketFields
  onChange: (k: string, v: string) => void
  onDecrypt: () => void
}

export function DecryptBox({ fields, onChange, onDecrypt }: DecryptBoxProps) {
  const hash = window.location.hash
  const hasCtlLink = hash.startsWith('#ctl=')

  return (
    <div className="bg-white rounded-2xl shadow border border-slate-200 p-6">
      <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
        🔓 Decrypt Incoming
      </h3>
      {hasCtlLink ? (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
            #ctl= link detected in URL. Enter the shared passphrase to unlock.
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Shared Room Passphrase
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              value={fields.passphrase}
              onChange={(e) => onChange('passphrase', e.target.value)}
              placeholder="••••••"
            />
          </div>
          <button
            onClick={onDecrypt}
            disabled={fields.passphrase.length < 6}
            className={`w-full py-3 rounded-lg font-semibold transition-colors ${
              fields.passphrase.length < 6
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            Unlock & Verify Authenticity
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Open a <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">
              #ctl=…
            </code>
            link to decrypt an incoming packet.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Shared Room Passphrase
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              value={fields.passphrase}
              onChange={(e) => onChange('passphrase', e.target.value)}
              placeholder="••••••"
            />
          </div>
        </div>
      )}
    </div>
  )
}