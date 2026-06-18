/**
 * AI Report Repository Tests
 *
 * Integration tests for the persisted AI insights archive.
 * Uses mongodb-memory-server via shared test helper.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import {
  saveAIReport,
  listAIReports,
  getAIReport,
  deleteAIReport,
} from '../aiReportRepository';
import type { WeeklyAIReview } from '../../../shared/weeklyAiReview';

const HH = 'test-household-ai-reports';
const HH2 = 'test-household-ai-reports-2';
const USER = 'test-user-ai-reports';

function makeReview(summary: string): WeeklyAIReview {
  return {
    weekStart: '2026-06-08',
    weekEnd: '2026-06-14',
    summary,
    facts: ['Logged 5 of 7 days'],
    patterns: [],
    journalThemes: [],
    wins: [],
    areasForAttention: [],
    recommendations: [],
    dataLimitations: [],
  };
}

describe('aiReportRepository', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('aiReports').deleteMany({});
  });

  it('saves a report and lists it (newest first, lightweight items)', async () => {
    await saveAIReport(HH, USER, {
      kind: 'weekly_review',
      periodStart: '2026-06-08',
      periodEnd: '2026-06-14',
      payload: { review: makeReview('A solid, consistent week.') },
    });
    await saveAIReport(HH, USER, {
      kind: 'journal_summary',
      periodStart: '2026-06-10',
      periodEnd: '2026-06-17',
      payload: { summary: 'You wrote about focus and rest.', journalEntriesCount: 4 },
    });

    const all = await listAIReports(HH, USER);
    expect(all).toHaveLength(2);
    // Newest first: journal_summary was inserted last.
    expect(all[0].kind).toBe('journal_summary');
    expect(all[0].preview).toContain('focus and rest');
    // List items must not carry the full payload.
    expect((all[0] as any).payload).toBeUndefined();
  });

  it('filters by kind', async () => {
    await saveAIReport(HH, USER, {
      kind: 'weekly_review',
      periodStart: '2026-06-08',
      periodEnd: '2026-06-14',
      payload: { review: makeReview('Week one.') },
    });
    await saveAIReport(HH, USER, {
      kind: 'journal_summary',
      periodStart: '2026-06-10',
      periodEnd: '2026-06-17',
      payload: { summary: 'Journal summary text.', journalEntriesCount: 2 },
    });

    const reviews = await listAIReports(HH, USER, { kind: 'weekly_review' });
    expect(reviews).toHaveLength(1);
    expect(reviews[0].kind).toBe('weekly_review');
  });

  it('fetches a full report by id including payload', async () => {
    const saved = await saveAIReport(HH, USER, {
      kind: 'weekly_review',
      periodStart: '2026-06-08',
      periodEnd: '2026-06-14',
      payload: { review: makeReview('Detailed week.') },
    });

    const fetched = await getAIReport(HH, USER, saved.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.kind).toBe('weekly_review');
    expect((fetched!.payload as { review: WeeklyAIReview }).review.summary).toBe('Detailed week.');
  });

  it('soft-deletes a report (hidden from list and get)', async () => {
    const saved = await saveAIReport(HH, USER, {
      kind: 'journal_summary',
      periodStart: '2026-06-10',
      periodEnd: '2026-06-17',
      payload: { summary: 'To be deleted.', journalEntriesCount: 1 },
    });

    const deleted = await deleteAIReport(HH, USER, saved.id);
    expect(deleted).toBe(true);

    expect(await getAIReport(HH, USER, saved.id)).toBeNull();
    expect(await listAIReports(HH, USER)).toHaveLength(0);

    // Deleting again is a no-op.
    expect(await deleteAIReport(HH, USER, saved.id)).toBe(false);
  });

  it('scopes reports by household', async () => {
    await saveAIReport(HH, USER, {
      kind: 'weekly_review',
      periodStart: '2026-06-08',
      periodEnd: '2026-06-14',
      payload: { review: makeReview('Household one.') },
    });

    expect(await listAIReports(HH, USER)).toHaveLength(1);
    expect(await listAIReports(HH2, USER)).toHaveLength(0);
  });
});
