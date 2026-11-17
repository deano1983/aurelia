export type TimelineCategory = 'creator' | 'linkedin-executive' | 'board' | 'personal' | 'life'

export type TimelineTag = 'flexible-content-upload' | 'hard-report-deadline' | 'protected-life-event'

export type TimelineSlot = '1' | '2' | '3' | '4' | 'custom'

export type TimelineItem = {
  id: string
  title: string
  category: TimelineCategory
  tags: TimelineTag[]
  dueDate: string
  dueTime?: string
  description?: string
  slot: TimelineSlot
  sourceApp?: string
  createdAt: string
  completed: boolean
}

export type DeepLinkDeadline = {
  title: string
  dueDate?: string
  dueTime?: string
  category?: TimelineCategory
  tags?: TimelineTag[]
  sourceApp?: string
  description?: string
}

export type TimelineStats = {
  active: number
  upcomingToday: number
  overdue: number
}
