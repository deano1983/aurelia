import type { TimelineItem as TimelineItemType, TimelineCategory, TimelineTag } from '../types'
import { TimelineItem } from './TimelineItem'

interface TimelineListProps {
  items: TimelineItemType[]
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  filterCategory?: TimelineCategory | 'all'
  filterTags?: TimelineTag[]
}

export function TimelineList({
  items,
  onToggle,
  onRemove,
  filterCategory = 'all',
  filterTags = [],
}: TimelineListProps) {
  const filtered = items.filter((item) => {
    if (filterCategory !== 'all' && item.category !== filterCategory) {
      return false
    }
    if (filterTags.length && !filterTags.some((tag) => item.tags.includes(tag))) {
      return false
    }
    return true
  })

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <span className="text-2xl mb-2">📭</span>
        <p className="text-sm">No deadlines match the current filters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {filtered.map((item) => (
        <TimelineItem
          key={item.id}
          item={item}
          onToggle={onToggle}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}
