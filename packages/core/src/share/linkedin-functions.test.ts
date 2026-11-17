// Tests for the pure parts of the linkedin-auth and linkedin-post edge
// functions (they live under supabase/functions and run on Deno; the helpers
// have no Deno globals so they run here too).
import { describe, expect, it } from 'vitest'
import {
  base64urlDecode,
  base64urlEncode,
  buildAuthorizeUrl,
  buildTokenRequest,
  isAllowedReturnTo,
  readCookie,
  signState,
  verifyState,
  withStatus,
} from '../../../../supabase/functions/linkedin-auth/oauth.ts'
import {
  DEFAULT_LINKEDIN_VERSION,
  buildLinkedInPostRequest,
  escapeLittleText,
  interpretPostResponse,
  postUrlFromUrn,
  resolveLinkedInVersion,
  validatePostInput,
} from '../../../../supabase/functions/linkedin-post/request.ts'

const SECRET = 'test-secret-that-is-at-least-32-characters-long'
const now = 1_800_000_000
const payload = { uid: '6f1c-user', rt: 'https://app.example/apps/03/', n: 'nonce123', exp: now + 600 }

describe('state HMAC', () => {
  it('round-trips a valid state', async () => {
    const token = await signState(payload, SECRET)
    expect(await verifyState(token, SECRET, now)).toEqual(payload)
  })

  it('rejects a tampered payload', async () => {
    const token = await signState(payload, SECRET)
    const [, sig] = token.split('.')
    const evil = base64urlEncode(new TextEncoder().encode(JSON.stringify({ ...payload, uid: 'attacker' })))
    expect(await verifyState(`${evil}.${sig}`, SECRET, now)).toBeNull()
  })

  it('rejects a tampered signature', async () => {
    const token = await signState(payload, SECRET)
    const [body, sig] = token.split('.')
    const bytes = base64urlDecode(sig)
    bytes[0] ^= 1
    expect(await verifyState(`${body}.${base64urlEncode(bytes)}`, SECRET, now)).toBeNull()
    expect(await verifyState(`${body}.`, SECRET, now)).toBeNull()
    expect(await verifyState(body, SECRET, now)).toBeNull()
  })

  it('rejects another secret, expiry and garbage', async () => {
    const token = await signState(payload, SECRET)
    expect(await verifyState(token, `${SECRET}x`, now)).toBeNull()
    expect(await verifyState(token, SECRET, now + 601)).toBeNull()
    expect(await verifyState('!!!.???', SECRET, now)).toBeNull()
    expect(await verifyState('', SECRET, now)).toBeNull()
  })

  it('refuses a short secret', async () => {
    await expect(signState(payload, 'short')).rejects.toThrow(/STATE_SECRET/)
  })
})

describe('OAuth helpers', () => {
  it('builds the authorize URL with the three scopes', () => {
    const u = new URL(
      buildAuthorizeUrl({
        clientId: 'cid',
        redirectUri: 'https://dhyfiudikillxfqeqqrp.supabase.co/functions/v1/linkedin-auth/callback',
        state: 'abc.def',
      }),
    )
    expect(u.origin + u.pathname).toBe('https://www.linkedin.com/oauth/v2/authorization')
    expect(u.searchParams.get('response_type')).toBe('code')
    expect(u.searchParams.get('scope')).toBe('openid profile w_member_social')
    expect(u.searchParams.get('state')).toBe('abc.def')
    expect(u.searchParams.get('redirect_uri')).toBe(
      'https://dhyfiudikillxfqeqqrp.supabase.co/functions/v1/linkedin-auth/callback',
    )
  })

  it('builds the token exchange as a form POST', () => {
    const r = buildTokenRequest({ code: 'c&d', clientId: 'id', clientSecret: 's', redirectUri: 'https://r/cb' })
    expect(r.url).toBe('https://www.linkedin.com/oauth/v2/accessToken')
    expect(r.init.method).toBe('POST')
    const body = new URLSearchParams(String(r.init.body))
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('c&d')
  })

  it('only allows return URLs on listed origins', () => {
    const allowed = ['https://aurelia.example', 'capacitor://localhost']
    expect(isAllowedReturnTo('https://aurelia.example/apps/03/?x=1', allowed)).toBe(true)
    expect(isAllowedReturnTo('https://aurelia.example.evil.com/', allowed)).toBe(false)
    expect(isAllowedReturnTo('//evil.com', allowed)).toBe(false)
    expect(isAllowedReturnTo('javascript:alert(1)', allowed)).toBe(false)
  })

  it('reads cookies and decorates return URLs', () => {
    expect(readCookie('a=1; li_oauth_nonce=xyz=; b=2', 'li_oauth_nonce')).toBe('xyz=')
    expect(readCookie(null, 'x')).toBeNull()
    expect(withStatus('https://a.example/p?q=1#h', 'error', 'access_denied')).toBe(
      'https://a.example/p?q=1&linkedin=error&linkedin_reason=access_denied#h',
    )
  })
})

