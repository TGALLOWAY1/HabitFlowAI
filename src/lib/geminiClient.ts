/**
 * Gemini BYOK Client
 *
 * Manages the user's Gemini API key (stored only in localStorage)
 * and provides a client function to fetch the weekly AI summary.
 */

import { API_BASE_URL } from './persistenceConfig';
import { getIdentityHeaders } from './persistenceClient';
import { fetchEntries } from '../api/journal';
import type { JournalEntry } from '../models/persistenceTypes';
import type { WeeklyAIReviewResponse } from '../shared/weeklyAiReview';
import type { AIJournalReviewResponse } from '../shared/aiJournalReview';

const GEMINI_KEY_STORAGE = 'habitflow_gemini_api_key';

export function getGeminiApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
}

export function setGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
  } else {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
  }
}

export function hasGeminiApiKey(): boolean {
  return getGeminiApiKey().length > 0;
}

export interface WeeklySummaryResponse {
  summary: string;
  period: { start: string; end: string };
  habitDaysTracked: number;
  journalEntriesCount: number;
}

export interface JournalSummaryResponse {
  summary: string;
  period: { start: string; end: string };
  journalEntriesCount: number;
  templatesUsed: string[];
  entryId: string;
}

export async function fetchJournalSummary(): Promise<JournalSummaryResponse> {
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    throw new Error('No Gemini API key configured. Add your key in Settings.');
  }

  const url = `${API_BASE_URL}/ai/journal-summary`;
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getIdentityHeaders(),
    },
    body: JSON.stringify({ geminiApiKey }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `Failed to generate journal summary (${response.status})`,
    );
  }

  return response.json();
}

/**
 * Check for a recent AI weekly summary journal entry (within the last 7 days).
 */
export async function fetchLatestJournalSummaryEntry(): Promise<JournalEntry | null> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const startDate = sevenDaysAgo.toISOString().slice(0, 10);
  const entries = await fetchEntries({ startDate });
  return entries.find(e => e.templateId === 'ai-weekly-summary') ?? null;
}

/**
 * Generate a structured, grounded Weekly AI Review.
 *
 * @param weekStart Any day within the desired week (YYYY-MM-DD). Omit for the current week.
 */
export async function fetchWeeklyAIReview(weekStart?: string): Promise<WeeklyAIReviewResponse> {
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    throw new Error('No Gemini API key configured. Add your key in Settings.');
  }

  const timeZone =
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;

  const url = `${API_BASE_URL}/ai/weekly-review`;
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getIdentityHeaders(),
    },
    body: JSON.stringify({ geminiApiKey, weekStart, timeZone }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `Failed to generate weekly review (${response.status})`,
    );
  }

  return response.json();
}

/**
 * Generate a structured, grounded AI Journal Review for a date range.
 *
 * @param rangeStart Start of the range (YYYY-MM-DD).
 * @param rangeEnd   End of the range, inclusive (YYYY-MM-DD).
 */
export async function fetchJournalReview(
  rangeStart: string,
  rangeEnd: string,
): Promise<AIJournalReviewResponse> {
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    throw new Error('No Gemini API key configured. Add your key in Settings.');
  }

  const url = `${API_BASE_URL}/ai/journal-review`;
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getIdentityHeaders(),
    },
    body: JSON.stringify({ geminiApiKey, rangeStart, rangeEnd }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `Failed to generate journal review (${response.status})`,
    );
  }

  return response.json();
}

export async function fetchWeeklySummary(): Promise<WeeklySummaryResponse> {
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    throw new Error('No Gemini API key configured. Add your key in Settings.');
  }

  const url = `${API_BASE_URL}/ai/weekly-summary`;
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getIdentityHeaders(),
    },
    body: JSON.stringify({ geminiApiKey }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `Failed to generate summary (${response.status})`,
    );
  }

  return response.json();
}
