// Share intent URLs for the networks that accept a prefilled post from a
// plain link. No API keys, no SDKs: every href opens the network's own
// composer with the text filled in, and the user presses Post themselves.

export interface SharePost {
  /** The post body. */
  text: string
  /** Optional link to attach. Kept separate so link-aware networks get it as a link. */
  url?: string
  /** Optional title, used for email subject and Reddit. */
  title?: string
  /** Optional hashtags, with or without the leading '#'. */
  hashtags?: string[]
}

export type NetworkId =
  | 'linkedin'
  | 'linkedin-link'
  | 'x'
  | 'facebook'
  | 'threads'
  | 'whatsapp'
  | 'telegram'
  | 'reddit'
  | 'bluesky'
  | 'email'
  | 'sms'

/**
 * Post length limits in characters. X counts every link as 23 characters
 * (t.co); Bluesky counts graphemes. Networks without a practical limit for a
 * share are left out.
 */
export const NETWORK_LIMITS: Partial<Record<NetworkId, number>> = {
  linkedin: 3000,
  x: 280,
  threads: 500,
  bluesky: 300,
  telegram: 4096,
  reddit: 300, // title limit for link posts
}

export const NETWORK_LABELS: Record<NetworkId, string> = {
  linkedin: 'LinkedIn',
  'linkedin-link': 'LinkedIn (link card)',
  x: 'X',
  facebook: 'Facebook',
  threads: 'Threads',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  reddit: 'Reddit',
  bluesky: 'Bluesky',
  email: 'Email',
  sms: 'SMS',
}

const X_URL_WEIGHT = 23
const URL_RE = /https?:\/\/[^\s]+/g

const segmenter: { segment(s: string): Iterable<unknown> } | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new (Intl as unknown as {
        Segmenter: new (l?: string, o?: { granularity: string }) => {
          segment(s: string): Iterable<unknown>
        }
      }).Segmenter(undefined, { granularity: 'grapheme' })
    : null

/** User-perceived characters: an emoji with modifiers counts as one. */
export function graphemeLength(text: string): number {
  if (!segmenter) return Array.from(text).length
  return Array.from(segmenter.segment(text)).length
}

/** Length as the given network counts it. */
export function lengthForNetwork(text: string, network: NetworkId): number {
  if (network === 'x') {
    const urls = text.match(URL_RE) ?? []
    const withoutUrls = text.replace(URL_RE, '')
    return graphemeLength(withoutUrls) + urls.length * X_URL_WEIGHT
  }
  return graphemeLength(text)
}

export interface FitResult {
  text: string
  truncated: boolean
  /** Length of the returned text as the network counts it. */
  length: number
  /** The network limit, or null when the network has none. */
  limit: number | null
}

const ELLIPSIS = '…'

/**
 * Fit text to a network's limit. When it is too long, it is cut at the last
 * word boundary that fits and an ellipsis is added. `suffix` (for example
 * "\n\nhttps://link") is always kept whole and counts toward the limit.
 */
export function fitForNetwork(
  text: string,
  network: NetworkId,
  suffix = '',
): FitResult {
  const limit = NETWORK_LIMITS[network] ?? null
  const full = text + suffix
  const fullLen = lengthForNetwork(full, network)
  if (limit === null || fullLen <= limit) {
    return { text: full, truncated: false, length: fullLen, limit }
  }

  const budget = limit - lengthForNetwork(suffix, network) - 1 // 1 for the ellipsis
  if (budget <= 0) {
    // The suffix alone fills the limit: drop the body.
    const s = suffix.trim()
    return { text: s, truncated: true, length: lengthForNetwork(s, network), limit }
  }

  const chars = segmenter
    ? Array.from(segmenter.segment(text), (s) => (s as { segment: string }).segment)
    : Array.from(text)
  let kept = Math.min(budget, chars.length)
  // X weights links: if the body holds links, shrink until it fits.
  while (kept > 0 && lengthForNetwork(chars.slice(0, kept).join(''), network) > budget) kept--
  let cut = chars.slice(0, kept).join('')

  // Prefer a word boundary, unless that would throw away most of the budget.
  if (kept < chars.length && !/\s/.test(chars[kept])) {
    const lastSpace = cut.search(/\s\S*$/)
    if (lastSpace > cut.length * 0.6) cut = cut.slice(0, lastSpace)
  }
  cut = cut.replace(/[\s,;:\-–—.]+$/u, '')

  const out = cut + ELLIPSIS + suffix
  return { text: out, truncated: true, length: lengthForNetwork(out, network), limit }
}

export interface ShareTarget {
  id: NetworkId
  label: string
  /** The intent URL to open. */
  href: string
  /** The text this network receives, after fitting. */
  text: string
  truncated: boolean
  length: number
  limit: number | null
  /** 'intent' opens href; 'copy' copies text first because the network has no text parameter. */
  kind: 'intent' | 'copy'
  note?: string
}

const enc = encodeURIComponent

