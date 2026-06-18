/**
 * Weekly AI Review — shared contract
 *
 * The single, comprehensive weekly AI report for HabitFlow. It both tells the
 * story of the week (a human-readable "Week at a Glance" narrative) and provides
 * evidence-based analysis. The shape deliberately separates the narrative recap,
 * objective facts, inferred patterns (each with an explicit confidence level),
 * journal themes, wins, areas for attention, and forward-looking recommendations
 * so the UI can present grounded feedback without conflating them.
 *
 * Used by both the server route that generates the review (Gemini BYOK) and the
 * frontend that renders it.
 */

export type ReviewConfidence = 'low' | 'medium' | 'high';

export interface WeeklyReviewPattern {
  /** Short headline for the pattern, e.g. "Workouts dip after poor sleep". */
  title: string;
  /** The specific observed data that supports the pattern. */
  evidence: string;
  /** How strongly the data supports the pattern. */
  confidence: ReviewConfidence;
}

export interface WeeklyReviewRecommendation {
  /** Short, concrete action headline. */
  title: string;
  /** Why this is suggested, tied to the observed data. */
  reason: string;
  /** A small, behaviorally realistic next step. */
  suggestedAction: string;
}

export interface WeeklyAIReview {
  /** Monday of the reviewed week (YYYY-MM-DD). */
  weekStart: string;
  /** Sunday of the reviewed week (YYYY-MM-DD). */
  weekEnd: string;
  /**
   * Section 1 — "Week at a Glance": a natural-language narrative recap of the
   * week (1–3 short paragraphs, no recommendations). Tells the story of the week.
   */
  summary: string;
  /** Section 2 — Facts: objective, measurable observations supported by the data. */
  facts: string[];
  /** Section 3 — Patterns: inferred relationships in the data, each with a confidence level. */
  patterns: WeeklyReviewPattern[];
  /** Section 4 — Journal Themes: recurring topics and emotional trends from journaling. */
  journalThemes: string[];
  /** Section 5 — Wins: the most meaningful accomplishments, grounded in the data. */
  wins: string[];
  /** Section 6 — Areas for Attention: issues, risks, or recurring challenges. */
  areasForAttention: string[];
  /** Section 7 — Recommendations: a small number (max 3–5) of actionable suggestions. */
  recommendations: WeeklyReviewRecommendation[];
  /** Honest notes about where data was too thin to draw conclusions. */
  dataLimitations: string[];
}

/** Server response wrapper: the review plus lightweight metadata. */
export interface WeeklyAIReviewResponse {
  review: WeeklyAIReview;
  meta: {
    weekStart: string;
    weekEnd: string;
    habitsTracked: number;
    daysWithHabitData: number;
    journalEntries: number;
    wellbeingDaysRecorded: number;
  };
}
