import { useState } from 'react'
import type { AureliaUser } from '@aurelia/core/auth'

type HeaderProps = {
  user: AureliaUser
  onSignOut: () => Promise<void> | void
}

export function Header({ user, onSignOut }: HeaderProps) {
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    try {
      await onSignOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
            A
          </div>
          <div>
            <h1 className="text-lg font-bold text-aurelia-dark">Aurelia OS</h1>
            <p className="text-xs text-slate-500">
              Sovereign Command Suite · {user.role}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full text-xs text-slate-600 border border-slate-200"
            title={user.email ?? undefined}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>{user.name}</span>
          </div>
          <button
            onClick={signOut}
            disabled={signingOut}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 rounded-lg transition-colors"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </header>
  )
}
