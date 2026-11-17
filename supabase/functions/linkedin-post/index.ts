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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extra },
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' })

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const userRes = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jwt}`, apikey: env('SUPABASE_ANON_KEY') },
    })
    const user = userRes.ok ? ((await userRes.json()) as { id?: string }) : null
    if (!user?.id) return json(401, { ok: false, error: 'not_signed_in' })

    const input = validatePostInput(await req.json().catch(() => null))
    if (!input.ok) return json(400, input)

    const connRes = await service(
      `linkedin_connections?user_id=eq.${encodeURIComponent(user.id)}&select=member_sub,access_token,expires_at`,
    )
    if (!connRes.ok) return json(500, { ok: false, error: 'lookup_failed' })
    const [conn] = (await connRes.json()) as {
      member_sub: string
      access_token: string
      expires_at: string | null
    }[]
    if (!conn) return json(409, { ok: false, error: 'not_connected', reconnect: true })
    if (conn.expires_at && Date.parse(conn.expires_at) <= Date.now()) {
      return json(401, { ok: false, error: 'token_expired', reconnect: true })
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
      return json(201, { ...outcome.body, postUrl: postUrlFromUrn(outcome.body.postUrn) })
    }
    if (outcome.status === 429 && outcome.body.retryAfter) {
      return json(429, outcome.body, { 'Retry-After': String(outcome.body.retryAfter) })
    }
    return json(outcome.status, outcome.body)
  } catch (err) {
    console.error('linkedin-post', err instanceof Error ? err.message : err)
    return json(500, { ok: false, error: 'internal_error' })
  }
})
