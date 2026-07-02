/**
 * Curated content for the public "Take a Tour" walkthrough.
 *
 * Everything in this file is deterministic sample data for one fictional
 * week of tracking, plus prewritten example AI outputs composed from that
 * same sample data. The tour renders these directly — it makes no API
 * calls, needs no Gemini key, and never implies live generation. Every AI
 * panel in the tour is labeled as an example output.
 *
 * The sample story is intentionally coherent across stops: a user pushing
 * toward a Q3 launch whose deep work is strong, whose sleep suffers when
 * the evening wind-down is skipped, and whose morning runs keep energy up.
 * The journal entries, weekly review, extraction, and insights all reflect
 * that one dataset, so a reader can see the AI outputs are grounded in it.
 */

// ---------------------------------------------------------------------------
// Sample behavioral dataset (one week, Mon–Sun)
// ---------------------------------------------------------------------------

export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export interface SampleHabit {
  name: string;
  /** Tailwind text color class for the habit's category dot. */
  color: string;
  /** Per-day state: 'done' | 'missed' | 'off' (not scheduled). */
  days: ReadonlyArray<'done' | 'missed' | 'off'>;
  /** e.g. "5/7 days" or "4/4 this week" */
  summary: string;
}

export const SAMPLE_HABITS: SampleHabit[] = [
  {
    name: 'Deep work (2h)',
    color: 'text-emerald-400',
    days: ['done', 'done', 'done', 'missed', 'done', 'off', 'off'],
    summary: '4/5 weekdays',
  },
  {
    name: 'Morning run',
    color: 'text-cyan-400',
    days: ['done', 'missed', 'done', 'missed', 'done', 'done', 'missed'],
    summary: '4/4 this week',
  },
  {
    name: 'Wind-down routine',
    color: 'text-violet-400',
    days: ['done', 'done', 'done', 'missed', 'missed', 'done', 'done'],
    summary: '5/7 days',
  },
  {
    name: 'No phone in bed',
    color: 'text-amber-400',
    days: ['done', 'done', 'missed', 'missed', 'done', 'done', 'missed'],
    summary: '4/7 days',
  },
  {
    name: 'Read 20 min',
    color: 'text-rose-400',
    days: ['done', 'done', 'done', 'done', 'missed', 'done', 'done'],
    summary: '6/7 days',
  },
];

export interface SampleGoal {
  name: string;
  progressLabel: string;
  /** 0–100 */
  percent: number;
}

export const SAMPLE_GOALS: SampleGoal[] = [
  { name: 'Log 150 hours of deep work', progressLabel: '82.5 / 150 hrs', percent: 55 },
  { name: 'Run 120 miles this quarter', progressLabel: '74 / 120 mi', percent: 62 },
  { name: 'Ship the Q3 launch', progressLabel: 'On track · 3 weeks left', percent: 70 },
];

export const SAMPLE_TASKS = [
  { name: 'Draft launch retro doc', done: true },
  { name: 'Outline launch presentation', done: false },
  { name: 'Book dentist appointment', done: false },
] as const;

export const SAMPLE_WELLBEING = {
  mood: { label: 'Mood', value: '3.6 / 5', note: 'dips Thu' },
  energy: { label: 'Energy', value: '3.2 / 5', note: 'higher on run days' },
  sleep: { label: 'Sleep', value: '6h 51m', note: 'quality 3.4 / 5' },
} as const;

export const SAMPLE_ROUTINE = {
  name: 'Morning Kickstart',
  detail: '5 steps · 25 min · auto-logs 3 habits',
} as const;

export interface SampleJournalEntry {
  day: string;
  template: string;
  excerpt: string;
}

export const SAMPLE_JOURNAL_ENTRIES: SampleJournalEntry[] = [
  {
    day: 'Mon',
    template: 'Morning Primer',
    excerpt:
      'Slept badly but the run helped shake it off. Main focus today: outline the launch presentation. Feeling cautiously optimistic — if I get the outline done this week, the rest is execution.',
  },
  {
    day: 'Wed',
    template: 'Free write',
    excerpt:
      'The Q3 launch deadline is eating my evenings. Skipped wind-down twice already and I can feel it — groggy mornings, slow starts. The morning runs are the one thing reliably keeping my energy up.',
  },
  {
    day: 'Sun',
    template: 'Weekly Reflection',
    excerpt:
      'Good week for deep work, bad week for sleep. I keep pushing the presentation outline to “tomorrow.” Next week I want to finish it early instead of perfectly — done by Wednesday, then iterate.',
  },
];

// ---------------------------------------------------------------------------
// Prewritten example AI outputs (composed from the sample data above)
// ---------------------------------------------------------------------------

export type Confidence = 'high' | 'medium' | 'low';

export interface WeeklyReviewExample {
  weekAtAGlance: string;
  wins: string[];
  patterns: { text: string; confidence: Confidence }[];
  blockers: string[];
  recommendations: string[];
  nextWeekFocus: string[];
}

