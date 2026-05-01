/**
 * Goal Create Routes Tests
 * 
 * Tests for Goal creation endpoint, specifically verifying 'onetime' goal support.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { createGoalRoute, getGoals } from '../goals';
import { getGoalsByUser } from '../../repositories/goalRepository';

const TEST_HOUSEHOLD_ID = 'test-household-goals';
const TEST_USER_ID = 'test-user-123';

describe('Goal Create Routes', () => {
    let app: Express;

    beforeAll(async () => {
        await setupTestMongo();

        app = express();
        app.use(express.json());

        // Add identity to request (simulating identity middleware)
        app.use((req, _res, next) => {
            (req as any).householdId = TEST_HOUSEHOLD_ID;
            (req as any).userId = TEST_USER_ID;
            next();
        });

        // Register routes
        app.get('/api/goals', getGoals);
        app.post('/api/goals', createGoalRoute);
    });

    afterAll(async () => {
        await teardownTestMongo();
    });

    beforeEach(async () => {
        // Clear ALL goals collection before each test to ensure isolation
        const testDb = await getTestDb();
        await testDb.collection('goals').deleteMany({});
    });

    describe('POST /api/goals - One-Time Goal', () => {
        it('should create a valid onetime goal', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Run Marathon',
                    type: 'onetime',
                    deadline: '2025-12-31',
                    linkedHabitIds: [],
                    targetValue: 1, // Optional but often sent
                    unit: 'event', // Optional
                })
                .expect(201);

            expect(response.body).toHaveProperty('goal');
            expect(response.body.goal.title).toBe('Run Marathon');
            expect(response.body.goal.type).toBe('onetime');
            expect(response.body.goal.deadline).toBe('2025-12-31');
            expect(response.body.goal).toHaveProperty('id');

            // Verify persistence
            const goals = await getGoalsByUser(TEST_HOUSEHOLD_ID, TEST_USER_ID);
            expect(goals).toHaveLength(1);
            expect(goals[0].title).toBe('Run Marathon');
            expect(goals[0].type).toBe('onetime');
        });

        it('should create onetime goal without targetValue and unit', async () => {
            // Logic for onetime goals allows optional targetValue
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Calculus Final',
                    type: 'onetime',
                    deadline: '2025-05-15',
                    linkedHabitIds: [],
                })
                .expect(201);

            expect(response.body.goal.title).toBe('Calculus Final');
            expect(response.body.goal.type).toBe('onetime');

            // Verify persistence
            const goals = await getGoalsByUser(TEST_HOUSEHOLD_ID, TEST_USER_ID);
            expect(goals).toHaveLength(1);
            expect(goals[0].title).toBe('Calculus Final');
        });

        it('should create onetime goal without deadline (optional)', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Flexible Event Goal',
                    type: 'onetime',
                    // Missing deadline - should be allowed
                    linkedHabitIds: [],
                })
                .expect(201);

            expect(response.body).toHaveProperty('goal');
            expect(response.body.goal.title).toBe('Flexible Event Goal');
            expect(response.body.goal.type).toBe('onetime');
            // Deadline should be null or undefined (database may store as null)
            expect(response.body.goal.deadline === null || response.body.goal.deadline === undefined).toBe(true);

            // Verify persistence
            const goals = await getGoalsByUser(TEST_HOUSEHOLD_ID, TEST_USER_ID);
            expect(goals).toHaveLength(1);
            expect(goals[0].title).toBe('Flexible Event Goal');
            // Deadline should be null or undefined (database may store as null)
            expect(goals[0].deadline === null || goals[0].deadline === undefined).toBe(true);
        });

        it('should fail if type is invalid', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Invalid Type',
                    type: 'invalid-type',
                    deadline: '2025-12-31',
                })
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            // This confirms that "type must be cumulative or onetime"
        });
    });

    // Regression: legacy goals stored with countMode/aggregationMode = null were
    // tripping validation on Repeat / Extend, which forwards the
    // original goal's mode fields verbatim. Validator now treats null the same
    // as undefined (i.e. "fall through to defaults").
    describe('POST /api/goals - legacy null mode fields', () => {
        it('should create a cumulative goal when countMode is explicitly null', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Journal',
                    type: 'cumulative',
                    targetValue: 10,
                    unit: 'entries',
                    linkedHabitIds: [],
                    countMode: null,
                    aggregationMode: null,
                })
                .expect(201);

            expect(response.body.goal.title).toBe('Journal');
            expect(response.body.goal.type).toBe('cumulative');
        });

        it('should still reject countMode set to a junk string', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Bad CountMode',
                    type: 'cumulative',
                    targetValue: 10,
                    linkedHabitIds: [],
                    countMode: 'banana',
                })
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            expect(response.body.error.message).toMatch(/countMode/);
        });
    });

    describe('POST /api/goals - Milestones', () => {
        it('should create a cumulative goal with valid milestones', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: '100 Pull-Ups',
                    type: 'cumulative',
                    targetValue: 100,
                    unit: 'pull-ups',
                    linkedHabitIds: [],
                    milestones: [{ value: 25 }, { value: 50 }, { value: 75 }],
                })
                .expect(201);

            expect(response.body.goal.milestones).toHaveLength(3);
            expect(response.body.goal.milestones.map((m: { value: number }) => m.value)).toEqual([25, 50, 75]);
            for (const milestone of response.body.goal.milestones) {
                expect(typeof milestone.id).toBe('string');
                expect(milestone.id.length).toBeGreaterThan(0);
                expect(milestone.acknowledgedAt).toBeUndefined();
            }
        });

        it('should normalize milestones into ascending order', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Sorted',
                    type: 'cumulative',
                    targetValue: 100,
                    linkedHabitIds: [],
                    milestones: [{ value: 75 }, { value: 25 }, { value: 50 }],
                })
                .expect(201);

            expect(response.body.goal.milestones.map((m: { value: number }) => m.value)).toEqual([25, 50, 75]);
        });

        it('should drop client-supplied acknowledgedAt on create', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Fresh Goal',
                    type: 'cumulative',
                    targetValue: 100,
                    linkedHabitIds: [],
                    milestones: [{ value: 25, acknowledgedAt: '2025-01-01T00:00:00.000Z' }],
                })
                .expect(201);

            expect(response.body.goal.milestones[0].acknowledgedAt).toBeUndefined();
        });

        it('should accept an empty milestones array', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'No milestones',
                    type: 'cumulative',
                    targetValue: 100,
                    linkedHabitIds: [],
                    milestones: [],
                })
                .expect(201);

            expect(response.body.goal.milestones).toEqual([]);
        });

        it('should reject milestones on a onetime goal', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Bad onetime',
                    type: 'onetime',
                    targetValue: 1,
                    linkedHabitIds: [],
                    milestones: [{ value: 1 }],
                })
                .expect(400);

            expect(response.body.error.message).toMatch(/cumulative/);
        });

        it('should reject duplicate milestone values', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Dups',
                    type: 'cumulative',
                    targetValue: 100,
                    linkedHabitIds: [],
                    milestones: [{ value: 25 }, { value: 25 }],
                })
                .expect(400);

            expect(response.body.error.message).toMatch(/unique/);
        });

        it('should reject milestone values >= targetValue', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Over',
                    type: 'cumulative',
                    targetValue: 100,
                    linkedHabitIds: [],
                    milestones: [{ value: 100 }],
                })
                .expect(400);

            expect(response.body.error.message).toMatch(/less than targetValue/);
        });

        it('should reject more than 20 milestones', async () => {
            const tooMany = Array.from({ length: 21 }, (_, i) => ({ value: i + 1 }));
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Too many',
                    type: 'cumulative',
                    targetValue: 100,
                    linkedHabitIds: [],
                    milestones: tooMany,
                })
                .expect(400);

            expect(response.body.error.message).toMatch(/at most 20/);
        });

        it('should reject non-positive milestone values', async () => {
            const response = await request(app)
                .post('/api/goals')
                .send({
                    title: 'Zero',
                    type: 'cumulative',
                    targetValue: 100,
                    linkedHabitIds: [],
                    milestones: [{ value: 0 }],
                })
                .expect(400);

            expect(response.body.error.message).toMatch(/positive/);
        });
    });
});
