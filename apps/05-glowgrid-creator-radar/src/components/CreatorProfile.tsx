import { useState, useEffect, useCallback } from 'react';
import type { CreatorProfile } from '../types';
import { loadCreator, saveCreator } from '../utils/storage';
import { engagementRatePercent } from '../utils/engagementRate';

const EMPTY: CreatorProfile = {
  id: crypto.randomUUID(),
  name: '', handle: '', niche: '', platform: 'TikTok',
  followers: 0, avgViews30d: 0, bio: '', audienceNote: '',
  updatedAt: new Date().toISOString(),
};

export interface CreatorProfileProps { onProfileChange?: (p: CreatorProfile) => void; }

export default function CreatorProfile({ onProfileChange }: CreatorProfileProps) {
  const [profile, setProfile] = useState<CreatorProfile>(EMPTY);

  useEffect(() => { const saved = loadCreator(); if (saved) setProfile(saved); }, []);

  const save = useCallback((next: Partial<CreatorProfile>) => {
    const updated = { ...profile, ...next, updatedAt: new Date().toISOString() };
    setProfile(updated); saveCreator(updated); onProfileChange?.(updated);
  }, [profile, onProfileChange]);

  const rate = engagementRatePercent(profile.avgViews30d, profile.followers);
  const num = (v: string) => Number(v) || 0;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm no-print">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Creator Profile</h2>
        <span className="badge">Shared with 03 Voice Studio · audience/writing style</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="col-span-2 md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input className="input-field" value={profile.name} onChange={(e) => save({ name: e.target.value })} placeholder="Creator name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Handle</label>
          <div className="relative">
            <span className="absolute left-2.5 top-2.5 text-gray-400">@</span>
            <input className="input-field pl-7" value={profile.handle} onChange={(e) => save({ handle: e.target.value.replace('@', '') })} placeholder="creator_handle" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
          <select className="input-field" value={profile.platform} onChange={(e) => save({ platform: e.target.value })}>
            <option>TikTok</option><option>Instagram</option><option>YouTube</option><option>Twitch</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Positioning / Niche</label>
          <input className="input-field" value={profile.niche} onChange={(e) => save({ niche: e.target.value })} placeholder="e.g. Sustainable fashion UGC" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Followers</label>
          <input className="input-field" type="number" min="0" value={String(profile.followers)} onChange={(e) => save({ followers: num(e.target.value) })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Avg 30-Day Views / Video</label>
          <input className="input-field" type="number" min="0" value={String(profile.avgViews30d)} onChange={(e) => save({ avgViews30d: num(e.target.value) })} />
        </div>
        <div className="col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          <textarea className="input-field" rows={2} value={profile.bio} onChange={(e) => save({ bio: e.target.value })} placeholder="One-line creator bio" />
        </div>
      </div>

      <div className="glass-panel">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Live Metrics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div><div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Combined Followers</div><div className="text-xl font-bold">{profile.followers.toLocaleString('en-AU')}</div></div>
          <div><div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg 30-Day Views / Video</div><div className="text-xl font-bold">{profile.avgViews30d.toLocaleString('en-AU')}</div></div>
          <div><div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Engagement Rate</div><div className="text-xl font-bold text-glowgrid-primary">{rate.toFixed(1)}%</div></div>
        </div>
        <p className="mt-3 text-xs text-gray-500">Rate-card output feeds <strong>07 Affiliate Engine</strong> · streak deadlines feed <strong>01 Timeline</strong>.</p>
      </div>
    </section>
  );
}