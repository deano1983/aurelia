import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { LoginPanel } from './LoginPanel'
import type { UserSession } from '../types'

const SessionContext = createContext<{
  session: UserSession | null
  login: (name: string, role: string, passphrase: string) => void
  logout: () => void
} | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('aurelia_session')
    if (saved) {
      try {
        setSession(JSON.parse(saved))
      } catch {
        // ignore corrupt storage
      }
    }
  }, [])

  const saveSession = (next: UserSession) => {
    localStorage.setItem('aurelia_session', JSON.stringify(next))
    setSession(next)
  }

  const login = (name: string, role: string, passphrase: string) => {
    const next: UserSession = {
      name,
      role,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1d4ed8&color=fff`,
      passphrase,
      isAuthenticated: true,
    }
    saveSession(next)
  }

  const logout = () => {
    localStorage.removeItem('aurelia_session')
    setSession(null)
  }

  return (
    <SessionContext.Provider value={{ session, login, logout }}>
      {session ? children : <LoginPanelShell onLogin={login} />}
    </SessionContext.Provider>
  )
}

function LoginPanelShell({ onLogin }: { onLogin: (n: string, r: string, p: string) => void }) {
  return <LoginPanel onLogin={onLogin} />
}

export const useSession = () => {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}