import React from 'react';
import { Lightbulb, Trophy, AlertTriangle } from 'lucide-react';
import type { Insight } from '../../lib/analyticsClient';

interface InsightsPanelProps {
  data: Insight[] | null;
  loading: boolean;
}

const iconMap = {
  info: Lightbulb,
  success: Trophy,
  warning: AlertTriangle,
};

const colorMap = {
  info: 'text-blue-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
};

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Insights</h3>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-neutral-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Insights</h3>
        <p className="text-neutral-500 text-sm">Not enough data for insights yet</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
      <h3 className="text-sm font-medium text-neutral-400 mb-3">Insights</h3>
      <div className="space-y-2">
        {data.map((insight, i) => {
          const Icon = iconMap[insight.type];
          const color = colorMap[insight.type];
          return (
            <div
              key={i}
              className="flex items-start gap-3 p-3 bg-neutral-800/50 rounded-xl"
            >
              <Icon size={16} className={`${color} shrink-0 mt-0.5`} />
              <span className="text-sm text-neutral-200">{insight.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
