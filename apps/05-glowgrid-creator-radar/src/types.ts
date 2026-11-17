export interface CreatorProfile {
  id: string;
  name: string;
  handle: string;
  niche: string;
  platform: string;
  followers: number;
  avgViews30d: number;
  bio: string;
  audienceNote: string;
  updatedAt: string;
}

export interface StreakRecord {
  postedDates: string[]; // ISO YYYY-MM-DD, unique, sorted
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  totalPosts: number;
  lastPosted: string | null;
}

export interface RateCardLine {
  label: string;
  qty: number;
  unitCents: number;
  lineCents: number;
}

export interface SponsorshipTier {
  key: string;
  label: string;
  min: number;
  max: number; // inclusive upper bound; Infinity for Mega
  baseCents: Record<string, number>; // contentType -> cents per unit
}