import type { DeepLinkDeadline, TimelineCategory, TimelineTag } from '../types'

const VALID_CATEGORIES: TimelineCategory[] = [
  'creator',
  'linkedin-executive',
  'board',
  'personal',
  'life',
]

export function parseDeepLink(): DeepLinkDeadline | null {
  const hash = window.location.hash
  if (!hash) return null

  const queryString = hash.replace(/^#/, '').split('?')[1]
  if (!queryString) return null

  const params = new URLSearchParams(queryString)
  const title = params.get('title')
  if (!title) return null

  const category = params.get('category')
  const tags = params.getAll('tags') as TimelineTag[]
  const parsedCategory = VALID_CATEGORIES.includes(
    category as TimelineCategory,
  )
    ? (category as TimelineCategory)
    : undefined

  return {
    title,
    dueDate: params.get('due') || undefined,
    dueTime: params.get('time') || undefined,
    category: parsedCategory,
    tags: tags.length ? tags : undefined,
    sourceApp: params.get('source') || undefined,
    description: params.get('desc') || undefined,
  }
}

export function buildDeepLinkUrl(deadline: Partial<DeepLinkDeadline>): string {
  const params = new URLSearchParams()
  if (deadline.title) params.set('title', deadline.title)
  if (deadline.dueDate) params.set('due', deadline.dueDate)
  if (deadline.dueTime) params.set('time', deadline.dueTime)
  if (deadline.category) params.set('category', deadline.category)
  deadline.tags?.forEach((tag) => params.append('tags', tag))
  if (deadline.sourceApp) params.set('source', deadline.sourceApp)
  if (deadline.description) params.set('desc', deadline.description)
  return `#timeline/add?${params.toString()}`
}
