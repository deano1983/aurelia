import { useCallback, useState } from 'react'
import type {
  TimelineItem,
  TimelineCategory,
  TimelineTag,
  TimelineSlot,
  DeepLinkDeadline,
} from '../types'
import { CATEGORIES, TAGS, SLOTS } from '../hooks/useTimeline'
import { parseDeepLinkDate } from '../utils/dateHelpers'

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

interface AddDeadlineFormProps {
  onAdd: (item: Omit<TimelineItem, 'id' | 'createdAt' | 'completed'>) => void
  prefill?: DeepLinkDeadline | null
}

export function AddDeadlineForm({ onAdd, prefill }: AddDeadlineFormProps) {
  const [title, setTitle] = useState(prefill?.title ?? '')
  const [category, setCategory] = useState<TimelineCategory>(
    prefill?.category ?? 'personal',
  )
  const [tags, setTags] = useState<TimelineTag[]>(prefill?.tags ?? [])
  const [dueDate, setDueDate] = useState(prefill?.dueDate ?? '')
  const [dueTime, setDueTime] = useState(prefill?.dueTime ?? '')
  const [description, setDescription] = useState(prefill?.description ?? '')
  const [slot, setSlot] = useState<TimelineSlot>(prefill ? 'custom' : '1')

  const toggleTag = useCallback((tag: TimelineTag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }, [])

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      if (!title.trim() || !dueDate) {
        window.alert('Please enter a title and due date.')
        return
      }
      const parsedDate = parseDeepLinkDate(dueDate)
      if (!parsedDate) {
        window.alert('Please enter a valid due date (YYYY-MM-DD).')
        return
      }
      onAdd({
        title: title.trim(),
        category,
        tags,
        dueDate: parsedDate,
        dueTime: dueTime || undefined,
        description: description.trim() || undefined,
        slot,
      })
      setTitle('')
      setCategory('personal')
      setTags([])
      setDueDate('')
      setDueTime('')
      setDescription('')
      setSlot('1')
    },
    [title, dueDate, category, tags, dueTime, description, slot, onAdd],
  )

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">
        Add to my timeline
      </h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q3 tax report due"
            className="w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-timeline-primary focus:ring-1 focus:ring-timeline-primary outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Category
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const active = category === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-timeline-primary text-white border-timeline-primary'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {CATEGORY_LABEL[cat]}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => {
              const active = tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
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
          <p className="mt-1 text-[10px] text-slate-400">
            Tap tags to select (e.g. Hard report deadline, Protected life event).
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Due date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-timeline-primary focus:ring-1 focus:ring-timeline-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Due time (optional)
            </label>
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-timeline-primary focus:ring-1 focus:ring-timeline-primary outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Slot
          </label>
          <div className="flex flex-wrap gap-2">
            {SLOTS.map((s) => {
              const active = slot === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-timeline-dark text-white border-timeline-dark'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {s === 'custom' ? 'Custom' : `Slot ${s}`}
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            4 active slots plus custom overflow.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Notes (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Additional details…"
            className="w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-timeline-primary focus:ring-1 focus:ring-timeline-primary outline-none"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-timeline-dark hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm"
        >
          Add deadline
        </button>
      </form>
    </section>
  )
}
