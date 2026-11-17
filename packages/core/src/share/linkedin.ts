// Client side of direct LinkedIn posting. The app never sees a LinkedIn
// token: connectLinkedIn() hands the browser to the linkedin-auth edge
// function, and postToLinkedIn() asks the linkedin-post edge function to
// post with the token it keeps server-side.

import type { SupabaseClient } from '@supabase/supabase-js'

export type LinkedInVisibility = 'PUBLIC' | 'CONNECTIONS'

export interface LinkedInOptions {
  /** The app's Supabase client (for the user's session). */
  supabase: SupabaseClient | null | undefined
  /** Defaults to `${VITE_SUPABASE_URL}/functions/v1`. */
  functionsUrl?: string
}

export type LinkedInPostResult =
  | { ok: true; postUrn: string; postUrl?: string }
  | {
      ok: false
      error:
        | 'not_configured'
        | 'not_signed_in'
        | 'not_connected'
        | 'token_expired'
        | 'forbidden'
        | 'rate_limited'
        | 'network_error'
        | string
      /** True when the user must connect LinkedIn again. */
      reconnect?: boolean
      retryAfter?: number | null
      message?: string
    }

function viteEnv(name: string): string | undefined {
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> }
  return meta.env?.[name]
}

/** `${VITE_SUPABASE_URL}/functions/v1`, or null when Supabase is not configured. */
export function defaultFunctionsUrl(): string | null {
  const base = viteEnv('VITE_SUPABASE_URL')
  return base ? `${base.replace(/\/+$/, '')}/functions/v1` : null
}

let localClient: Promise<SupabaseClient | null> | null = null

/**
 * A Supabase client for sharing, made from VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY, or null when those are not set. Prefer passing the
 * app's own client (from '@aurelia/core/auth') where one exists.
 */
export function getShareSupabase(): Promise<SupabaseClient | null> {
  if (localClient) return localClient
  const url = viteEnv('VITE_SUPABASE_URL')
  const key = viteEnv('VITE_SUPABASE_ANON_KEY')
  if (!url || !key) return Promise.resolve(null)
  localClient = import('@supabase/supabase-js')
    .then(({ createClient }) => createClient(url, key) as SupabaseClient)
    .catch(() => null)
  return localClient
}

export async function getAccessToken(supabase: SupabaseClient | null | undefined): Promise<string | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

export interface LinkedInStatus {
  connected: boolean
  expiresAt: string | null
}

/** Whether the signed-in user has a live LinkedIn connection. Null when unknown. */
export async function getLinkedInStatus(
  supabase: SupabaseClient | null | undefined,
): Promise<LinkedInStatus | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.rpc('linkedin_status')
    if (error || !data) return null
    const row = (Array.isArray(data) ? data[0] : data) as
      | { connected?: boolean; expires_at?: string | null }
      | undefined
    return { connected: Boolean(row?.connected), expiresAt: row?.expires_at ?? null }
  } catch {
    return null
  }
}

/**
 * Send the browser to LinkedIn's consent screen through the linkedin-auth
 * function. Uses a top-level form POST so the Supabase JWT travels in the
 * request body, never in a URL. Afterwards the browser returns to `returnTo`
 * with `?linkedin=connected` or `?linkedin=error&linkedin_reason=…`.
 */
export async function connectLinkedIn(
  opts: LinkedInOptions & { returnTo?: string },
): Promise<{ ok: false; error: 'not_configured' | 'not_signed_in' } | { ok: true }> {
  const base = opts.functionsUrl ?? defaultFunctionsUrl()
  if (!base) return { ok: false, error: 'not_configured' }
  const jwt = await getAccessToken(opts.supabase)
  if (!jwt) return { ok: false, error: 'not_signed_in' }

  const form = document.createElement('form')
  form.method = 'POST'
  form.action = `${base}/linkedin-auth/start`
  form.style.display = 'none'
  const fields: Record<string, string> = {
    access_token: jwt,
    return_to: opts.returnTo ?? window.location.href.split('#')[0],
  }
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
  return { ok: true }
}

