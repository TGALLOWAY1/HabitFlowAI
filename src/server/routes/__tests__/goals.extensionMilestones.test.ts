/**
 * Goal extension milestone tests (Bug #2 — extended goals must show milestone
 * progression).
 *
 * When a goal is extended (50 -> 100), the new goal must carry the prior
 * target(s) forward as pre-acknowledged milestones so the achievements/goal UI
 * can render "50 done / 100 in progress" rather than a bare progress bar with no
 * history. Multiple extensions (50 -> 100 -> 150) accumulate all prior targets.
 *
 * This exercises the frontend extension path: POST /api/goals with
 * `iteratedFromGoalId` set and no explicit `milestones`.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { createGoalRoute } from '../goals';

const TEST_HOUSEHOLD_ID = 'test-household-extend-milestones';
const TEST_USER_ID = 'test-user-extend-milestones';

describe('Goal extension carries milestone history', () => {
    let app: Express;

    beforeAll(async () => {
        await setupTestMongo();

        app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            (req as any).householdId = TEST_HOUSEHOLD_ID;
            (req as any).userId = TEST_USER_ID;
            next();
        });

        app.post('/api/goals', createGoalRoute);
    });

    afterAll(async () => {
        await teardownTestMongo();
    });

    beforeEach(async () => {
        const db = await getTestDb();
        await db.collection('goals').deleteMany({ householdId: TEST_HOUSEHOLD_ID, userId: TEST_USER_ID });
    });

    async function createGoal(body: Record<string, unknown>) {
        const res = await request(app).post('/api/goals').send(body).expect(201);
        return res.body.goal;
    }

    it('adds a pre-acknowledged milestone at the prior target when extending 50 -> 100', async () => {
        const original = await createGoal({
            title: 'Job Applications',
            type: 'cumulative',
            targetValue: 50,
            unit: 'applications',
            linkedHabitIds: [],
        });

        const extended = await createGoal({
            title: 'Job Applications',
            type: 'cumulative',
            targetValue: 100,
            unit: 'applications',
            linkedHabitIds: [],
            iteratedFromGoalId: original.id,
        });

        expect(extended.iteratedFromGoalId).toBe(original.id);
        expect(extended.milestones).toHaveLength(1);
        expect(extended.milestones[0].value).toBe(50);
        // Carry-forward milestones represent already-celebrated checkpoints, so
        // they are pre-acknowledged to avoid re-popping a celebration modal.
        expect(typeof extended.milestones[0].acknowledgedAt).toBe('string');
    });

    it('accumulates all prior targets across multiple extensions (50 -> 100 -> 150)', async () => {
        const original = await createGoal({
            title: 'Job Applications',
            type: 'cumulative',
            targetValue: 50,
            linkedHabitIds: [],
        });

        const extended100 = await createGoal({
            title: 'Job Applications',
            type: 'cumulative',
            targetValue: 100,
            linkedHabitIds: [],
            iteratedFromGoalId: original.id,
        });

        expect(extended100.milestones.map((m: { value: number }) => m.value)).toEqual([50]);

        const extended150 = await createGoal({
            title: 'Job Applications',
            type: 'cumulative',
            targetValue: 150,
            linkedHabitIds: [],
            iteratedFromGoalId: extended100.id,
        });

        // The 150 goal carries both prior targets as ascending milestones.
        expect(extended150.milestones.map((m: { value: number }) => m.value)).toEqual([50, 100]);
        for (const m of extended150.milestones) {
            expect(typeof m.acknowledgedAt).toBe('string');
        }
    });

    it('does not add milestones at or above the new target', async () => {
        const original = await createGoal({
            title: 'Edge',
            type: 'cumulative',
            targetValue: 50,
            linkedHabitIds: [],
        });

        // Extend to a target only marginally above the prior one; the prior
        // target (50) is still strictly below 60, so it is carried.
        const extended = await createGoal({
            title: 'Edge',
            type: 'cumulative',
            targetValue: 60,
            linkedHabitIds: [],
            iteratedFromGoalId: original.id,
        });
        expect(extended.milestones.map((m: { value: number }) => m.value)).toEqual([50]);
    });

    it('respects client-supplied milestones over carry-forward defaults', async () => {
        const original = await createGoal({
            title: 'Explicit',
            type: 'cumulative',
            targetValue: 50,
            linkedHabitIds: [],
        });

        const extended = await createGoal({
            title: 'Explicit',
            type: 'cumulative',
            targetValue: 100,
            linkedHabitIds: [],
            iteratedFromGoalId: original.id,
            milestones: [{ value: 30 }, { value: 60 }],
        });

        // Explicit milestones win; carry-forward only fills the gap when the
        // client sends none.
        expect(extended.milestones.map((m: { value: number }) => m.value)).toEqual([30, 60]);
    });
});
