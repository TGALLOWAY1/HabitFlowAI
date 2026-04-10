/**
 * Tests for tracked-goal edit validation and ghost habit-ID preservation.
 *
 * These cover three tightly-related fixes:
 *
 *  1. PART A — The category gate for tracked goals should only reject when the
 *     category is ACTUALLY changing. Previously, re-sending the unchanged
 *     categoryId (the Edit Goal modal does this on every save) would
 *     incorrectly trip a "Cannot change category of a goal that belongs to a
 *     track" error on any edit to a tracked goal.
 *
 *  2. PART B — The linkedHabitIds validator should only reject NEWLY-added
 *     IDs that don't resolve to a live habit. Pre-existing stale IDs (IDs of
 *     habits that were deleted after being linked) must be allowed to persist
 *     so that deleted habits' historical entries continue to contribute to
 *     goal progress — that is the documented design intent in
 *     `deleteHabitRoute` and `computeGoalProgressV2`.
 *
 *  3. PART E — The multi-goal-aware bidirectional sync helpers
 *     (`linkHabitsToGoal` / `unlinkHabitsFromGoal`) must preserve a stable
 *     `Habit.linkedGoalId` UI hint when the habit is linked to multiple goals.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { updateGoalRoute } from '../goals';
import { createGoal } from '../../repositories/goalRepository';
import { createGoalTrack } from '../../repositories/goalTrackRepository';
import {
  createHabit,
  deleteHabit,
  getHabitById,
  linkHabitsToGoal,
  unlinkHabitsFromGoal,
} from '../../repositories/habitRepository';
import { MONGO_COLLECTIONS, type Goal } from '../../../models/persistenceTypes';

const HOUSEHOLD = 'test-household-goals-tracked-edit';
const USER = 'test-user-goals-tracked-edit';
const CATEGORY_MUSIC = 'cat-music';
const CATEGORY_FITNESS = 'cat-fitness';

let app: Express;

describe('Tracked goal edit validation & multi-goal sync', () => {
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
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await Promise.all([
      db.collection(MONGO_COLLECTIONS.GOALS).deleteMany({ householdId: HOUSEHOLD, userId: USER }),
      db.collection(MONGO_COLLECTIONS.GOAL_TRACKS).deleteMany({ householdId: HOUSEHOLD, userId: USER }),
      db.collection('habits').deleteMany({ householdId: HOUSEHOLD, userId: USER }),
    ]);
  });

  async function makeHabit(name: string, categoryId: string) {
    return createHabit(
      {
        name,
        categoryId,
        goal: { type: 'boolean', frequency: 'daily', target: 1 },
      },
      HOUSEHOLD,
      USER
    );
  }

  async function makeTrack(name: string, categoryId: string) {
    return createGoalTrack({ name, categoryId }, HOUSEHOLD, USER);
  }

  async function makeGoal(
    title: string,
    categoryId: string,
    linkedHabitIds: string[] = [],
    extra: Partial<Goal> = {}
  ) {
    return createGoal(
      {
        title,
        type: 'onetime',
        linkedHabitIds,
        categoryId,
        ...extra,
      } as Omit<Goal, 'id' | 'createdAt'>,
      HOUSEHOLD,
      USER
    );
  }

  // -------------------------------------------------------------------------
  // Part A — Category gate only fires when category actually changes
  // -------------------------------------------------------------------------

  describe('Part A: tracked-goal category gate', () => {
    it('allows PATCH that re-sends the unchanged categoryId on a tracked goal', async () => {
      const habit = await makeHabit('Deep work on music', CATEGORY_MUSIC);
      const track = await makeTrack('Music Releases', CATEGORY_MUSIC);
      const goal = await makeGoal('Release Tribe Wobble', CATEGORY_MUSIC, [habit.id], {
        trackId: track.id,
        trackStatus: 'active',
      });

      const res = await request(app)
        .put(`/api/goals/${goal.id}`)
        .send({
          title: 'Release Tribe Wobble (updated)',
          categoryId: CATEGORY_MUSIC, // unchanged — should NOT trip the gate
        });

      expect(res.status).toBe(200);
      expect(res.body.goal.title).toBe('Release Tribe Wobble (updated)');
      expect(res.body.goal.categoryId).toBe(CATEGORY_MUSIC);
    });

    it('rejects PATCH that tries to change the categoryId on a tracked goal', async () => {
      const habit = await makeHabit('Deep work on music', CATEGORY_MUSIC);
      const track = await makeTrack('Music Releases', CATEGORY_MUSIC);
      const goal = await makeGoal('Release Tribe Wobble', CATEGORY_MUSIC, [habit.id], {
        trackId: track.id,
        trackStatus: 'active',
      });

      const res = await request(app)
        .put(`/api/goals/${goal.id}`)
        .send({ categoryId: CATEGORY_FITNESS });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/Cannot change category of a goal that belongs to a track/);
    });

    it('allows categoryId changes on NON-tracked goals', async () => {
      const habit = await makeHabit('Random habit', CATEGORY_FITNESS);
      const goal = await makeGoal('Random goal', CATEGORY_FITNESS, [habit.id]);

      const res = await request(app)
        .put(`/api/goals/${goal.id}`)
        .send({ categoryId: CATEGORY_MUSIC });

      expect(res.status).toBe(200);
      expect(res.body.goal.categoryId).toBe(CATEGORY_MUSIC);
    });
  });

  // -------------------------------------------------------------------------
  // Part B — Pre-existing stale habit IDs may persist in linkedHabitIds
  // -------------------------------------------------------------------------

  describe('Part B: ghost habit-ID preservation in linkedHabitIds', () => {
    it('allows PATCH that keeps a pre-existing linkedHabitId whose habit has been deleted', async () => {
      const habitA = await makeHabit('Habit A', CATEGORY_MUSIC);
      const habitB = await makeHabit('Habit B', CATEGORY_MUSIC);
      const goal = await makeGoal('Music goal', CATEGORY_MUSIC, [habitA.id, habitB.id]);

      // Delete habitA — its ID is now stale but must be allowed to persist
      await deleteHabit(habitA.id, HOUSEHOLD, USER);

      const res = await request(app)
        .put(`/api/goals/${goal.id}`)
        .send({
          title: 'Music goal (edited)',
          linkedHabitIds: [habitA.id, habitB.id], // stale + live, unchanged from goal
        });

      expect(res.status).toBe(200);
      expect(res.body.goal.linkedHabitIds).toEqual([habitA.id, habitB.id]);
    });

    it('rejects PATCH that ADDS a non-existent habit ID', async () => {
      const habitA = await makeHabit('Habit A', CATEGORY_MUSIC);
      const goal = await makeGoal('Music goal', CATEGORY_MUSIC, [habitA.id]);

      const res = await request(app)
        .put(`/api/goals/${goal.id}`)
        .send({
          linkedHabitIds: [habitA.id, 'nonexistent-habit-id'],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/nonexistent-habit-id/);
    });

    it('allows PATCH mixing pre-existing stale IDs with newly added valid IDs', async () => {
      const habitA = await makeHabit('Habit A', CATEGORY_MUSIC);
      const habitB = await makeHabit('Habit B', CATEGORY_MUSIC);
      const goal = await makeGoal('Music goal', CATEGORY_MUSIC, [habitA.id]);

      // Delete habitA so it becomes stale
      await deleteHabit(habitA.id, HOUSEHOLD, USER);

      // Now add habitB alongside the stale habitA reference
      const res = await request(app)
        .put(`/api/goals/${goal.id}`)
        .send({
          linkedHabitIds: [habitA.id, habitB.id],
        });

      expect(res.status).toBe(200);
      expect(res.body.goal.linkedHabitIds).toEqual([habitA.id, habitB.id]);
    });
  });

  // -------------------------------------------------------------------------
  // Part E — Multi-goal-aware linkedGoalId sync
  // -------------------------------------------------------------------------

  describe('Part E: multi-goal-aware linkedGoalId sync helpers', () => {
    it('linkHabitsToGoal does not clobber linkedGoalId when another goal still references the habit', async () => {
      const habit = await makeHabit('Deep work on music', CATEGORY_MUSIC);
      const goalA = await makeGoal('Song A', CATEGORY_MUSIC, [habit.id]);
      const goalB = await makeGoal('Song B', CATEGORY_MUSIC, []);

      // Link habit to goalA first
      await linkHabitsToGoal([habit.id], goalA.id, HOUSEHOLD, USER);

      // Refresh goalB to include the habit in its linkedHabitIds, then sync
      const db = await getTestDb();
      await db.collection(MONGO_COLLECTIONS.GOALS).updateOne(
        { id: goalB.id, householdId: HOUSEHOLD, userId: USER },
        { $set: { linkedHabitIds: [habit.id] } }
      );
      await linkHabitsToGoal([habit.id], goalB.id, HOUSEHOLD, USER);

      // linkedGoalId should still point at goalA, because goalA still references the habit
      const h = await getHabitById(habit.id, HOUSEHOLD, USER);
      expect(h?.linkedGoalId).toBe(goalA.id);
    });

    it('unlinkHabitsFromGoal switches linkedGoalId to another referencing goal instead of clearing', async () => {
      const habit = await makeHabit('Deep work on music', CATEGORY_MUSIC);
      const goalA = await makeGoal('Song A', CATEGORY_MUSIC, [habit.id]);
      const goalB = await makeGoal('Song B', CATEGORY_MUSIC, [habit.id]);

      // habit is initially linked to goalA via linkHabitsToGoal
      await linkHabitsToGoal([habit.id], goalA.id, HOUSEHOLD, USER);
      let h = await getHabitById(habit.id, HOUSEHOLD, USER);
      expect(h?.linkedGoalId).toBe(goalA.id);

      // Now unlink from goalA — goalB still references the habit, so linkedGoalId
      // should switch to goalB, not be cleared
      await unlinkHabitsFromGoal(goalA.id, HOUSEHOLD, USER);

      h = await getHabitById(habit.id, HOUSEHOLD, USER);
      expect(h?.linkedGoalId).toBe(goalB.id);
    });

    it('unlinkHabitsFromGoal clears linkedGoalId when no other goal references the habit', async () => {
      const habit = await makeHabit('Orphan habit', CATEGORY_MUSIC);
      const goalA = await makeGoal('Only goal', CATEGORY_MUSIC, [habit.id]);

      await linkHabitsToGoal([habit.id], goalA.id, HOUSEHOLD, USER);
      let h = await getHabitById(habit.id, HOUSEHOLD, USER);
      expect(h?.linkedGoalId).toBe(goalA.id);

      await unlinkHabitsFromGoal(goalA.id, HOUSEHOLD, USER);
      h = await getHabitById(habit.id, HOUSEHOLD, USER);
      expect(h?.linkedGoalId).toBeUndefined();
    });

    it('full multi-goal lifecycle: link to 3 goals, unlink progressively', async () => {
      const habit = await makeHabit('Deep work on music', CATEGORY_MUSIC);
      const goalA = await makeGoal('Song A', CATEGORY_MUSIC, [habit.id]);
      const goalB = await makeGoal('Song B', CATEGORY_MUSIC, [habit.id]);
      const goalC = await makeGoal('Song C', CATEGORY_MUSIC, [habit.id]);

      // Start: goalA, goalB, goalC all reference habit via linkedHabitIds.
      // Link to goalA first — habit.linkedGoalId = goalA
      await linkHabitsToGoal([habit.id], goalA.id, HOUSEHOLD, USER);
      expect((await getHabitById(habit.id, HOUSEHOLD, USER))?.linkedGoalId).toBe(goalA.id);

      // Link to goalB — should NOT overwrite (goalA still references habit)
      await linkHabitsToGoal([habit.id], goalB.id, HOUSEHOLD, USER);
      expect((await getHabitById(habit.id, HOUSEHOLD, USER))?.linkedGoalId).toBe(goalA.id);

      // Link to goalC — still should not overwrite
      await linkHabitsToGoal([habit.id], goalC.id, HOUSEHOLD, USER);
      expect((await getHabitById(habit.id, HOUSEHOLD, USER))?.linkedGoalId).toBe(goalA.id);

      // Now remove habit from goalA (via goal update path: reset linkedHabitIds = [])
      const db = await getTestDb();
      await db.collection(MONGO_COLLECTIONS.GOALS).updateOne(
        { id: goalA.id, householdId: HOUSEHOLD, userId: USER },
        { $set: { linkedHabitIds: [] } }
      );
      await unlinkHabitsFromGoal(goalA.id, HOUSEHOLD, USER);

      // linkedGoalId should switch to goalB or goalC (both still reference the habit)
      const afterUnlinkA = await getHabitById(habit.id, HOUSEHOLD, USER);
      expect([goalB.id, goalC.id]).toContain(afterUnlinkA?.linkedGoalId);

      // Remove from whichever goal linkedGoalId currently points at
      const currentOwner = afterUnlinkA?.linkedGoalId as string;
      await db.collection(MONGO_COLLECTIONS.GOALS).updateOne(
        { id: currentOwner, householdId: HOUSEHOLD, userId: USER },
        { $set: { linkedHabitIds: [] } }
      );
      await unlinkHabitsFromGoal(currentOwner, HOUSEHOLD, USER);

      // One goal still references it
      const afterSecond = await getHabitById(habit.id, HOUSEHOLD, USER);
      expect(afterSecond?.linkedGoalId).toBeDefined();
      expect([goalB.id, goalC.id]).toContain(afterSecond?.linkedGoalId);
      expect(afterSecond?.linkedGoalId).not.toBe(currentOwner);

      // Remove from the last one
      const lastOwner = afterSecond?.linkedGoalId as string;
      await db.collection(MONGO_COLLECTIONS.GOALS).updateOne(
        { id: lastOwner, householdId: HOUSEHOLD, userId: USER },
        { $set: { linkedHabitIds: [] } }
      );
      await unlinkHabitsFromGoal(lastOwner, HOUSEHOLD, USER);

      // Now linkedGoalId should be cleared
      const finalState = await getHabitById(habit.id, HOUSEHOLD, USER);
      expect(finalState?.linkedGoalId).toBeUndefined();
    });
  });
});
