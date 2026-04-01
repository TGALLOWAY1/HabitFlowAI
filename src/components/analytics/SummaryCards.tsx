import React from 'react';
import { Flame, Target, TrendingUp, TrendingDown, Minus, Calendar, BarChart3, Info } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
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
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-neutral-400 font-medium">Consistency</span>
            <Info
              size={12}
              className="text-neutral-500 cursor-help"
              data-tooltip-id="summary-tooltip"
              data-tooltip-content="How regularly you complete habits relative to your schedule. Higher means fewer missed days."
            />
          </div>
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
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-neutral-400 font-medium">Completion Rate</span>
            <Info
              size={12}
              className="text-neutral-500 cursor-help"
              data-tooltip-id="summary-tooltip"
              data-tooltip-content="Percentage of scheduled habits you completed. The total below is the raw number of completions in this period."
            />
          </div>
          <div className="mt-2">
            <span className="text-xs text-neutral-500">{data.totalCompletions} total completions</span>
          </div>
        </div>
      </div>

      {/* Secondary Stats — Smaller Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm text-center">
          <BarChart3 size={14} className="text-teal-400 mx-auto mb-1" />
          <div className="text-xl font-bold text-white">{data.averageHabitsPerDay}</div>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <span className="text-[10px] text-neutral-400">Avg/Day</span>
            <Info
              size={10}
              className="text-neutral-500 cursor-help"
              data-tooltip-id="summary-tooltip"
              data-tooltip-content="Average number of habits you complete per day."
            />
          </div>
        </div>
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm text-center">
          <Calendar size={14} className="text-teal-400 mx-auto mb-1" />
          <div className="text-sm font-bold text-white leading-tight">{data.mostConsistentDayOfWeek}</div>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <span className="text-[10px] text-neutral-400">Best Day</span>
            <Info
              size={10}
              className="text-neutral-500 cursor-help"
              data-tooltip-id="summary-tooltip"
              data-tooltip-content="The day of the week where you have the highest completion rate."
            />
          </div>
        </div>
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm text-center">
          <Target size={14} className="text-teal-400 mx-auto mb-1" />
          <div className="text-xl font-bold text-white">{data.graduatedHabits}</div>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <span className="text-[10px] text-neutral-400">Graduated</span>
            <Info
              size={10}
              className="text-neutral-500 cursor-help"
              data-tooltip-id="summary-tooltip"
              data-tooltip-content="Habits completed consistently enough to be considered mastered."
            />
          </div>
        </div>
      </div>

      <Tooltip
        id="summary-tooltip"
        className="z-50 !bg-neutral-800 !text-white !opacity-100 !rounded-lg !px-3 !py-2 !text-xs !max-w-[200px]"
      />
    </div>
  );
};
