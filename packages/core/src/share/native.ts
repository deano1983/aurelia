// Native share sheet (Capacitor Share plugin or the Web Share API), with the
// intent-link list as the fallback, plus copy helpers for networks that have
// no web share link at all (Instagram, TikTok).

import { buildShareTargets, composeBody, type SharePost, type ShareTarget } from './targets'

interface CapacitorSharePlugin {
  share(opts: { title?: string; text?: string; url?: string; dialogTitle?: string }): Promise<unknown>
}

interface CapacitorShareGlobal {
  isNativePlatform?: () => boolean
  Plugins?: { Share?: CapacitorSharePlugin }
}

export type NativeShareResult =
  | { method: 'capacitor' | 'web-share'; shared: true }
  | { method: 'capacitor' | 'web-share'; shared: false; cancelled: true }
  | { method: 'fallback'; shared: false; targets: ShareTarget[] }

function capacitorShare(): CapacitorSharePlugin | null {
  const cap = (globalThis as { Capacitor?: CapacitorShareGlobal }).Capacitor
  if (!cap?.Plugins?.Share) return null
  if (cap.isNativePlatform && !cap.isNativePlatform()) return null
  return cap.Plugins.Share
}

/** True when a system share sheet is available on this device. */
export function canNativeShare(): boolean {
  if (capacitorShare()) return true
  const nav = (globalThis as { navigator?: Navigator }).navigator
  return typeof nav?.share === 'function'
}

function isAbort(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    ((err as { name?: string }).name === 'AbortError' ||
      /cancel/i.test(String((err as { message?: string }).message ?? '')))
  )
}

/**
 * Open the system share sheet. Prefers Capacitor's Share plugin when the app
 * runs natively and the plugin is registered (no compile-time dependency),
 * then the Web Share API, and otherwise returns the intent-link targets so the
 * caller can show its own list.
 */
export async function nativeShare(post: SharePost): Promise<NativeShareResult> {
  const text = composeBody(post)
  const payload = {
    title: post.title,
    text,
    url: post.url || undefined,
  }

  const cap = capacitorShare()
  if (cap) {
    try {
      await cap.share({ ...payload, dialogTitle: post.title ?? 'Share' })
      return { method: 'capacitor', shared: true }
    } catch (err) {
      if (isAbort(err)) return { method: 'capacitor', shared: false, cancelled: true }
      // Fall through to the next method.
    }
  }

  const nav = (globalThis as { navigator?: Navigator }).navigator
  if (typeof nav?.share === 'function') {
    const data: ShareData = { title: payload.title, text: payload.text, url: payload.url }
    if (!nav.canShare || nav.canShare(data)) {
      try {
        await nav.share(data)
        return { method: 'web-share', shared: true }
      } catch (err) {
        if (isAbort(err)) return { method: 'web-share', shared: false, cancelled: true }
      }
    }
  }

  return { method: 'fallback', shared: false, targets: buildShareTargets(post) }
}

/** Copy text to the clipboard, with a textarea fallback for older webviews. */
export async function copyText(text: string): Promise<boolean> {
  const nav = (globalThis as { navigator?: Navigator }).navigator
  try {
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission denied or insecure context: try the fallback.
  }
  const doc = (globalThis as { document?: Document }).document
  if (!doc) return false
  const ta = doc.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  doc.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = doc.execCommand('copy')
  } catch {
    ok = false
  }
  doc.body.removeChild(ta)
  return ok
}

export interface CopyForAppResult {
  copied: boolean
  text: string
  note: string
}

const INSTAGRAM_CAPTION_LIMIT = 2200
const TIKTOK_CAPTION_LIMIT = 4000

async function copyCaption(post: SharePost, app: string, limit: number): Promise<CopyForAppResult> {
  let text = composeBody(post)
  if (post.url) text += `\n\n${post.url}`
  const tooLong = Array.from(text).length > limit
  const copied = await copyText(text)
  const base = copied
    ? `Caption copied. ${app} has no web share link: open ${app}, start a post and paste.`
    : `Could not copy automatically. ${app} has no web share link: select the text and copy it by hand.`
  const note = tooLong ? `${base} ${app} captions are limited to ${limit} characters; trim before posting.` : base
  return { copied, text, note }
}

/** Instagram has no web intent: copy the caption and tell the user what to do. */
export function copyForInstagram(post: SharePost): Promise<CopyForAppResult> {
  return copyCaption(post, 'Instagram', INSTAGRAM_CAPTION_LIMIT)
}

/** TikTok has no web intent: copy the caption and tell the user what to do. */
export function copyForTikTok(post: SharePost): Promise<CopyForAppResult> {
  return copyCaption(post, 'TikTok', TIKTOK_CAPTION_LIMIT)
}
