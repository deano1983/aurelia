import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from './config'

/**
 * localStorage key for the Supabase session. All eight apps are served from one
 * origin, so one sign-in in the hub is visible to every app.
 */
export const AUTH_STORAGE_KEY = 'aurelia.auth'

/** Legacy key from the old hub login, which stored the passphrase in plain text. */
export const LEGACY_SESSION_KEY = 'aurelia_session'

/** Deep link the native (Capacitor) hub registers for auth callbacks. */
export const NATIVE_AUTH_CALLBACK = 'com.aurelia.os.centralhub://auth-callback'

let client: SupabaseClient | null | undefined

/** The shared Supabase client, or null when Supabase is not configured. */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client
  const config = getSupabaseConfig()
  client = config
    ? createClient(config.url, config.anonKey, {
        auth: {
          storageKey: AUTH_STORAGE_KEY,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // PKCE keeps tokens out of the URL and leaves the hub's #ctl= / #vault=
          // hash deep links alone. The magic link must be opened in the same
          // browser that requested it.
          flowType: 'pkce',
        },
      })
    : null
  return client
}

/** Test hook: forget the cached client so the next call re-reads env. */
export function resetSupabaseForTests(): void {
  client = undefined
}

/** Removes the old plaintext session (name + passphrase) if it is still there. */
export function clearLegacySession(): void {
  try {
    window.localStorage.removeItem(LEGACY_SESSION_KEY)
  } catch {
    // storage unavailable (private mode, sandboxed frame): nothing to clear
  }
}

type CapacitorGlobal = { isNativePlatform?: () => boolean }

/** True inside a Capacitor native shell (no @capacitor dependency needed). */
export function isNativePlatform(): boolean {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor
  return Boolean(cap?.isNativePlatform?.())
}

/** Where magic links and OAuth should send the user back to. */
export function authRedirectUrl(): string {
  if (isNativePlatform()) return NATIVE_AUTH_CALLBACK
  return `${window.location.origin}/`
}

/**
 * Completes a sign-in from a callback URL that carries a PKCE `code`
 * (used by native deep links, where detectSessionInUrl cannot see the URL).
 */
export async function completeSignInFromUrl(supabase: SupabaseClient, url: string): Promise<boolean> {
  let code: string | null = null
  try {
    code = new URL(url).searchParams.get('code')
  } catch {
    return false
  }
  if (!code) return false
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) throw error
  return true
}
