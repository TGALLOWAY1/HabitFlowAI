import React, { useMemo } from 'react';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { TrendDataPoint } from '../../lib/analyticsClient';

interface TrendChartProps {
  data: TrendDataPoint[] | null;
  loading: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = ({ data, loading }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Compute rolling 4-week average
    const points = data.map((d, i) => {
      const windowSize = Math.min(4, i + 1);
      const windowStart = i - windowSize + 1;
      let sum = 0;
      for (let j = windowStart; j <= i; j++) {
        sum += data[j].completionRate;
      }
      return {
        ...d,
        displayRate: Math.round(d.completionRate * 100),
        rollingAvg: Math.round((sum / windowSize) * 100),
      };
    });

    // Find highest and lowest weeks
    let maxIdx = 0, minIdx = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i].displayRate > points[maxIdx].displayRate) maxIdx = i;
      if (points[i].displayRate < points[minIdx].displayRate) minIdx = i;
    }

    // Trend direction (last 4 weeks vs prior 4)
    let trendDir: 'up' | 'down' | 'stable' = 'stable';
    if (points.length >= 4) {
      const recent = points.slice(-2).reduce((s, p) => s + p.displayRate, 0) / 2;
      const prior = points.slice(-4, -2).reduce((s, p) => s + p.displayRate, 0) / 2;
      const delta = recent - prior;
      if (delta > 3) trendDir = 'up';
      else if (delta < -3) trendDir = 'down';
    }

    return { points, maxIdx, minIdx, trendDir };
  }, [data]);

  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Completion Trend</h3>
        <div className="h-52 bg-neutral-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Completion Trend</h3>
        <p className="text-neutral-500 text-sm">No trend data available</p>
      </div>
    );
  }

  const { points, maxIdx, minIdx, trendDir } = chartData;

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-neutral-400">Completion Trend</h3>
        <div className={`flex items-center gap-1 text-xs font-medium ${
          trendDir === 'up' ? 'text-emerald-400' : trendDir === 'down' ? 'text-red-400' : 'text-blue-400'
        }`}>
          {trendDir === 'up' && <><TrendingUp size={12} /> Improving</>}
          {trendDir === 'down' && <><TrendingDown size={12} /> Declining</>}
          {trendDir === 'stable' && <><Minus size={12} /> Stable</>}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={points} margin={{ top: 10, right: 5, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="completionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
          <XAxis
            dataKey="week"
            tick={{ fill: '#737373', fontSize: 10 }}
            tickFormatter={(v: string) => v.split('-')[1] || v}
          />
          <YAxis
            tick={{ fill: '#737373', fontSize: 10 }}
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: 8 }}
            labelStyle={{ color: '#a3a3a3' }}
            formatter={(value: number, name: string) => {
              const label = name === 'rollingAvg' ? '4-Week Avg' : 'Completion';
              return [`${value}%`, label];
            }}
          />
          <Area
            type="monotone"
            dataKey="displayRate"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#completionGradient)"
          />
          <Line
            type="monotone"
            dataKey="rollingAvg"
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
          />
          {/* Highest week marker */}
          <ReferenceDot
            x={points[maxIdx].week}
            y={points[maxIdx].displayRate}
            r={5}
            fill="#10b981"
            stroke="#fff"
            strokeWidth={2}
          />
          {/* Lowest week marker */}
          <ReferenceDot
            x={points[minIdx].week}
            y={points[minIdx].displayRate}
            r={5}
            fill="#ef4444"
            stroke="#fff"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-2 text-[10px] text-neutral-500">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 rounded" /> Completion Rate</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-500 rounded border-dashed" /> 4-Week Avg</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Best</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Lowest</span>
      </div>
    </div>
  );
};
