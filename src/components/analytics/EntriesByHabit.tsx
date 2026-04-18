import React from 'react';
import type { EntriesByHabitItem } from '../../lib/analyticsClient';
import { resolveColorHex } from '../../utils/categoryColors';

interface EntriesByHabitProps {
  data: EntriesByHabitItem[] | null;
  loading: boolean;
}

export const EntriesByHabit: React.FC<EntriesByHabitProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Entries by Habit</h3>
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
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Entries by Habit</h3>
        <p className="text-neutral-500 text-sm">No entries logged yet</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
      <h3 className="text-sm font-medium text-neutral-400 mb-4">Entries by Habit</h3>

      <div className="space-y-2">
        {data.map(item => {
          const color = resolveColorHex(item.color ?? 'bg-neutral-500');
          return (
            <div key={item.habitId} className="flex items-center gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium text-neutral-200 truncate">{item.name}</span>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold text-white leading-tight">
                  {item.totalEntries.toLocaleString()}
                </div>
                {item.entriesInRange > 0 && (
                  <div className="text-[10px] text-neutral-500 leading-tight">
                    +{item.entriesInRange} in range
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
