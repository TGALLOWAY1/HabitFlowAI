/**
 * Goal Create Routes Tests
 * 
 * Tests for Goal creation endpoint, specifically verifying 'onetime' goal support.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

// Set environment variables BEFORE importing modules that use them
if (!process.env.MONGODB_URI) {
    process.env.MONGODB_URI = 'mongodb://localhost:27017';
}
process.env.USE_MONGO_PERSISTENCE = 'true';

import { createGoalRoute, getGoals } from '../goals';
import { getDb, closeConnection } from '../../lib/mongoClient';
import { getGoalsByUser } from '../../repositories/goalRepository';

// Use test database
const TEST_DB_NAME = 'habitflowai_test_goals';
const TEST_USER_ID = 'test-user-123';

// Store original env values
let originalDbName: string | undefined;

describe('Goal Create Routes', () => {
    let app: Express;

    beforeAll(async () => {
        // Use test database (env vars already set at top of file)
        originalDbName = process.env.MONGODB_DB_NAME;
        process.env.MONGODB_DB_NAME = TEST_DB_NAME;

        // Set up Express app
        app = express();
        app.use(express.json());

        // Add userId to request (simulating auth middleware)
        app.use((req, _res, next) => {
            (req as any).userId = TEST_USER_ID;
            next();
        });

        // Register routes
        app.get('/api/goals', getGoals);
        app.post('/api/goals', createGoalRoute);
    });

    afterAll(async () => {
        // Clean up test database
        const testDb = await getDb();
        await testDb.dropDatabase();
        await closeConnection();

        // Restore original env
        if (originalDbName) {
            process.env.MONGODB_DB_NAME = originalDbName;
        } else {
            delete process.env.MONGODB_DB_NAME;
        }
    });

    beforeEach(async () => {
        // Clear ALL goals collection before each test to ensure isolation
        const testDb = await getDb();
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
            const goals = await getGoalsByUser(TEST_USER_ID);
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
            const goals = await getGoalsByUser(TEST_USER_ID);
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
            const goals = await getGoalsByUser(TEST_USER_ID);
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
            // This confirms that "type must be cumulative, frequency, or onetime"
        });
    });
});
