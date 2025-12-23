import React, { useState, useEffect } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import type { Routine } from '../../../models/persistenceTypes';
import { ReadinessSnapshot } from './ReadinessSnapshot';
import { SleepEnergyTrends } from './SleepEnergyTrends';
import { QuickLog } from './QuickLog';
import { ActionCards } from './ActionCards';
import { RoutinePreviewModal } from '../../RoutinePreviewModal';
import { PersonaSwitcher } from '../PersonaSwitcher';
import { Heatmap } from '../../Heatmap';
import { GoalPulseCard } from '../../goals/GoalPulseCard';
import { CategoryCompletionRow } from '../../CategoryCompletionRow';
import { useProgressOverview } from '../../../lib/useProgressOverview';
import { useHabitStore } from '../../../store/HabitContext';

type Props = {
  onOpenCheckIn: () => void;
  onNavigateWellbeingHistory?: () => void;
  onStartRoutine?: (routine: Routine) => void;
  onCreateGoal?: () => void;
  onViewGoal?: (goalId: string) => void;
  onSelectCategory?: (categoryId: string) => void;
};

export const FitnessDashboard: React.FC<Props> = ({ 
  onOpenCheckIn, 
  onNavigateWellbeingHistory, 
  onStartRoutine,
  onCreateGoal,
  onViewGoal,
  onSelectCategory,
}) => {
  // DEV ONLY: Render counter to verify readiness sliders don't cause re-renders
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.count('FitnessDashboard render');
  }

  const [previewRoutine, setPreviewRoutine] = useState<Routine | undefined>(undefined);
  const { habits, categories } = useHabitStore();
  const { data: progressData, loading: progressLoading } = useProgressOverview();
  
  // Activity Heatmap state (reused from legacy dashboard)
  const [activityTab, setActivityTab] = useState<'overall' | 'category'>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('activityTab') as 'overall' | 'category') || 'overall';
  });

  const [heatmapRange, setHeatmapRange] = useState<'year' | '90d' | '30d'>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('heatmapRange') as 'year' | '90d' | '30d') || '30d';
  });

  const [categoryRange, setCategoryRange] = useState<'7d' | '14d'>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('categoryRange') as '7d' | '14d') || '14d';
  });

  // Helper to update URL without page reload
  const updateUrlParams = (updates: Record<string, string>, method: 'push' | 'replace' = 'replace') => {
    const url = new URL(window.location.href);
    Object.entries(updates).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    if (method === 'push') {
      window.history.pushState(null, '', url.toString());
    } else {
      window.history.replaceState(null, '', url.toString());
    }
  };

  const handleTabChange = (tab: 'overall' | 'category') => {
    setActivityTab(tab);
    updateUrlParams({ activityTab: tab }, 'push');
  };

  const handleHeatmapRangeChange = (range: 'year' | '90d' | '30d') => {
    setHeatmapRange(range);
    updateUrlParams({ heatmapRange: range }, 'replace');
  };

  const handleCategoryRangeChange = (range: '7d' | '14d') => {
    setCategoryRange(range);
    updateUrlParams({ categoryRange: range }, 'replace');
  };

  const handleViewRoutine = (routine: Routine) => {
    setPreviewRoutine(routine);
  };

  const handleStartFromPreview = (routine: Routine) => {
    setPreviewRoutine(undefined);
    if (onStartRoutine) {
      onStartRoutine(routine);
    }
  };

  // DEV ONLY: Debug helper to check container heights (temporary)
  useEffect(() => {
    if (import.meta.env.DEV) {
      const container = document.querySelector('[data-fitness-dashboard-container]');
      if (container) {
        // eslint-disable-next-line no-console
        console.log('[Fitness Dashboard] Container height:', {
          scrollHeight: container.scrollHeight,
          clientHeight: container.clientHeight,
          offsetHeight: (container as HTMLElement).offsetHeight,
          viewportHeight: window.innerHeight,
          canScroll: container.scrollHeight > container.clientHeight,
        });
      }
    }
  }, []);

  return (
    <>
      {/* Fitness dashboard layout per canonical contract: @docs/layouts/fitness_dashboard_layout_v2.md */}
      <div 
        data-fitness-dashboard-container
        className={`space-y-6 overflow-y-auto pb-20 ${import.meta.env.DEV ? 'border border-emerald-500/20' : ''}`}
      >
        {/* Persona Header actions */}
        <div className="flex justify-end gap-2">
          <PersonaSwitcher />
          <button
            onClick={onOpenCheckIn}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors text-sm font-medium border border-white/5"
          >
            <Activity size={16} className="text-emerald-400" />
            Daily Check-in
          </button>
          {onNavigateWellbeingHistory && (
            <button
              onClick={onNavigateWellbeingHistory}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors text-sm font-medium border border-white/5"
            >
              <Activity size={16} className="text-emerald-400" />
              Wellbeing History
            </button>
          )}
        </div>

        {/* Row 1: Daily Context + Quick Log (8/12 + 4/12) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Left: Subjective Readiness Snapshot (8/12 columns) */}
          <div className="md:col-span-8">
            <ReadinessSnapshot />
          </div>
          {/* Right: Quick Log (4/12 columns) */}
          <div className="md:col-span-4">
            <QuickLog />
          </div>
        </div>

        {/* Row 2: Sleep & Energy Trends + Action Cards (8/12 + 4/12) - V1.2 layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Left: Sleep & Energy Trends (8/12 columns) */}
          <div className="md:col-span-8 min-w-0">
            <SleepEnergyTrends />
          </div>
          {/* Right: Action Cards in 2×2 grid (4/12 columns) */}
          <div className="md:col-span-4">
            <ActionCards onStartRoutine={onStartRoutine} onViewRoutine={handleViewRoutine} />
          </div>
        </div>

        {/* Row 3: Goals at a Glance (full width) */}
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Goals at a glance</h3>
            <button
              onClick={() => onViewGoal && onViewGoal('all')}
              className="text-xs text-neutral-500 hover:text-white transition-colors"
            >
              View all
            </button>
          </div>

          {progressLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="text-emerald-500 animate-spin" size={20} />
            </div>
          ) : !progressData || progressData.goalsWithProgress.length === 0 ? (
            <div className="text-center py-6">
              <h4 className="text-neutral-400 text-sm mb-2">No active goals</h4>
              {onCreateGoal && (
                <button
                  onClick={onCreateGoal}
                  className="text-emerald-500 hover:text-emerald-400 text-xs font-medium transition-colors"
                >
                  + Add a goal
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {progressData.goalsWithProgress
                .filter(({ goal }) => !goal.completedAt) // active only
                .slice(0, 4) // max 4
                .map((goalWithProgress) => (
                  <GoalPulseCard
                    key={goalWithProgress.goal.id}
                    goalWithProgress={goalWithProgress}
                    onClick={() => {
                      if (onViewGoal) {
                        onViewGoal(goalWithProgress.goal.id);
                      }
                    }}
                  />
                ))}
            </div>
          )}
        </div>

        {/* Row 4: Activity Heat Map (full width) */}
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-bold text-white">Activity</h3>
              {activityTab === 'overall' ? (
                <select
                  value={heatmapRange}
                  onChange={(e) => handleHeatmapRangeChange(e.target.value as 'year' | '90d' | '30d')}
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
                      onClick={() => handleCategoryRangeChange(r)}
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
                onClick={() => handleTabChange('overall')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  activityTab === 'overall'
                    ? 'bg-neutral-700 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Overall
              </button>
              <button
                onClick={() => handleTabChange('category')}
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
                {categories.map((category) => {
                  const catHabits = habits.filter((h) => h.categoryId === category.id && !h.archived);
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
      </div>

      {/* Routine Preview Modal */}
      <RoutinePreviewModal
        isOpen={!!previewRoutine}
        routine={previewRoutine}
        onClose={() => setPreviewRoutine(undefined)}
        onStart={handleStartFromPreview}
      />
    </>
  );
};