describe('linkedin-post request builder', () => {
  it('builds the Posts API request', () => {
    const r = buildLinkedInPostRequest({
      accessToken: 'tok',
      memberSub: 'abc123XYZ',
      text: 'Hello (world) #ai @me',
      visibility: 'CONNECTIONS',
    })
    expect(r.url).toBe('https://api.linkedin.com/rest/posts')
    expect(r.init.method).toBe('POST')
    expect(r.init.headers).toEqual({
      Authorization: 'Bearer tok',
      'Content-Type': 'application/json',
      'LinkedIn-Version': DEFAULT_LINKEDIN_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    })
    expect(DEFAULT_LINKEDIN_VERSION).toBe('202411')
    expect(JSON.parse(r.init.body)).toEqual({
      author: 'urn:li:person:abc123XYZ',
      commentary: 'Hello \\(world\\) \\#ai \\@me',
      visibility: 'CONNECTIONS',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    })
  })

  it('lets env override the version, but only with a valid value', () => {
    expect(resolveLinkedInVersion('202505')).toBe('202505')
    expect(resolveLinkedInVersion('latest')).toBe(DEFAULT_LINKEDIN_VERSION)
    expect(resolveLinkedInVersion(undefined)).toBe(DEFAULT_LINKEDIN_VERSION)
    const r = buildLinkedInPostRequest({ accessToken: 't', memberSub: 's', text: 'x', visibility: 'PUBLIC', version: '202506' })
    expect(r.init.headers['LinkedIn-Version']).toBe('202506')
  })

  it('rejects a member id that could inject into the URN', () => {
    expect(() =>
      buildLinkedInPostRequest({ accessToken: 't', memberSub: 'a:b', text: 'x', visibility: 'PUBLIC' }),
    ).toThrow()
  })

  it('escapes every little-text reserved character', () => {
    expect(escapeLittleText('\\|{}@[]()<>#*_~ ok')).toBe('\\\\\\|\\{\\}\\@\\[\\]\\(\\)\\<\\>\\#\\*\\_\\~ ok')
  })

  it('validates input', () => {
    expect(validatePostInput({ text: 'hi' })).toEqual({ ok: true, text: 'hi', visibility: 'PUBLIC', appId: null })
    expect(validatePostInput({ text: ' ' })).toEqual({ ok: false, error: 'text_required' })
    expect(validatePostInput({ text: 'x'.repeat(3001) })).toEqual({ ok: false, error: 'text_too_long' })
    expect(validatePostInput({ text: 'x', visibility: 'LOGGED_IN' })).toEqual({ ok: false, error: 'invalid_visibility' })
    expect(validatePostInput(null)).toEqual({ ok: false, error: 'invalid_body' })
  })

  it('maps LinkedIn responses', () => {
    const h = (o: Record<string, string>) => new Headers(o)
    expect(interpretPostResponse(201, h({ 'x-restli-id': 'urn:li:share:7' }))).toEqual({
      status: 201,
      body: { ok: true, postUrn: 'urn:li:share:7' },
    })
    expect(interpretPostResponse(401, h({})).body).toMatchObject({ error: 'token_expired', reconnect: true })
    expect(interpretPostResponse(429, h({ 'retry-after': '30' })).body).toEqual({
      ok: false,
      error: 'rate_limited',
      retryAfter: 30,
    })
    expect(interpretPostResponse(500, h({}), '{"message":"boom"}')).toEqual({
      status: 502,
      body: { ok: false, error: 'linkedin_error', linkedinStatus: 500, message: 'boom' },
    })
    expect(postUrlFromUrn('urn:li:share:7')).toBe('https://www.linkedin.com/feed/update/urn:li:share:7/')
  })
})
