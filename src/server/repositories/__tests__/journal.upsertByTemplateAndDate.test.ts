/**
 * Journal upsert-by-key tests
 *
 * Verifies idempotency for (userId, date, templateId) upserts.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://localhost:27017';
}
process.env.USE_MONGO_PERSISTENCE = 'true';

import { getDb, closeConnection } from '../../lib/mongoClient';
import { upsertEntryByTemplateAndDate } from '../journal';

const TEST_DB_NAME = 'habitflowai_test';
const TEST_USER_ID = 'test-user-vibe';

let originalDbName: string | undefined;
let originalUseMongo: string | undefined;
let testClient: MongoClient | null = null;

describe('JournalRepository upsertEntryByTemplateAndDate', () => {
  beforeAll(async () => {
    originalDbName = process.env.MONGODB_DB_NAME;
    originalUseMongo = process.env.USE_MONGO_PERSISTENCE;
    process.env.MONGODB_DB_NAME = TEST_DB_NAME;

    await getDb();

    const uri = process.env.MONGODB_URI;
    if (uri) {
      testClient = new MongoClient(uri);
      await testClient.connect();
    }
  });

  afterAll(async () => {
    if (testClient) {
      const adminDb = testClient.db(TEST_DB_NAME);
      await adminDb.dropDatabase();
      await testClient.close();
    }
    await closeConnection();

    if (originalDbName) process.env.MONGODB_DB_NAME = originalDbName;
    else delete process.env.MONGODB_DB_NAME;
    if (originalUseMongo) process.env.USE_MONGO_PERSISTENCE = originalUseMongo;
    else delete process.env.USE_MONGO_PERSISTENCE;
  });

  beforeEach(async () => {
    const db = await getDb();
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

    const db = await getDb();
    const count = await db.collection('journalEntries').countDocuments({ userId: TEST_USER_ID, templateId: 'current_vibe', date });
    expect(count).toBe(1);

    const stored = await db.collection('journalEntries').findOne({ userId: TEST_USER_ID, templateId: 'current_vibe', date });
    expect((stored as any)?.content?.value).toBe('steady');
  });
});


