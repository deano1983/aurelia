import { useEffect, useState } from 'react'

/**
 * Keep all eight apps on the same build. The assemble step writes /version.json
 * (scripts/write-version.mjs) and bakes the same id into every app as
 * VITE_AURELIA_BUILD_ID. An app whose own id differs from the hub's shows a small
 * "Update available" banner. Nothing is emitted on the bus.
 */

export interface VersionInfo {
  buildId: string
  builtAt?: string
}

export const VERSION_URL = '/version.json'

/** This bundle's build id, or null in dev / when not built by the assemble step. */
export function ownBuildId(): string | null {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    const id = env?.VITE_AURELIA_BUILD_ID
    return id && id.trim() ? id.trim() : null
  } catch {
    return null
  }
}

export async function fetchSuiteVersion(url = VERSION_URL, fetchImpl: typeof fetch | undefined = globalThis.fetch): Promise<VersionInfo | null> {
  if (typeof fetchImpl !== 'function') return null
  try {
    const res = await fetchImpl(url, { cache: 'no-store', credentials: 'same-origin' })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<VersionInfo>
    if (typeof data.buildId !== 'string' || !data.buildId || data.buildId.length > 128) return null
    return { buildId: data.buildId, builtAt: typeof data.builtAt === 'string' ? data.builtAt : undefined }
  } catch {
    return null
  }
}

/** True when both ids are known and differ. */
export function isUpdateAvailable(own: string | null, suite: VersionInfo | null): boolean {
  return Boolean(own && suite && suite.buildId !== own)
}

const RECHECK_MS = 10 * 60 * 1000

/** Polls /version.json at boot, on tab focus and every 10 minutes. */
export function useVersionCheck(own: string | null = ownBuildId()): { updateAvailable: boolean; suite: VersionInfo | null } {
  const [suite, setSuite] = useState<VersionInfo | null>(null)
  useEffect(() => {
    if (!own) return
    let alive = true
    const check = async () => {
      const info = await fetchSuiteVersion()
      if (alive && info) setSuite(info)
    }
    void check()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(() => void check(), RECHECK_MS)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [own])
  return { updateAvailable: isUpdateAvailable(own, suite), suite }
}

/** Small fixed banner; renders nothing unless this app is behind the hub's build. */
export function UpdateBanner() {
  const { updateAvailable } = useVersionCheck()
  const [dismissed, setDismissed] = useState(false)
  if (!updateAvailable || dismissed) return null
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 2147483000,
        margin: '0 auto',
        maxWidth: 420,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 12,
        background: '#0b1f3a',
        color: '#ffffff',
        font: '500 14px/1.4 system-ui, -apple-system, Segoe UI, sans-serif',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      }}
    >
      <span style={{ flex: 1 }}>Update available</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{ border: 0, borderRadius: 8, padding: '6px 12px', background: '#ffffff', color: '#0b1f3a', fontWeight: 600, cursor: 'pointer' }}
      >
        Reload
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        style={{ border: 0, background: 'transparent', color: '#cbd5e1', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  )
}
