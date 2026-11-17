import { useEffect, useState, useCallback } from 'react'
import { useTimeline } from './hooks/useTimeline'
import { TimelineList } from './components/TimelineList'
import { AddDeadlineForm } from './components/AddDeadlineForm'
import { CategoryFilter } from './components/CategoryFilter'
import { IcsExportButton } from './components/IcsExportButton'
import { DeepLinkHandler } from './components/DeepLinkHandler'
import { parseDeepLink } from './utils/deepLink'
import type { DeepLinkDeadline, TimelineItem, TimelineCategory, TimelineTag } from './types'

export default function App() {
  const {
    activeItems,
    completedItems,
    addItem,
    toggleItem,
    removeItem,
    hydrated,
    stats,
  } = useTimeline()

  const [filterCategory, setFilterCategory] = useState<'all' | TimelineCategory>(
    'all',
  )
  const [filterTags, setFilterTags] = useState<TimelineTag[]>([])
  const [deepLink, setDeepLink] = useState<DeepLinkDeadline | null>(null)
  const [showDeepLink, setShowDeepLink] = useState(false)

  useEffect(() => {
    const link = parseDeepLink()
    if (link) {
      setDeepLink(link)
      setShowDeepLink(true)
    }
  }, [])

  const handleAdd = useCallback(
    (item: Omit<TimelineItem, 'id' | 'createdAt' | 'completed'>) => {
      addItem(item)
    },
    [addItem],
  )

  const handleDeepLinkAdd = useCallback(
    (deadline: DeepLinkDeadline) => {
      addItem({
        title: deadline.title,
        category: deadline.category ?? 'personal',
        tags: deadline.tags ?? [],
        dueDate: deadline.dueDate ?? new Date().toISOString().slice(0, 10),
        dueTime: deadline.dueTime,
        description: deadline.description,
        slot: 'custom',
        sourceApp: deadline.sourceApp,
      })
      setDeepLink(null)
      setShowDeepLink(false)
      window.location.hash = ''
    },
    [addItem],
  )

  const handleFilterChange = useCallback(
    (category: 'all' | TimelineCategory, tags: TimelineTag[]) => {
      setFilterCategory(category)
      setFilterTags(tags)
    },
    [],
  )

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading timeline…
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-timeline-primary flex items-center justify-center text-white font-bold">
              T
            </div>
            <div>
              <h1 className="text-lg font-bold text-timeline-dark">
                Daily Command Timeline
              </h1>
              <p className="text-xs text-slate-500">
                Unified deadlines &amp; publishing slots
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <IcsExportButton items={activeItems} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Active
            </p>
            <p className="text-2xl font-bold text-timeline-dark">{stats.active}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Due today
            </p>
            <p className={`text-2xl font-bold ${stats.upcomingToday ? 'text-amber-700' : 'text-timeline-dark'}`}>
              {stats.upcomingToday}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Overdue
            </p>
            <p className={`text-2xl font-bold ${stats.overdue ? 'text-red-700' : 'text-timeline-dark'}`}>
              {stats.overdue}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Completed
            </p>
            <p className="text-2xl font-bold text-emerald-700">{completedItems.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-3 space-y-4">
            <CategoryFilter
              category={filterCategory}
              tags={filterTags}
              onChange={handleFilterChange}
            />
            <AddDeadlineForm onAdd={handleAdd} prefill={deepLink} />
          </aside>

          <section className="lg:col-span-9 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Timeline</h2>
            </div>
            <TimelineList
              items={activeItems}
              onToggle={toggleItem}
              onRemove={removeItem}
              filterCategory={filterCategory}
              filterTags={filterTags}
            />
          </section>
        </div>
      </main>

      {deepLink && showDeepLink && (
        <DeepLinkHandler
          deadline={deepLink}
          onAdd={handleDeepLinkAdd}
          onDismiss={() => {
            setDeepLink(null)
            setShowDeepLink(false)
            window.location.hash = ''
          }}
        />
      )}
    </div>
  )
}
