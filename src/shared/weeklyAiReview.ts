/**
 * Weekly AI Review — shared contract
 *
 * Used by both the server route that generates the review (Gemini BYOK)
 * and the frontend that renders it. The shape deliberately separates
 * observed facts (summary/wins/struggles), inferred patterns (with an
 * explicit confidence level), and forward-looking recommendations so the
 * UI can present grounded feedback without conflating the three.
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
  /** Short, human-readable narrative of the week. */
  summary: string;
  /** 2–5 positive patterns grounded in the data. */
  wins: string[];
  /** 2–5 obstacles or weak spots grounded in the data. */
  struggles: string[];
  /** Inferred relationships in the data, each with a confidence level. */
  patterns: WeeklyReviewPattern[];
  /** Practical, specific suggestions for next week. */
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
