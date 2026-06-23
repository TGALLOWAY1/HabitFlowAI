/**
 * Insights AI Review — shared contract
 *
 * A grounded, forward-looking AI narrative built ONLY from the cross-domain
 * insights the app already computes (correlations, linear-trend predictions,
 * medication adherence, metric averages, discoveries). It explains what the
 * numbers mean in plain language and suggests small, realistic next steps —
 * always framed as correlation, never causation.
 *
 * Used by the server route that generates it (Gemini BYOK) and the AI Review tab.
 */

import type { ReviewConfidence } from './weeklyAiReview';

export interface InsightsReviewPattern {
  /** Short headline, e.g. "Exercise days track with higher mood". */
  title: string;
  /** The specific computed evidence supporting it. */
  evidence: string;
  /** How strongly the data supports it. */
  confidence: ReviewConfidence;
}

export interface InsightsReviewRecommendation {
  /** Short, concrete action headline. */
  title: string;
  /** Why this is suggested, tied to the computed insights. */
  reason: string;
  /** A small, behaviorally realistic next step. */
  suggestedAction: string;
}

export interface InsightsAIReview {
  /** Window analyzed (days). */
  rangeDays: number;
  /** Window bounds (YYYY-MM-DD, inclusive). */
  rangeStart: string;
  rangeEnd: string;
  /** Plain-language narrative of what the insights show (1–3 short paragraphs). */
  summary: string;
  /** Objective findings drawn straight from the computed correlations/trends. */
  keyFindings: string[];
  /** Inferred relationships, each with a confidence level. */
  patterns: InsightsReviewPattern[];
  /** Forward-looking, caveated read of the trend predictions. */
  outlook: string[];
  /** A small number (max 5) of grounded, actionable suggestions. */
  recommendations: InsightsReviewRecommendation[];
  /** Honest notes about where data was too thin to draw conclusions. */
  dataLimitations: string[];
}

export interface InsightsAIReviewResponse {
  review: InsightsAIReview;
  meta: {
    rangeDays: number;
    rangeStart: string;
    rangeEnd: string;
    daysWithCheckins: number;
    correlationsFound: number;
  };
}
