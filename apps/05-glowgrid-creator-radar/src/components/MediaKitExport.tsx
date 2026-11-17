import { useCallback } from 'react';
import type { CreatorProfile } from '../types';
import type { StreakStats } from '../types';
import { formatAUD } from '../utils/audMoney';
import { engagementRatePercent } from '../utils/engagementRate';
import { SPONSORSHIP_TIERS } from '../utils/sponsorshipTier';
import ShareMediaKitButton from './ShareMediaKitButton';

interface MediaKitExportProps {
  profile: CreatorProfile;
  stats: StreakStats;
  totalCents: number;
}

export default function MediaKitExport({ profile, stats, totalCents }: MediaKitExportProps) {
  const handlePrint = useCallback(() => window.print(), []);
  const rate = engagementRatePercent(profile.avgViews30d, profile.followers);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Media Kit / Rate Card Export</h2>
        <div className="no-print flex flex-wrap items-center gap-2">
          <ShareMediaKitButton profile={profile} stats={stats} totalCents={totalCents} />
          <button
            onClick={handlePrint}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-glowgrid-primary"
          >
            🖨️ Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="no-print mb-6 text-sm text-gray-500">
        Browser print dialog — choose "Save as PDF". A4 media kit for sponsor outreach (feeds 07 Affiliate Engine).
      </div>

      <div className="print-section media-kit-page">
        <div className="border-b-4 border-glowgrid-primary pb-4 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{profile.name || 'Creator Name'}</h1>
            <p className="text-glowgrid-primary font-semibold">{profile.handle ? '@' + profile.handle : ''} · {profile.niche}</p>
            <p className="text-sm text-gray-600 mt-1">{profile.bio}</p>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</div>
            <div className="text-lg font-bold">{profile.platform}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Audience &amp; Reach</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Followers</span><span className="font-medium">{profile.followers.toLocaleString('en-AU')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Avg 30-Day Views / Video</span><span className="font-medium">{profile.avgViews30d.toLocaleString('en-AU')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Engagement Rate</span><span className="font-medium text-glowgrid-primary">{rate.toFixed(1)}%</span></div>
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Consistency</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Current Streak</span><span className="font-medium">{stats.currentStreak} days</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Longest Streak</span><span className="font-medium">{stats.longestStreak} days</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total Posts Logged</span><span className="font-medium">{stats.totalPosts}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Last Posted</span><span className="font-medium">{stats.lastPosted ?? '—'}</span></div>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-4 mb-8">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Sponsorship Rate Card (AUD)</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left pb-2 text-gray-500 font-medium text-xs uppercase">Tier</th>
                <th className="text-right pb-2 text-gray-500 font-medium text-xs uppercase">Static</th>
                <th className="text-right pb-2 text-gray-500 font-medium text-xs uppercase">Story/Reel</th>
                <th className="text-right pb-2 text-gray-500 font-medium text-xs uppercase">Video</th>
                <th className="text-right pb-2 text-gray-500 font-medium text-xs uppercase">Bundle</th>
              </tr>
            </thead>
            <tbody>
              {SPONSORSHIP_TIERS.map((t) => (
                <tr key={t.key} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 font-medium">{t.label}</td>
                  <td className="py-2 text-right font-mono">{formatAUD(t.baseCents.static)}</td>
                  <td className="py-2 text-right font-mono">{formatAUD(t.baseCents.story)}</td>
                  <td className="py-2 text-right font-mono">{formatAUD(t.baseCents.video)}</td>
                  <td className="py-2 text-right font-mono">{formatAUD(t.baseCents.bundle)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-500">
            Per deliverable, AUD. Multipliers: 30d 1.0× · 60d 1.3× · 90d 1.6× · perpetual 2.0× · exclusive +50%.
            This configuration: <span className="font-bold text-glowgrid-primary">{formatAUD(totalCents)}</span>.
          </p>
        </div>
      </div>
    </section>
  );
}