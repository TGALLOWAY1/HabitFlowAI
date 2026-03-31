import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TrendDataPoint } from '../../lib/analyticsClient';

interface TrendChartProps {
  data: TrendDataPoint[] | null;
  loading: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Completion Trend</h3>
        <div className="h-48 bg-neutral-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Completion Trend</h3>
        <p className="text-neutral-500 text-sm">No trend data available</p>
      </div>
    );
  }

  const chartData = data.map(d => ({
    ...d,
    displayRate: Math.round(d.completionRate * 100),
  }));

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
      <h3 className="text-sm font-medium text-neutral-400 mb-3">Completion Trend</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="completionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
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
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }}
            labelStyle={{ color: '#a3a3a3' }}
            formatter={(value: number) => [`${value}%`, 'Completion']}
          />
          <Area
            type="monotone"
            dataKey="displayRate"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#completionGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
