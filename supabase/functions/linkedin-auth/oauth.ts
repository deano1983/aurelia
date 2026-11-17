// Pure helpers for the LinkedIn OAuth flow. No Deno globals here, so the
// same file is unit-tested from Node (vitest) and imported by index.ts.

export const LINKEDIN_AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization'
export const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
export const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo'
export const LINKEDIN_SCOPES = ['openid', 'profile', 'w_member_social'] as const

/** How long a sign-in attempt may take, from start to callback. */
export const STATE_TTL_SECONDS = 600
export const NONCE_COOKIE = 'li_oauth_nonce'

export interface StatePayload {
  /** Supabase user id the LinkedIn account will be linked to. */
  uid: string
  /** Where to send the browser afterwards. */
  rt: string
  /** Random nonce, also set as an HttpOnly cookie to bind the flow to this browser. */
  n: string
  /** Expiry, seconds since epoch. */
  exp: number
}

const te = new TextEncoder()
const td = new TextDecoder()

export function base64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64urlDecode(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('bad base64url')
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    te.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, te.encode(data)))
}

/** Constant-time comparison of two byte arrays or strings. */
export function timingSafeEqual(a: Uint8Array | string, b: Uint8Array | string): boolean {
  const x = typeof a === 'string' ? te.encode(a) : a
  const y = typeof b === 'string' ? te.encode(b) : b
  let diff = x.length ^ y.length
  const n = Math.max(x.length, y.length)
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

export function randomNonce(bytes = 16): string {
  return base64urlEncode(crypto.getRandomValues(new Uint8Array(bytes)))
}

/** `<base64url(json)>.<base64url(hmac-sha256)>` */
export async function signState(payload: StatePayload, secret: string): Promise<string> {
  if (!secret || secret.length < 32) throw new Error('STATE_SECRET must be at least 32 characters')
  const body = base64urlEncode(te.encode(JSON.stringify(payload)))
  const sig = base64urlEncode(await hmac(secret, body))
  return `${body}.${sig}`
}

/**
 * Returns the payload when the signature is valid and the state has not
 * expired, otherwise null. Never throws on malformed input.
 */
export async function verifyState(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<StatePayload | null> {
  try {
    if (!secret || typeof token !== 'string') return null
    const parts = token.split('.')
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null
    const [body, sig] = parts
    const expected = await hmac(secret, body)
    if (!timingSafeEqual(base64urlDecode(sig), expected)) return null
    const payload = JSON.parse(td.decode(base64urlDecode(body))) as Partial<StatePayload>
    if (
      typeof payload.uid !== 'string' ||
      typeof payload.rt !== 'string' ||
      typeof payload.n !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return null
    }
    if (payload.exp < nowSeconds) return null
    return payload as StatePayload
  } catch {
    return null
  }
}

export function buildAuthorizeUrl(opts: {
  clientId: string
  redirectUri: string
  state: string
  scopes?: readonly string[]
}): string {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    scope: (opts.scopes ?? LINKEDIN_SCOPES).join(' '),
  })
  return `${LINKEDIN_AUTHORIZE_URL}?${q.toString()}`
}

/** Request for exchanging the authorization code for an access token. */
export function buildTokenRequest(opts: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): { url: string; init: RequestInit } {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
  })
  return {
    url: LINKEDIN_TOKEN_URL,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
  }
}

/**
 * `return_to` must be an absolute URL whose origin is in the allow-list
 * (APP_ORIGINS). Prevents the flow from being used as an open redirect.
 */
export function isAllowedReturnTo(returnTo: string, allowedOrigins: string[]): boolean {
  try {
    const u = new URL(returnTo)
    return allowedOrigins.some((o) => o.replace(/\/+$/, '') === u.origin)
  } catch {
    return false
  }
}

export function parseAllowedOrigins(env: string | undefined): string[] {
  return (env ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

/** Adds `linkedin=<status>` (and an optional reason) to the return URL. */
export function withStatus(returnTo: string, status: 'connected' | 'error', reason?: string): string {
  const u = new URL(returnTo)
  u.searchParams.set('linkedin', status)
  if (reason) u.searchParams.set('linkedin_reason', reason)
  return u.toString()
}
