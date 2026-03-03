/**
 * Journal upsert-by-key tests
 *
 * Verifies idempotency for (userId, date, templateId) upserts.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { upsertEntryByTemplateAndDate } from '../journal';

const TEST_USER_ID = 'test-user-vibe';

describe('JournalRepository upsertEntryByTemplateAndDate', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('journalEntries').deleteMany({});
  });

  it('should upsert (not duplicate) for same (templateId,date)', async () => {
    const date = '2025-01-27';

    const first = await upsertEntryByTemplateAndDate(
      {
        templateId: 'current_vibe',
        mode: 'free',
        date,
        content: { value: 'tender' },
        persona: 'Test',
      },
      TEST_USER_ID
    );

    const second = await upsertEntryByTemplateAndDate(
      {
        templateId: 'current_vibe',
        mode: 'free',
        date,
        content: { value: 'steady' },
        persona: 'Test',
      },
      TEST_USER_ID
    );

    expect(second.id).toBe(first.id);

    const db = await getTestDb();
    const count = await db.collection('journalEntries').countDocuments({ userId: TEST_USER_ID, templateId: 'current_vibe', date });
    expect(count).toBe(1);

    const stored = await db.collection('journalEntries').findOne({ userId: TEST_USER_ID, templateId: 'current_vibe', date });
    expect((stored as any)?.content?.value).toBe('steady');
  });
});


