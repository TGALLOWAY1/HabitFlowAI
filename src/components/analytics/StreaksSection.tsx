import React from 'react';
import { Flame, Trophy, Shield, Star } from 'lucide-react';
import type { HabitAnalyticsSummary } from '../../lib/analyticsClient';

interface StreaksSectionProps {
  data: HabitAnalyticsSummary | null;
  loading: boolean;
}

export const StreaksSection: React.FC<StreaksSectionProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-4">Streaks</h3>
        <div className="h-20 bg-neutral-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const streakActive = data.currentStreak > 0;

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-purple-500/15 p-5 backdrop-blur-sm">
      <h3 className="text-sm font-medium text-neutral-400 mb-4">Streaks</h3>

      <div className="flex items-center gap-4 mb-5">
        {/* Current Streak — Hero */}
        <div className="flex-1 text-center">
          <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
            streakActive ? 'bg-emerald-500/15 ring-2 ring-emerald-500/30' : 'bg-neutral-800'
          }`}>
            <Flame size={28} className={streakActive ? 'text-emerald-400' : 'text-neutral-500'} />
          </div>
          <div className={`text-4xl font-bold mt-2 ${streakActive ? 'text-white' : 'text-neutral-500'}`}>
            {data.currentStreak}
          </div>
          <div className="text-xs text-neutral-400">Current Streak</div>
        </div>

        {/* Divider */}
        <div className="w-px h-20 bg-white/5" />

        {/* Secondary stats */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <Trophy size={16} className="text-amber-400 shrink-0" />
            <div>
              <div className="text-lg font-bold text-white">{data.longestStreak}d</div>
              <div className="text-[10px] text-neutral-500">Longest Streak</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Shield size={16} className="text-blue-400 shrink-0" />
            <div>
              <div className="text-lg font-bold text-white">{data.daysSinceLastMissed}d</div>
              <div className="text-[10px] text-neutral-500">Perfect Days</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Star size={16} className="text-purple-400 shrink-0" />
            <div>
              <div className="text-lg font-bold text-white">{data.bestWeekCompletions}</div>
              <div className="text-[10px] text-neutral-500">Best Week</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
