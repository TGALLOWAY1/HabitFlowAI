import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import {
  fetchHabitSummary,
  fetchHabitHeatmap,
  fetchHabitTrends,
  fetchHabitCategoryBreakdown,
  fetchHabitInsights,
  fetchRoutineSummary,
  fetchGoalSummary,
  type HabitAnalyticsSummary,
  type HeatmapResponse,
  type TrendDataPoint,
  type CategoryBreakdownItem,
  type Insight,
  type RoutineAnalyticsSummary,
  type GoalAnalyticsSummary,
} from '../lib/analyticsClient';
import { SummaryCards } from '../components/analytics/SummaryCards';
import { StreaksSection } from '../components/analytics/StreaksSection';
import { AnalyticsHeatmap } from '../components/analytics/AnalyticsHeatmap';
import { TrendChart } from '../components/analytics/TrendChart';
import { CategoryBreakdown } from '../components/analytics/CategoryBreakdown';
import { BehaviorPatterns } from '../components/analytics/BehaviorPatterns';
import { AchievementsSection } from '../components/analytics/AchievementsSection';
import { InsightsPanel } from '../components/analytics/InsightsPanel';
import { RoutineAnalytics } from '../components/analytics/RoutineAnalytics';
import { GoalAnalytics } from '../components/analytics/GoalAnalytics';

const BETA_EMAIL = 'tj.galloway1@gmail.com';

type TimeRange = 30 | 90 | 365;
type AnalyticsTab = 'habits' | 'routines' | 'goals';

interface AnalyticsPageProps {
  onBack: () => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ onBack }) => {
  const { user } = useAuth();
  const isAuthorized = user?.email?.toLowerCase() === BETA_EMAIL;

  const [activeTab, setActiveTab] = useState<AnalyticsTab>('habits');
  const [timeRange, setTimeRange] = useState<TimeRange>(90);
  const [loading, setLoading] = useState(true);

  // Habits state
  const [summary, setSummary] = useState<HabitAnalyticsSummary | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapResponse | null>(null);
  const [trends, setTrends] = useState<TrendDataPoint[] | null>(null);
  const [categories, setCategories] = useState<CategoryBreakdownItem[] | null>(null);
  const [insights, setInsights] = useState<Insight[] | null>(null);

  // Routines state
  const [routineData, setRoutineData] = useState<RoutineAnalyticsSummary | null>(null);

  // Goals state
  const [goalData, setGoalData] = useState<GoalAnalyticsSummary | null>(null);

  const loadHabitData = useCallback(async (days: TimeRange) => {
    setLoading(true);
    try {
      const [s, h, t, c, i] = await Promise.all([
        fetchHabitSummary(days),
        fetchHabitHeatmap(days),
        fetchHabitTrends(days),
        fetchHabitCategoryBreakdown(days),
        fetchHabitInsights(days),
      ]);
      setSummary(s);
      setHeatmap(h);
      setTrends(t);
      setCategories(c);
      setInsights(i);
    } catch (err) {
      console.error('[AnalyticsPage] Failed to load habit analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoutineData = useCallback(async (days: TimeRange) => {
    setLoading(true);
    try {
      const data = await fetchRoutineSummary(days);
      setRoutineData(data);
    } catch (err) {
      console.error('[AnalyticsPage] Failed to load routine analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGoalData = useCallback(async (days: TimeRange) => {
    setLoading(true);
    try {
      const data = await fetchGoalSummary(days);
      setGoalData(data);
    } catch (err) {
      console.error('[AnalyticsPage] Failed to load goal analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthorized) {
      onBack();
      return;
    }
    if (activeTab === 'habits') loadHabitData(timeRange);
    else if (activeTab === 'routines') loadRoutineData(timeRange);
    else if (activeTab === 'goals') loadGoalData(timeRange);
  }, [isAuthorized, onBack, activeTab, timeRange, loadHabitData, loadRoutineData, loadGoalData]);

  if (!isAuthorized) return null;

  const rangeOptions: { value: TimeRange; label: string }[] = [
    { value: 30, label: '30d' },
    { value: 90, label: '90d' },
    { value: 365, label: '1y' },
  ];

  const tabs: { value: AnalyticsTab; label: string }[] = [
    { value: 'habits', label: 'Habits' },
    { value: 'routines', label: 'Routines' },
    { value: 'goals', label: 'Goals' },
  ];

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-neutral-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold text-white">Analytics (Beta)</h2>
        </div>
        <div className="flex bg-neutral-800 rounded-lg p-0.5">
          {rangeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                timeRange === opt.value
                  ? 'bg-emerald-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex bg-neutral-800/50 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.value
                ? 'bg-neutral-700 text-white'
                : 'text-neutral-400 hover:text-neutral-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'habits' && (
        <>
          <SummaryCards data={summary} loading={loading} />
          <StreaksSection data={summary} loading={loading} />
          <AnalyticsHeatmap data={heatmap} loading={loading} />
          <TrendChart data={trends} loading={loading} />
          <CategoryBreakdown data={categories} loading={loading} />
          <BehaviorPatterns data={summary?.behaviorPatterns ?? null} loading={loading} />
          <AchievementsSection data={summary?.achievements ?? null} loading={loading} />
          <InsightsPanel data={insights} loading={loading} />
        </>
      )}

      {activeTab === 'routines' && (
        <RoutineAnalytics data={routineData} loading={loading} />
      )}

      {activeTab === 'goals' && (
        <GoalAnalytics data={goalData} loading={loading} />
      )}
    </div>
  );
};
