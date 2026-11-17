const PREFIX = 'affiliate-'

/** Load a JSON value from localStorage, returning fallback on any failure. */
export function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${key}`)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Persist a JSON value to localStorage, degrading silently on quota/private mode. */
export function saveJSON<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value))
  } catch {
    // localStorage quota exceeded or private mode — silently degrade
  }
}

export const STORAGE_KEYS = {
  partners: 'partners',
  ledger: 'ledger',
  pitches: 'pitches',
} as const
