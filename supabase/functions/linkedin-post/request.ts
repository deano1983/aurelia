// Pure helpers for creating a LinkedIn post through the Posts API. No Deno
// globals, so vitest can test the exact request this function sends.

export const LINKEDIN_POSTS_URL = 'https://api.linkedin.com/rest/posts'
/** Monthly API version (YYYYMM). Override with the LINKEDIN_VERSION secret. */
export const DEFAULT_LINKEDIN_VERSION = '202411'
export const LINKEDIN_TEXT_LIMIT = 3000

export type Visibility = 'PUBLIC' | 'CONNECTIONS'

export function resolveLinkedInVersion(override: string | undefined | null): string {
  return override && /^\d{6}(\.\d{2})?$/.test(override) ? override : DEFAULT_LINKEDIN_VERSION
}

/**
 * The Posts API reads `commentary` as "little text": these characters are
 * markup and must be backslash-escaped, or the post is cut or mangled at the
 * first one (for example an unescaped "(").
 */
export function escapeLittleText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`)
}

export interface PostRequestInput {
  accessToken: string
  memberSub: string
  text: string
  visibility: Visibility
  version?: string
}

export interface PostRequestBody {
  author: string
  commentary: string
  visibility: Visibility
  distribution: {
    feedDistribution: 'MAIN_FEED'
    targetEntities: []
    thirdPartyDistributionChannels: []
  }
  lifecycleState: 'PUBLISHED'
  isReshareDisabledByAuthor: boolean
}

export function validatePostInput(input: unknown):
  | { ok: true; text: string; visibility: Visibility; appId: string | null }
  | { ok: false; error: string } {
  if (typeof input !== 'object' || input === null) return { ok: false, error: 'invalid_body' }
  const { text, visibility, appId } = input as Record<string, unknown>
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'text_required' }
  if (Array.from(text).length > LINKEDIN_TEXT_LIMIT) return { ok: false, error: 'text_too_long' }
  const vis = visibility ?? 'PUBLIC'
  if (vis !== 'PUBLIC' && vis !== 'CONNECTIONS') return { ok: false, error: 'invalid_visibility' }
  return {
    ok: true,
    text,
    visibility: vis,
    appId: typeof appId === 'string' && appId.length <= 64 ? appId : null,
  }
}

export function buildLinkedInPostRequest(input: PostRequestInput): {
  url: string
  init: { method: 'POST'; headers: Record<string, string>; body: string }
  body: PostRequestBody
} {
  if (!/^[A-Za-z0-9_-]+$/.test(input.memberSub)) throw new Error('invalid member id')
  const body: PostRequestBody = {
    author: `urn:li:person:${input.memberSub}`,
    commentary: escapeLittleText(input.text),
    visibility: input.visibility,
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }
  return {
    url: LINKEDIN_POSTS_URL,
    body,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': resolveLinkedInVersion(input.version),
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    },
  }
}

export type PostOutcome =
  | { status: 201; body: { ok: true; postUrn: string } }
  | { status: 401; body: { ok: false; error: 'token_expired'; reconnect: true } }
  | { status: 429; body: { ok: false; error: 'rate_limited'; retryAfter: number | null } }
  | { status: 403; body: { ok: false; error: 'forbidden'; reconnect: true } }
  | { status: 502; body: { ok: false; error: 'linkedin_error'; linkedinStatus: number; message?: string } }

/** Map LinkedIn's response to what this function returns to the app. */
export function interpretPostResponse(
  status: number,
  headers: { get(name: string): string | null },
  bodyText = '',
): PostOutcome {
  if (status === 201 || status === 200) {
    const urn = headers.get('x-restli-id') ?? headers.get('x-linkedin-id') ?? ''
    if (urn) return { status: 201, body: { ok: true, postUrn: urn } }
  }
  if (status === 401) return { status: 401, body: { ok: false, error: 'token_expired', reconnect: true } }
  if (status === 403) return { status: 403, body: { ok: false, error: 'forbidden', reconnect: true } }
  if (status === 429) {
    const ra = Number(headers.get('retry-after'))
    return {
      status: 429,
      body: { ok: false, error: 'rate_limited', retryAfter: Number.isFinite(ra) && ra > 0 ? ra : null },
    }
  }
  let message: string | undefined
  try {
    message = (JSON.parse(bodyText) as { message?: string }).message
  } catch {
    message = undefined
  }
  return { status: 502, body: { ok: false, error: 'linkedin_error', linkedinStatus: status, message } }
}

/** Public URL of a post from its URN (urn:li:share:… or urn:li:ugcPost:…). */
export function postUrlFromUrn(urn: string): string {
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(urn).replace(/%3A/g, ':')}/`
}
