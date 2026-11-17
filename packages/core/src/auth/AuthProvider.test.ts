// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AureliaAuthProvider, useSession, type SessionContextValue } from './AuthProvider'
import { RequireSession } from './RequireSession'
import { getSupabase, resetSupabaseForTests, LEGACY_SESSION_KEY } from './client'
import { newRoomSalt, saltToBase64 } from './roomKey'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const PASSPHRASE = 'tangerine-orbit-7731'

function fakeClient(opts: { signedIn: boolean; salt?: string | null }) {
  const session = opts.signedIn
    ? { user: { id: 'u-1', email: 'dc@example.com', user_metadata: {} } }
    : null
  const profile = opts.signedIn ? { display_name: 'DC', role: 'Executive', room_salt: opts.salt ?? null } : null
  return {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: vi.fn(async () => ({ error: null })),
      signInWithOtp: vi.fn(async () => ({ error: null })),
      signInWithOAuth: vi.fn(async () => ({ error: null })),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }),
    }),
  } as unknown as SupabaseClient
}

let container: HTMLDivElement
let root: Root
let ctx: SessionContextValue | null = null

function Probe() {
  ctx = useSession()
  return null
}

async function render(node: ReactNode) {
  await act(async () => {
    root.render(node)
  })
  // let getSession() and the profile query settle
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  ctx = null
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  resetSupabaseForTests()
})

describe('AureliaAuthProvider', () => {
  it('shows the not-configured panel when env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    resetSupabaseForTests()
    expect(getSupabase()).toBeNull()

    await render(
      createElement(AureliaAuthProvider, null, createElement(Probe), createElement(RequireSession, null, 'secret app')),
    )
    expect(ctx?.configured).toBe(false)
    expect(ctx?.status).toBe('signed_out')
    expect(container.textContent).toContain('Supabase not configured')
    expect(container.textContent).not.toContain('secret app')
    await expect(ctx!.signInWithEmail('dc@example.com')).rejects.toThrow(/not configured/)
  })

  it('links signed-out users to the hub instead of showing a form', async () => {
    await render(
      createElement(
        AureliaAuthProvider,
        { client: fakeClient({ signedIn: false }) },
        createElement(RequireSession, { appName: 'Timeline' }, 'secret app'),
      ),
    )
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/')
    expect(container.querySelector('input')).toBeNull()
    expect(container.textContent).not.toContain('secret app')
  })

  it('renders children when signed in and clears the legacy plaintext session', async () => {
    localStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify({ name: 'x', passphrase: 'plaintext!' }))
    await render(
      createElement(
        AureliaAuthProvider,
        { client: fakeClient({ signedIn: true, salt: saltToBase64(newRoomSalt()) }) },
        createElement(Probe),
        createElement(RequireSession, null, 'secret app'),
      ),
    )
    expect(ctx?.status).toBe('signed_in')
    expect(ctx?.user).toEqual({ id: 'u-1', email: 'dc@example.com', name: 'DC', role: 'Executive' })
    expect(container.textContent).toContain('secret app')
    expect(localStorage.getItem(LEGACY_SESSION_KEY)).toBeNull()
  })

  it('unlocks the room without writing the passphrase to storage, and locks again', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    await render(
      createElement(
        AureliaAuthProvider,
        { client: fakeClient({ signedIn: true, salt: saltToBase64(newRoomSalt()) }) },
        createElement(Probe),
      ),
    )
    await act(async () => {
      await ctx!.unlockRoom(PASSPHRASE)
    })
    expect(ctx?.roomKey).not.toBeNull()
    expect(ctx?.roomKey?.extractable).toBe(false)

    for (const call of setItem.mock.calls) expect(String(call[1])).not.toContain(PASSPHRASE)
    for (const store of [localStorage, sessionStorage]) {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i)!
        expect(k).not.toContain(PASSPHRASE)
        expect(store.getItem(k) ?? '').not.toContain(PASSPHRASE)
      }
    }
    expect(document.cookie).not.toContain(PASSPHRASE)

    act(() => ctx!.lockRoom())
    expect(ctx?.roomKey).toBeNull()
  })

  it('auto-locks the room after the idle timeout', async () => {
    await render(
      createElement(
        AureliaAuthProvider,
        { client: fakeClient({ signedIn: true, salt: saltToBase64(newRoomSalt()) }), idleLockMs: 40 },
        createElement(Probe),
      ),
    )
    await act(async () => {
      await ctx!.unlockRoom(PASSPHRASE)
    })
    expect(ctx?.roomKey).not.toBeNull()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 120))
    })
    expect(ctx?.roomKey).toBeNull()
  })

  it('refuses to unlock when the profile has no salt or the passphrase is short', async () => {
    await render(
      createElement(AureliaAuthProvider, { client: fakeClient({ signedIn: true, salt: null }) }, createElement(Probe)),
    )
    await expect(ctx!.unlockRoom(PASSPHRASE)).rejects.toThrow(/salt/)
    await expect(ctx!.unlockRoom('short')).rejects.toThrow(/at least/)
    expect(ctx?.roomKey).toBeNull()
  })
})
