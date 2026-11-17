import { useCallback } from 'react'
import type { Draft } from '../types'
import { STYLE_LABEL } from '../types'

interface DraftCardsProps {
  drafts: Draft[]
  selectedId: string | null
  onSelect: (id: string) => void
  onEdit: (id: string, body: string) => void
  onCopy: (id: string) => void
}

export function DraftCards({
  drafts,
  selectedId,
  onSelect,
  onEdit,
  onCopy,
}: DraftCardsProps) {
  const handleCopy = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      const draft = drafts.find((d) => d.id === id)
      if (!draft) return
      navigator.clipboard.writeText(draft.body)
      onCopy(id)
    },
    [drafts, onCopy],
  )

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
        Draft Options ({drafts.length})
      </h2>
      <div className="grid gap-4">
        {drafts.map((draft) => {
          const selected = selectedId === draft.id
          return (
            <div
              key={draft.id}
              className={`rounded-xl border p-4 transition-colors ${
                selected
                  ? 'border-violet-600 bg-violet-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700">
                    {STYLE_LABEL[draft.style]}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900 mt-1">
                    {draft.title}
                  </h3>
                </div>
                <button
                  onClick={() => onSelect(draft.id)}
                  className={`rounded-md text-xs font-semibold transition-colors px-3 py-1.5 ${
                    selected
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {selected ? 'Selected' : 'Select'}
                </button>
              </div>
              <textarea
                value={draft.body}
                onChange={(e) => onEdit(draft.id, e.target.value)}
                rows={6}
                className="w-full text-sm text-slate-700 rounded-lg border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors resize-y"
                readOnly={!selected}
                placeholder="Edit this draft…"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  {draft.body.length} characters
                </span>
                <button
                  onClick={(e) => handleCopy(draft.id, e)}
                  className="text-xs font-semibold text-violet-600 hover:text-violet-800 underline underline-offset-2"
                >
                  Copy draft
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
