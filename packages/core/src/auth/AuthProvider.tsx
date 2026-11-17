import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import {
  authRedirectUrl,
  clearLegacySession,
  completeSignInFromUrl,
  getSupabase,
  isNativePlatform,
} from './client'
import { deriveRoomKey, MIN_PASSPHRASE_LENGTH, saltFromBase64 } from './roomKey'

export type SessionStatus = 'loading' | 'signed_out' | 'signed_in'

export type AureliaUser = {
  id: string
  email: string | null
  name: string
  role: string
}

export type ProfileUpdate = { name?: string; role?: string }

export type SessionContextValue = {
  status: SessionStatus
  /** False when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. */
  configured: boolean
  user: AureliaUser | null
  supabase: SupabaseClient | null
  /** AES-GCM 256 room key, in memory only; null while locked. */
  roomKey: CryptoKey | null
  /** Last profile load error (for example, migration 0001 not applied). */
  profileError: string | null
  signInWithEmail: (email: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (update: ProfileUpdate) => Promise<void>
  unlockRoom: (passphrase: string) => Promise<void>
  lockRoom: () => void
}

export const DEFAULT_ROLE = 'Executive'
export const IDLE_LOCK_MS = 30 * 60 * 1000

const SessionContext = createContext<SessionContextValue | null>(null)

type ProfileRow = { display_name: string | null; role: string | null; room_salt: string | null }

function notConfigured(): never {
  throw new Error('Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
}

function fallbackName(session: Session): string {
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>
  const fromMeta = meta.full_name ?? meta.name
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim()
  return session.user.email?.split('@')[0] ?? 'Aurelia user'
}

export type AureliaAuthProviderProps = {
  children: ReactNode
  /**
   * Override the shared client (tests). Omit to use getSupabase();
   * pass null to force the not-configured state.
   */
  client?: SupabaseClient | null
  /** Idle time before the room key is dropped. Default 30 minutes. */
  idleLockMs?: number
}

export function AureliaAuthProvider({ children, client, idleLockMs = IDLE_LOCK_MS }: AureliaAuthProviderProps) {
  const supabase = useMemo(() => (client !== undefined ? client : getSupabase()), [client])
  const [status, setStatus] = useState<SessionStatus>(supabase ? 'loading' : 'signed_out')
  const [user, setUser] = useState<AureliaUser | null>(null)
  const [roomKey, setRoomKey] = useState<CryptoKey | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  // Salt is not secret, but keep it out of the public context value.
  const saltRef = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  const lockRoom = useCallback(() => setRoomKey(null), [])

  useEffect(() => {
    clearLegacySession()
  }, [])

  // Session tracking.
  useEffect(() => {
    if (!supabase) return
    let cancelled = false

    const apply = async (session: Session | null) => {
      if (cancelled) return
      if (!session) {
        userIdRef.current = null
        saltRef.current = null
        setUser(null)
        setRoomKey(null)
        setProfileError(null)
        setStatus('signed_out')
        return
      }
      if (userIdRef.current !== session.user.id) setRoomKey(null)
      userIdRef.current = session.user.id
      const base: AureliaUser = {
        id: session.user.id,
        email: session.user.email ?? null,
        name: fallbackName(session),
        role: DEFAULT_ROLE,
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, role, room_salt')
        .eq('id', session.user.id)
        .maybeSingle()
      if (cancelled) return
      const row = (data ?? null) as ProfileRow | null
      if (error || !row) {
        saltRef.current = null
        setProfileError(error ? error.message : 'Profile not found.')
        setUser(base)
      } else {
        saltRef.current = row.room_salt
        setProfileError(null)
        setUser({ ...base, name: row.display_name?.trim() || base.name, role: row.role || DEFAULT_ROLE })
      }
      setStatus('signed_in')
    }

    supabase.auth
      .getSession()
      .then(({ data }) => apply(data.session))
      .catch(() => {
        if (!cancelled) setStatus('signed_out')
      })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      // Defer: calling Supabase inside this callback can deadlock the auth lock.
      setTimeout(() => void apply(session), 0)
    })

    // Native shells receive the magic-link / OAuth callback as a deep link.
    let removeDeepLink: (() => void) | undefined
    if (isNativePlatform()) {
      type AppPlugin = {
        addListener: (
          e: 'appUrlOpen',
          cb: (ev: { url: string }) => void,
        ) => Promise<{ remove: () => void }> | { remove: () => void }
      }
      const appPlugin = (globalThis as { Capacitor?: { Plugins?: { App?: AppPlugin } } }).Capacitor?.Plugins?.App
      if (appPlugin) {
        void Promise.resolve(
          appPlugin.addListener('appUrlOpen', ({ url }) => {
            void completeSignInFromUrl(supabase, url).catch(() => undefined)
          }),
        ).then((handle) => {
          if (cancelled) handle.remove()
          else removeDeepLink = () => handle.remove()
        })
      }
    }

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
      removeDeepLink?.()
    }
  }, [supabase])

  // Idle auto-lock: drop the key after idleLockMs without user activity.
  useEffect(() => {
    if (!roomKey) return
    let last = Date.now()
    const check = () => {
      if (Date.now() - last >= idleLockMs) setRoomKey(null)
    }
    const touch = () => {
      check()
      last = Date.now()
    }
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    document.addEventListener('visibilitychange', check)
    const timer = setInterval(check, Math.min(30_000, Math.max(10, Math.floor(idleLockMs / 4))))
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch))
      document.removeEventListener('visibilitychange', check)
      clearInterval(timer)
    }
  }, [roomKey, idleLockMs])

  const signInWithEmail = useCallback(
    async (email: string) => {
      if (!supabase) notConfigured()
      const trimmed = email.trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) throw new Error('Enter a valid email address.')
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: authRedirectUrl() },
      })
      if (error) throw error
    },
    [supabase],
  )

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) notConfigured()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirectUrl() },
    })
    if (error) throw error
  }, [supabase])

  const signOut = useCallback(async () => {
    setRoomKey(null)
    clearLegacySession()
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      // Still drop the local session so the user is not stuck signed in.
      await supabase.auth.signOut({ scope: 'local' })
    }
  }, [supabase])

  const updateProfile = useCallback(
    async (update: ProfileUpdate) => {
      if (!supabase) notConfigured()
      const id = userIdRef.current
      if (!id) throw new Error('Sign in first.')
      const patch: Record<string, string> = {}
      if (update.name !== undefined) {
        const name = update.name.trim()
        if (!name) throw new Error('Name cannot be empty.')
        patch.display_name = name.slice(0, 80)
      }
      if (update.role !== undefined) patch.role = update.role
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', id)
        .select('display_name, role')
        .single()
      if (error) throw error
      const row = data as Pick<ProfileRow, 'display_name' | 'role'>
      setUser((u) =>
        u && u.id === id
          ? { ...u, name: row.display_name?.trim() || u.name, role: row.role || u.role }
          : u,
      )
    },
    [supabase],
  )

  const unlockRoom = useCallback(async (passphrase: string) => {
    if (!userIdRef.current) throw new Error('Sign in before unlocking the room.')
    if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE_LENGTH) {
      throw new Error(`The room passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`)
    }
    const salt = saltRef.current
    if (!salt) throw new Error('Your profile has no room salt yet. Ask the owner to apply migration 0001.')
    const id = userIdRef.current
    const key = await deriveRoomKey(passphrase, saltFromBase64(salt))
    if (userIdRef.current === id) setRoomKey(key)
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      configured: supabase !== null,
      user,
      supabase,
      roomKey,
      profileError,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      updateProfile,
      unlockRoom,
      lockRoom,
    }),
    [status, supabase, user, roomKey, profileError, signInWithEmail, signInWithGoogle, signOut, updateProfile, unlockRoom, lockRoom],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <AureliaAuthProvider>.')
  return ctx
}
