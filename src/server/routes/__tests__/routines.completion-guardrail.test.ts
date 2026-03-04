/**
 * Guardrail: Routine completion alone must never create HabitEntries or affect day view/progress.
 *
 * - Submitting a routine with no habitIdsToComplete creates RoutineLog only; no HabitEntries.
 * - Day view and progress derive only from HabitEntries; routine/evidence never count as completion.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { submitRoutineRoute } from '../routines';
import { getDayView } from '../dayView';
import { getProgressOverview } from '../progress';
import { createRoutine } from '../../repositories/routineRepository';
import { createHabit } from '../../repositories/habitRepository';
import { createCategory } from '../../repositories/categoryRepository';
import { getHabitEntriesForDay } from '../../repositories/habitEntryRepository';

const TEST_HOUSEHOLD_ID = 'test-household-guardrail';
const TEST_USER_ID = 'test-user-routine-guardrail';

function getTodayDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

describe('Routine completion does not auto-log habits', () => {
  let app: Express;
  let routineId: string;
  let habitId1: string;
  let habitId2: string;
  const dayKey = getTodayDayKey();

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
    app.get('/api/dayView', getDayView);
    app.get('/api/progress/overview', getProgressOverview);
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
      { name: 'Guardrail Category', color: '#000000', order: 0 },
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID
    );

    const habit1 = await createHabit(
      {
        name: 'Guardrail Habit 1',
        categoryId: category.id,
        goal: { type: 'daily', target: 1, unit: 'times', frequency: 'daily' },
        order: 0,
      },
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID
    );
    habitId1 = habit1.id;

    const habit2 = await createHabit(
      {
        name: 'Guardrail Habit 2',
        categoryId: category.id,
        goal: { type: 'daily', target: 1, unit: 'times', frequency: 'daily' },
        order: 1,
      },
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID
    );
    habitId2 = habit2.id;

    const routine = await createRoutine(TEST_HOUSEHOLD_ID, TEST_USER_ID, {
      title: 'Guardrail Routine',
      linkedHabitIds: [habitId1, habitId2],
      steps: [
        { id: 'step-1', title: 'Step 1' },
        { id: 'step-2', title: 'Step 2' },
      ],
    });
    routineId = routine.id;
  });

  it('complete routine without logging any selected habits: day view and progress unchanged, no new HabitEntries', async () => {
    const dayViewBefore = await request(app)
      .get('/api/dayView')
      .query({ dayKey, timeZone: 'UTC' });
    const progressBefore = await request(app)
      .get('/api/progress/overview')
      .query({ timeZone: 'UTC' });

    expect(dayViewBefore.status).toBe(200);
    expect(progressBefore.status).toBe(200);

    const habit1CompleteBefore = dayViewBefore.body.habits?.find((h: any) => h.habit?.id === habitId1)?.isComplete ?? false;
    const habit2CompleteBefore = dayViewBefore.body.habits?.find((h: any) => h.habit?.id === habitId2)?.isComplete ?? false;

    const res = await request(app)
      .post(`/api/routines/${routineId}/submit`)
      .send({
        submittedAt: new Date().toISOString(),
        habitIdsToComplete: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.createdOrUpdatedCount).toBe(0);
    expect(res.body.completedHabitIds).toEqual([]);

    const entries1 = await getHabitEntriesForDay(habitId1, dayKey, TEST_HOUSEHOLD_ID, TEST_USER_ID);
    const entries2 = await getHabitEntriesForDay(habitId2, dayKey, TEST_HOUSEHOLD_ID, TEST_USER_ID);
    expect(entries1).toHaveLength(0);
    expect(entries2).toHaveLength(0);

    const dayViewAfter = await request(app)
      .get('/api/dayView')
      .query({ dayKey, timeZone: 'UTC' });
    const progressAfter = await request(app)
      .get('/api/progress/overview')
      .query({ timeZone: 'UTC' });

    expect(dayViewAfter.status).toBe(200);
    expect(progressAfter.status).toBe(200);

    const habit1CompleteAfter = dayViewAfter.body.habits?.find((h: any) => h.habit?.id === habitId1)?.isComplete ?? false;
    const habit2CompleteAfter = dayViewAfter.body.habits?.find((h: any) => h.habit?.id === habitId2)?.isComplete ?? false;

    expect(habit1CompleteAfter).toBe(habit1CompleteBefore);
    expect(habit2CompleteAfter).toBe(habit2CompleteBefore);
  });
});
