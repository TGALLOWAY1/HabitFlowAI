import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { CategoryBreakdownItem } from '../../lib/analyticsClient';

interface CategoryBreakdownProps {
  data: CategoryBreakdownItem[] | null;
  loading: boolean;
}

function resolveColor(color: string): string {
  // If it's already a hex/rgb/hsl color, use it directly
  if (!color.startsWith('bg-')) return color;

  const map: Record<string, string> = {
    'bg-emerald-500': '#10b981',
    'bg-blue-500': '#3b82f6',
    'bg-purple-500': '#a855f7',
    'bg-red-500': '#ef4444',
    'bg-orange-500': '#f97316',
    'bg-yellow-500': '#eab308',
    'bg-pink-500': '#ec4899',
    'bg-teal-500': '#14b8a6',
    'bg-indigo-500': '#6366f1',
    'bg-cyan-500': '#06b6d4',
    'bg-neutral-500': '#737373',
  };
  return map[color] ?? '#737373';
}

const statusColors: Record<string, string> = {
  'Strong': 'bg-emerald-500/15 text-emerald-400',
  'Improving': 'bg-blue-500/15 text-blue-400',
  'Stable': 'bg-neutral-500/15 text-neutral-400',
  'Needs Attention': 'bg-amber-500/15 text-amber-400',
  'Neglected': 'bg-red-500/15 text-red-400',
};

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

const trendColors = {
  up: 'text-emerald-400',
  down: 'text-red-400',
  stable: 'text-neutral-500',
};

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Category Performance</h3>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-neutral-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Category Performance</h3>
        <p className="text-neutral-500 text-sm">No category data available</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
      <h3 className="text-sm font-medium text-neutral-400 mb-4">Category Performance</h3>

      <div className="space-y-3">
        {data.map(item => {
          const pct = Math.round(item.completionRate * 100);
          const color = resolveColor(item.color);
          const TrendIcon = trendIcons[item.trendDirection];
          const trendColor = trendColors[item.trendDirection];
          const statusStyle = statusColors[item.status] ?? statusColors['Stable'];

          return (
            <div key={item.categoryId} className="flex items-center gap-3">
              {/* Category color dot + name */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium truncate" style={{ color }}>{item.categoryName}</span>
              </div>

              {/* Completion % */}
              <div className="text-lg font-bold text-white w-14 text-right">{pct}%</div>

              {/* Trend arrow */}
              <TrendIcon size={14} className={`${trendColor} shrink-0`} />

              {/* Status badge */}
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${statusStyle}`}>
                {item.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
