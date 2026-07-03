import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestMongo, teardownTestMongo } from '../../../test/mongoTestHelper';
import { seedDemoShowcase } from '../seedShowcase';
import { getDb } from '../../lib/mongoClient';
import { MONGO_COLLECTIONS } from '../../../models/persistenceTypes';
import { listAIReports } from '../../repositories/aiReportRepository';
import { PUBLIC_DEMO_HOUSEHOLD_ID } from '../../../shared/demo';
import { DEMO_USER_ID } from '../../config/demo';

/**
 * Regression coverage for the read-only demo's archived AI reports. The tour's
 * AI stops read their content from these seeded reports (no Gemini key in the
 * demo to generate live), so all four kinds must always be present — and the
 * dataset must reseed when a kind is missing, not skip as "fresh".
 */
describe('demo showcase seeds all AI report kinds', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });
  afterAll(async () => {
    await teardownTestMongo();
  });

  it('persists weekly_review, journal_summary, journal_review, and insights_review', async () => {
    await seedDemoShowcase({ force: true });
    const reports = await listAIReports(PUBLIC_DEMO_HOUSEHOLD_ID, DEMO_USER_ID, {});
    const kinds = new Set(reports.map((r) => r.kind));
    expect(kinds.has('weekly_review')).toBe(true);
    expect(kinds.has('journal_summary')).toBe(true);
    expect(kinds.has('journal_review')).toBe(true);
    expect(kinds.has('insights_review')).toBe(true);
  });

  it('reseeds when a report kind is missing even though entries look fresh', async () => {
    // Start from a fully seeded, "fresh" dataset.
    await seedDemoShowcase({ force: true });

    // Simulate a dataset seeded before the newer report kinds existed: drop
    // journal_review + insights_review while leaving recent entries in place.
    const db = await getDb();
    await db
      .collection(MONGO_COLLECTIONS.AI_REPORTS)
      .deleteMany({ userId: DEMO_USER_ID, kind: { $in: ['journal_review', 'insights_review'] } });

    const before = await listAIReports(PUBLIC_DEMO_HOUSEHOLD_ID, DEMO_USER_ID, {});
    expect(new Set(before.map((r) => r.kind)).has('insights_review')).toBe(false);

    // A non-forced seed must now detect the dataset as stale (incomplete) and
    // reseed, restoring the missing kinds.
    const result = await seedDemoShowcase();
    expect(result.seeded).toBe(true);

    const after = await listAIReports(PUBLIC_DEMO_HOUSEHOLD_ID, DEMO_USER_ID, {});
    const kinds = new Set(after.map((r) => r.kind));
    expect(kinds.has('journal_review')).toBe(true);
    expect(kinds.has('insights_review')).toBe(true);
  });
});
