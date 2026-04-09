import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ArrowLeft, CheckSquare, RefreshCw, Target } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import {
  fetchAllHabitAnalytics,
  fetchRoutineSummary,
  fetchGoalSummary,
  type HabitAnalyticsSummary,
  type TrendDataPoint,
  type CategoryBreakdownItem,
  type Insight,
  type RoutineAnalyticsSummary,
  type GoalAnalyticsSummary,
} from '../lib/analyticsClient';
import { SummaryCards } from '../components/analytics/SummaryCards';
import { StreaksSection } from '../components/analytics/StreaksSection';
import { TrendChart } from '../components/analytics/TrendChart';
import { CategoryBreakdown } from '../components/analytics/CategoryBreakdown';
import { BehaviorPatterns } from '../components/analytics/BehaviorPatterns';
import { AchievementsSection } from '../components/analytics/AchievementsSection';
import { InsightsPanel } from '../components/analytics/InsightsPanel';
import { RoutineAnalytics } from '../components/analytics/RoutineAnalytics';
import { GoalAnalytics } from '../components/analytics/GoalAnalytics';
import { ActivitySection } from '../components/ActivitySection';

const BETA_EMAIL = 'tj.galloway1@gmail.com';

type TimeRange = 7 | 14 | 30 | 'custom';
type AnalyticsTab = 'habits' | 'routines' | 'goals';

function getDaysFromRange(range: TimeRange, customStart: string, customEnd: string): number {
  if (range === 'custom' && customStart && customEnd) {
    const start = new Date(customStart);
    const end = new Date(customEnd);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, Math.min(diff, 365));
  }
  if (typeof range === 'number') return range;
  return 7;
}

interface AnalyticsPageProps {
  onBack: () => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ onBack }) => {
  const { user } = useAuth();
  const isAuthorized = user?.email?.toLowerCase() === BETA_EMAIL;

  const [activeTab, setActiveTab] = useState<AnalyticsTab>('habits');
  const [timeRange, setTimeRange] = useState<TimeRange>(7);
  const [loading, setLoading] = useState(true);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const hasAutoBumped = useRef(false);

  // Habits state
  const [summary, setSummary] = useState<HabitAnalyticsSummary | null>(null);
  const [trends, setTrends] = useState<TrendDataPoint[] | null>(null);
  const [categories, setCategories] = useState<CategoryBreakdownItem[] | null>(null);
  const [insights, setInsights] = useState<Insight[] | null>(null);

  // Routines state
  const [routineData, setRoutineData] = useState<RoutineAnalyticsSummary | null>(null);

  // Goals state
  const [goalData, setGoalData] = useState<GoalAnalyticsSummary | null>(null);

  const loadHabitData = useCallback(async (days: number) => {
    setLoading(true);
    try {
      const result = await fetchAllHabitAnalytics(days);
      setSummary(result.summary);
      setTrends(result.trends);
      setCategories(result.categoryBreakdown);
      setInsights(result.insights);
      const s = result.summary;

      // Smart default: auto-bump to 14d if user has more than 7 days of activity
      if (!hasAutoBumped.current && days === 7 && s.totalActiveDays > 7) {
        hasAutoBumped.current = true;
        setTimeRange(14);
      }
    } catch (err) {
      console.error('[AnalyticsPage] Failed to load habit analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoutineData = useCallback(async (days: number) => {
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

  const loadGoalData = useCallback(async (days: number) => {
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
    const days = getDaysFromRange(timeRange, customStart, customEnd);
    if (timeRange === 'custom' && (!customStart || !customEnd)) return;

    if (activeTab === 'habits') loadHabitData(days);
    else if (activeTab === 'routines') loadRoutineData(days);
    else if (activeTab === 'goals') loadGoalData(days);
  }, [isAuthorized, onBack, activeTab, timeRange, customStart, customEnd, loadHabitData, loadRoutineData, loadGoalData]);

  if (!isAuthorized) return null;

  const tabs: { value: AnalyticsTab; label: string; icon: typeof ArrowLeft }[] = [
    { value: 'habits', label: 'Habits', icon: CheckSquare },
    { value: 'routines', label: 'Routines', icon: RefreshCw },
    { value: 'goals', label: 'Goals', icon: Target },
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
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => {
              const val = e.target.value;
              setTimeRange(val === 'custom' ? 'custom' : Number(val) as 7 | 14 | 30);
            }}
            className="bg-neutral-800 text-xs text-neutral-300 border border-white/5 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-emerald-500/50"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last month</option>
            <option value="custom">Custom range</option>
          </select>
        </div>
      </div>

      {/* Custom date range inputs */}
      {timeRange === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="bg-neutral-800 text-xs text-neutral-300 border border-white/5 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
          <span className="text-neutral-400 text-xs">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="bg-neutral-800 text-xs text-neutral-300 border border-white/5 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>
      )}

      {/* Tab Toggle */}
      <div className="flex gap-4 border-b border-white/5">
        {tabs.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`pb-3 px-3 text-sm font-medium transition-colors relative ${
              activeTab === value ? 'text-emerald-400' : 'text-white/40 hover:text-white/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon size={16} />
              {label}
            </div>
            {activeTab === value && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'habits' && (
        <>
          <SummaryCards data={summary} loading={loading} />
          <StreaksSection data={summary} loading={loading} />
          <ActivitySection />
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
