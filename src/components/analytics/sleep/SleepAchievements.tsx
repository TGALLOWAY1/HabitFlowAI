import React from 'react';
import { Flame, Heart, Award, Leaf, Timer } from 'lucide-react';
import type { SleepAnalyticsSummary, SleepAchievement } from '../../../lib/analyticsClient';
import { formatDurationMinutes } from './sleepFormat';

interface Props {
  data: SleepAnalyticsSummary | null;
  loading: boolean;
}

const ICONS: Record<SleepAchievement['icon'], React.ComponentType<{ size?: number; className?: string }>> = {
  streak: Flame,
  quality: Heart,
  consistency: Award,
  aidfree: Leaf,
  latency: Timer,
};

function formatValue(a: SleepAchievement): string {
  if (a.value === null || a.value === undefined) return '—';
  switch (a.icon) {
    case 'streak':
    case 'aidfree':
      return `${a.value} night${a.value === 1 ? '' : 's'}`;
    case 'quality':
      return `${a.value}/10`;
    case 'consistency':
      return `${a.value}%`;
    case 'latency':
      return formatDurationMinutes(a.value);
    default:
      return `${a.value}`;
  }
}

export const SleepAchievements: React.FC<Props> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Achievements</h3>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 bg-neutral-800 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
      <h3 className="text-sm font-medium text-neutral-400 mb-3">Achievements</h3>
      <div className="grid grid-cols-2 gap-3">
        {data.achievements.map((a) => {
          const Icon = ICONS[a.icon];
          return (
            <div
              key={a.id}
              className={`rounded-xl p-3 border ${a.earned ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-neutral-800/40 border-white/5'}`}
              title={a.description}
            >
              <div className="flex items-center gap-2">
                <Icon size={16} className={a.earned ? 'text-emerald-400' : 'text-neutral-500'} />
                <span className="text-lg font-bold text-white">{formatValue(a)}</span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-1 leading-tight">{a.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
