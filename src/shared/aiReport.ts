/**
 * AI Report — shared contract
 *
 * A persisted, browsable record of an AI-generated insight (Weekly Review or
 * Journal Summary). Unlike derived views, these are genuine generated artifacts:
 * each generation is archived so the user can revisit past reports ("history")
 * without spending another Gemini call.
 *
 * Used by the server routes that persist reports and the frontend history UI.
 */

import type { WeeklyAIReview } from './weeklyAiReview';

/** The kinds of AI report we archive. */
export type AIReportKind = 'weekly_review' | 'journal_summary';

/** Kind-specific payloads. */
export interface WeeklyReviewPayload {
  review: WeeklyAIReview;
}

export interface JournalSummaryPayload {
  /** Markdown summary text. */
  summary: string;
  journalEntriesCount: number;
}

export type AIReportPayload = WeeklyReviewPayload | JournalSummaryPayload;

/** A full, persisted AI report (with its kind-specific payload). */
export interface AIReport {
  id: string;
  userId: string;
  kind: AIReportKind;
  /** Period covered by the report (YYYY-MM-DD, inclusive). */
  periodStart: string;
  periodEnd: string;
  /** Short, human-friendly preview used in the history list. */
  preview: string;
  /** ISO timestamp the report was generated. */
  createdAt: string;
  /** Kind-specific content. */
  payload: AIReportPayload;
}

/** Lightweight list item for the history list (omits the full payload). */
export interface AIReportListItem {
  id: string;
  kind: AIReportKind;
  periodStart: string;
  periodEnd: string;
  preview: string;
  createdAt: string;
}

/** Build a short preview string from a payload (best-effort, bounded length). */
export function buildReportPreview(kind: AIReportKind, payload: AIReportPayload): string {
  const clamp = (s: string, n = 160): string => {
    const flat = s.replace(/\s+/g, ' ').trim();
    return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
  };

  if (kind === 'weekly_review') {
    const review = (payload as WeeklyReviewPayload).review;
    return clamp(review.summary || review.facts[0] || 'Weekly review');
  }
  return clamp((payload as JournalSummaryPayload).summary || 'Journal summary');
}
