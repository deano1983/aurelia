import type { CreatorProfile } from '../types';
import type { StreakStats } from '../types';
import {
  RadarChart,
  Radar,
  PolarAngleAxis,
  PolarRadiusAxis,
  PolarGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface ConsistencyRadarChartProps {
  profile: CreatorProfile;
  stats: StreakStats;
}

function consistencyScore(stats: StreakStats): number {
  return Math.min(Math.round((stats.currentStreak / 14) * 100), 100);
}

function contentVolumeScore(profile: CreatorProfile): number {
  return Math.min(Math.round((profile.avgViews30d / 100_000) * 100), 100);
}

function engagementScore(profile: CreatorProfile): number {
  const rate = ((profile.avgViews30d * 1000) / profile.followers) / 10; // one-decimal %
  return Math.min(Math.round((rate / 10) * 100), 100);
}

function growthScore(profile: CreatorProfile): number {
  return Math.min(Math.round((profile.followers / 1_000_000) * 100), 100);
}

function mediaKitScore(profile: CreatorProfile): number {
  let score = 0;
  if (profile.name) score += 25;
  if (profile.handle) score += 25;
  if (profile.niche) score += 25;
  if (profile.followers > 0) score += 25;
  return score;
}

export default function ConsistencyRadarChart({ profile, stats }: ConsistencyRadarChartProps) {
  const data = [
    { axis: 'Consistency', value: consistencyScore(stats) },
    { axis: 'Content Volume', value: contentVolumeScore(profile) },
    { axis: 'Engagement', value: engagementScore(profile) },
    { axis: 'Growth Potential', value: growthScore(profile) },
    { axis: 'Media Kit', value: mediaKitScore(profile) },
  ];

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm no-print">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Creator Consistency Radar</h2>
      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="axis" />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
            <Radar
              dataKey="value"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="#8b5cf6"
              fillOpacity={0.15}
              radius={80}
            />
            <Tooltip content={({ active }: { active?: any }) => {
              if (!active || active.length === 0) return null;
              const entry = active[0];
              const payload = entry.payload ?? entry;
              const label = String(payload.axis ?? entry.name ?? '');
              const value = Number(payload.value ?? entry.value ?? 0);
              return (
                <div className="rounded bg-white border border-gray-200 p-2 shadow text-sm">
                  <div className="font-medium text-gray-900">{label}</div>
                  <div className="text-glowgrid-primary font-bold">{value}/100</div>
                </div>
              );
            }}
            />
            <Legend verticalAlign="top" align="right" height={36} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        0–100 radar built from streak length, views, engagement (views ÷ followers),
        follower scale and media-kit completeness.
      </p>
    </section>
  );
}