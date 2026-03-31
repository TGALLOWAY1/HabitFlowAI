import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchHabitSummary,
  fetchHabitHeatmap,
  fetchHabitTrends,
  fetchHabitCategoryBreakdown,
  fetchHabitInsights,
  type HabitAnalyticsSummary,
  type HeatmapDataPoint,
  type TrendDataPoint,
  type CategoryBreakdownItem,
  type Insight,
} from '../lib/analyticsClient';
import { SummaryCards } from '../components/analytics/SummaryCards';
import { AnalyticsHeatmap } from '../components/analytics/AnalyticsHeatmap';
import { TrendChart } from '../components/analytics/TrendChart';
import { CategoryBreakdown } from '../components/analytics/CategoryBreakdown';
import { InsightsPanel } from '../components/analytics/InsightsPanel';

type TimeRange = 30 | 90 | 365;

export const AnalyticsPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>(90);
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<HabitAnalyticsSummary | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapDataPoint[] | null>(null);
  const [trends, setTrends] = useState<TrendDataPoint[] | null>(null);
  const [categories, setCategories] = useState<CategoryBreakdownItem[] | null>(null);
  const [insights, setInsights] = useState<Insight[] | null>(null);

  const loadData = useCallback(async (days: TimeRange) => {
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
      console.error('[AnalyticsPage] Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(timeRange);
  }, [timeRange, loadData]);

  const rangeOptions: { value: TimeRange; label: string }[] = [
    { value: 30, label: '30d' },
    { value: 90, label: '90d' },
    { value: 365, label: '1y' },
  ];

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Analytics</h2>
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

      {/* Summary Cards */}
      <SummaryCards data={summary} loading={loading} />

      {/* Heatmap */}
      <AnalyticsHeatmap data={heatmap} loading={loading} />

      {/* Trend Chart */}
      <TrendChart data={trends} loading={loading} />

      {/* Category Breakdown */}
      <CategoryBreakdown data={categories} loading={loading} />

      {/* Insights */}
      <InsightsPanel data={insights} loading={loading} />
    </div>
  );
};
