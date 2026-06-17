import React from 'react';
import { Moon, Sunrise, Clock, Timer, Heart, Watch, Flame, TrendingUp, TrendingDown, Minus, Info, ShieldCheck } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import type { SleepAnalyticsSummary, SleepStat } from '../../../lib/analyticsClient';
import { formatDurationMinutes, minutesAfterNoonToClock } from './sleepFormat';

interface Props {
  data: SleepAnalyticsSummary | null;
  loading: boolean;
}

function SkeletonCard({ large }: { large?: boolean }) {
  return (
    <div className={`bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm ${large ? 'col-span-2' : ''}`}>
      <div className="h-4 w-20 bg-neutral-800 rounded animate-pulse mb-3" />
      <div className="h-9 w-24 bg-neutral-800 rounded animate-pulse mb-2" />
      <div className="h-3 w-16 bg-neutral-800 rounded animate-pulse" />
    </div>
  );
}

/** Render a stat's period-over-period trend with polarity-aware coloring. */
function TrendLabel({ stat, format, neutral }: { stat: SleepStat; format: (delta: number) => string; neutral?: boolean }) {
  if (stat.trendDirection === null || stat.trendDelta === null) {
    return <span className="text-[11px] text-neutral-500">vs prev —</span>;
  }
  if (stat.trendDirection === 'stable') {
    return (
      <span className="flex items-center gap-1 text-blue-400 text-[11px] font-medium">
        <Minus size={12} /> Stable
      </span>
    );
  }
  const better = stat.trendDirection === 'better';
  const color = neutral ? 'text-neutral-300' : better ? 'text-emerald-400' : 'text-red-400';
  const Icon = stat.trendDelta >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-1 ${color} text-[11px] font-medium`}>
      <Icon size={12} /> {format(stat.trendDelta)}
    </span>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tooltip: string;
  stat?: SleepStat;
  trendFormat?: (delta: number) => string;
  trendNeutral?: boolean;
  accent?: string;
}

function StatCard({ icon, label, value, tooltip, stat, trendFormat, trendNeutral, accent }: StatCardProps) {
  return (
    <div className={`bg-neutral-900/50 rounded-2xl border ${accent ?? 'border-white/5'} p-4 backdrop-blur-sm`}>
      <div className="flex items-center gap-2 mb-1">{icon}</div>
      <div className="text-2xl font-bold text-white mt-1.5">{value}</div>
      <div className="flex items-center gap-1 mt-1">
        <span className="text-[11px] text-neutral-400 font-medium">{label}</span>
        <Info size={11} className="text-neutral-500 cursor-help" data-tooltip-id="sleep-summary-tooltip" data-tooltip-content={tooltip} />
      </div>
      {stat && trendFormat && (
        <div className="mt-1.5">
          <TrendLabel stat={stat} format={trendFormat} neutral={trendNeutral} />
        </div>
      )}
    </div>
  );
}

function avgFromNights(nights: SleepAnalyticsSummary['nights'], field: 'bedtimeScore' | 'durationScore' | 'interruptionScore'): number | null {
  const vals = nights.map((n) => n[field]).filter((v): v is number => typeof v === 'number');
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export const SleepSummaryCards: React.FC<Props> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonCard large />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonCard /> <SkeletonCard /> <SkeletonCard /> <SkeletonCard />
        </div>
      </div>
    );
  }
  if (!data) return null;

  const score = data.avgAppleSleepScore;
  const sub = {
    bedtime: avgFromNights(data.nights, 'bedtimeScore'),
    duration: avgFromNights(data.nights, 'durationScore'),
    interruption: avgFromNights(data.nights, 'interruptionScore'),
  };
  const ind = data.independence;

  return (
    <div className="space-y-3">
      {/* Hero — Apple Watch Sleep Score (primary signal) */}
      <div className="bg-neutral-900/50 rounded-2xl border border-indigo-500/30 p-5 backdrop-blur-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                <Watch size={18} className="text-indigo-400" />
              </div>
              <span className="text-xs text-neutral-400 font-medium">Apple Watch Sleep Score</span>
            </div>
            <div className="text-4xl font-bold text-white">
              {score.value !== null ? Math.round(score.value) : '—'}
              {score.value !== null && <span className="text-lg text-neutral-500 font-medium"> /100</span>}
            </div>
            <div className="mt-1">
              <TrendLabel stat={score} format={(d) => `${d > 0 ? '+' : ''}${Math.round(d)} pts`} />
            </div>
          </div>
          <div className="text-right space-y-1 text-[11px] text-neutral-400">
            <div>Duration <span className="text-white font-semibold">{sub.duration ?? '—'}</span><span className="text-neutral-600">/50</span></div>
            <div>Bedtime <span className="text-white font-semibold">{sub.bedtime ?? '—'}</span><span className="text-neutral-600">/25</span></div>
            <div>Interruption <span className="text-white font-semibold">{sub.interruption ?? '—'}</span><span className="text-neutral-600">/25</span></div>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-neutral-600">
          {score.sampleSize > 0 ? `Based on ${score.sampleSize} night${score.sampleSize === 1 ? '' : 's'}` : 'No data yet'}
        </div>
      </div>

      {/* Core metric grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Moon size={16} className="text-indigo-400" />}
          label="Avg Duration"
          value={formatDurationMinutes(data.avgDurationMinutes.value)}
          tooltip="Average time asleep per night over this period."
          stat={data.avgDurationMinutes}
          trendFormat={(d) => `${d > 0 ? '+' : ''}${Math.round(d)} min`}
        />
        <StatCard
          icon={<Timer size={16} className="text-amber-400" />}
          label="Avg Latency"
          value={data.avgLatencyMinutes.value !== null ? `${Math.round(data.avgLatencyMinutes.value)} min` : '—'}
          tooltip="Average time to fall asleep. Lower is better."
          stat={data.avgLatencyMinutes}
          trendFormat={(d) => `${d > 0 ? '+' : ''}${Math.round(d)} min`}
        />
        <StatCard
          icon={<Clock size={16} className="text-sky-400" />}
          label="Avg Bedtime"
          value={minutesAfterNoonToClock(data.avgBedtimeMinutes.value)}
          tooltip="Average clock time you fell asleep. Trend reflects movement toward your target bedtime."
          stat={data.avgBedtimeMinutes}
          trendFormat={(d) => `${Math.abs(Math.round(d))} min ${d <= 0 ? 'earlier' : 'later'}`}
          trendNeutral
        />
        <StatCard
          icon={<Sunrise size={16} className="text-orange-400" />}
          label="Avg Wake Time"
          value={minutesAfterNoonToClock(data.avgWakeMinutes.value)}
          tooltip="Average clock time you woke. Trend reflects movement toward your target wake time."
          stat={data.avgWakeMinutes}
          trendFormat={(d) => `${Math.abs(Math.round(d))} min ${d <= 0 ? 'earlier' : 'later'}`}
          trendNeutral
        />
        <StatCard
          icon={<Heart size={16} className="text-fuchsia-300" />}
          label="Avg Quality"
          value={data.avgSleepQuality0to10.value !== null ? `${data.avgSleepQuality0to10.value} /10` : '—'}
          tooltip="Your subjective sleep quality, rescaled to a 0-10 scale."
          stat={data.avgSleepQuality0to10}
          trendFormat={(d) => `${d > 0 ? '+' : ''}${d}`}
        />
        <StatCard
          icon={<Flame size={16} className="text-emerald-400" />}
          label="Consistency"
          value={data.consistencyScore !== null ? `${data.consistencyScore}%` : '—'}
          tooltip="How tightly your bedtime AND wake time cluster night-to-night, independent of how long you sleep."
          accent="border-emerald-500/20"
        />
      </div>

      {/* Sleep Independence */}
      <div className="bg-neutral-900/50 rounded-2xl border border-teal-500/20 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center">
            <ShieldCheck size={18} className="text-teal-400" />
          </div>
          <span className="text-xs text-neutral-400 font-medium">Sleep Independence</span>
          <Info size={11} className="text-neutral-500 cursor-help" data-tooltip-id="sleep-summary-tooltip"
            data-tooltip-content="Your reliance on sleep aids. Higher aid-free percentage and longer aid-free streaks are the goal." />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-1">
          <div>
            <div className="text-2xl font-bold text-white">
              {ind.aidFreePercent !== null ? `${Math.round(ind.aidFreePercent * 100)}%` : '—'}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Aid-free nights</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{ind.currentAidFreeStreak}</div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Current streak</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{ind.aidNights}</div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Aid nights</div>
          </div>
        </div>
        {ind.trendDirection && ind.trendDelta !== null && (
          <div className="mt-2">
            <TrendLabel
              stat={{ value: ind.aidFreePercent, sampleSize: ind.sampleSize, trendDelta: ind.trendDelta, trendDirection: ind.trendDirection }}
              format={(d) => `${d > 0 ? '+' : ''}${d}% aid-free`}
            />
          </div>
        )}
      </div>

      <Tooltip
        id="sleep-summary-tooltip"
        className="z-50 !bg-neutral-800 !text-white !opacity-100 !rounded-lg !px-3 !py-2 !text-xs !max-w-[220px]"
      />
    </div>
  );
};
