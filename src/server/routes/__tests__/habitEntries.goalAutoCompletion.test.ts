/**
 * Goal auto-completion regression tests.
 *
 * Verifies that creating/updating/upserting an entry whose linked cumulative
 * goal reaches 100% causes the server to mark the goal as complete and surface
 * the goal id in the response under `completedGoalIds`. This is the path that
 * lets the celebration screen pop from anywhere in the app, not just the goal
 * detail page.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { createCategory } from '../../repositories/categoryRepository';
import { createHabit } from '../../repositories/habitRepository';
import { createGoal, getGoalById } from '../../repositories/goalRepository';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import {
    createHabitEntryRoute,
    upsertHabitEntryRoute,
    batchCreateEntriesRoute,
} from '../habitEntries';
import { requestContextMiddleware } from '../../middleware/requestContext';

const TEST_HOUSEHOLD = 'test-household-goal-autocomplete';
const TEST_USER = 'test-user-goal-autocomplete';

let app: Express;
let habitId: string;
let goalId: string;

function todayKey(): string {
    return new Date().toISOString().slice(0, 10);
}

describe('Goal auto-completion on entry mutation', () => {
    beforeAll(async () => {
        await setupTestMongo();

        app = express();
        app.use(express.json());
        app.use(requestContextMiddleware);
        app.use((req, _res, next) => {
            (req as any).householdId = TEST_HOUSEHOLD;
            (req as any).userId = TEST_USER;
            next();
        });

        app.post('/api/entries', createHabitEntryRoute);
        app.put('/api/entries', upsertHabitEntryRoute);
        app.post('/api/entries/batch', batchCreateEntriesRoute);
    });

    afterAll(async () => {
        await teardownTestMongo();
    });

    beforeEach(async () => {
        const db = await getTestDb();
        await Promise.all([
            db.collection('categories').deleteMany({ householdId: TEST_HOUSEHOLD, userId: TEST_USER }),
            db.collection('habits').deleteMany({ householdId: TEST_HOUSEHOLD, userId: TEST_USER }),
            db.collection('habitEntries').deleteMany({ householdId: TEST_HOUSEHOLD, userId: TEST_USER }),
            db.collection('goals').deleteMany({ householdId: TEST_HOUSEHOLD, userId: TEST_USER }),
        ]);

        const cat = await createCategory({ name: 'Test', color: '#FF0000' }, TEST_HOUSEHOLD, TEST_USER);
        const habit = await createHabit(
            {
                name: 'Run',
                categoryId: cat.id,
                goal: { type: 'number', frequency: 'daily', target: 5, unit: 'miles' },
            },
            TEST_HOUSEHOLD,
            TEST_USER
        );
        habitId = habit.id;

        const goal = await createGoal(
            {
                title: 'Run 10 miles',
                type: 'cumulative',
                targetValue: 10,
                unit: 'miles',
                linkedHabitIds: [habit.id],
                aggregationMode: 'sum',
            },
            TEST_HOUSEHOLD,
            TEST_USER
        );
        goalId = goal.id;
    });

    it('marks the goal complete and returns completedGoalIds when an entry pushes progress to 100%', async () => {
        const day = todayKey();

        const res = await request(app).post('/api/entries').send({
            habitId,
            dayKey: day,
            value: 10,
            source: 'manual',
            timeZone: 'UTC',
        });
        expect(res.status).toBe(201);
        expect(res.body.completedGoalIds).toEqual([goalId]);

        const goal = await getGoalById(goalId, TEST_HOUSEHOLD, TEST_USER);
        expect(goal?.completedAt).toBeTruthy();
    });

    it('does NOT mark the goal complete when progress is below the target', async () => {
        const day = todayKey();

        const res = await request(app).post('/api/entries').send({
            habitId,
            dayKey: day,
            value: 4,
            source: 'manual',
            timeZone: 'UTC',
        });
        expect(res.status).toBe(201);
        expect(res.body.completedGoalIds).toEqual([]);

        const goal = await getGoalById(goalId, TEST_HOUSEHOLD, TEST_USER);
        expect(goal?.completedAt).toBeFalsy();
    });

    it('does not double-mark a goal that is already completed', async () => {
        const day = todayKey();

        // First entry: completes the goal.
        const first = await request(app).post('/api/entries').send({
            habitId, dayKey: day, value: 10, source: 'manual', timeZone: 'UTC',
        });
        expect(first.body.completedGoalIds).toEqual([goalId]);

        const completedAtAfterFirst = (await getGoalById(goalId, TEST_HOUSEHOLD, TEST_USER))?.completedAt;

        // Second entry on a different day pushes the count higher; should NOT
        // re-emit the goal id (it's already completed).
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const second = await request(app).post('/api/entries').send({
            habitId, dayKey: tomorrow, value: 5, source: 'manual', timeZone: 'UTC',
        });
        expect(second.body.completedGoalIds).toEqual([]);

        const goal = await getGoalById(goalId, TEST_HOUSEHOLD, TEST_USER);
        expect(goal?.completedAt).toBe(completedAtAfterFirst);
    });

    it('surfaces completion via the upsert (PUT) entry route too', async () => {
        const day = todayKey();

        const res = await request(app).put('/api/entries').send({
            habitId,
            dateKey: day,
            value: 10,
            source: 'manual',
            timeZone: 'UTC',
        });
        expect(res.status).toBe(200);
        expect(res.body.completedGoalIds).toEqual([goalId]);
    });
});
