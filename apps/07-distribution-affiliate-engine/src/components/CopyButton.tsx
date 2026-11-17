import { useState, useCallback } from 'react'

interface CopyButtonProps {
  /** Text to copy to the clipboard. */
  text: string
  /** Button label shown when not copied. Default 'Copy'. */
  label?: string
  /** Feedback label shown after copy. Default 'Copied!'. */
  copiedLabel?: string
  /** Size variant. */
  size?: 'sm' | 'md'
  /** Optional callback fired after copying. */
  onCopied?: () => void
}

const COPIED_MS = 1800

export function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied!',
  size = 'md',
  onCopied,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      onCopied?.()
      setTimeout(() => setCopied(false), COPIED_MS)
    } catch {
      // Clipboard access blocked — best effort fallback
      void document.execCommand('copy')
      onCopied?.()
    }
  }, [text, onCopied])

  const base =
    'inline-flex items-center gap-2 rounded-lg border font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none'
  const sizeClasses =
    size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'

  return (
    <button
      onClick={handleCopy}
      disabled={copied}
      className={[
        base,
        sizeClasses,
        copied
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
      ].join(' ')}
      title={copied ? copiedLabel : `Copy: ${text.slice(0, 60)}…`}
    >
      <svg
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <rect width="16" height="12" x="2" y="7" rx="2" ry="2" />
        <path d="M8 5h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8" />
      </svg>
      {copied ? copiedLabel : label}
    </button>
  )
}
