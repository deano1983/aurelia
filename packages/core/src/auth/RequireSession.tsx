import type { CSSProperties, ReactNode } from 'react'
import { useSession } from './AuthProvider'

// Inline styles on purpose: each app's Tailwind build only scans its own src/,
// so utility classes used here would not be generated.
const page: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  background: '#0b1f3a',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
}
const card: CSSProperties = {
  background: '#ffffff',
  color: '#0f172a',
  borderRadius: 16,
  padding: 28,
  width: '100%',
  maxWidth: 420,
  boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
}
const title: CSSProperties = { fontSize: 20, fontWeight: 700, margin: '0 0 8px' }
const text: CSSProperties = { fontSize: 14, lineHeight: 1.5, color: '#475569', margin: '0 0 16px' }
const button: CSSProperties = {
  display: 'inline-block',
  background: '#1d4ed8',
  color: '#ffffff',
  padding: '10px 18px',
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 14,
  textDecoration: 'none',
}
const code: CSSProperties = { fontFamily: 'ui-monospace, monospace', fontSize: 12, background: '#f1f5f9', padding: '1px 4px', borderRadius: 4 }

export function AuthPanel({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div style={page}>
      <div style={card} role="region" aria-label={heading}>
        <h2 style={title}>{heading}</h2>
        {children}
      </div>
    </div>
  )
}

/** Shown when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY were not set at build time. */
export function NotConfiguredPanel() {
  return (
    <AuthPanel heading="Supabase not configured">
      <p style={text}>
        Sign-in is unavailable because this build has no Supabase settings. Set{' '}
        <span style={code}>VITE_SUPABASE_URL</span> and <span style={code}>VITE_SUPABASE_ANON_KEY</span> in{' '}
        <span style={code}>.env.local</span> at the repository root (see <span style={code}>.env.example</span>) and
        rebuild.
      </p>
    </AuthPanel>
  )
}

export type RequireSessionProps = {
  children: ReactNode
  /** Shown in the signed-out panel, e.g. "Daily Command Timeline". */
  appName?: string
  /** Where the hub lives. All apps share one origin, so the default is "/". */
  hubHref?: string
}

/**
 * Gate for apps 01-07: renders children only when signed in. Signed-out users
 * get a link to the hub, which owns the sign-in form.
 */
export function RequireSession({ children, appName, hubHref = '/' }: RequireSessionProps) {
  const { status, configured } = useSession()
  if (!configured) return <NotConfiguredPanel />
  if (status === 'loading') {
    return (
      <AuthPanel heading="Checking your session">
        <p style={text}>One moment…</p>
      </AuthPanel>
    )
  }
  if (status === 'signed_out') {
    return (
      <AuthPanel heading="Sign in to continue">
        <p style={text}>
          {appName ? `${appName} is part of Aurelia OS. ` : ''}Sign in once at the Aurelia hub and every app picks up
          your session.
        </p>
        <a href={hubHref} style={button}>
          Go to the hub to sign in
        </a>
      </AuthPanel>
    )
  }
  return <>{children}</>
}
