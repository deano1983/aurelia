import { useCallback, useMemo } from 'react'
import type { TimelineCategory, TimelineTag } from '../types'
import { CATEGORIES, TAGS } from '../hooks/useTimeline'

interface CategoryFilterProps {
  category: TimelineCategory | 'all'
  tags: TimelineTag[]
  onChange: (category: TimelineCategory | 'all', tags: TimelineTag[]) => void
}

const CATEGORY_LABEL: Record<string, string> = {
  creator: 'Creator',
  'linkedin-executive': 'LinkedIn Executive',
  board: 'Board',
  personal: 'Personal',
  life: 'Life',
}

const TAG_LABEL: Record<string, string> = {
  'flexible-content-upload': 'Flexible upload',
  'hard-report-deadline': 'Hard report deadline',
  'protected-life-event': 'Protected life event',
}

export function CategoryFilter({
  category,
  tags,
  onChange,
}: CategoryFilterProps) {
  const selectCategory = useCallback(
    (next: TimelineCategory | 'all') => {
      onChange(next, tags)
    },
    [onChange, tags],
  )

  const toggleTag = useCallback(
    (tag: TimelineTag) => {
      const next = tags.includes(tag)
        ? tags.filter((t) => t !== tag)
        : [...tags, tag]
      onChange(category, next)
    },
    [category, tags, onChange],
  )

  const activeTagSet = useMemo(() => new Set(tags), [tags])

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Filter</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => selectCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              category === cat
                ? 'bg-timeline-primary text-white border-timeline-primary'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {CATEGORY_LABEL[cat]}
          </button>
        ))}
        <button
          onClick={() => selectCategory('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            category === 'all'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
          }`}
        >
          All
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          Tags
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {TAGS.map((tag) => {
          const active = activeTagSet.has(tag)
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? 'bg-timeline-accent text-slate-900 border-timeline-accent'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {TAG_LABEL[tag]}
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-[10px] text-slate-400">
        Select categories and tags to narrow the timeline.
      </p>
    </section>
  )
}
