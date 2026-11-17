/**
 * Engagement-rate math using integer arithmetic (views * 1000 / followers, then /10
 * for one decimal place). Display-only; money calculations stay in integer cents.
 */

export function engagementRatePercent(avgViews: number, followers: number): number {
  if (!followers) return 0;
  return Math.round((avgViews * 1000) / followers) / 10;
}