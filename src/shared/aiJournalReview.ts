/**
 * AI Journal Review — shared contract
 *
 * Used by both the server route that generates the review (Gemini BYOK)
 * and the frontend that renders it. The shape deliberately separates
 * OBSERVED EVIDENCE (what the entries actually say) from INFERRED THEMES
 * (patterns the model noticed, each with a confidence level) from
 * SUGGESTED NEXT STEPS (forward-looking ideas) so the UI can present
 * grounded, non-clinical feedback without conflating the three.
 *
 * Safety: this is a reflective aid, not a clinical or diagnostic tool.
 * The server prompt forbids diagnoses and instructs the model to surface
 * crisis support guidance (via `crisisNotice`) if entries suggest harm.
 */

export type ReviewConfidence = 'low' | 'medium' | 'high';

export interface EmotionalTheme {
  /** A recurring emotion or tone, e.g. "frustrated", "optimistic". */
  theme: string;
  /** Brief, paraphrased evidence from the entries (no long quotes). */
  evidence: string;
  /** How strongly the entries support this theme. */
  confidence: ReviewConfidence;
}

export interface RecurringStressor {
  /** A repeated source of stress or friction, e.g. "poor sleep". */
  stressor: string;
  /** Brief, paraphrased evidence from the entries. */
  evidence: string;
  /** How strongly the entries support this stressor. */
  confidence: ReviewConfidence;
}

export interface JournalWin {
  /** Short headline for an encouraging moment or positive signal. */
  title: string;
  /** Brief, paraphrased evidence from the entries. */
  evidence: string;
}

export interface SelfTalkPattern {
  /** How the user tends to speak to themselves, e.g. "self-critical". */
  pattern: string;
  /** Brief, paraphrased evidence from the entries. */
  evidence: string;
  /** Optional gentle, non-clinical reframe or idea. */
  suggestion?: string;
}

export interface SuggestedNextStep {
  /** Short, concrete action headline. */
  title: string;
  /** Why this is suggested, tied to the entries. */
  rationale: string;
  /** A small, realistic, non-medical action. */
  action: string;
}

export interface AIJournalReview {
  /** Start of the reviewed range (YYYY-MM-DD), set by the server. */
  rangeStart: string;
  /** End of the reviewed range (YYYY-MM-DD), set by the server. */
  rangeEnd: string;
  /** Short, human-readable narrative of the range. */
  overview: string;
  /** Recurring emotions or tones grounded in the entries. */
  emotionalThemes: EmotionalTheme[];
  /** Repeated sources of stress or friction grounded in the entries. */
  recurringStressors: RecurringStressor[];
  /** Encouraging moments and positive signals. */
  wins: JournalWin[];
  /** Observed self-talk patterns, handled carefully and non-clinically. */
  selfTalkPatterns: SelfTalkPattern[];
  /** 3–5 useful questions for the user to journal about next. */
  reflectionQuestions: string[];
  /** 2–4 small, practical, non-medical next steps. */
  suggestedNextSteps: SuggestedNextStep[];
  /** Honest notes about where the data was too thin to draw conclusions. */
  dataLimitations: string[];
  /**
   * Present only if entries suggest self-harm or crisis. A gentle,
   * non-counseling message encouraging the user to reach out for support.
   */
  crisisNotice?: string;
}

/** Server response wrapper: the review plus lightweight metadata. */
export interface AIJournalReviewResponse {
  review: AIJournalReview;
  meta: {
    rangeStart: string;
    rangeEnd: string;
    /** Number of journal entries included in the review. */
    journalEntriesCount: number;
    /** Distinct days on which the user journaled in the range. */
    daysJournaled: number;
    /** True when there were too few entries for confident insights. */
    lowData: boolean;
  };
}
