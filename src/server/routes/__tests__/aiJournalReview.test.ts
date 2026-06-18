import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

// --- Mock identity (route reads it from the request via middleware helper) ---
vi.mock('../../middleware/identity', () => ({
  getRequestIdentity: () => ({ householdId: 'hh-1', userId: 'user-1' }),
}));

// --- Mock journal repository ---
let journalData: Array<Record<string, unknown>> = [];
vi.mock('../../repositories/journal', () => ({
  getEntriesByUser: vi.fn(async () => journalData),
}));

import { postJournalReview } from '../aiJournalReview';

function createRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

function geminiOk(modelOutput: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(modelOutput) }] } }],
    }),
  } as unknown as Response;
}

const RANGE_START = '2026-06-01';
const RANGE_END = '2026-06-07';

const fullModelOutput = {
  overview: 'A steady week with a mix of motivation and tiredness.',
  emotionalThemes: [
    { theme: 'motivated', evidence: 'Several entries mention renewed energy', confidence: 'banana' },
    { theme: '', evidence: 'should be dropped', confidence: 'high' },
  ],
  recurringStressors: [
    { stressor: 'poor sleep', evidence: 'Mentions of waking up tired', confidence: 'medium' },
  ],
  wins: [
    { title: 'Stayed consistent', evidence: 'Journaled most days' },
    { title: '', evidence: 'dropped' },
  ],
  selfTalkPatterns: [
    { pattern: 'self-critical', evidence: 'Tends to focus on shortfalls', suggestion: 'Note one thing that went well' },
  ],
  reflectionQuestions: ['What helped you feel grounded?', ''],
  suggestedNextSteps: [
    { title: 'Wind-down ritual', rationale: 'Sleep came up often', action: 'Try a 5-minute shutdown reflection' },
  ],
  dataLimitations: ['Most entries were short.'],
};

describe('postJournalReview', () => {
  beforeEach(() => {
    journalData = [
      { date: '2026-06-02', templateId: 'free-write', mode: 'free', content: { body: 'Felt motivated but tired.' } },
      { date: '2026-06-04', templateId: 'daily-retrospective', mode: 'standard', content: { win: 'Walked daily.' } },
      { date: '2026-06-06', templateId: 'free-write', mode: 'free', content: { body: 'Slept poorly again.' } },
    ];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('rejects a missing/short Gemini API key with 400', async () => {
    const res = createRes();
    await postJournalReview(
      { body: { geminiApiKey: 'x', rangeStart: RANGE_START, rangeEnd: RANGE_END } } as unknown as Request,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects invalid date ranges with 400', async () => {
    const res = createRes();
    await postJournalReview(
      { body: { geminiApiKey: 'a-valid-key-123', rangeStart: 'nope', rangeEnd: RANGE_END } } as unknown as Request,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns a graceful empty review (no Gemini call) when no entries exist', async () => {
    journalData = [];
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = createRes();
    await postJournalReview(
      { body: { geminiApiKey: 'a-valid-key-123', rangeStart: RANGE_START, rangeEnd: RANGE_END } } as unknown as Request,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(fetchMock).not.toHaveBeenCalled(); // never calls the model with nothing to analyze
    const body = vi.mocked(res.json).mock.calls[0][0];
    expect(body.meta.journalEntriesCount).toBe(0);
    expect(body.meta.lowData).toBe(true);
    expect(body.review.dataLimitations.length).toBeGreaterThan(0);
  });

  it('flags low-data when there are very few entries', async () => {
    journalData = [
      { date: '2026-06-02', templateId: 'free-write', mode: 'free', content: { body: 'One short note.' } },
    ];
    vi.stubGlobal('fetch', vi.fn(async () => geminiOk(fullModelOutput)));

    const res = createRes();
    await postJournalReview(
      { body: { geminiApiKey: 'a-valid-key-123', rangeStart: RANGE_START, rangeEnd: RANGE_END } } as unknown as Request,
      res,
    );

    const body = vi.mocked(res.json).mock.calls[0][0];
    expect(body.meta.lowData).toBe(true);
    expect(body.meta.journalEntriesCount).toBe(1);
  });

  it('grounds the prompt in entries and normalizes the model output', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => geminiOk(fullModelOutput));
    vi.stubGlobal('fetch', fetchMock);

    const res = createRes();
    await postJournalReview(
      { body: { geminiApiKey: 'a-valid-key-123', rangeStart: RANGE_START, rangeEnd: RANGE_END } } as unknown as Request,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);

    // --- Grounding: prompt carries the user's entries and a structured request ---
    const promptBody = JSON.parse(vi.mocked(fetchMock).mock.calls[0][1].body as string);
    const promptText = promptBody.contents[0].parts[0].text as string;
    expect(promptText).toContain('Felt motivated but tired.');
    expect(promptText.toLowerCase()).toContain('diagnose'); // safety instruction present
    expect(promptBody.generationConfig.responseMimeType).toBe('application/json');

    // --- Gemini 3.5 request contract ---
    const url = vi.mocked(fetchMock).mock.calls[0][0] as string;
    expect(url).toContain('/models/gemini-3.5-flash:generateContent');
    expect(promptBody.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });
    expect(promptBody.generationConfig).not.toHaveProperty('temperature');

    const body = vi.mocked(res.json).mock.calls[0][0];
    const review = body.review;

    // Server owns the range boundaries.
    expect(review.rangeStart).toBe(RANGE_START);
    expect(review.rangeEnd).toBe(RANGE_END);

    // Bad confidence coerced to 'low'; empty-titled items filtered out.
    expect(review.emotionalThemes).toHaveLength(1);
    expect(review.emotionalThemes[0].confidence).toBe('low');
    expect(review.wins).toHaveLength(1);
    expect(review.reflectionQuestions).toEqual(['What helped you feel grounded?']);
    expect(review.selfTalkPatterns[0].suggestion).toBe('Note one thing that went well');
    expect(body.meta.lowData).toBe(false);
    expect(body.meta.journalEntriesCount).toBe(3);
  });

  it('swaps reversed ranges so start <= end', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => geminiOk(fullModelOutput)));
    const res = createRes();
    await postJournalReview(
      { body: { geminiApiKey: 'a-valid-key-123', rangeStart: RANGE_END, rangeEnd: RANGE_START } } as unknown as Request,
      res,
    );
    const review = vi.mocked(res.json).mock.calls[0][0].review;
    expect(review.rangeStart).toBe(RANGE_START);
    expect(review.rangeEnd).toBe(RANGE_END);
  });
});
