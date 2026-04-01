import React, { useState } from 'react';
import { useHabitStore } from '../store/HabitContext';
import { Heatmap } from './Heatmap';
import { CategoryCompletionRow } from './CategoryCompletionRow';

interface ActivitySectionProps {
  onSelectCategory?: (categoryId: string) => void;
}

export const ActivitySection: React.FC<ActivitySectionProps> = ({ onSelectCategory }) => {
  const { habits, categories } = useHabitStore();
  const [activityTab, setActivityTab] = useState<'overall' | 'category'>('overall');
  const [heatmapRange, setHeatmapRange] = useState<'year' | '90d' | '30d'>('30d');
  const [categoryRange, setCategoryRange] = useState<'7d' | '14d'>('14d');

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-bold text-white">Activity</h3>
          {activityTab === 'overall' ? (
            <select
              value={heatmapRange}
              onChange={(e) => setHeatmapRange(e.target.value as 'year' | '90d' | '30d')}
              className="bg-neutral-800 text-xs text-neutral-300 border border-white/5 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-500/50"
            >
              <option value="year">Last Year</option>
              <option value="90d">Last 90 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          ) : (
            <div className="flex bg-neutral-800 rounded-md p-0.5 border border-white/5">
              {(['7d', '14d'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setCategoryRange(r)}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                    categoryRange === r
                      ? 'bg-neutral-700 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex p-1 bg-neutral-800 rounded-lg self-start lg:self-auto">
          <button
            onClick={() => setActivityTab('overall')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              activityTab === 'overall'
                ? 'bg-neutral-700 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Overall
          </button>
          <button
            onClick={() => setActivityTab('category')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              activityTab === 'category'
                ? 'bg-neutral-700 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            By Category
          </button>
        </div>
      </div>

      <div className="animate-in fade-in duration-300">
        {activityTab === 'overall' ? (
          <Heatmap range={heatmapRange} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {categories.map(category => {
              const catHabits = habits.filter(h => h.categoryId === category.id && !h.archived);
              if (catHabits.length === 0) return null;

              return (
                <CategoryCompletionRow
                  key={category.id}
                  category={category}
                  habits={catHabits}
                  range={categoryRange}
                  onClick={() => onSelectCategory && onSelectCategory(category.id)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
