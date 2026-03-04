/**
 * Batch create habit entries (POST /api/entries/batch)
 *
 * - Batch with two habits creates two entries for today's dayKey
 * - Batch called twice doesn't create duplicates (still only 2 entries)
 * - Request is user-scoped: user B cannot create entries for user A
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { batchCreateEntriesRoute } from '../habitEntries';
import { createCategory } from '../../repositories/categoryRepository';
import { createHabit } from '../../repositories/habitRepository';
import { getHabitEntriesForDay } from '../../repositories/habitEntryRepository';

const HOUSEHOLD_ID = 'household-batch';
const USER_A = 'user-a-batch';
const USER_B = 'user-b-batch';

function getTodayDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

describe('POST /api/entries/batch', () => {
  let app: Express;
  let habitId1: string;
  let habitId2: string;

  beforeAll(async () => {
    await setupTestMongo();

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).householdId = HOUSEHOLD_ID;
      (req as any).userId = USER_A;
      next();
    });
    app.post('/api/entries/batch', batchCreateEntriesRoute);
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('habitEntries').deleteMany({ householdId: HOUSEHOLD_ID });
    await db.collection('habits').deleteMany({ householdId: HOUSEHOLD_ID, userId: USER_A });
    await db.collection('categories').deleteMany({ householdId: HOUSEHOLD_ID, userId: USER_A });

    const category = await createCategory(
      { name: 'Batch Test Category', color: '#000000' },
      HOUSEHOLD_ID,
      USER_A
    );

    const habit1 = await createHabit(
      {
        name: 'Batch Habit 1',
        categoryId: category.id,
        goal: { type: 'boolean', target: 1, frequency: 'daily' },
      },
      HOUSEHOLD_ID,
      USER_A
    );
    habitId1 = habit1.id;

    const habit2 = await createHabit(
      {
        name: 'Batch Habit 2',
        categoryId: category.id,
        goal: { type: 'boolean', target: 1, frequency: 'daily' },
      },
      HOUSEHOLD_ID,
      USER_A
    );
    habitId2 = habit2.id;
  });

  it('batch with two habits creates two entries for today’s dayKey', async () => {
    const dayKey = getTodayDayKey();
    const res = await request(app)
      .post('/api/entries/batch')
      .send({
        dayKey,
        entries: [
          { habitId: habitId1, source: 'routine' },
          { habitId: habitId2, source: 'routine', routineId: 'routine-1' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(2);
    expect(res.body.updated).toBe(0);
    expect(res.body.results).toHaveLength(2);

    const ids = res.body.results.map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(2);

    const entries1 = await getHabitEntriesForDay(habitId1, dayKey, HOUSEHOLD_ID, USER_A);
    const entries2 = await getHabitEntriesForDay(habitId2, dayKey, HOUSEHOLD_ID, USER_A);
    expect(entries1).toHaveLength(1);
    expect(entries2).toHaveLength(1);
    expect(entries1[0].source).toBe('routine');
    expect(entries2[0].source).toBe('routine');
    expect(entries2[0].routineId).toBe('routine-1');
  });

  it('batch called twice doesn’t create duplicates (still only 2 entries)', async () => {
    const dayKey = getTodayDayKey();

    const res1 = await request(app)
      .post('/api/entries/batch')
      .send({
        dayKey,
        entries: [
          { habitId: habitId1, source: 'routine' },
          { habitId: habitId2, source: 'routine' },
        ],
      });
    expect(res1.status).toBe(200);
    expect(res1.body.created).toBe(2);
    expect(res1.body.updated).toBe(0);

    const res2 = await request(app)
      .post('/api/entries/batch')
      .send({
        dayKey,
        entries: [
          { habitId: habitId1, source: 'routine' },
          { habitId: habitId2, source: 'routine' },
        ],
      });
    expect(res2.status).toBe(200);
    expect(res2.body.created).toBe(0);
    expect(res2.body.updated).toBe(2);

    const entries1 = await getHabitEntriesForDay(habitId1, dayKey, HOUSEHOLD_ID, USER_A);
    const entries2 = await getHabitEntriesForDay(habitId2, dayKey, HOUSEHOLD_ID, USER_A);
    expect(entries1).toHaveLength(1);
    expect(entries2).toHaveLength(1);
  });

  it('request is user-scoped: user B cannot create entries for user A', async () => {
    const appB = express();
    appB.use(express.json());
    appB.use((req, _res, next) => {
      (req as any).householdId = HOUSEHOLD_ID;
      (req as any).userId = USER_B;
      next();
    });
    appB.post('/api/entries/batch', batchCreateEntriesRoute);

    const dayKey = getTodayDayKey();
    const res = await request(appB)
      .post('/api/entries/batch')
      .send({
        dayKey,
        entries: [
          { habitId: habitId1, source: 'routine' },
        ],
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Habit not found/i);

    const entriesA = await getHabitEntriesForDay(habitId1, dayKey, HOUSEHOLD_ID, USER_A);
    expect(entriesA).toHaveLength(0);
  });
});
