import type { CreatorProfile, StreakRecord } from '../types';

const CREATOR_KEY = 'glowgrid:creator';
const STREAK_KEY = 'glowgrid:streak';

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable or quota exceeded — silently degrade.
  }
}

export function loadCreator(): CreatorProfile | null {
  return loadJSON(CREATOR_KEY, null);
}

export function saveCreator(profile: CreatorProfile): void {
  saveJSON(CREATOR_KEY, profile);
}

export function loadStreak(): StreakRecord {
  return loadJSON(STREAK_KEY, { postedDates: [] });
}

export function saveStreak(record: StreakRecord): void {
  saveJSON(STREAK_KEY, record);
}