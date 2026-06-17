import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { SleepAnalyticsSummary } from '../../../lib/analyticsClient';
import { minutesAfterNoonToClock } from './sleepFormat';

interface Props {
  data: SleepAnalyticsSummary | null;
  loading: boolean;
}

function shortDay(dayKey: string): string {
  return dayKey.slice(5);
}

export const SleepScheduleTrendChart: React.FC<Props> = ({ data, loading }) => {
  const points = useMemo(() => {
    if (!data) return null;
    const pts = data.trend.map((p) => ({ dayKey: p.dayKey, bedtime: p.bedtimeMinutes, wake: p.wakeMinutes }));
    return pts.some((p) => p.bedtime !== null || p.wake !== null) ? pts : null;
  }, [data]);

  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Bedtime & Wake Trend</h3>
        <div className="h-52 bg-neutral-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!points) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Bedtime & Wake Trend</h3>
        <p className="text-neutral-500 text-sm">Not enough data yet. Log bedtime and wake times to see drift vs your targets.</p>
      </div>
    );
  }

  const { bedtimeMinutes, wakeMinutes } = data!.targets;

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-neutral-400">Bedtime & Wake Trend</h3>
        <span className="text-[10px] text-neutral-500">
          targets {minutesAfterNoonToClock(bedtimeMinutes)} / {minutesAfterNoonToClock(wakeMinutes)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={points} margin={{ top: 10, right: 5, left: -8, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
          <XAxis dataKey="dayKey" tick={{ fill: '#737373', fontSize: 10 }} tickFormatter={shortDay} minTickGap={20} />
          <YAxis
            tick={{ fill: '#737373', fontSize: 10 }}
            domain={[0, 1440]}
            ticks={[360, 540, 720, 900, 1080, 1260]}
            tickFormatter={(v: number) => minutesAfterNoonToClock(v)}
            width={56}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: 8 }}
            labelStyle={{ color: '#a3a3a3' }}
            formatter={(value: number, name: string) => [minutesAfterNoonToClock(value), name === 'bedtime' ? 'Bedtime' : 'Wake']}
          />
          <ReferenceLine y={bedtimeMinutes} stroke="#6366f1" strokeDasharray="6 3" />
          <ReferenceLine y={wakeMinutes} stroke="#f59e0b" strokeDasharray="6 3" />
          <Line type="monotone" dataKey="bedtime" stroke="#818cf8" strokeWidth={2} connectNulls dot={{ r: 2, fill: '#818cf8' }} />
          <Line type="monotone" dataKey="wake" stroke="#fbbf24" strokeWidth={2} connectNulls dot={{ r: 2, fill: '#fbbf24' }} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-neutral-500">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-400 rounded" /> Bedtime</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-400 rounded" /> Wake</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-500 rounded" /> / target lines</span>
      </div>
    </div>
  );
};
