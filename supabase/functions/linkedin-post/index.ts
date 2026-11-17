// linkedin-post: publish a text post to the caller's own LinkedIn feed.
//
//   POST /functions/v1/linkedin-post
//   Authorization: Bearer <Supabase user JWT>
//   { "text": "...", "visibility": "PUBLIC" | "CONNECTIONS", "appId": "03-voice-authority-studio" }
//
//   201 { ok: true, postUrn, postUrl }
//   401 { ok: false, error: "token_expired" | "not_signed_in", reconnect? }
//   409 { ok: false, error: "not_connected", reconnect: true }
//   429 { ok: false, error: "rate_limited", retryAfter }
//
// The LinkedIn access token never leaves the server: it is read with the
// service role key, which exists only in this function's environment.

import {
  buildLinkedInPostRequest,
  interpretPostResponse,
  postUrlFromUrn,
  validatePostInput,
} from './request.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing secret ${name}`)
  return v
}

// CORS: only the app origins in APP_ORIGINS (comma-separated, the same secret
// linkedin-auth uses) may call this from a browser (pentest N-10).
function corsFor(req: Request): Record<string, string> {
  const allowed = (Deno.env.get('APP_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const origin = req.headers.get('Origin')
  const base = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  return origin && allowed.includes(origin) ? { ...base, 'Access-Control-Allow-Origin': origin } : base
}

// Per-user cap on posts through this function, counted from share_log.
const DAILY_POST_LIMIT = Number(Deno.env.get('LINKEDIN_DAILY_POST_LIMIT') ?? '25')

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function service(path: string, init: RequestInit = {}): Promise<Response> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  return fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  })
}

Deno.serve(async (req) => {
  const cors = corsFor(req)
  const reply = (status: number, b: unknown, extra: Record<string, string> = {}) => json(status, b, { ...cors, ...extra })
  if (req.method === 'OPTIONS') return new Response('ok', { status: cors['Access-Control-Allow-Origin'] ? 200 : 403, headers: cors })
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'method_not_allowed' })

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const userRes = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jwt}`, apikey: env('SUPABASE_ANON_KEY') },
    })
    const user = userRes.ok ? ((await userRes.json()) as { id?: string }) : null
    if (!user?.id) return reply(401, { ok: false, error: 'not_signed_in' })

    const input = validatePostInput(await req.json().catch(() => null))
    if (!input.ok) return reply(400, input)

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const countRes = await service(
      `share_log?owner_id=eq.${encodeURIComponent(user.id)}&network=eq.linkedin-api&created_at=gte.${encodeURIComponent(since)}&select=id`,
      { method: 'HEAD', headers: { Prefer: 'count=exact' } },
    )
    const used = Number(countRes.headers.get('Content-Range')?.split('/')[1] ?? '0')
    if (!countRes.ok || used >= DAILY_POST_LIMIT) {
      return reply(429, { ok: false, error: 'rate_limited', retryAfter: 3600 }, { 'Retry-After': '3600' })
    }

    const connRes = await service(
      `linkedin_connections?user_id=eq.${encodeURIComponent(user.id)}&select=member_sub,access_token,expires_at`,
    )
    if (!connRes.ok) return reply(500, { ok: false, error: 'lookup_failed' })
    const [conn] = (await connRes.json()) as {
      member_sub: string
      access_token: string
      expires_at: string | null
    }[]
    if (!conn) return reply(409, { ok: false, error: 'not_connected', reconnect: true })
    if (conn.expires_at && Date.parse(conn.expires_at) <= Date.now()) {
      return reply(401, { ok: false, error: 'token_expired', reconnect: true })
    }

    const { url, init } = buildLinkedInPostRequest({
      accessToken: conn.access_token,
      memberSub: conn.member_sub,
      text: input.text,
      visibility: input.visibility,
      version: Deno.env.get('LINKEDIN_VERSION'),
    })
    const liRes = await fetch(url, init)
    const outcome = interpretPostResponse(liRes.status, liRes.headers, await liRes.text())

    if (outcome.status === 201) {
      // Best effort: a failed log must not fail a post that went out.
      await service('share_log', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          owner_id: user.id,
          network: 'linkedin-api',
          app_id: input.appId,
          post_urn: outcome.body.postUrn,
        }),
      }).catch(() => undefined)
      return reply(201, { ...outcome.body, postUrl: postUrlFromUrn(outcome.body.postUrn) })
    }
    if (outcome.status === 429 && outcome.body.retryAfter) {
      return reply(429, outcome.body, { 'Retry-After': String(outcome.body.retryAfter) })
    }
    return reply(outcome.status, outcome.body)
  } catch (err) {
    console.error('linkedin-post', err instanceof Error ? err.message : err)
    return reply(500, { ok: false, error: 'internal_error' })
  }
})
