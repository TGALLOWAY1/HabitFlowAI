import React from 'react';
import { Flame, Target, Zap, Trophy, CheckCircle2, GraduationCap } from 'lucide-react';
import type { HabitAnalyticsSummary } from '../../lib/analyticsClient';

interface SummaryCardsProps {
  data: HabitAnalyticsSummary | null;
  loading: boolean;
}

const cards = [
  { key: 'consistencyScore' as const, label: 'Consistency', icon: Flame, format: (v: number) => `${Math.round(v * 100)}%` },
  { key: 'completionRate' as const, label: 'Completion Rate', icon: Target, format: (v: number) => `${Math.round(v * 100)}%` },
  { key: 'currentStreak' as const, label: 'Current Streak', icon: Zap, format: (v: number) => `${v}d` },
  { key: 'longestStreak' as const, label: 'Longest Streak', icon: Trophy, format: (v: number) => `${v}d` },
  { key: 'totalCompletions' as const, label: 'Completions', icon: CheckCircle2, format: (v: number) => `${v}` },
  { key: 'graduatedHabits' as const, label: 'Graduated', icon: GraduationCap, format: (v: number) => `${v}` },
];

export const SummaryCards: React.FC<SummaryCardsProps> = ({ data, loading }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {cards.map(({ key, label, icon: Icon, format }) => (
        <div
          key={key}
          className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon size={16} className="text-emerald-400" />
            <span className="text-xs text-neutral-400 font-medium">{label}</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {loading ? (
              <div className="h-8 w-16 bg-neutral-800 rounded animate-pulse" />
            ) : data ? (
              format(data[key])
            ) : (
              '—'
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
