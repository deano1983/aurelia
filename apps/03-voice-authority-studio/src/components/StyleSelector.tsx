import { useCallback } from 'react'
import type { VoiceStyle } from '../types'
import { STYLE_LABEL } from '../types'

interface StyleSelectorProps {
  style: VoiceStyle
  onChange: (style: VoiceStyle) => void
}

export function StyleSelector({ style, onChange }: StyleSelectorProps) {
  const styles: VoiceStyle[] = ['executive', 'punchy', 'human']

  const select = useCallback(
    (next: VoiceStyle) => {
      onChange(next)
    },
    [onChange],
  )

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Writing Style
      </h2>
      <div className="flex gap-1">
        {styles.map((s) => (
          <button
            key={s}
            onClick={() => select(s)}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-colors border ${
              style === s
                ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-600/25'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {STYLE_LABEL[s]}
          </button>
        ))}
      </div>
    </section>
  )
}