/** Post text to the signed-in user's LinkedIn feed via the linkedin-post function. */
export async function postToLinkedIn(
  text: string,
  visibility: LinkedInVisibility = 'PUBLIC',
  opts: LinkedInOptions & { appId?: string; fetchImpl?: typeof fetch } = { supabase: null },
): Promise<LinkedInPostResult> {
  const base = opts.functionsUrl ?? defaultFunctionsUrl()
  if (!base) return { ok: false, error: 'not_configured' }
  const jwt = await getAccessToken(opts.supabase)
  if (!jwt) return { ok: false, error: 'not_signed_in' }

  const doFetch = opts.fetchImpl ?? fetch
  let res: Response
  try {
    res = await doFetch(`${base}/linkedin-post`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, visibility, appId: opts.appId }),
    })
  } catch {
    return { ok: false, error: 'network_error' }
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await res.json()) as Record<string, unknown>
  } catch {
    body = {}
  }
  if (res.ok && typeof body.postUrn === 'string') {
    return {
      ok: true,
      postUrn: body.postUrn,
      postUrl: typeof body.postUrl === 'string' ? body.postUrl : undefined,
    }
  }
  const error = typeof body.error === 'string' ? body.error : `http_${res.status}`
  const retryHeader = Number(res.headers.get('Retry-After'))
  return {
    ok: false,
    error,
    reconnect: body.reconnect === true || res.status === 401,
    retryAfter:
      typeof body.retryAfter === 'number'
        ? body.retryAfter
        : Number.isFinite(retryHeader) && retryHeader > 0
          ? retryHeader
          : null,
    message: typeof body.message === 'string' ? body.message : undefined,
  }
}

/** Record a share in share_log (best effort; ignored when signed out). */
export async function logShare(
  supabase: SupabaseClient | null | undefined,
  entry: { network: string; appId?: string; postUrn?: string },
): Promise<void> {
  if (!supabase) return
  try {
    const jwt = await getAccessToken(supabase)
    if (!jwt) return
    await supabase.from('share_log').insert({
      network: entry.network,
      app_id: entry.appId ?? null,
      post_urn: entry.postUrn ?? null,
    })
  } catch {
    // Logging must never block sharing.
  }
}

/** Read and remove `?linkedin=…` left by the linkedin-auth redirect. */
export function consumeLinkedInReturn(
  loc: Location = window.location,
  history: History = window.history,
): { status: 'connected' | 'error'; reason: string | null } | null {
  const url = new URL(loc.href)
  const status = url.searchParams.get('linkedin')
  if (status !== 'connected' && status !== 'error') return null
  const reason = url.searchParams.get('linkedin_reason')
  url.searchParams.delete('linkedin')
  url.searchParams.delete('linkedin_reason')
  history.replaceState(history.state, '', url.toString())
  return { status, reason }
}

export function describeLinkedInError(r: Extract<LinkedInPostResult, { ok: false }>): string {
  switch (r.error) {
    case 'not_configured':
      return 'Direct posting is not set up on this deployment yet.'
    case 'not_signed_in':
      return 'Sign in to Aurelia to post directly.'
    case 'not_connected':
      return 'Connect your LinkedIn account first.'
    case 'token_expired':
      return 'Your LinkedIn connection has expired. Reconnect to keep posting.'
    case 'forbidden':
      return 'LinkedIn refused the post. Reconnect and allow posting permission.'
    case 'rate_limited':
      return r.retryAfter
        ? `LinkedIn is rate limiting posts. Try again in ${r.retryAfter} seconds.`
        : 'LinkedIn is rate limiting posts. Try again shortly.'
    case 'network_error':
      return 'Could not reach the server. Check your connection.'
    default:
      return r.message ? `LinkedIn error: ${r.message}` : 'LinkedIn could not publish the post.'
  }
}