export const WEEKLY_REVIEW_EXAMPLE: WeeklyReviewExample = {
  weekAtAGlance:
    'A strong execution week with a visible cost: deep work landed on 4 of 5 weekdays (8.0 hrs, pushing the 150-hour goal past 55%), and the run target was met at 4/4 — but the wind-down routine slipped on Thursday and Friday, and average sleep fell to 6h 51m. Journal entries point at one cause: Q3 launch prep spilling into evenings.',
  wins: [
    'Deep work on 4 of 5 weekdays — 8.0 hours logged, the strongest week this month.',
    'Run target met (4/4) for the third consecutive week; energy checked in higher on every run day.',
    'Read 20 min held at 6/7 days, even on the low-sleep nights.',
  ],
  patterns: [
    {
      text: 'On the 5 nights the wind-down routine was completed, next-morning sleep quality averaged 4.0 / 5; on the 2 skipped nights it averaged 2.5 / 5.',
      confidence: 'high',
    },
    {
      text: 'Both wind-down misses (Thu, Fri) followed evenings with launch work logged after 8 PM — evening work appears to displace the routine.',
      confidence: 'medium',
    },
    {
      text: 'Mood and energy check-ins were highest on the three days that combined a morning run with a deep-work block.',
      confidence: 'medium',
    },
  ],
  blockers: [
    'Launch prep is running into the evening, displacing the wind-down routine and shortening sleep.',
    '“Outline launch presentation” was deferred in three separate journal entries but never scheduled into a deep-work block.',
  ],
  recommendations: [
    'Give the presentation outline the first deep-work block on Monday — it is the most-deferred item in your journal, not the largest.',
    'Set a hard 8 PM stop on launch work Thursday and Friday, the two days wind-down slipped this week.',
    'Keep the run cadence at 4/week rather than adding more; it is already your most reliable energy lever.',
  ],
  nextWeekFocus: [
    'Presentation outline finished by Wednesday — done, then iterated.',
    'Wind-down routine 7/7, protected by the 8 PM stop.',
  ],
};

export interface JournalExtractionExample {
  themes: { text: string; confidence: Confidence }[];
  stressors: string[];
  blockers: string[];
  goalsMentioned: string[];
  emotionalPatterns: string[];
}

export const JOURNAL_EXTRACTION_EXAMPLE: JournalExtractionExample = {
  themes: [
    { text: 'Launch-deadline pressure shaping the whole week (all 3 entries)', confidence: 'high' },
    { text: 'Morning exercise as the primary energy regulator', confidence: 'high' },
    { text: 'Accumulating sleep debt from evening work', confidence: 'medium' },
  ],
  stressors: [
    'Q3 launch deadline, especially its bleed into evenings',
    'Groggy mornings after skipped wind-downs',
  ],
  blockers: [
    'The launch presentation outline — repeatedly deferred to “tomorrow” across entries',
  ],
  goalsMentioned: [
    'Finish the presentation outline early (“done by Wednesday, then iterate”)',
    'Protect the evening wind-down routine',
  ],
  emotionalPatterns: [
    'Optimism consistently tied to completed morning runs',
    'Frustration is self-directed (about deferral), not situational — a perfectionism signal the Sunday entry names directly',
  ],
};

export interface InsightExample {
  finding: string;
  detail: string;
  direction: 'positive' | 'negative';
}

export const INSIGHT_EXAMPLES: InsightExample[] = [
  {
    finding: 'Wind-down evenings precede better sleep',
    detail: 'Sleep quality averages +1.5 higher the morning after a completed wind-down (5 vs 2 nights this week).',
    direction: 'positive',
  },
  {
    finding: 'Run days lift same-day energy',
    detail: 'Energy check-ins average +0.8 on the 4 run days versus the 3 rest days.',
    direction: 'positive',
  },
  {
    finding: 'Phone in bed tracks with lower next-day mood',
    detail: 'The 3 phone-in-bed nights preceded the 3 lowest mood check-ins of the week.',
    direction: 'negative',
  },
  {
    finding: 'Evening work displaces the wind-down',
    detail: 'Both skipped wind-downs followed launch work logged after 8 PM.',
    direction: 'negative',
  },
];

export const RECOMMENDATION_EXAMPLES: string[] = [
  'Schedule the presentation outline into Monday’s first deep-work block — it has been deferred in 3 journal entries.',
  'Set an 8 PM stop on launch work Thursday and Friday to protect the wind-down routine.',
  'Hold the run cadence at 4/week; it is your most reliable energy lever this month.',
  'Charge your phone outside the bedroom on work nights — the 3 phone-in-bed nights preceded your lowest mood days.',
  'Keep Read 20 min as-is; at 6/7 it is stable and needs no intervention.',
];

// ---------------------------------------------------------------------------
// Technical credibility panel
// ---------------------------------------------------------------------------

export interface TechFact {
  title: string;
  detail: string;
}

export const TECH_FACTS: TechFact[] = [
  {
    title: 'React 19 + TypeScript + Vite',
    detail: 'Strict-mode TypeScript monorepo; Tailwind CSS with a responsive, mobile-first UX (bottom tab bar on small screens).',
  },
  {
    title: 'Express 5 + MongoDB backend',
    detail: 'Layered routes → services → repositories, with input validation at the route boundary and soft-delete truth records.',
  },
  {
    title: 'Entries as the single source of truth',
    detail: 'Streaks, progress, correlations, and AI reviews are all derived from raw entries at read time — no stored completion state to drift.',
  },
  {
    title: 'Gemini-powered AI features',
    detail: 'Weekly reviews, journal analysis, and insight narration via Google Gemini — bring-your-own-key, stored client-side only.',
  },
  {
    title: 'Grounded prompt engineering',
    detail: 'The server aggregates entries into observed facts first; schema-constrained prompts separate facts from inferred patterns from suggestions and forbid fabricating data.',
  },
  {
    title: 'Authenticated app architecture',
    detail: 'Session auth with invite-based accounts, per-user data scoping on every request, rate limiting, and timezone-aware day boundaries.',
  },
];
