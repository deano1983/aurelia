import { useState } from 'react'

type LoginPanelProps = {
  onLogin: (name: string, role: string, passphrase: string) => void
}

export function LoginPanel({ onLogin }: LoginPanelProps) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('Executive')
  const [passphrase, setPassphrase] = useState('')

  return (
    <div className="min-h-screen flex items-center justify-center bg-aurelia-dark p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-xl">🔑</div>
          <h2 className="text-xl font-bold text-aurelia-dark">Aurelia OS</h2>
        </div>
        <p className="text-slate-600 mb-6">
          Enter your executive credentials to access the Command Suite.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Name</label>
            <input
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Chen"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Role</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option>Executive</option>
              <option>Executive Assistant</option>
              <option>Board Chair</option>
              <option>Ghostwriter</option>
              <option>Creator</option>
              <option>Personal / Life</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Shared Room Passphrase (min 6 chars)
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="••••••"
            />
          </div>
          <button
            onClick={() => onLogin(name, role, passphrase)}
            disabled={name.length === 0 || passphrase.length < 6}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Unlock Command Suite
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-6 text-center">
          Passphrase never touches storage — used only for session encryption.
        </p>
      </div>
    </div>
  )
}