function hashtagLine(tags: string[] | undefined): string {
  if (!tags || tags.length === 0) return ''
  return tags
    .map((t) => t.trim().replace(/^#+/, '').replace(/\s+/g, ''))
    .filter(Boolean)
    .map((t) => `#${t}`)
    .join(' ')
}

/** The body with hashtags appended (once), without the link. */
export function composeBody(post: SharePost): string {
  const tags = hashtagLine(post.hashtags)
  const text = post.text.trim()
  if (!tags) return text
  return text ? `${text}\n\n${tags}` : tags
}

function linkSuffix(url: string | undefined): string {
  return url ? `\n\n${url}` : ''
}

/** Intent URLs for every supported network, with text fitted per network. */
export function buildShareTargets(post: SharePost): ShareTarget[] {
  const body = composeBody(post)
  const url = post.url?.trim() || undefined
  const title = post.title?.trim() || undefined
  const targets: ShareTarget[] = []

  const add = (
    id: NetworkId,
    fit: FitResult,
    href: string,
    extra: Partial<ShareTarget> = {},
  ) => {
    targets.push({
      id,
      label: NETWORK_LABELS[id],
      href,
      text: fit.text,
      truncated: fit.truncated,
      length: fit.length,
      limit: fit.limit,
      kind: 'intent',
      ...extra,
    })
  }

  // LinkedIn: the feed composer takes text; share-offsite takes only a URL.
  const li = fitForNetwork(body, 'linkedin', linkSuffix(url))
  add('linkedin', li, `https://www.linkedin.com/feed/?shareActive=true&text=${enc(li.text)}`)
  if (url) {
    add(
      'linkedin-link',
      { text: url, truncated: false, length: url.length, limit: null },
      `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
      { note: 'Shares the link as a card; LinkedIn ignores text here.' },
    )
  }

  // X: url passed separately and counted as 23 characters.
  const x = fitForNetwork(body, 'x', url ? ` ${url}` : '')
  const xBody = url ? x.text.slice(0, x.text.length - url.length - 1) : x.text
  add(
    'x',
    x,
    `https://x.com/intent/post?text=${enc(xBody)}${url ? `&url=${enc(url)}` : ''}`,
  )

  // Facebook's sharer accepts only a link; text has to be pasted.
  const fbText = body + linkSuffix(url)
  const fbLen = { text: fbText, truncated: false, length: graphemeLength(fbText), limit: null }
  if (url) {
    add('facebook', fbLen, `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, {
      kind: 'copy',
      note: 'Facebook takes the link only. The text is copied so you can paste it.',
    })
  } else {
    add('facebook', fbLen, 'https://www.facebook.com/', {
      kind: 'copy',
      note: 'Facebook has no text share link. The text is copied; paste it into a new post.',
    })
  }

  const th = fitForNetwork(body, 'threads', linkSuffix(url))
  add('threads', th, `https://www.threads.net/intent/post?text=${enc(th.text)}`)

  const waText = body + linkSuffix(url)
  add(
    'whatsapp',
    { text: waText, truncated: false, length: graphemeLength(waText), limit: null },
    `https://wa.me/?text=${enc(waText)}`,
  )

  const tg = fitForNetwork(body, 'telegram')
  add(
    'telegram',
    { ...tg, text: url ? `${url}\n${tg.text}` : tg.text },
    url
      ? `https://t.me/share/url?url=${enc(url)}&text=${enc(tg.text)}`
      : `https://t.me/share/url?url=${enc(tg.text)}`,
  )

  if (url) {
    const rt = fitForNetwork(title ?? firstLine(body), 'reddit')
    add('reddit', rt, `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(rt.text)}`, {
      note: 'The count is for the post title.',
    })
  } else {
    const rt = fitForNetwork(title ?? firstLine(body), 'reddit')
    add(
      'reddit',
      { ...rt, text: `${rt.text}\n\n${body}` },
      `https://www.reddit.com/submit?selftext=true&title=${enc(rt.text)}&text=${enc(body)}`,
      { note: 'The count is for the post title.' },
    )
  }

  const bs = fitForNetwork(body, 'bluesky', linkSuffix(url))
  add('bluesky', bs, `https://bsky.app/intent/compose?text=${enc(bs.text)}`)

  const mailBody = body + linkSuffix(url)
  add(
    'email',
    { text: mailBody, truncated: false, length: graphemeLength(mailBody), limit: null },
    `mailto:?subject=${enc(title ?? firstLine(body))}&body=${enc(mailBody)}`,
  )

  const smsBody = body + linkSuffix(url)
  add(
    'sms',
    { text: smsBody, truncated: false, length: graphemeLength(smsBody), limit: null },
    // "?&body=" works on both iOS and Android.
    `sms:?&body=${enc(smsBody)}`,
  )

  return targets
}

function firstLine(text: string): string {
  const line = text.split('\n').find((l) => l.trim()) ?? ''
  return line.trim().slice(0, 120)
}
