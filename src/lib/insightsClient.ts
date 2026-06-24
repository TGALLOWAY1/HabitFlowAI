/**
 * Insights API Client
 *
 * Frontend client for the cross-domain Insights endpoints (/api/insights/*) and
 * the Insights AI Review (Gemini BYOK). Response shapes mirror the server's
 * insightsService output structurally.
 */

import { API_BASE_URL } from './persistenceConfig';
import { getLocalTimeZone, getIdentityHeaders } from './persistenceClient';
import { getGeminiApiKey } from './geminiClient';
import type { InsightsAIReview } from '../shared/insightsAiReview';

async function insightsRequest<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getIdentityHeaders() },
  });
  if (!response.ok) {
    throw new Error(`Insights API error: ${response.status}`);
  }
  return response.json();
}

function buildParams(days: number): string {
  return `?days=${days}&timeZone=${encodeURIComponent(getLocalTimeZone())}`;
}

// ─── Types (mirror src/server/services/insightsService.ts) ───────────────────────

export interface InsightsCorrelation {
  factorId: string;
  factorName: string;
  factorSource: string;
  outcomeKey: string;
  outcomeLabel: string;
  factorPresentMean: number;
  factorAbsentMean: number;
  meanDifference: number;
  effectSize: number;
  direction: 'improves' | 'worsens';
  nPresent: number;
  nAbsent: number;
  message: string;
}

export interface MetricAverage {
  metricKey: string;
  label: string;
  average: number;
  sampleSize: number;
  higherIsBetter: boolean;
}

export interface Discovery {
  id: string;
  type: 'positive' | 'negative' | 'milestone' | 'info';
  title: string;
  message: string;
}

export interface InsightsOverview {
  rangeDays: number;
  daysWithCheckins: number;
  metricAverages: MetricAverage[];
  topCorrelations: InsightsCorrelation[];
  discoveries: Discovery[];
}

export interface MetricPredictionPoint {
  dayKey: string;
  value: number;
}

export interface MetricPrediction {
  metricKey: string;
  label: string;
  higherIsBetter: boolean;
  sampleSize: number;
  currentValue: number | null;
  slopePerWeek: number | null;
  predictedValue: number | null;
  horizonDays: number;
  direction: 'improving' | 'declining' | 'stable' | null;
  confidence: 'low' | 'medium' | 'high';
  fitQuality: number | null;
  trend: MetricPredictionPoint[];
}

export interface MedicationAdherence {
  medicationId: string;
  name: string;
  dosage: string | null;
  takenDays: number;
  loggedDays: number;
  adherencePercent: number | null;
  currentTakenStreak: number;
}

export interface MedicationInsights {
  rangeDays: number;
  adherence: MedicationAdherence[];
  correlations: InsightsCorrelation[];
}

// ─── API functions ───────────────────────────────────────────────────────────

export async function fetchInsightsOverview(days = 90): Promise<InsightsOverview> {
  return insightsRequest(`/insights/overview${buildParams(days)}`);
}

export async function fetchInsightsCorrelations(
  days = 90,
): Promise<{ correlations: InsightsCorrelation[]; rangeDays: number }> {
  return insightsRequest(`/insights/correlations${buildParams(days)}`);
}

export async function fetchInsightsHabits(
  days = 90,
): Promise<{ correlations: InsightsCorrelation[]; rangeDays: number }> {
  return insightsRequest(`/insights/habits${buildParams(days)}`);
}

export async function fetchInsightsMedications(days = 90): Promise<MedicationInsights> {
  return insightsRequest(`/insights/medications${buildParams(days)}`);
}

export async function fetchInsightsPredictions(
  days = 90,
): Promise<{ predictions: MetricPrediction[]; rangeDays: number }> {
  return insightsRequest(`/insights/predictions${buildParams(days)}`);
}

/**
 * Generate a grounded, forward-looking Insights AI Review (Gemini BYOK).
 */
export async function fetchInsightsAIReview(days = 90): Promise<{ review: InsightsAIReview }> {
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    throw new Error('No Gemini API key configured. Add your key in Settings.');
  }
  const timeZone = getLocalTimeZone();
  const response = await fetch(`${API_BASE_URL}/ai/insights-review`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getIdentityHeaders() },
    body: JSON.stringify({ geminiApiKey, days, timeZone }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Failed to generate insights review (${response.status})`);
  }
  return response.json();
}
