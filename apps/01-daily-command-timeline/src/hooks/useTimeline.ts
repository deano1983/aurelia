import { useCallback, useMemo } from 'react'
import { useLocalStorage } from './useLocalStorage'
import type { TimelineItem, TimelineCategory, TimelineTag, TimelineSlot } from '../types'

const STORAGE_KEY = 'aurelia-timeline-items'

export const CATEGORIES: TimelineCategory[] = ['creator', 'linkedin-executive', 'board', 'personal', 'life']
export const TAGS: TimelineTag[] = ['flexible-content-upload', 'hard-report-deadline', 'protected-life-event']
export const SLOTS: TimelineSlot[] = ['1', '2', '3', '4', 'custom']

export function useTimeline() {
  const [items, setItems, hydrated] = useLocalStorage<TimelineItem[]>(STORAGE_KEY, [])

  const addItem = useCallback(
    (item: Omit<TimelineItem, 'id' | 'createdAt' | 'completed'>) => {
      const now = new Date().toISOString()
      const newItem: TimelineItem = {
        ...item,
        id: crypto.randomUUID(),
        createdAt: now,
        completed: false,
      }
      setItems((prev) => [...prev, newItem])
      return newItem
    },
    [],
  )

  const toggleItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, completed: !i.completed } : i)),
    )
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const updateItem = useCallback((id: string, patch: Partial<TimelineItem>) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    )
  }, [])

  const activeItems = useMemo(
    () =>
      items
        .filter((i) => !i.completed)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [items],
  )
  const completedItems = useMemo(() => items.filter((i) => i.completed), [items])

  const today = new Date().toISOString().slice(0, 10)
  const upcomingToday = activeItems.filter((i) => i.dueDate === today).length
  const overdue = activeItems.filter((i) => i.dueDate < today).length

  return {
    items,
    activeItems,
    completedItems,
    hydrated,
    addItem,
    toggleItem,
    removeItem,
    updateItem,
    CATEGORIES,
    TAGS,
    SLOTS,
    stats: { active: activeItems.length, upcomingToday, overdue },
  }
}
