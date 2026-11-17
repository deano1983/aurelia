import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getLinkedInStatus, postToLinkedIn } from './linkedin'
import { copyForInstagram, nativeShare } from './native'

const fakeSupabase = (token: string | null, rpcData: unknown = null) =>
  ({
    auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null } }) },
    rpc: vi.fn(async () => ({ data: rpcData, error: null })),
  }) as unknown as SupabaseClient

const FN = 'https://proj.supabase.co/functions/v1'

describe('postToLinkedIn', () => {
  it('calls linkedin-post with the user JWT and returns the URN', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, postUrn: 'urn:li:share:1', postUrl: 'https://l/1' }), { status: 201 }),
    )
    const r = await postToLinkedIn('Hello', 'CONNECTIONS', {
      supabase: fakeSupabase('jwt-1'),
      functionsUrl: FN,
      appId: '03-voice-authority-studio',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(r).toEqual({ ok: true, postUrn: 'urn:li:share:1', postUrl: 'https://l/1' })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${FN}/linkedin-post`)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-1')
    expect(JSON.parse(String(init.body))).toEqual({
      text: 'Hello',
      visibility: 'CONNECTIONS',
      appId: '03-voice-authority-studio',
    })
  })

  it('asks to reconnect on 401 and surfaces 429 retry-after', async () => {
    const f401 = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'token_expired', reconnect: true }), { status: 401 }))
    const r1 = await postToLinkedIn('x', 'PUBLIC', { supabase: fakeSupabase('j'), functionsUrl: FN, fetchImpl: f401 as unknown as typeof fetch })
    expect(r1).toMatchObject({ ok: false, error: 'token_expired', reconnect: true })

    const f429 = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, error: 'rate_limited' }), { status: 429, headers: { 'Retry-After': '12' } }),
    )
    const r2 = await postToLinkedIn('x', 'PUBLIC', { supabase: fakeSupabase('j'), functionsUrl: FN, fetchImpl: f429 as unknown as typeof fetch })
    expect(r2).toMatchObject({ ok: false, error: 'rate_limited', retryAfter: 12, reconnect: false })
  })

  it('does not call the network when signed out or unconfigured', async () => {
    const f = vi.fn()
    expect(await postToLinkedIn('x', 'PUBLIC', { supabase: fakeSupabase(null), functionsUrl: FN, fetchImpl: f })).toEqual({
      ok: false,
      error: 'not_signed_in',
    })
    expect(await postToLinkedIn('x', 'PUBLIC', { supabase: null, fetchImpl: f })).toMatchObject({ ok: false })
    expect(f).not.toHaveBeenCalled()
  })
})

describe('getLinkedInStatus', () => {
  it('reads the RPC row', async () => {
    const sb = fakeSupabase('j', [{ connected: true, expires_at: '2027-01-01T00:00:00Z' }])
    expect(await getLinkedInStatus(sb)).toEqual({ connected: true, expiresAt: '2027-01-01T00:00:00Z' })
    expect(sb.rpc).toHaveBeenCalledWith('linkedin_status')
  })
})

describe('native share', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('falls back to intent targets without a share API', async () => {
    vi.stubGlobal('navigator', {})
    const r = await nativeShare({ text: 'hi' })
    expect(r.method).toBe('fallback')
    if (r.method === 'fallback') expect(r.targets.map((t) => t.id)).toContain('bluesky')
  })

  it('uses the Web Share API and treats AbortError as cancel', async () => {
    const share = vi.fn(async () => {
      throw Object.assign(new Error('x'), { name: 'AbortError' })
    })
    vi.stubGlobal('navigator', { share })
    expect(await nativeShare({ text: 'hi', url: 'https://a.example' })).toEqual({
      method: 'web-share',
      shared: false,
      cancelled: true,
    })
    expect(share).toHaveBeenCalledWith({ title: undefined, text: 'hi', url: 'https://a.example' })
  })

  it('prefers Capacitor Share when running natively', async () => {
    const capShare = vi.fn(async () => ({}))
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, Plugins: { Share: { share: capShare } } })
    vi.stubGlobal('navigator', { share: vi.fn() })
    expect(await nativeShare({ text: 'hi', title: 'T' })).toEqual({ method: 'capacitor', shared: true })
    expect(capShare).toHaveBeenCalledWith({ title: 'T', text: 'hi', url: undefined, dialogTitle: 'T' })
  })

  it('copies an Instagram caption and explains the next step', async () => {
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const r = await copyForInstagram({ text: 'Caption', hashtags: ['ugc'] })
    expect(writeText).toHaveBeenCalledWith('Caption\n\n#ugc')
    expect(r.copied).toBe(true)
    expect(r.note).toMatch(/open Instagram/)
  })
})
