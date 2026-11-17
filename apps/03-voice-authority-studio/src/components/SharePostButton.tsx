import { ShareButton } from '@aurelia/core/share'
import type { Draft } from '../types'

/** "Share / Post" for one generated draft: intent links, native share, direct LinkedIn. */
export function SharePostButton({ draft }: { draft: Draft }) {
  return (
    <ShareButton
      post={{ text: draft.body, title: draft.title }}
      appId="03-voice-authority-studio"
      label="Share / Post"
      heading={`Share “${draft.title}”`}
      className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
    />
  )
}
