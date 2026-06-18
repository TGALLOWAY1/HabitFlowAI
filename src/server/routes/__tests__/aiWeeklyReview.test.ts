import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { startOfWeek, endOfWeek, parseISO, format, getDay } from 'date-fns';

// --- Mock identity (route reads it from the request via middleware helper) ---
vi.mock('../../middleware/identity', () => ({
  getRequestIdentity: () => ({ householdId: 'hh-1', userId: 'user-1' }),
}));

// --- Mock data sources ---
const habitsData = [
  {
    id: 'h-walk',
    name: 'Walk',
    archived: false,
    timesPerWeek: undefined,
    assignedDays: undefined,
  },
  {
    id: 'h-archived',
    name: 'Old Habit',
    archived: true,
  },
];

// dayKeys for the reviewed week, filled in beforeEach from the resolved Monday.
let weekDays: string[] = [];
let habitEntriesData: Array<Record<string, unknown>> = [];
let wellbeingData: Array<Record<string, unknown>> = [];
let journalData: Array<Record<string, unknown>> = [];

vi.mock('../../lib/mongoClient', () => ({
  getDb: vi.fn(async () => ({
    collection: (name: string) => ({
      find: () => ({
        toArray: async () => (name === 'habits' ? habitsData : habitEntriesData),
      }),
    }),
  })),
}));

vi.mock('../../repositories/journal', () => ({
  getEntriesByUser: vi.fn(async () => journalData),
}));

vi.mock('../../repositories/wellbeingEntryRepository', () => ({
  getWellbeingEntries: vi.fn(async () => wellbeingData),
}));

vi.mock('../../repositories/goalRepository', () => ({
  getGoalsByUser: vi.fn(async () => [
    { id: 'g-1', title: 'Run a 10k', type: 'onetime', linkedHabitIds: ['h-walk'], completedAt: null },
  ]),
}));

import { postWeeklyReview } from '../aiWeeklyReview';

function createRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

const REQUESTED_WEEK = '2026-06-17';

function geminiOk(modelOutput: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(modelOutput) }] } }],
    }),
  } as unknown as Response;
}

describe('postWeeklyReview', () => {
  beforeEach(() => {
    const monday = startOfWeek(parseISO(REQUESTED_WEEK), { weekStartsOn: 1 });
    weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return format(d, 'yyyy-MM-dd');
    });

    // Walk logged on 5 of 7 days.
    habitEntriesData = weekDays.slice(0, 5).map((dayKey, i) => ({
      id: `e-${i}`,
      habitId: 'h-walk',
      dayKey,
      value: 1,
    }));

    // Sleep score recorded on two days.
    wellbeingData = [
      { metricKey: 'appleSleepScore', dayKey: weekDays[0], value: 82 },
      { metricKey: 'appleSleepScore', dayKey: weekDays[1], value: 60 },
    ];

    journalData = [{ date: weekDays[0], templateId: 'free-write', content: { body: 'Felt good today.' } }];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('rejects a missing/short Gemini API key with 400', async () => {
    const res = createRes();
    await postWeeklyReview({ body: { geminiApiKey: 'x' } } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('sends only grounded observed facts to Gemini and returns a normalized review', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      geminiOk({
        summary: 'Solid week overall.',
        facts: ['Logged Walk 5 of 7 days', ''], // empty string should be filtered out
        journalThemes: ['Reflected positively on the day'],
        wins: ['Logged Walk 5 of 7 days', ''], // empty string should be filtered out
        areasForAttention: ['Skipped Walk on two days'],
        patterns: [
          { title: 'Sleep vs. activity', evidence: 'Fewer habits after a low sleep score', confidence: 'banana' },
        ],
        recommendations: [
          { title: 'Protect sleep', reason: 'Low-sleep days had fewer habits', suggestedAction: 'Set a wind-down alarm' },
        ],
        dataLimitations: ['Only two days of sleep data this week'],
        // Note: model does NOT supply weekStart/weekEnd — the server must own them.
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = createRes();
    await postWeeklyReview(
      { body: { geminiApiKey: 'a-valid-key-123', weekStart: REQUESTED_WEEK, timeZone: 'UTC' } } as unknown as Request,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);

    // --- Grounding: the prompt contains DB-derived facts, not invented content ---
    const promptBody = JSON.parse(vi.mocked(fetchMock).mock.calls[0][1].body as string);
    const promptText = promptBody.contents[0].parts[0].text as string;
    expect(promptText).toContain('Walk');
    expect(promptText).toContain('daysLogged');
    expect(promptText).toContain('Sleep score'); // friendly wellbeing label
    expect(promptText).toContain('Run a 10k'); // active goal
    expect(promptText).not.toContain('Old Habit'); // archived habit excluded
    // Structured JSON output requested.
    expect(promptBody.generationConfig.responseMimeType).toBe('application/json');

    const body = vi.mocked(res.json).mock.calls[0][0];
    const review = body.review;

    // Server owns the week boundaries (Monday..Sunday), regardless of model output.
    const expectedStart = format(startOfWeek(parseISO(REQUESTED_WEEK), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const expectedEnd = format(endOfWeek(parseISO(REQUESTED_WEEK), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    expect(review.weekStart).toBe(expectedStart);
    expect(review.weekEnd).toBe(expectedEnd);
    expect(getDay(parseISO(review.weekStart))).toBe(1); // Monday

    // Empty strings filtered, bad confidence coerced to 'low'.
    expect(review.wins).toEqual(['Logged Walk 5 of 7 days']);
    expect(review.facts).toEqual(['Logged Walk 5 of 7 days']);
    expect(review.areasForAttention).toEqual(['Skipped Walk on two days']);
    expect(review.journalThemes).toEqual(['Reflected positively on the day']);
    expect(review.patterns[0].confidence).toBe('low');

    // Metadata reflects real aggregates (archived habit excluded).
    expect(body.meta.habitsTracked).toBe(1);
    expect(body.meta.daysWithHabitData).toBe(5);
    expect(body.meta.journalEntries).toBe(1);
    expect(body.meta.wellbeingDaysRecorded).toBe(2);
  });

  it('returns a well-formed review even when Gemini reports only data limitations', async () => {
    habitEntriesData = [];
    wellbeingData = [];
    journalData = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        geminiOk({
          summary: 'Not much was tracked this week.',
          facts: [],
          journalThemes: [],
          wins: [],
          areasForAttention: [],
          patterns: [],
          recommendations: [],
          dataLimitations: ['There is not enough data this week to identify patterns confidently.'],
        }),
      ),
    );

    const res = createRes();
    await postWeeklyReview(
      { body: { geminiApiKey: 'a-valid-key-123', weekStart: REQUESTED_WEEK, timeZone: 'UTC' } } as unknown as Request,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const review = vi.mocked(res.json).mock.calls[0][0].review;
    expect(review.wins).toEqual([]);
    expect(review.dataLimitations.length).toBeGreaterThan(0);
    expect(review.weekStart).toBeTruthy();
  });
});
