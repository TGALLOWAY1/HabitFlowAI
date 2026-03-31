import React from 'react';
import type { CategoryBreakdownItem } from '../../lib/analyticsClient';

interface CategoryBreakdownProps {
  data: CategoryBreakdownItem[] | null;
  loading: boolean;
}

function tailwindToHex(tw: string): string {
  // Map common Tailwind bg classes to hex for the bar
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
  return map[tw] ?? '#10b981';
}

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">By Category</h3>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 bg-neutral-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">By Category</h3>
        <p className="text-neutral-500 text-sm">No category data available</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
      <h3 className="text-sm font-medium text-neutral-400 mb-3">By Category</h3>
      <div className="space-y-3">
        {data.map(item => {
          const pct = Math.round(item.completionRate * 100);
          const color = tailwindToHex(item.color);
          return (
            <div key={item.categoryId}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white font-medium">{item.categoryName}</span>
                <span className="text-xs text-neutral-400">{pct}%</span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {item.totalCompleted} / {item.totalScheduled} completed
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
