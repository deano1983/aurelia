/** @jsxRuntime automatic */
/** @jsxImportSource react */
// The pragmas keep the automatic JSX runtime under any bundler or test
// runner, since packages/core has no tsconfig of its own.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildShareTargets, type SharePost, type ShareTarget } from './targets'
import { canNativeShare, copyForInstagram, copyForTikTok, copyText, nativeShare } from './native'
import {
  connectLinkedIn,
  consumeLinkedInReturn,
  describeLinkedInError,
  getLinkedInStatus,
  getShareSupabase,
  logShare,
  postToLinkedIn,
  type LinkedInStatus,
  type LinkedInVisibility,
} from './linkedin'

export interface ShareSheetProps {
  open: boolean
  onClose: () => void
  post: SharePost
  /** Recorded in share_log, e.g. "03-voice-authority-studio". */
  appId?: string
  /** The app's Supabase client. Undefined: build one from VITE_SUPABASE_*; null: no direct posting. */
  supabase?: SupabaseClient | null
  heading?: string
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

type DirectState =
  | { kind: 'loading' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'disconnected' }
  | { kind: 'connected'; status: LinkedInStatus }

export function ShareSheet({ open, onClose, post, appId, supabase, heading = 'Share' }: ShareSheetProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [client, setClient] = useState<SupabaseClient | null>(null)
  const [direct, setDirect] = useState<DirectState>({ kind: 'loading' })
  const [visibility, setVisibility] = useState<LinkedInVisibility>('PUBLIC')
  const [posting, setPosting] = useState(false)
  const [postedUrl, setPostedUrl] = useState<string | null>(null)

  const targets = useMemo(() => buildShareTargets(post), [post])
  const linkedInText = targets.find((t) => t.id === 'linkedin')?.text ?? post.text
  const nativeAvailable = useMemo(() => (open ? canNativeShare() : false), [open])

  // Focus management: remember the opener, focus the panel, restore on close.
  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panelRef.current)?.focus()
    return () => restoreRef.current?.focus?.()
  }, [open])

  // Resolve the Supabase client and LinkedIn connection when opened.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setPostedUrl(null)
    const ret = consumeLinkedInReturn()
    if (ret?.status === 'connected') setMessage('LinkedIn connected. You can post directly now.')
    if (ret?.status === 'error') setMessage(`LinkedIn connection failed (${ret.reason ?? 'unknown'}).`)
    ;(async () => {
      const c = supabase === undefined ? await getShareSupabase() : supabase
      if (cancelled) return
      setClient(c)
      if (!c) {
        setDirect({ kind: 'unavailable', reason: 'Direct posting needs Supabase sign-in, which is not set up here.' })
        return
      }
      const { data } = await c.auth.getSession().catch(() => ({ data: { session: null } }))
      if (cancelled) return
      if (!data.session) {
        setDirect({ kind: 'unavailable', reason: 'Sign in to Aurelia to post to LinkedIn directly.' })
        return
      }
      const status = await getLinkedInStatus(c)
      if (cancelled) return
      if (!status) setDirect({ kind: 'unavailable', reason: 'Direct LinkedIn posting is not enabled on this server yet.' })
      else setDirect(status.connected ? { kind: 'connected', status } : { kind: 'disconnected' })
    })()
    return () => {
      cancelled = true
    }
  }, [open, supabase])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    },
    [onClose],
  )

  const handleTarget = useCallback(
    async (t: ShareTarget, e: React.MouseEvent) => {
      void logShare(client, { network: t.id, appId })
      if (t.kind === 'copy') {
        e.preventDefault()
        const ok = await copyText(t.text)
        setMessage(ok ? `Text copied. ${t.note ?? ''}` : (t.note ?? 'Copy the text by hand.'))
        window.open(t.href, '_blank', 'noopener,noreferrer')
      }
    },
    [client, appId],
  )

  const handleNative = useCallback(async () => {
    const r = await nativeShare(post)
    if (r.method === 'fallback') setMessage('No system share sheet here. Pick a network below.')
    else if (r.shared) {
      void logShare(client, { network: r.method, appId })
      setMessage('Shared.')
    }
  }, [post, client, appId])

  const handleCopyApp = useCallback(
    async (app: 'instagram' | 'tiktok') => {
      const r = app === 'instagram' ? await copyForInstagram(post) : await copyForTikTok(post)
      if (r.copied) void logShare(client, { network: app, appId })
      setMessage(r.note)
    },
    [post, client, appId],
  )

  const handleConnect = useCallback(async () => {
    // Connecting leaves the page; keep the draft safe on the clipboard.
    await copyText(linkedInText)
    const r = await connectLinkedIn({ supabase: client })
    if (!r.ok) setMessage(describeLinkedInError({ ok: false, error: r.error }))
  }, [client, linkedInText])

  const handlePost = useCallback(async () => {
    setPosting(true)
    setMessage(null)
    const r = await postToLinkedIn(linkedInText, visibility, { supabase: client, appId })
    setPosting(false)
    if (r.ok) {
      setPostedUrl(r.postUrl ?? null)
      setMessage('Posted to LinkedIn.')
    } else {
      if (r.reconnect) setDirect({ kind: 'disconnected' })
      setMessage(describeLinkedInError(r))
    }
  }, [linkedInText, visibility, client, appId])

  if (!open || typeof document === 'undefined') return null

  const liTarget = targets.find((t) => t.id === 'linkedin')

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onKeyDown={onKeyDown}
      // The portal still bubbles through the React tree: keep clicks from
      // reaching the card or form that rendered the button.
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-slate-900/50" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white p-5 text-left text-slate-800 shadow-2xl outline-none sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            {heading}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share sheet"
            className="rounded-md px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            ×
          </button>
        </div>

        <p role="status" aria-live="polite" className={message ? 'mb-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700' : 'sr-only'}>
          {message ?? ''}
          {postedUrl && (
            <>
              {' '}
              <a href={postedUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                View post
              </a>
            </>
          )}
        </p>

        <section aria-label="Post directly to LinkedIn" className="mb-4 rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-900">Post directly to LinkedIn</span>
            {liTarget && (
              <span className={`text-[11px] ${liTarget.truncated ? 'text-amber-700' : 'text-slate-500'}`}>
                {liTarget.length} / {liTarget.limit}
              </span>
            )}
          </div>
          {direct.kind === 'loading' && <p className="mt-2 text-xs text-slate-500">Checking your LinkedIn connection…</p>}
          {direct.kind === 'unavailable' && <p className="mt-2 text-xs text-slate-500">{direct.reason}</p>}
          {direct.kind === 'disconnected' && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleConnect}
                className="rounded-lg bg-[#0a66c2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#004182] focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              >
                Connect LinkedIn
              </button>
              <span className="text-[11px] text-slate-500">Opens LinkedIn; your text is copied first.</span>
            </div>
          )}
          {direct.kind === 'connected' && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-600">
                <span className="sr-only">Visibility</span>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as LinkedInVisibility)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="PUBLIC">Anyone</option>
                  <option value="CONNECTIONS">Connections only</option>
                </select>
              </label>
              <button
                type="button"
                onClick={handlePost}
                disabled={posting || !linkedInText.trim()}
                className="rounded-lg bg-[#0a66c2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#004182] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              >
                {posting ? 'Posting…' : 'Post now'}
              </button>
            </div>
          )}
        </section>

        {nativeAvailable && (
          <button
            type="button"
            onClick={handleNative}
            className="mb-4 w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            Share via this device…
          </button>
        )}

        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {targets.map((t) => (
            <li key={t.id} className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">{t.label}</div>
                  {t.limit !== null && (
                    <div className={`text-[11px] ${t.truncated ? 'text-amber-700' : 'text-slate-500'}`}>
                      {t.truncated
                        ? `Trimmed to fit the ${t.limit}-character limit (${t.length} / ${t.limit})`
                        : `${t.length} / ${t.limit} characters`}
                    </div>
                  )}
                  {t.note && <div className="text-[11px] text-slate-500">{t.note}</div>}
                </div>
                <a
                  href={t.href}
                  target={t.href.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  onClick={(e) => void handleTarget(t, e)}
                  aria-label={`${t.kind === 'copy' ? 'Copy text and open' : 'Open'} ${t.label}`}
                  className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  {t.kind === 'copy' ? 'Copy & open' : 'Open'}
                </a>
              </div>
              <details className="mt-1">
                <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-700">Preview</summary>
                <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                  {t.text}
                </p>
              </details>
            </li>
          ))}
          {(['instagram', 'tiktok'] as const).map((app) => (
            <li key={app} className="flex items-center justify-between gap-3 p-3">
              <div>
                <div className="text-sm font-medium text-slate-900">{app === 'instagram' ? 'Instagram' : 'TikTok'}</div>
                <div className="text-[11px] text-slate-500">No web share link. Copies the caption to paste in the app.</div>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyApp(app)}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                Copy caption
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}

export interface ShareButtonProps {
  post: SharePost
  appId?: string
  label?: string
  className?: string
  supabase?: SupabaseClient | null
  heading?: string
}

/** A button that opens the ShareSheet for `post`. */
export function ShareButton({ post, appId, label = 'Share / Post', className, supabase, heading }: ShareButtonProps) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className={
          className ??
          'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400'
        }
      >
        {label}
      </button>
      <ShareSheet open={open} onClose={close} post={post} appId={appId} supabase={supabase} heading={heading} />
    </>
  )
}
