export function formatDateShort(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-AU', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function isToday(isoDate: string): boolean {
  return isoDate === new Date().toISOString().slice(0, 10)
}

export function isOverdue(isoDate: string): boolean {
  return isoDate < new Date().toISOString().slice(0, 10)
}

export function parseDeepLinkDate(raw?: string): string | undefined {
  if (!raw) return undefined
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined
}
