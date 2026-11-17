// linkedin-auth: three-legged OAuth 2.0 with LinkedIn.
//
//   POST /functions/v1/linkedin-auth/start     (top-level form POST from the app)
//        fields: access_token (Supabase JWT), return_to (app URL)
//        -> 303 to LinkedIn's consent screen
//   GET  /functions/v1/linkedin-auth/callback  (LinkedIn redirects here)
//        -> stores the token, 303 back to return_to?linkedin=connected
//
// CSRF: `state` is HMAC-signed (STATE_SECRET), carries the Supabase user id,
// the return URL, an expiry and a nonce; the nonce is also set as an HttpOnly
// SameSite=Lax cookie at /start and must match at /callback, so a consent
// started in one browser cannot be completed in another. /start also checks
// the Origin header against APP_ORIGINS.
//
// Deploy with --no-verify-jwt (LinkedIn's redirect carries no Supabase JWT;
// this function verifies the user itself). See docs/SOCIAL.md.

import {
  NONCE_COOKIE,
  STATE_TTL_SECONDS,
  buildAuthorizeUrl,
  buildTokenRequest,
  isAllowedReturnTo,
  parseAllowedOrigins,
  randomNonce,
  readCookie,
  signState,
  timingSafeEqual,
  verifyState,
  withStatus,
  LINKEDIN_USERINFO_URL,
} from './oauth.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing secret ${name}`)
  return v
}

const COOKIE_PATH = '/functions/v1/linkedin-auth'

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

function redirect(location: string, cookie?: string): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' })
  if (cookie) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 303, headers })
}

async function getUserId(jwt: string): Promise<string | null> {
  const res = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: env('SUPABASE_ANON_KEY') },
  })
  if (!res.ok) return null
  const user = (await res.json()) as { id?: string }
  return user.id ?? null
}

async function start(req: Request): Promise<Response> {
  const allowed = parseAllowedOrigins(Deno.env.get('APP_ORIGINS'))
  if (allowed.length === 0) return text(500, 'APP_ORIGINS is not configured')
  const origin = req.headers.get('Origin')
  if (!origin || !allowed.includes(origin)) return text(403, 'Origin not allowed')

  const form = await req.formData()
  const jwt = String(form.get('access_token') ?? '')
  const returnTo = String(form.get('return_to') ?? '')
  if (!isAllowedReturnTo(returnTo, allowed)) return text(400, 'return_to not allowed')

  const uid = jwt ? await getUserId(jwt) : null
  if (!uid) return redirect(withStatus(returnTo, 'error', 'not_signed_in'))

  const nonce = randomNonce()
  const state = await signState(
    { uid, rt: returnTo, n: nonce, exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS },
    env('STATE_SECRET'),
  )
  const url = buildAuthorizeUrl({
    clientId: env('LINKEDIN_CLIENT_ID'),
    redirectUri: env('LINKEDIN_REDIRECT_URI'),
    state,
  })
  const cookie = `${NONCE_COOKIE}=${nonce}; Path=${COOKIE_PATH}; Max-Age=${STATE_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`
  return redirect(url, cookie)
}

async function callback(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams
  const state = await verifyState(params.get('state') ?? '', env('STATE_SECRET'))
  if (!state) return text(400, 'Invalid or expired sign-in attempt. Start again from the app.')

  const cookieNonce = readCookie(req.headers.get('Cookie'), NONCE_COOKIE)
  const clearCookie = `${NONCE_COOKIE}=; Path=${COOKIE_PATH}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
  if (!cookieNonce || !timingSafeEqual(cookieNonce, state.n)) {
    return redirect(withStatus(state.rt, 'error', 'browser_mismatch'), clearCookie)
  }

  const liError = params.get('error')
  if (liError) return redirect(withStatus(state.rt, 'error', liError), clearCookie)
  const code = params.get('code')
  if (!code) return redirect(withStatus(state.rt, 'error', 'missing_code'), clearCookie)

  const tokenReq = buildTokenRequest({
    code,
    clientId: env('LINKEDIN_CLIENT_ID'),
    clientSecret: env('LINKEDIN_CLIENT_SECRET'),
    redirectUri: env('LINKEDIN_REDIRECT_URI'),
  })
  const tokenRes = await fetch(tokenReq.url, tokenReq.init)
  if (!tokenRes.ok) return redirect(withStatus(state.rt, 'error', 'token_exchange_failed'), clearCookie)
  const token = (await tokenRes.json()) as { access_token?: string; expires_in?: number; scope?: string }
  if (!token.access_token) return redirect(withStatus(state.rt, 'error', 'no_access_token'), clearCookie)

  const infoRes = await fetch(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  if (!infoRes.ok) return redirect(withStatus(state.rt, 'error', 'userinfo_failed'), clearCookie)
  const info = (await infoRes.json()) as { sub?: string }
  if (!info.sub) return redirect(withStatus(state.rt, 'error', 'no_member_id'), clearCookie)

  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
  const expiresAt = new Date(Date.now() + (token.expires_in ?? 0) * 1000).toISOString()
  const save = await fetch(`${env('SUPABASE_URL')}/rest/v1/linkedin_connections?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      user_id: state.uid,
      member_sub: info.sub,
      access_token: token.access_token,
      expires_at: expiresAt,
      scope: token.scope ?? null,
      updated_at: new Date().toISOString(),
    }),
  })
  if (!save.ok) return redirect(withStatus(state.rt, 'error', 'save_failed'), clearCookie)

  return redirect(withStatus(state.rt, 'connected'), clearCookie)
}

Deno.serve(async (req) => {
  const path = new URL(req.url).pathname
  try {
    if (req.method === 'POST' && path.endsWith('/start')) return await start(req)
    if (req.method === 'GET' && path.endsWith('/callback')) return await callback(req)
    return text(404, 'Not found')
  } catch (err) {
    console.error('linkedin-auth', err instanceof Error ? err.message : err)
    return text(500, 'LinkedIn sign-in failed')
  }
})
