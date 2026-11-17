// Reads the Supabase project URL and publishable (anon) key from Vite env.
// Values come from VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (root .env.local,
// or the CI environment). Nothing is hard-coded here.

export type SupabaseConfig = { url: string; anonKey: string }

type EnvLike = Record<string, string | boolean | undefined>

/** Pure: returns the config, or null when either value is missing or blank. */
export function readSupabaseConfig(env: EnvLike | undefined | null): SupabaseConfig | null {
  if (!env) return null
  const url = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : ''
  const anonKey = typeof env.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY.trim() : ''
  if (!url || !anonKey) return null
  if (!/^https?:\/\//.test(url)) return null
  return { url: url.replace(/\/+$/, ''), anonKey }
}

/** The config for the running app (Vite inlines import.meta.env at build time). */
export function getSupabaseConfig(): SupabaseConfig | null {
  // The cast keeps this file free of a dependency on vite/client types; the
  // emitted code is still `import.meta.env`, which Vite replaces at build time.
  const env = (import.meta as unknown as { env?: EnvLike }).env
  return readSupabaseConfig(env)
}
