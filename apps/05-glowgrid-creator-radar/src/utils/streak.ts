import type { StreakRecord, StreakStats } from '../types';

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function subtractDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function computeStreak(record: StreakRecord): StreakStats {
  const dates = [...record.postedDates].sort();
  const totalPosts = dates.length;
  const lastPosted = dates.length ? dates[dates.length - 1] : null;

  const dateSet = new Set(dates);
  const today = todayISO();

  // Current streak: consecutive posted days ending on today (walking backward).
  let currentStreak = 0;
  let cursor = today;
  while (dateSet.has(cursor)) {
    currentStreak += 1;
    cursor = subtractDays(cursor, 1);
  }

  // Longest streak: longest run of consecutive posted days ever.
  let longestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of dates) {
    if (prev && subtractDays(d, 1) === prev) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prev = d;
  }

  return { currentStreak, longestStreak, totalPosts, lastPosted };
}

export function isPosted(record: StreakRecord, iso: string): boolean {
  return record.postedDates.includes(iso);
}

export function toggleDate(record: StreakRecord, iso: string): StreakRecord {
  const set = new Set(record.postedDates);
  if (set.has(iso)) set.delete(iso);
  else set.add(iso);
  return { postedDates: [...set].sort() };
}

export function monthDays(year: number, month: number): { iso: string; day: number; weekday: number }[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const out: { iso: string; day: number; weekday: number }[] = [];
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    out.push({ iso: d.toISOString().slice(0, 10), day: d.getDate(), weekday: d.getDay() });
  }
  return out;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleString('en-AU', { month: 'long', year: 'numeric' });
}