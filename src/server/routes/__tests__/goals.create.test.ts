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
    // tripping validation on Repeat / Level Up / Extend, which forwards the
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
});
