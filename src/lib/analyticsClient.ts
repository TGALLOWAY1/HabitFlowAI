/**
 * Analytics API Client
 *
 * Frontend client for the analytics endpoints.
 */

import { API_BASE_URL } from './persistenceConfig';
import { getLocalTimeZone, getIdentityHeaders } from './persistenceClient';

async function analyticsRequest<T>(endpoint: string): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getIdentityHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error(`Analytics API error: ${response.status}`);
  }
  return response.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HabitAnalyticsSummary {
  consistencyScore: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  graduatedHabits: number;
}

export interface HeatmapDataPoint {
  dayKey: string;
  completionPercent: number;
  completedCount: number;
  scheduledCount: number;
}

export interface TrendDataPoint {
  week: string;
  completionRate: number;
  totalCompleted: number;
  totalScheduled: number;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  color: string;
  completionRate: number;
  totalCompleted: number;
  totalScheduled: number;
}

export interface Insight {
  type: 'info' | 'success' | 'warning';
  message: string;
}

// ─── API Functions ───────────────────────────────────────────────────────────

function buildParams(days: number): string {
  const timeZone = getLocalTimeZone();
  return `?days=${days}&timeZone=${encodeURIComponent(timeZone)}`;
}

export async function fetchHabitSummary(days = 90): Promise<HabitAnalyticsSummary> {
  return analyticsRequest(`/analytics/habits/summary${buildParams(days)}`);
}

export async function fetchHabitHeatmap(days = 365): Promise<HeatmapDataPoint[]> {
  return analyticsRequest(`/analytics/habits/heatmap${buildParams(days)}`);
}

export async function fetchHabitTrends(days = 90): Promise<TrendDataPoint[]> {
  return analyticsRequest(`/analytics/habits/trends${buildParams(days)}`);
}

export async function fetchHabitCategoryBreakdown(days = 90): Promise<CategoryBreakdownItem[]> {
  return analyticsRequest(`/analytics/habits/category-breakdown${buildParams(days)}`);
}

export async function fetchHabitInsights(days = 90): Promise<Insight[]> {
  return analyticsRequest(`/analytics/habits/insights${buildParams(days)}`);
}

// ─── Routine Analytics ───────────────────────────────────────────────────────

export interface RoutineAnalyticsSummary {
  totalCompleted: number;
  totalStarted: number;
  reliabilityRate: number;
  averageDurationSeconds: number;
  routineBreakdown: Array<{
    routineId: string;
    routineTitle: string;
    completedCount: number;
    averageDurationSeconds: number;
  }>;
}

export async function fetchRoutineSummary(days = 90): Promise<RoutineAnalyticsSummary> {
  return analyticsRequest(`/analytics/routines/summary${buildParams(days)}`);
}

// ─── Goal Analytics ──────────────────────────────────────────────────────────

export interface GoalAnalyticsSummary {
  activeGoals: number;
  completedGoals: number;
  averageProgressPercent: number;
  goalsAtRisk: number;
  goalBreakdown: Array<{
    goalId: string;
    goalTitle: string;
    progressPercent: number;
    isCompleted: boolean;
    isAtRisk: boolean;
  }>;
}

export async function fetchGoalSummary(days = 90): Promise<GoalAnalyticsSummary> {
  return analyticsRequest(`/analytics/goals/summary${buildParams(days)}`);
}
