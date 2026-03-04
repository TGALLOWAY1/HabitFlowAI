import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { requestContextMiddleware } from '../../middleware/requestContext';
import habitPotentialEvidenceRoutes from '../habitPotentialEvidence';

const HOUSEHOLD_ID = 'household-evidence-test';
const USER_A = 'user-evidence-a';
const USER_B = 'user-evidence-b';

function buildApp(householdId: string, userId: string): Express {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use((req, _res, next) => {
    (req as any).householdId = householdId;
    (req as any).userId = userId;
    next();
  });
  app.use('/api/evidence', habitPotentialEvidenceRoutes);
  return app;
}

describe('Evidence user scoping', () => {
  let appA: Express;
  let appB: Express;

  beforeAll(async () => {
    await setupTestMongo();
    appA = buildApp(HOUSEHOLD_ID, USER_A);
    appB = buildApp(HOUSEHOLD_ID, USER_B);
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('habitPotentialEvidence').deleteMany({});
  });

  it('user B cannot see evidence created by user A', async () => {
    const db = await getTestDb();
    await db.collection('habitPotentialEvidence').insertOne({
      id: 'ev-1',
      habitId: 'habit-1',
      routineId: 'routine-1',
      stepId: 'step-1',
      date: '2025-06-01',
      timestamp: new Date().toISOString(),
      source: 'routine-step',
      householdId: HOUSEHOLD_ID,
      userId: USER_A,
    });

    const resA = await request(appA).get('/api/evidence').query({ date: '2025-06-01' });
    expect(resA.status).toBe(200);
    expect(resA.body.evidence).toHaveLength(1);

    const resB = await request(appB).get('/api/evidence').query({ date: '2025-06-01' });
    expect(resB.status).toBe(200);
    expect(resB.body.evidence).toHaveLength(0);
  });

  it('returns { evidence: [...] } envelope', async () => {
    const res = await request(appA).get('/api/evidence').query({ date: '2025-06-01' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('evidence');
    expect(Array.isArray(res.body.evidence)).toBe(true);
  });
});
