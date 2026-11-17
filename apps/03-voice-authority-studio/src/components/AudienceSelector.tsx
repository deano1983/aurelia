import { useCallback } from 'react'
import type { Audience } from '../types'
import { AUDIENCE_LABEL } from '../types'

interface AudienceSelectorProps {
  audience: Audience
  onChange: (audience: Audience) => void
}

export function AudienceSelector({ audience, onChange }: AudienceSelectorProps) {
  const audiences: Audience[] = [
    'linkedin-executives',
    'board',
    'investors',
    'team',
    'media',
  ]

  const select = useCallback(
    (next: Audience) => {
      onChange(next)
    },
    [onChange],
  )

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Audience
      </h2>
      <div className="flex flex-wrap gap-2">
        {audiences.map((a) => (
          <button
            key={a}
            onClick={() => select(a)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              audience === a
                ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-600/25'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {AUDIENCE_LABEL[a]}
          </button>
        ))}
      </div>
    </section>
  )
}
