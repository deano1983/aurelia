import { useState, useCallback } from 'react';
import type { CreatorProfile } from './types';
import type { StreakRecord } from './types';
import { computeStreak } from './utils/streak';
import { saveRateCard, saveStreak } from './utils/storage';
import { UpdateBanner } from '@aurelia/core/events';
import CreatorProfileComponent from './components/CreatorProfile';
import StreakCalendar from './components/StreakCalendar';
import ConsistencyRadarChart from './components/ConsistencyRadarChart';
import RateCardCalculator from './components/RateCardCalculator';
import MediaKitExport from './components/MediaKitExport';

export default function App() {
  const [profile, setProfile] = useState<CreatorProfile>({
    id: '',
    name: '', handle: '', niche: '', platform: 'TikTok',
    followers: 0, avgViews30d: 0, bio: '', audienceNote: '',
    updatedAt: new Date().toISOString(),
  });
  const [record, setRecord] = useState<StreakRecord>({ postedDates: [] });
  const [totalCents, setTotalCents] = useState(0);

  const stats = computeStreak(record);

  const onProfileChange = useCallback((next: CreatorProfile) => setProfile(next), []);
  const onStreakChange = useCallback((next: StreakRecord) => {
    setRecord(next);
    saveStreak(next);
  }, []);
  const onRateCardChange = useCallback((result: { totalCents: number; tier?: string }) => {
    setTotalCents(result.totalCents);
    // Interlink: rate card → 07 Affiliate Engine (glowgrid.rate_card_set).
    if (result.tier) saveRateCard(result.tier, result.totalCents);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-glowgrid-primary flex items-center justify-center text-white font-bold text-lg">G</div>
            <span className="font-bold text-xl tracking-tight text-gray-900">GlowGrid Studio</span>
          </div>
          <nav className="flex items-center gap-6 no-print text-sm font-medium">
            <a href="#creator" className="text-glowgrid-primary hover:text-glowgrid-primary">Creator Profile</a>
            <a href="#streak" className="text-gray-600 hover:text-gray-900">Streak Calendar</a>
            <a href="#radar" className="text-gray-600 hover:text-gray-900">Consistency Radar</a>
            <a href="#ratecard" className="text-gray-600 hover:text-gray-900">Rate Card</a>
            <a href="#export" className="text-gray-600 hover:text-gray-900">Export</a>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        <section id="creator">
          <CreatorProfileComponent onProfileChange={onProfileChange} />
        </section>

        <section id="streak">
          <StreakCalendar onStreakChange={onStreakChange} />
        </section>

        <section id="radar" className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <ConsistencyRadarChart profile={profile} stats={stats} />
        </section>

        <section id="ratecard">
          <RateCardCalculator followers={profile.followers} onRateCardChange={onRateCardChange} />
        </section>

        <section id="export">
          <MediaKitExport profile={profile} stats={stats} totalCents={totalCents} />
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6 no-print">
        <div className="max-w-6xl mx-auto px-4 text-xs text-gray-400 text-center">
          Aurelia OS · App 05 — GlowGrid Creator Consistency Radar & Sponsor Rate Card. All amounts in AUD
          (integer cent math). Data persists in localStorage only.
        </div>
      </footer>
      <UpdateBanner />
    </div>
  );
}