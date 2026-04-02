/**
 * Guardrail: Routine submit must reject habit IDs not linked to the routine.
 *
 * Audit Finding 3 — prevents arbitrary habit completion injection via routine submission.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { submitRoutineRoute } from '../routines';
import { createRoutine } from '../../repositories/routineRepository';
import { createHabit } from '../../repositories/habitRepository';
import { createCategory } from '../../repositories/categoryRepository';
import { getHabitEntriesForDay } from '../../repositories/habitEntryRepository';

const TEST_HOUSEHOLD_ID = 'test-household-linkage';
const TEST_USER_ID = 'test-user-linkage';

describe('Routine submit rejects unlinked habit IDs', () => {
  let app: Express;
  let routineId: string;
  let linkedHabitId: string;
  let unlinkedHabitId: string;

  beforeAll(async () => {
    await setupTestMongo();

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).householdId = TEST_HOUSEHOLD_ID;
      (req as any).userId = TEST_USER_ID;
      next();
    });

    app.post('/api/routines/:id/submit', submitRoutineRoute);
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('habitEntries').deleteMany({ householdId: TEST_HOUSEHOLD_ID, userId: TEST_USER_ID });
    await db.collection('routineLogs').deleteMany({ userId: TEST_USER_ID });
    await db.collection('habits').deleteMany({ householdId: TEST_HOUSEHOLD_ID, userId: TEST_USER_ID });
    await db.collection('routines').deleteMany({ householdId: TEST_HOUSEHOLD_ID, userId: TEST_USER_ID });
    await db.collection('categories').deleteMany({ householdId: TEST_HOUSEHOLD_ID, userId: TEST_USER_ID });

    const category = await createCategory(
      { name: 'Linkage Category', color: '#000000' },
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID
    );

    linkedHabitId = (await createHabit(
      {
        name: 'Linked Habit',
        categoryId: category.id,
        goal: { type: 'boolean', target: 1, frequency: 'daily' },
      },
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID
    )).id;

    unlinkedHabitId = (await createHabit(
      {
        name: 'Unlinked Habit',
        categoryId: category.id,
        goal: { type: 'boolean', target: 1, frequency: 'daily' },
      },
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID
    )).id;

    const routine = await createRoutine(TEST_HOUSEHOLD_ID, TEST_USER_ID, {
      title: 'Linkage Test Routine',
      linkedHabitIds: [linkedHabitId],
      steps: [{ id: 'step-1', title: 'Step 1', linkedHabitId: linkedHabitId }],
    });
    routineId = routine.id;
  });

  it('should reject habitIdsToComplete containing unlinked habit IDs', async () => {
    const testDate = '2025-06-01';

    const res = await request(app)
      .post(`/api/routines/${routineId}/submit`)
      .send({
        habitIdsToComplete: [linkedHabitId, unlinkedHabitId],
        dateOverride: testDate,
        submittedAt: new Date(`${testDate}T12:00:00Z`).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain(unlinkedHabitId);

    // Verify no entries were created (entire request rejected)
    const entries = await getHabitEntriesForDay(linkedHabitId, testDate, TEST_HOUSEHOLD_ID, TEST_USER_ID);
    expect(entries).toHaveLength(0);
  });

  it('should reject habitIdsToComplete with only unlinked habit IDs', async () => {
    const testDate = '2025-06-02';

    const res = await request(app)
      .post(`/api/routines/${routineId}/submit`)
      .send({
        habitIdsToComplete: [unlinkedHabitId],
        dateOverride: testDate,
        submittedAt: new Date(`${testDate}T12:00:00Z`).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should accept habitIdsToComplete with only linked habit IDs', async () => {
    const testDate = '2025-06-03';

    const res = await request(app)
      .post(`/api/routines/${routineId}/submit`)
      .send({
        habitIdsToComplete: [linkedHabitId],
        dateOverride: testDate,
        submittedAt: new Date(`${testDate}T12:00:00Z`).toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.createdOrUpdatedCount).toBe(1);

    // Verify the entry was created
    const entries = await getHabitEntriesForDay(linkedHabitId, testDate, TEST_HOUSEHOLD_ID, TEST_USER_ID);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('should accept empty habitIdsToComplete (no habits to validate)', async () => {
    const testDate = '2025-06-04';

    const res = await request(app)
      .post(`/api/routines/${routineId}/submit`)
      .send({
        habitIdsToComplete: [],
        dateOverride: testDate,
        submittedAt: new Date(`${testDate}T12:00:00Z`).toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.createdOrUpdatedCount).toBe(0);
  });
});
