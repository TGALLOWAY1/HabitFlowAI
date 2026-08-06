/**
 * Goal Lifecycle Status Tests
 *
 * Covers the `status` ('active' | 'scheduled' | 'backlog') and `startDate`
 * fields: create/update validation, tracked-goal restrictions, and lazy
 * promotion of scheduled goals whose startDate has arrived.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { createGoalRoute, updateGoalRoute, getGoals } from '../goals';
import { createGoal, getGoalById } from '../../repositories/goalRepository';

const TEST_HOUSEHOLD_ID = 'test-household-goal-status';
const TEST_USER_ID = 'test-user-status';

async function seedGoal(overrides: Record<string, unknown> = {}) {
    return createGoal(
        {
            title: 'Seeded goal',
            type: 'cumulative',
            targetValue: 10,
            linkedHabitIds: [],
            ...overrides,
        } as any,
        TEST_HOUSEHOLD_ID,
        TEST_USER_ID
    );
}

describe('Goal Lifecycle Status', () => {
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

        app.get('/api/goals', getGoals);
        app.post('/api/goals', createGoalRoute);
        app.put('/api/goals/:id', updateGoalRoute);
    });

    afterAll(async () => {
        await teardownTestMongo();
    });

    beforeEach(async () => {
        const testDb = await getTestDb();
        await testDb.collection('goals').deleteMany({});
    });

    describe('POST /api/goals', () => {
        it('creates a scheduled goal with a startDate', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Learn Rust',
                    type: 'cumulative',
                    targetValue: 20,
                    linkedHabitIds: [],
                    status: 'scheduled',
                    startDate: '2099-01-15',
                })
                .expect(201);

            expect(response.body.goal.status).toBe('scheduled');
            expect(response.body.goal.startDate).toBe('2099-01-15');
        });

        it('creates a backlog goal without a startDate', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Someday project',
                    type: 'onetime',
                    linkedHabitIds: [],
                    status: 'backlog',
                })
                .expect(201);

            expect(response.body.goal.status).toBe('backlog');
        });

        it('stores no status field for a plain create (active default)', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Plain goal',
                    type: 'onetime',
                    linkedHabitIds: [],
                })
                .expect(201);

            expect(response.body.goal.status ?? null).toBeNull();

            const stored = await getGoalById(response.body.goal.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
            expect(stored?.status ?? null).toBeNull();
        });

        it('rejects an invalid status value', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Bad status',
                    type: 'onetime',
                    linkedHabitIds: [],
                    status: 'paused',
                })
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            expect(response.body.error.message).toMatch(/status/);
        });

        it('rejects startDate when status is not scheduled', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Backlog with date',
                    type: 'onetime',
                    linkedHabitIds: [],
                    status: 'backlog',
                    startDate: '2099-01-15',
                })
                .expect(400);

            expect(response.body.error.message).toMatch(/startDate/);
        });

        it('rejects a malformed startDate', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Bad date',
                    type: 'onetime',
                    linkedHabitIds: [],
                    status: 'scheduled',
                    startDate: 'next tuesday',
                })
                .expect(400);

            expect(response.body.error.message).toMatch(/YYYY-MM-DD/);
        });

        it('tolerates explicit null status (legacy documents)', async () => {
            await request(app)
                .post('/api/goals')
                .send({
                    title: 'Null status',
                    type: 'onetime',
                    linkedHabitIds: [],
                    status: null,
                })
                .expect(201);
        });
    });

    describe('PUT /api/goals/:id', () => {
        it('moves an active goal to backlog', async () => {
            const goal = await seedGoal();

            const response = await request(app)
                .put(`/api/goals/${goal.id}`)
                .send({ status: 'backlog' })
                .expect(200);

            expect(response.body.goal.status).toBe('backlog');
        });

        it('clears startDate when a scheduled goal becomes active', async () => {
            const goal = await seedGoal({ status: 'scheduled', startDate: '2099-03-01' });

            await request(app)
                .put(`/api/goals/${goal.id}`)
                .send({ status: 'active' })
                .expect(200);

            const stored = await getGoalById(goal.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
            expect(stored?.status).toBe('active');
            expect(stored?.startDate ?? null).toBeNull();
        });

        it('sets a startDate on an already-scheduled goal', async () => {
            const goal = await seedGoal({ status: 'scheduled' });

            await request(app)
                .put(`/api/goals/${goal.id}`)
                .send({ startDate: '2099-06-01' })
                .expect(200);

            const stored = await getGoalById(goal.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
            expect(stored?.startDate).toBe('2099-06-01');
        });

        it('rejects startDate on a non-scheduled goal', async () => {
            const goal = await seedGoal();

            const response = await request(app)
                .put(`/api/goals/${goal.id}`)
                .send({ startDate: '2099-06-01' })
                .expect(400);

            expect(response.body.error.message).toMatch(/scheduled/);
        });

        it('rejects a status change on a tracked goal', async () => {
            const goal = await seedGoal({ trackId: 'track-1', trackOrder: 0, trackStatus: 'active' });

            const response = await request(app)
                .put(`/api/goals/${goal.id}`)
                .send({ status: 'backlog' })
                .expect(400);

            expect(response.body.error.message).toMatch(/track/);
        });

        it('accepts a re-sent unchanged status on a tracked goal (edit modal round-trip)', async () => {
            const goal = await seedGoal({ trackId: 'track-1', trackOrder: 0, trackStatus: 'active' });

            await request(app)
                .put(`/api/goals/${goal.id}`)
                .send({ title: 'Renamed tracked goal', status: 'active' })
                .expect(200);

            const stored = await getGoalById(goal.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
            expect(stored?.title).toBe('Renamed tracked goal');
        });

        it('rejects an invalid status value', async () => {
            const goal = await seedGoal();

            await request(app)
                .put(`/api/goals/${goal.id}`)
                .send({ status: 'someday' })
                .expect(400);
        });
    });

    describe('GET /api/goals — lazy promotion of due scheduled goals', () => {
        it('promotes a scheduled goal whose startDate has arrived and persists it', async () => {
            const goal = await seedGoal({ status: 'scheduled', startDate: '2020-01-01' });

            const response = await request(app).get('/api/goals').expect(200);
            const returned = response.body.goals.find((g: { id: string }) => g.id === goal.id);
            expect(returned.status).toBe('active');
            expect(returned.startDate ?? null).toBeNull();

            // Persisted, not just decorated on the response
            const stored = await getGoalById(goal.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
            expect(stored?.status).toBe('active');
            expect(stored?.startDate ?? null).toBeNull();
        });

        it('leaves a future-dated scheduled goal untouched', async () => {
            const goal = await seedGoal({ status: 'scheduled', startDate: '2099-01-01' });

            const response = await request(app).get('/api/goals').expect(200);
            const returned = response.body.goals.find((g: { id: string }) => g.id === goal.id);
            expect(returned.status).toBe('scheduled');
            expect(returned.startDate).toBe('2099-01-01');
        });

        it('leaves an undated scheduled goal untouched', async () => {
            const goal = await seedGoal({ status: 'scheduled' });

            const response = await request(app).get('/api/goals').expect(200);
            const returned = response.body.goals.find((g: { id: string }) => g.id === goal.id);
            expect(returned.status).toBe('scheduled');
        });

        it('never promotes a tracked goal', async () => {
            const goal = await seedGoal({
                status: 'scheduled',
                startDate: '2020-01-01',
                trackId: 'track-1',
                trackOrder: 0,
                trackStatus: 'locked',
            });

            await request(app).get('/api/goals').expect(200);
            const stored = await getGoalById(goal.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
            expect(stored?.status).toBe('scheduled');
        });
    });
});
