import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { SleepAnalyticsSummary } from '../../../lib/analyticsClient';
import { formatDurationMinutes } from './sleepFormat';

interface Props {
  data: SleepAnalyticsSummary | null;
  loading: boolean;
}

function shortDay(dayKey: string): string {
  return dayKey.slice(5); // MM-DD
}

export const SleepDurationTrendChart: React.FC<Props> = ({ data, loading }) => {
  const points = useMemo(() => {
    if (!data) return null;
    const pts = data.trend
      .map((p) => ({ dayKey: p.dayKey, hours: p.durationMinutes === null ? null : Math.round((p.durationMinutes / 60) * 100) / 100 }));
    return pts.some((p) => p.hours !== null) ? pts : null;
  }, [data]);

  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Sleep Duration Trend</h3>
        <div className="h-52 bg-neutral-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!points) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Sleep Duration Trend</h3>
        <p className="text-neutral-500 text-sm">Not enough data yet. Log a few nights to see your trend.</p>
      </div>
    );
  }

  const targetHours = (data!.targets.durationMinutes / 60);

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-neutral-400">Sleep Duration Trend</h3>
        <span className="text-[10px] text-neutral-500">target {formatDurationMinutes(data!.targets.durationMinutes)}</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={points} margin={{ top: 10, right: 5, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="durationGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
          <XAxis dataKey="dayKey" tick={{ fill: '#737373', fontSize: 10 }} tickFormatter={shortDay} minTickGap={20} />
          <YAxis tick={{ fill: '#737373', fontSize: 10 }} domain={[0, 12]} tickFormatter={(v: number) => `${v}h`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: 8 }}
            labelStyle={{ color: '#a3a3a3' }}
            formatter={(value: number) => [formatDurationMinutes(value * 60), 'Slept']}
          />
          <ReferenceLine y={targetHours} stroke="#6366f1" strokeDasharray="6 3" />
          <Area type="monotone" dataKey="hours" stroke="#10b981" strokeWidth={2} fill="url(#durationGradient)" connectNulls dot={{ r: 2, fill: '#10b981' }} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-neutral-500">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 rounded" /> Hours slept</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-500 rounded" /> Target</span>
      </div>
    </div>
  );
};
