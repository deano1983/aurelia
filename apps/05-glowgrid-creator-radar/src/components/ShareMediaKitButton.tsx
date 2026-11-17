import { useMemo } from 'react';
import { ShareButton } from '@aurelia/core/share';
import type { CreatorProfile, StreakStats } from '../types';
import { formatAUD } from '../utils/audMoney';
import { engagementRatePercent } from '../utils/engagementRate';

interface ShareMediaKitButtonProps {
  profile: CreatorProfile;
  stats: StreakStats;
  totalCents: number;
}

/** Share a text summary of the media kit (the PDF itself stays a print export). */
export default function ShareMediaKitButton({ profile, stats, totalCents }: ShareMediaKitButtonProps) {
  const post = useMemo(() => {
    const rate = engagementRatePercent(profile.avgViews30d, profile.followers);
    const who = [profile.name || 'Creator', profile.handle ? `@${profile.handle}` : ''].filter(Boolean).join(' ');
    const head = [`${who} · ${profile.niche} creator on ${profile.platform}`, profile.bio].filter(Boolean);
    const facts = [
      `${profile.followers.toLocaleString('en-AU')} followers · ${profile.avgViews30d.toLocaleString('en-AU')} avg views · ${rate.toFixed(1)}% engagement`,
      `${stats.currentStreak}-day posting streak (best ${stats.longestStreak}) · ${stats.totalPosts} posts logged`,
      `Sponsorships from ${formatAUD(totalCents)} (AUD). Open to brand partnerships, get in touch.`,
    ];
    return { text: `${head.join('\n')}\n\n${facts.join('\n')}`, title: `${who} media kit` };
  }, [profile, stats, totalCents]);

  return (
    <ShareButton
      post={post}
      appId="05-glowgrid-creator-radar"
      label="Share / Post"
      heading="Share your media kit"
      className="rounded-md bg-glowgrid-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-glowgrid-primaryHover focus:ring-2 focus:ring-glowgrid-primary"
    />
  );
}
