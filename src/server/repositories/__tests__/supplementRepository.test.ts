/**
 * Supplement Repository Tests
 *
 * Integration tests for the Supplement repository (definitions + daily "taken" logs).
 * Uses mongodb-memory-server via shared test helper.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import {
  listSupplements,
  createSupplement,
  updateSupplement,
  softDeleteSupplement,
  getSupplementLogsForDay,
  setSupplementLog,
} from '../supplementRepository';

const HOUSEHOLD_ID = 'house-1';
const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';

describe('SupplementRepository', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('supplements').deleteMany({});
    await db.collection('supplementLogs').deleteMany({});
  });

  it('creates and lists supplements (active first, then alphabetical)', async () => {
    await createSupplement({ name: 'Zinc', active: false }, HOUSEHOLD_ID, USER_ID);
    await createSupplement({ name: 'Magnesium', dosage: '400mg' }, HOUSEHOLD_ID, USER_ID);

    const list = await listSupplements(HOUSEHOLD_ID, USER_ID);
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe('Magnesium'); // active first
    expect(list[0].dosage).toBe('400mg');
    expect(list[1].name).toBe('Zinc');
  });

  it('updates a supplement', async () => {
    const created = await createSupplement({ name: 'Vitamin D' }, HOUSEHOLD_ID, USER_ID);
    const updated = await updateSupplement(created.id, { dosage: '2000 IU', schedule: 'morning' }, HOUSEHOLD_ID, USER_ID);
    expect(updated?.dosage).toBe('2000 IU');
    expect(updated?.schedule).toBe('morning');
  });

  it('soft-deletes a supplement (excluded from list)', async () => {
    const created = await createSupplement({ name: 'Vitamin D' }, HOUSEHOLD_ID, USER_ID);
    const ok = await softDeleteSupplement(created.id, HOUSEHOLD_ID, USER_ID);
    expect(ok).toBe(true);
    const list = await listSupplements(HOUSEHOLD_ID, USER_ID);
    expect(list).toHaveLength(0);
  });

  it('upserts a daily "taken" log idempotently per (supplement, day)', async () => {
    const created = await createSupplement({ name: 'Vitamin D' }, HOUSEHOLD_ID, USER_ID);
    const dayKey = '2026-01-10';

    await setSupplementLog({ supplementId: created.id, dayKey, taken: true }, HOUSEHOLD_ID, USER_ID);
    const second = await setSupplementLog({ supplementId: created.id, dayKey, taken: false }, HOUSEHOLD_ID, USER_ID);

    expect(second.taken).toBe(false);

    const logs = await getSupplementLogsForDay(HOUSEHOLD_ID, USER_ID, dayKey);
    expect(logs).toHaveLength(1);
    expect(logs[0].taken).toBe(false);
  });

  it('scopes data by user', async () => {
    await createSupplement({ name: 'Vitamin D' }, HOUSEHOLD_ID, USER_ID);
    const otherList = await listSupplements(HOUSEHOLD_ID, OTHER_USER_ID);
    expect(otherList).toHaveLength(0);
  });
});
