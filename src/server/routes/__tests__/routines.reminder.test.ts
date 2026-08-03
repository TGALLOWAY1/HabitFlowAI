/**
 * Routine Reminder Field Tests
 *
 * Validates that POST/PATCH /api/routines correctly handles the
 * reminderTime ("HH:mm") and reminderEnabled fields, including
 * format validation and the clear-with-null contract — the same
 * contract habits use (see habits.reminder.test.ts).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { createRoutineRoute, updateRoutineRoute } from '../routines';

const TEST_HOUSEHOLD_ID = 'test-routine-reminder-household';
const TEST_USER_ID = 'test-routine-reminder-user';

describe('Routine Reminder Fields (reminderTime + reminderEnabled)', () => {
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

    app.post('/api/routines', createRoutineRoute);
    app.patch('/api/routines/:id', updateRoutineRoute);
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const testDb = await getTestDb();
    await testDb.collection('routines').deleteMany({});
  });

  async function createRoutine(extra: Record<string, unknown> = {}) {
    return request(app)
      .post('/api/routines')
      .send({
        title: 'Wind Down',
        steps: [],
        ...extra,
      });
  }

  it('creates a routine with a valid reminderTime', async () => {
    const res = await createRoutine({ reminderTime: '21:00' });
    expect(res.status).toBe(201);
    expect(res.body.routine.reminderTime).toBe('21:00');
  });

  it('accepts boundary times 00:00 and 23:59', async () => {
    const early = await createRoutine({ reminderTime: '00:00' });
    expect(early.status).toBe(201);
    const late = await createRoutine({ reminderTime: '23:59' });
    expect(late.status).toBe(201);
  });

  it.each(['9:00', '25:00', '09:60', '0900', '09:00:00', 'evening'])(
    'rejects malformed reminderTime %s on create',
    async (bad) => {
      const res = await createRoutine({ reminderTime: bad });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  );

  it('treats null reminderTime as unset on create', async () => {
    const res = await createRoutine({ reminderTime: null });
    expect(res.status).toBe(201);
    expect(res.body.routine.reminderTime ?? undefined).toBeUndefined();
  });

  it('sets reminderTime via PATCH', async () => {
    const created = await createRoutine();
    const res = await request(app)
      .patch(`/api/routines/${created.body.routine.id}`)
      .send({ reminderTime: '07:30' });
    expect(res.status).toBe(200);
    expect(res.body.routine.reminderTime).toBe('07:30');
  });

  it('rejects malformed reminderTime via PATCH', async () => {
    const created = await createRoutine({ reminderTime: '07:30' });
    const res = await request(app)
      .patch(`/api/routines/${created.body.routine.id}`)
      .send({ reminderTime: '7:30pm' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('toggles reminderEnabled without losing reminderTime', async () => {
    const created = await createRoutine({ reminderTime: '07:30' });
    const id = created.body.routine.id;

    const off = await request(app).patch(`/api/routines/${id}`).send({ reminderEnabled: false });
    expect(off.status).toBe(200);
    expect(off.body.routine.reminderEnabled).toBe(false);
    expect(off.body.routine.reminderTime).toBe('07:30');

    const on = await request(app).patch(`/api/routines/${id}`).send({ reminderEnabled: true });
    expect(on.status).toBe(200);
    expect(on.body.routine.reminderEnabled).toBe(true);
    expect(on.body.routine.reminderTime).toBe('07:30');
  });

  it('clears reminderTime with null while keeping other fields', async () => {
    const created = await createRoutine({ reminderTime: '07:30' });
    const id = created.body.routine.id;

    const res = await request(app).patch(`/api/routines/${id}`).send({ reminderTime: null });
    expect(res.status).toBe(200);
    expect(res.body.routine.reminderTime ?? undefined).toBeUndefined();
    expect(res.body.routine.title).toBe('Wind Down');
  });
});
