/**
 * Tests for milestone configuration on PUT /goals/:id.
 *
 * Covers:
 * - Replacing the milestones array
 * - Clearing milestones via empty array
 * - Preserving acknowledgedAt on existing milestones across PUT-replace
 * - Rejecting type change to onetime when milestones are present
 * - Rejecting targetValue lowered below an existing milestone
 * - Rejecting milestones added on a onetime goal
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { updateGoalRoute, acknowledgeMilestoneRoute } from '../goals';
import { createGoal, getGoalById, updateGoal } from '../../repositories/goalRepository';
import { MONGO_COLLECTIONS } from '../../../models/persistenceTypes';

const HOUSEHOLD = 'test-household-goals-milestones';
const USER = 'test-user-goals-milestones';

let app: Express;

describe('PUT /api/goals/:id — milestones', () => {
  beforeAll(async () => {
    await setupTestMongo();

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).householdId = HOUSEHOLD;
      (req as any).userId = USER;
      next();
    });
    app.put('/api/goals/:id', updateGoalRoute);
    app.post('/api/goals/:id/milestones/:milestoneId/acknowledge', acknowledgeMilestoneRoute);
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection(MONGO_COLLECTIONS.GOALS).deleteMany({ householdId: HOUSEHOLD, userId: USER });
  });

  async function makeCumulativeGoal(milestones?: Array<{ id: string; value: number; acknowledgedAt?: string }>) {
    return createGoal(
      {
        title: '100 Pull-Ups',
        type: 'cumulative',
        targetValue: 100,
        linkedHabitIds: [],
        ...(milestones ? { milestones } : {}),
      },
      HOUSEHOLD,
      USER,
    );
  }

  it('replaces the milestones array on PUT', async () => {
    const goal = await makeCumulativeGoal([{ id: 'm-old', value: 30 }]);

    const res = await request(app)
      .put(`/api/goals/${goal.id}`)
      .send({ milestones: [{ value: 25 }, { value: 50 }, { value: 75 }] })
      .expect(200);

    expect(res.body.goal.milestones).toHaveLength(3);
    expect(res.body.goal.milestones.map((m: { value: number }) => m.value)).toEqual([25, 50, 75]);
  });

  it('clears milestones when given an empty array', async () => {
    const goal = await makeCumulativeGoal([{ id: 'm1', value: 25 }, { id: 'm2', value: 50 }]);

    await request(app)
      .put(`/api/goals/${goal.id}`)
      .send({ milestones: [] })
      .expect(200);

    const persisted = await getGoalById(goal.id, HOUSEHOLD, USER);
    expect(persisted?.milestones).toEqual([]);
  });

  it('preserves acknowledgedAt across PUT-replace by id', async () => {
    const ackTime = '2025-04-15T12:00:00.000Z';
    const goal = await makeCumulativeGoal([
      { id: 'm-25', value: 25, acknowledgedAt: ackTime },
      { id: 'm-50', value: 50 },
    ]);

    // Frontend re-sends milestones without acknowledgedAt — server merges from existing.
    const res = await request(app)
      .put(`/api/goals/${goal.id}`)
      .send({
        milestones: [
          { id: 'm-25', value: 25 },
          { id: 'm-50', value: 50 },
          { value: 75 },
        ],
      })
      .expect(200);

    const ms = res.body.goal.milestones;
    expect(ms.find((m: { id: string }) => m.id === 'm-25').acknowledgedAt).toBe(ackTime);
    expect(ms.find((m: { id: string }) => m.id === 'm-50').acknowledgedAt).toBeUndefined();
    expect(ms.find((m: { value: number }) => m.value === 75).id).toBeDefined();
  });

  it('drops acknowledgedAt for milestones removed from the array', async () => {
    const goal = await makeCumulativeGoal([
      { id: 'm-25', value: 25, acknowledgedAt: '2025-04-15T00:00:00.000Z' },
      { id: 'm-50', value: 50 },
    ]);

    await request(app)
      .put(`/api/goals/${goal.id}`)
      .send({ milestones: [{ id: 'm-50', value: 50 }] })
      .expect(200);

    const persisted = await getGoalById(goal.id, HOUSEHOLD, USER);
    expect(persisted?.milestones).toHaveLength(1);
    expect(persisted?.milestones?.[0].id).toBe('m-50');
  });

  it('rejects switching to onetime when milestones are present', async () => {
    const goal = await makeCumulativeGoal([{ id: 'm', value: 50 }]);

    const res = await request(app)
      .put(`/api/goals/${goal.id}`)
      .send({ type: 'onetime' })
      .expect(400);

    expect(res.body.error.message).toMatch(/Clear milestones first/);
  });

  it('allows switching to onetime when milestones are simultaneously cleared', async () => {
    const goal = await makeCumulativeGoal([{ id: 'm', value: 50 }]);

    await request(app)
      .put(`/api/goals/${goal.id}`)
      .send({ type: 'onetime', milestones: [] })
      .expect(200);
  });

  it('rejects targetValue lowered below an existing milestone', async () => {
    const goal = await makeCumulativeGoal([{ id: 'm', value: 75 }]);

    const res = await request(app)
      .put(`/api/goals/${goal.id}`)
      .send({ targetValue: 60 })
      .expect(400);

    expect(res.body.error.message).toMatch(/below existing milestone/);
  });

  it('allows targetValue change when milestones are simultaneously adjusted', async () => {
    const goal = await makeCumulativeGoal([{ id: 'm', value: 75 }]);

    await request(app)
      .put(`/api/goals/${goal.id}`)
      .send({ targetValue: 60, milestones: [{ value: 30 }] })
      .expect(200);
  });

  it('returns 404 when updating milestones on a non-existent goal', async () => {
    await request(app)
      .put('/api/goals/does-not-exist')
      .send({ milestones: [{ value: 25 }] })
      .expect(404);
  });

  it('rejects milestones on an existing onetime goal', async () => {
    const goal = await createGoal(
      {
        title: 'Pass Exam',
        type: 'onetime',
        linkedHabitIds: [],
      },
      HOUSEHOLD,
      USER,
    );

    const res = await request(app)
      .put(`/api/goals/${goal.id}`)
      .send({ milestones: [{ value: 1 }] })
      .expect(400);

    expect(res.body.error.message).toMatch(/cumulative/);
  });

  it('normalizes milestones to ascending order on PUT', async () => {
    const goal = await makeCumulativeGoal();

    const res = await request(app)
      .put(`/api/goals/${goal.id}`)
      .send({ milestones: [{ value: 75 }, { value: 25 }, { value: 50 }] })
      .expect(200);

    expect(res.body.goal.milestones.map((m: { value: number }) => m.value)).toEqual([25, 50, 75]);
  });

  // Touch updateGoal so the import is used (silences noUnusedVars in some configs).
  it('preserves milestones on a no-op direct update', async () => {
    const goal = await makeCumulativeGoal([{ id: 'm', value: 25 }]);
    const updated = await updateGoal(goal.id, HOUSEHOLD, USER, { notes: 'test' });
    expect(updated?.milestones).toHaveLength(1);
  });

  describe('POST /api/goals/:id/milestones/:milestoneId/acknowledge', () => {
    it('sets acknowledgedAt on the matching milestone', async () => {
      const goal = await makeCumulativeGoal([
        { id: 'm-25', value: 25 },
        { id: 'm-50', value: 50 },
      ]);

      const before = Date.now();
      const res = await request(app)
        .post(`/api/goals/${goal.id}/milestones/m-25/acknowledge`)
        .expect(200);
      const after = Date.now();

      const ack = res.body.goal.milestones.find((m: { id: string }) => m.id === 'm-25');
      expect(ack.acknowledgedAt).toBeDefined();
      const ackTime = Date.parse(ack.acknowledgedAt);
      expect(ackTime).toBeGreaterThanOrEqual(before);
      expect(ackTime).toBeLessThanOrEqual(after);

      // Other milestones untouched
      const other = res.body.goal.milestones.find((m: { id: string }) => m.id === 'm-50');
      expect(other.acknowledgedAt).toBeUndefined();
    });

    it('is idempotent — preserves the original acknowledgedAt on repeat call', async () => {
      const goal = await makeCumulativeGoal([{ id: 'm', value: 25 }]);

      const first = await request(app)
        .post(`/api/goals/${goal.id}/milestones/m/acknowledge`)
        .expect(200);
      const firstAck = first.body.goal.milestones[0].acknowledgedAt;
      expect(firstAck).toBeDefined();

      // Second call should not change the timestamp
      await new Promise((r) => setTimeout(r, 10));
      const second = await request(app)
        .post(`/api/goals/${goal.id}/milestones/m/acknowledge`)
        .expect(200);
      expect(second.body.goal.milestones[0].acknowledgedAt).toBe(firstAck);
    });

    it('returns 404 when the goal does not exist', async () => {
      await request(app)
        .post('/api/goals/no-goal/milestones/m/acknowledge')
        .expect(404);
    });

    it('returns 404 when the milestone id is unknown', async () => {
      const goal = await makeCumulativeGoal([{ id: 'm-25', value: 25 }]);
      await request(app)
        .post(`/api/goals/${goal.id}/milestones/wrong-id/acknowledge`)
        .expect(404);
    });
  });
});
