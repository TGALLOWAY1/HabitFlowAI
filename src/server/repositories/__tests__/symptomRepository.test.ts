/**
 * Symptom Repository Tests
 *
 * Integration tests for the Symptom repository (definitions + daily severity logs).
 * Uses mongodb-memory-server via shared test helper.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import {
  listSymptoms,
  createSymptom,
  updateSymptom,
  softDeleteSymptom,
  getSymptomLogsForDay,
  setSymptomLog,
} from '../symptomRepository';

const HOUSEHOLD_ID = 'house-1';
const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';

describe('SymptomRepository', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('symptoms').deleteMany({});
    await db.collection('symptomLogs').deleteMany({});
  });

  it('creates and lists symptoms (active first, then alphabetical)', async () => {
    await createSymptom({ name: 'Nausea', active: false }, HOUSEHOLD_ID, USER_ID);
    await createSymptom({ name: 'Headache' }, HOUSEHOLD_ID, USER_ID);

    const list = await listSymptoms(HOUSEHOLD_ID, USER_ID);
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe('Headache'); // active first
    expect(list[1].name).toBe('Nausea');
  });

  it('updates a symptom', async () => {
    const created = await createSymptom({ name: 'Headache' }, HOUSEHOLD_ID, USER_ID);
    const updated = await updateSymptom(created.id, { name: 'Migraine', notes: 'left side' }, HOUSEHOLD_ID, USER_ID);
    expect(updated?.name).toBe('Migraine');
    expect(updated?.notes).toBe('left side');
  });

  it('soft-deletes a symptom (excluded from list)', async () => {
    const created = await createSymptom({ name: 'Headache' }, HOUSEHOLD_ID, USER_ID);
    const ok = await softDeleteSymptom(created.id, HOUSEHOLD_ID, USER_ID);
    expect(ok).toBe(true);
    const list = await listSymptoms(HOUSEHOLD_ID, USER_ID);
    expect(list).toHaveLength(0);
  });

  it('upserts a daily severity log idempotently per (symptom, day)', async () => {
    const created = await createSymptom({ name: 'Headache' }, HOUSEHOLD_ID, USER_ID);
    const dayKey = '2026-01-10';

    await setSymptomLog({ symptomId: created.id, dayKey, severity: 2 }, HOUSEHOLD_ID, USER_ID);
    const second = await setSymptomLog({ symptomId: created.id, dayKey, severity: 4, notes: 'worse' }, HOUSEHOLD_ID, USER_ID);

    expect(second.severity).toBe(4);
    expect(second.notes).toBe('worse');

    const logs = await getSymptomLogsForDay(HOUSEHOLD_ID, USER_ID, dayKey);
    expect(logs).toHaveLength(1);
    expect(logs[0].severity).toBe(4);
  });

  it('scopes data by user', async () => {
    await createSymptom({ name: 'Headache' }, HOUSEHOLD_ID, USER_ID);
    const otherList = await listSymptoms(HOUSEHOLD_ID, OTHER_USER_ID);
    expect(otherList).toHaveLength(0);
  });
});
