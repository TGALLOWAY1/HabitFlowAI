/**
 * Gemini BYOK Client
 *
 * Manages the user's Gemini API key (stored only in localStorage)
 * and provides a client function to fetch the weekly AI summary.
 */

import { API_BASE_URL } from './persistenceConfig';
import { getIdentityHeaders } from './persistenceClient';

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
