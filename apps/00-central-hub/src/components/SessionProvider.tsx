import { type ReactNode, useEffect, useRef } from 'react'
import { emit } from '@aurelia/core/events'
import { AureliaAuthProvider, NotConfiguredPanel, clearLegacySession, useSession } from '@aurelia/core/auth'
import { LoginPanel } from './LoginPanel'

// The old hub stored { name, role, passphrase } in plain text under
// localStorage "aurelia_session". Remove it as soon as the hub loads.
clearLegacySession()

/** Hub gate: Supabase sign-in, shared with all apps on this origin. */
export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <AureliaAuthProvider>
      <SessionGate>{children}</SessionGate>
    </AureliaAuthProvider>
  )
}

function SessionGate({ children }: { children: ReactNode }) {
  const { status, configured } = useSession()
  // Tell the other apps when the hub signs in or out (status only, never tokens).
  const last = useRef<string | null>(null)
  useEffect(() => {
    if (status === 'loading' || last.current === status) return
    if (last.current !== null) emit('hub.session_changed', { status }, { source: '00' })
    last.current = status
  }, [status])
  if (!configured) return <NotConfiguredPanel />
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-aurelia-dark text-slate-300 text-sm">
        Checking your session…
      </div>
    )
  }
  if (status === 'signed_out') return <LoginPanel />
  return <>{children}</>
}

export { useSession }
