import React from 'react';
import { Flame, Target, TrendingUp, TrendingDown, Minus, Calendar, BarChart3 } from 'lucide-react';
import type { HabitAnalyticsSummary } from '../../lib/analyticsClient';

interface SummaryCardsProps {
  data: HabitAnalyticsSummary | null;
  loading: boolean;
}

function TrendArrow({ direction, delta }: { direction: 'up' | 'down' | 'stable'; delta: number }) {
  if (direction === 'up') {
    return (
      <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
        <TrendingUp size={14} /> +{Math.round(Math.abs(delta) * 100)}%
      </span>
    );
  }
  if (direction === 'down') {
    return (
      <span className="flex items-center gap-1 text-red-400 text-xs font-medium">
        <TrendingDown size={14} /> -{Math.round(Math.abs(delta) * 100)}%
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-blue-400 text-xs font-medium">
      <Minus size={14} /> Stable
    </span>
  );
}

function SkeletonCard({ large }: { large?: boolean }) {
  return (
    <div className={`bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm ${large ? 'col-span-2 sm:col-span-1' : ''}`}>
      <div className="h-4 w-20 bg-neutral-800 rounded animate-pulse mb-3" />
      <div className="h-10 w-24 bg-neutral-800 rounded animate-pulse mb-2" />
      <div className="h-3 w-16 bg-neutral-800 rounded animate-pulse" />
    </div>
  );
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <SkeletonCard large /> <SkeletonCard large />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <SkeletonCard /> <SkeletonCard /> <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const consistencyPct = Math.round(data.consistencyScore * 100);
  const completionPct = Math.round(data.completionRate * 100);

  return (
    <div className="space-y-3">
      {/* Primary Stats — Large Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Consistency Score */}
        <div className="bg-neutral-900/50 rounded-2xl border border-emerald-500/20 p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Flame size={18} className="text-emerald-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mt-2">{consistencyPct}%</div>
          <div className="text-xs text-neutral-400 font-medium mt-1">Consistency</div>
          <div className="mt-2">
            <TrendArrow direction={data.trendDirection} delta={data.trendDelta} />
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-neutral-900/50 rounded-2xl border border-blue-500/20 p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Target size={18} className="text-blue-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mt-2">{completionPct}%</div>
          <div className="text-xs text-neutral-400 font-medium mt-1">Completion Rate</div>
          <div className="mt-2">
            <span className="text-xs text-neutral-500">{data.totalCompletions} total</span>
          </div>
        </div>
      </div>

      {/* Secondary Stats — Smaller Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm text-center">
          <BarChart3 size={14} className="text-teal-400 mx-auto mb-1" />
          <div className="text-xl font-bold text-white">{data.averageHabitsPerDay}</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">Avg/Day</div>
        </div>
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm text-center">
          <Calendar size={14} className="text-teal-400 mx-auto mb-1" />
          <div className="text-sm font-bold text-white leading-tight">{data.mostConsistentDayOfWeek}</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">Best Day</div>
        </div>
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm text-center">
          <Target size={14} className="text-teal-400 mx-auto mb-1" />
          <div className="text-xl font-bold text-white">{data.graduatedHabits}</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">Graduated</div>
        </div>
      </div>
    </div>
  );
};
