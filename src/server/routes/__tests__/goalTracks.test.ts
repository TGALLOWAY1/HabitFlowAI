/**
 * Goal Tracks Routes Tests
 *
 * Tests for Goal Track CRUD, goal-track membership, track advancement,
 * and progress isolation via active windows.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import {
  getGoalTracks,
  createGoalTrackRoute,
  getGoalTrackRoute,
  deleteGoalTrackRoute,
  addGoalToTrack,
  removeGoalFromTrack,
  reorderTrackGoals,
  reorderGoalTracksRoute,
} from '../goalTracks';
import { getGoals, createGoalRoute, updateGoalRoute } from '../goals';
import { createGoal, getGoalById } from '../../repositories/goalRepository';
import { createGoalTrack } from '../../repositories/goalTrackRepository';
import { MONGO_COLLECTIONS } from '../../../models/persistenceTypes';

const TEST_HOUSEHOLD_ID = 'test-household-tracks';
const TEST_USER_ID = 'test-user-tracks';
const TEST_CATEGORY_ID = 'cat-music';

describe('Goal Tracks Routes', () => {
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

    app.get('/api/goal-tracks', getGoalTracks);
    app.post('/api/goal-tracks', createGoalTrackRoute);
    app.patch('/api/goal-tracks/reorder', reorderGoalTracksRoute);
    app.get('/api/goal-tracks/:id', getGoalTrackRoute);
    app.delete('/api/goal-tracks/:id', deleteGoalTrackRoute);
    app.post('/api/goal-tracks/:id/goals', addGoalToTrack);
    app.delete('/api/goal-tracks/:id/goals/:goalId', removeGoalFromTrack);
    app.patch('/api/goal-tracks/:id/goals/reorder', reorderTrackGoals);
    app.get('/api/goals', getGoals);
    app.post('/api/goals', createGoalRoute);
    app.put('/api/goals/:id', updateGoalRoute);
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection(MONGO_COLLECTIONS.GOAL_TRACKS).deleteMany({});
    await db.collection(MONGO_COLLECTIONS.GOALS).deleteMany({});
  });

  describe('Track CRUD', () => {
    it('should create a goal track', async () => {
      const res = await request(app)
        .post('/api/goal-tracks')
        .send({ name: 'Certification Path', categoryId: TEST_CATEGORY_ID });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Certification Path');
      expect(res.body.categoryId).toBe(TEST_CATEGORY_ID);
      expect(res.body.id).toBeTruthy();
      expect(res.body.createdAt).toBeTruthy();
    });

    it('should reject track without name', async () => {
      const res = await request(app)
        .post('/api/goal-tracks')
        .send({ categoryId: TEST_CATEGORY_ID });

      expect(res.status).toBe(400);
    });

    it('should reject track without categoryId', async () => {
      const res = await request(app)
        .post('/api/goal-tracks')
        .send({ name: 'Test Track' });

      expect(res.status).toBe(400);
    });

    it('should list tracks', async () => {
      await createGoalTrack({ name: 'Track 1', categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      await createGoalTrack({ name: 'Track 2', categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);

      const res = await request(app).get('/api/goal-tracks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('should get a track with its goals', async () => {
      const track = await createGoalTrack({ name: 'My Track', categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);

      const res = await request(app).get(`/api/goal-tracks/${track.id}`);
      expect(res.status).toBe(200);
      expect(res.body.track.name).toBe('My Track');
      expect(res.body.goals).toEqual([]);
    });

    it('should assign sortOrder when creating tracks in the same category', async () => {
      const res1 = await request(app)
        .post('/api/goal-tracks')
        .send({ name: 'First', categoryId: TEST_CATEGORY_ID });
      const res2 = await request(app)
        .post('/api/goal-tracks')
        .send({ name: 'Second', categoryId: TEST_CATEGORY_ID });
      const res3 = await request(app)
        .post('/api/goal-tracks')
        .send({ name: 'Third', categoryId: TEST_CATEGORY_ID });

      expect(res1.body.sortOrder).toBe(0);
      expect(res2.body.sortOrder).toBe(1);
      expect(res3.body.sortOrder).toBe(2);

      const listRes = await request(app).get('/api/goal-tracks');
      expect(listRes.body.map((t: { name: string }) => t.name)).toEqual([
        'First',
        'Second',
        'Third',
      ]);
    });

    it('should reorder goal tracks within a category', async () => {
      const t1 = await createGoalTrack({ name: 'Alpha', categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      const t2 = await createGoalTrack({ name: 'Beta', categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      const t3 = await createGoalTrack({ name: 'Gamma', categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);

      const res = await request(app)
        .patch('/api/goal-tracks/reorder')
        .send({ trackIds: [t3.id, t1.id, t2.id] });

      expect(res.status).toBe(200);

      const listRes = await request(app).get('/api/goal-tracks');
      expect(listRes.body.map((t: { id: string }) => t.id)).toEqual([t3.id, t1.id, t2.id]);
      expect(listRes.body.map((t: { sortOrder: number }) => t.sortOrder)).toEqual([0, 1, 2]);
    });

    it('should reject reorder request with non-array trackIds', async () => {
      const res = await request(app)
        .patch('/api/goal-tracks/reorder')
        .send({ trackIds: 'not-an-array' });

      expect(res.status).toBe(400);
    });

    it('should delete a track and release goals', async () => {
      const track = await createGoalTrack({ name: 'Deletable', categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      const goal = await createGoal({
        title: 'Exam 1',
        type: 'onetime',
        linkedHabitIds: [],
        categoryId: TEST_CATEGORY_ID,
        trackId: track.id,
        trackOrder: 0,
        trackStatus: 'active',
        activeWindowStart: '2026-01-01',
      }, TEST_HOUSEHOLD_ID, TEST_USER_ID);

      const delRes = await request(app).delete(`/api/goal-tracks/${track.id}`);
      expect(delRes.status).toBe(200);

      // Goal should be standalone now
      const updatedGoal = await getGoalById(goal.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(updatedGoal?.trackId).toBeUndefined();
      expect(updatedGoal?.trackStatus).toBeUndefined();
    });
  });

  describe('Track Goal Management', () => {
    it('should add a goal to a track', async () => {
      const track = await createGoalTrack({ name: 'Music Track', categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      const goal = await createGoal({
        title: 'Release Song 1',
        type: 'onetime',
        linkedHabitIds: [],
        categoryId: TEST_CATEGORY_ID,
      }, TEST_HOUSEHOLD_ID, TEST_USER_ID);

      const res = await request(app)
        .post(`/api/goal-tracks/${track.id}/goals`)
        .send({ goalId: goal.id });

      expect(res.status).toBe(200);
      expect(res.body.trackId).toBe(track.id);
      expect(res.body.trackOrder).toBe(0);
      // First goal should be active
      expect(res.body.trackStatus).toBe('active');
      expect(res.body.activeWindowStart).toBeTruthy();
    });

    it('should reject goal from different category', async () => {
      const track = await createGoalTrack({ name: 'Music Track', categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      const goal = await createGoal({
        title: 'Wrong Category Goal',
        type: 'onetime',
        linkedHabitIds: [],
        categoryId: 'cat-fitness', // Different category
      }, TEST_HOUSEHOLD_ID, TEST_USER_ID);

      const res = await request(app)
        .post(`/api/goal-tracks/${track.id}/goals`)
        .send({ goalId: goal.id });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('category');
    });

    it('should reject goal already in a track', async () => {
      const track = await createGoalTrack({ name: 'Track A', categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      const goal = await createGoal({
        title: 'Already Tracked',
        type: 'onetime',
        linkedHabitIds: [],
        categoryId: TEST_CATEGORY_ID,
        trackId: 'other-track-id',
      }, TEST_HOUSEHOLD_ID, TEST_USER_ID);

      const res = await request(app)
        .post(`/api/goal-tracks/${track.id}/goals`)
        .send({ goalId: goal.id });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('already in a track');
    });

    it('should lock second goal when first is active', async () => {
      const track = await createGoalTrack({ name: 'Sequential', categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      const goal1 = await createGoal({ title: 'Step 1', type: 'onetime', linkedHabitIds: [], categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      const goal2 = await createGoal({ title: 'Step 2', type: 'onetime', linkedHabitIds: [], categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);

      // Add first goal - should be active
      await request(app).post(`/api/goal-tracks/${track.id}/goals`).send({ goalId: goal1.id });

      // Add second goal - should be locked
      const res = await request(app).post(`/api/goal-tracks/${track.id}/goals`).send({ goalId: goal2.id });
      expect(res.body.trackStatus).toBe('locked');
    });

    it('should reorder goals in a track', async () => {
      const track = await createGoalTrack({ name: 'Reorder Test', categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      const g1 = await createGoal({ title: 'A', type: 'onetime', linkedHabitIds: [], categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      const g2 = await createGoal({ title: 'B', type: 'onetime', linkedHabitIds: [], categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);

      await request(app).post(`/api/goal-tracks/${track.id}/goals`).send({ goalId: g1.id });
      await request(app).post(`/api/goal-tracks/${track.id}/goals`).send({ goalId: g2.id });

      // Reverse order
      const res = await request(app)
        .patch(`/api/goal-tracks/${track.id}/goals/reorder`)
        .send({ goalIds: [g2.id, g1.id] });

      expect(res.status).toBe(200);

      const updated1 = await getGoalById(g1.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      const updated2 = await getGoalById(g2.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(updated2?.trackOrder).toBe(0);
      expect(updated1?.trackOrder).toBe(1);
    });

    it('should remove a goal from a track', async () => {
      const track = await createGoalTrack({ name: 'Remove Test', categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      const goal = await createGoal({ title: 'Removable', type: 'onetime', linkedHabitIds: [], categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);

      await request(app).post(`/api/goal-tracks/${track.id}/goals`).send({ goalId: goal.id });

      const res = await request(app).delete(`/api/goal-tracks/${track.id}/goals/${goal.id}`);
      expect(res.status).toBe(200);

      const updated = await getGoalById(goal.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(updated?.trackId).toBeUndefined();
    });
  });

  describe('Track Advancement', () => {
    it('should advance to next goal when active goal is completed', async () => {
      const track = await createGoalTrack({ name: 'Advance Test', categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      const g1 = await createGoal({ title: 'Step 1', type: 'onetime', linkedHabitIds: [], categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      const g2 = await createGoal({ title: 'Step 2', type: 'onetime', linkedHabitIds: [], categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);

      await request(app).post(`/api/goal-tracks/${track.id}/goals`).send({ goalId: g1.id });
      await request(app).post(`/api/goal-tracks/${track.id}/goals`).send({ goalId: g2.id });

      // Complete goal 1
      await request(app).put(`/api/goals/${g1.id}`).send({ completedAt: new Date().toISOString() });

      // Goal 2 should now be active
      const updatedG2 = await getGoalById(g2.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(updatedG2?.trackStatus).toBe('active');
      expect(updatedG2?.activeWindowStart).toBeTruthy();

      // Goal 1 should be completed in track
      const updatedG1 = await getGoalById(g1.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(updatedG1?.trackStatus).toBe('completed');
      expect(updatedG1?.activeWindowEnd).toBeTruthy();
    });

    it('should advance track on active goal removal', async () => {
      const track = await createGoalTrack({ name: 'Removal Advance', categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      const g1 = await createGoal({ title: 'Active', type: 'onetime', linkedHabitIds: [], categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      const g2 = await createGoal({ title: 'Locked', type: 'onetime', linkedHabitIds: [], categoryId: TEST_CATEGORY_ID }, TEST_HOUSEHOLD_ID, TEST_USER_ID);

      await request(app).post(`/api/goal-tracks/${track.id}/goals`).send({ goalId: g1.id });
      await request(app).post(`/api/goal-tracks/${track.id}/goals`).send({ goalId: g2.id });

      // Remove the active goal
      await request(app).delete(`/api/goal-tracks/${track.id}/goals/${g1.id}`);

      // Goal 2 should now be active
      const updatedG2 = await getGoalById(g2.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(updatedG2?.trackStatus).toBe('active');
    });
  });

  describe('Standalone Goals Unaffected', () => {
    it('should not affect standalone goal creation', async () => {
      const res = await request(app)
        .post('/api/goals')
        .send({
          title: 'Standalone Goal',
          type: 'cumulative',
          targetValue: 100,
          unit: 'miles',
          linkedHabitIds: [],
        });

      expect(res.status).toBe(201);
      expect(res.body.goal.trackId).toBeUndefined();
      expect(res.body.goal.trackStatus).toBeUndefined();
    });
  });
});
