import type { TimelineItem } from '../types'
import { formatDateShort, isOverdue, isToday } from '../utils/dateHelpers'

interface TimelineItemProps {
  item: TimelineItem
  onToggle: (id: string) => void
  onRemove: (id: string) => void
}

const CATEGORY_LABEL: Record<string, string> = {
  creator: 'Creator',
  'linkedin-executive': 'LinkedIn Executive',
  board: 'Board',
  personal: 'Personal',
  life: 'Life',
}

const TAG_LABEL: Record<string, string> = {
  'flexible-content-upload': 'Flexible content upload',
  'hard-report-deadline': 'Hard report deadline',
  'protected-life-event': 'Protected life event',
}

export function TimelineItem({ item, onToggle, onRemove }: TimelineItemProps) {
  const overdue = isOverdue(item.dueDate) && !item.completed
  const today = isToday(item.dueDate)

  return (
    <article
      className={`rounded-xl border p-4 flex items-center gap-4 transition-colors ${
        item.completed
          ? 'bg-slate-50 text-slate-400 border-slate-200'
          : overdue
          ? 'bg-red-50 border-red-200'
          : today
          ? 'bg-amber-50 border-amber-200'
          : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex-shrink-0">
        <input
          type="checkbox"
          checked={item.completed}
          onChange={() => onToggle(item.id)}
          className="rounded text-timeline-primary focus:ring-timeline-accent"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
              item.completed
                ? 'border-slate-300 text-slate-400'
                : 'border-timeline-primary/20 text-timeline-primary bg-timeline-primary/5'
            }`}
          >
            {CATEGORY_LABEL[item.category]}
          </span>
          <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-100">
            Slot {item.slot}
          </span>
          {item.tags.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                item.completed
                  ? 'border-slate-300 text-slate-400'
                  : tag === 'protected-life-event'
                  ? 'border-red-200 text-red-700 bg-red-50'
                  : tag === 'hard-report-deadline'
                  ? 'border-amber-200 text-amber-800 bg-amber-50'
                  : 'border-emerald-200 text-emerald-800 bg-emerald-50'
              }`}
            >
              {TAG_LABEL[tag]}
            </span>
          ))}
        </div>
        <h3 className="font-semibold text-slate-800 leading-tight">
          {item.title}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {formatDateShort(item.dueDate)}
          {item.dueTime ? ` • ${item.dueTime}` : ''}
          {item.sourceApp ? ` • from ${item.sourceApp}` : ''}
        </p>
      </div>
      <div className="flex-shrink-0 flex items-center gap-2">
        <button
          onClick={() => onRemove(item.id)}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
          aria-label="Remove deadline"
        >
          ✕
        </button>
      </div>
    </article>
  )
}
