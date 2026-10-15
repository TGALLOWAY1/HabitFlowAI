/**
 * Daily Check-in Routes Tests
 *
 * Validation and round-trip behavior for GET/PUT /api/dailyCheckIns/:dayKey.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import type { RequestWithIdentity } from '../../middleware/identity';
import { getDailyCheckInRoute, upsertDailyCheckInRoute, parseDailyCheckInBody } from '../dailyCheckIns';

const TEST_USER_ID = 'test-user-checkin';
const TEST_HOUSEHOLD_ID = 'test-household-checkin';
const DAY = '2026-10-12';

describe('Daily Check-in Routes', () => {
  let app: Express;

  beforeAll(async () => {
    await setupTestMongo();

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const identityRequest = req as RequestWithIdentity;
      identityRequest.householdId = TEST_HOUSEHOLD_ID;
      identityRequest.userId = TEST_USER_ID;
      next();
    });
    app.get('/api/dailyCheckIns/:dayKey', getDailyCheckInRoute);
    app.put('/api/dailyCheckIns/:dayKey', upsertDailyCheckInRoute);
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('dailyCheckIns').deleteMany({});
  });

  it('GET returns null for a day without a check-in', async () => {
    const response = await request(app).get(`/api/dailyCheckIns/${DAY}`).expect(200);
    expect(response.body).toEqual({ checkIn: null });
  });

  it('rejects an invalid dayKey', async () => {
    await request(app).get('/api/dailyCheckIns/not-a-day').expect(400);
    await request(app).put('/api/dailyCheckIns/2026-13-40').send({ currentStep: 1 }).expect(400);
  });

  it('PUT then GET round-trips the normalized check-in', async () => {
    const put = await request(app)
      .put(`/api/dailyCheckIns/${DAY}`)
      .send({
        status: 'in_progress',
        currentStep: 3,
        habits: [
          { habitId: 'h1', completionStatus: 'partial', moodScore: 4, moodTags: ['calm', 'calm', 'proud'], effortScore: 2, journalEntry: 'Went well' },
          { habitId: 'h2', completionStatus: null, moodScore: null, moodTags: [], effortScore: null, journalEntry: '   ' },
        ],
      })
      .expect(200);

    expect(put.body.checkIn.currentStep).toBe(3);
    // Empty reflection records are dropped; tags are de-duplicated.
    expect(put.body.checkIn.habits).toEqual([
      { habitId: 'h1', completionStatus: 'partial', moodScore: 4, moodTags: ['calm', 'proud'], effortScore: 2, journalEntry: 'Went well' },
    ]);

    const get = await request(app).get(`/api/dailyCheckIns/${DAY}`).expect(200);
    expect(get.body.checkIn.id).toBe(put.body.checkIn.id);
    expect(get.body.checkIn.habits).toEqual(put.body.checkIn.habits);
  });

  it('marks the check-in complete', async () => {
    const response = await request(app)
      .put(`/api/dailyCheckIns/${DAY}`)
      .send({ status: 'complete', currentStep: 5, habits: [] })
      .expect(200);
    expect(response.body.checkIn.status).toBe('complete');
    expect(response.body.checkIn.completedAt).toBeTruthy();
  });

  it('refuses to store "done" — completion is derived from habit entries', async () => {
    const response = await request(app)
      .put(`/api/dailyCheckIns/${DAY}`)
      .send({ currentStep: 2, habits: [{ habitId: 'h1', completionStatus: 'done' }] })
      .expect(400);
    expect(response.body.error.message).toMatch(/derived from habit entries/);
  });
});

describe('parseDailyCheckInBody', () => {
  it('defaults status and step and accepts an empty habit list', () => {
    expect(parseDailyCheckInBody({})).toEqual({
      ok: true,
      value: { status: 'in_progress', currentStep: 1, habits: [] },
    });
  });

  it.each([
    [{ status: 'done' }, /status/],
    [{ currentStep: 0 }, /currentStep/],
    [{ currentStep: 6 }, /currentStep/],
    [{ currentStep: 2.5 }, /currentStep/],
    [{ habits: 'nope' }, /habits must be an array/],
    [{ habits: [{ habitId: '' }] }, /habitId/],
    [{ habits: [{ habitId: 'h1', moodScore: 0 }] }, /moodScore/],
    [{ habits: [{ habitId: 'h1', effortScore: 6 }] }, /effortScore/],
    [{ habits: [{ habitId: 'h1', moodScore: 3.5 }] }, /moodScore/],
    [{ habits: [{ habitId: 'h1', moodTags: ['angry'] }] }, /unknown tag/],
    [{ habits: [{ habitId: 'h1', completionStatus: 'maybe' }] }, /completionStatus/],
    [{ habits: [{ habitId: 'h1', journalEntry: 'x'.repeat(501) }] }, /at most 500/],
    [{ habits: [{ habitId: 'h1', moodScore: 2 }, { habitId: 'h1', moodScore: 3 }] }, /Duplicate habitId/],
    [null, /must be an object/],
  ])('rejects %j', (body, message) => {
    const result = parseDailyCheckInBody(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });
});
