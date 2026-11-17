import { configureEvents, emit } from '@aurelia/core/events';
import type { CreatorProfile, StreakRecord } from '../types';

configureEvents({ appId: '05' });

const CREATOR_KEY = 'glowgrid:creator';
const STREAK_KEY = 'glowgrid:streak';
const RATE_CARD_KEY = 'glowgrid:rate-card';

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

export interface SavedRateCard {
  tier: string;
  totalCents: number;
  savedAt: string;
}

export function loadRateCard(): SavedRateCard | null {
  return loadJSON(RATE_CARD_KEY, null);
}

/**
 * Persist the calculated rate card and tell 07 Affiliate Engine
 * (glowgrid.rate_card_set) so it lands in the partner inbox.
 */
export function saveRateCard(tier: string, totalCents: number): SavedRateCard {
  const card: SavedRateCard = { tier, totalCents, savedAt: new Date().toISOString() };
  saveJSON(RATE_CARD_KEY, card);
  emit('glowgrid.rate_card_set', { tier, rateAud: Math.round(totalCents) / 100 });
  return card;
}
