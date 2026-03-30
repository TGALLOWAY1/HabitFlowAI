import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { unlinkHabitsFromGoal, uncategorizeHabitsByCategory } from '../habitRepository';

const HOUSEHOLD = 'test-household';
const USER = 'test-user';

describe('habitRepository', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('habits').deleteMany({});
  });

  describe('unlinkHabitsFromGoal', () => {
    it('clears linkedGoalId from habits referencing the deleted goal', async () => {
      const db = await getTestDb();

      // Insert habits directly with linkedGoalId
      await db.collection('habits').insertMany([
        {
          id: 'h1', name: 'Apply to jobs', categoryId: 'cat-1',
          goal: { type: 'number', frequency: 'daily', target: 3 },
          archived: false, createdAt: new Date().toISOString(),
          linkedGoalId: 'goal-to-delete',
          householdId: HOUSEHOLD, userId: USER,
        },
        {
          id: 'h2', name: 'Other habit', categoryId: 'cat-1',
          goal: { type: 'boolean', frequency: 'daily', target: 1 },
          archived: false, createdAt: new Date().toISOString(),
          linkedGoalId: 'goal-keep',
          householdId: HOUSEHOLD, userId: USER,
        },
      ]);

      const count = await unlinkHabitsFromGoal('goal-to-delete', HOUSEHOLD, USER);
      expect(count).toBe(1);

      const h1 = await db.collection('habits').findOne({ id: 'h1' });
      expect(h1?.linkedGoalId).toBeUndefined();

      const h2 = await db.collection('habits').findOne({ id: 'h2' });
      expect(h2?.linkedGoalId).toBe('goal-keep');
    });

    it('returns 0 when no habits reference the goal', async () => {
      const count = await unlinkHabitsFromGoal('nonexistent-goal', HOUSEHOLD, USER);
      expect(count).toBe(0);
    });
  });

  describe('uncategorizeHabitsByCategory', () => {
    it('sets archived to false when clearing categoryId', async () => {
      const db = await getTestDb();

      // Simulate a habit that was archived by old category-delete behavior
      await db.collection('habits').insertOne({
        id: 'h-archived', name: 'Stuck habit', categoryId: 'cat-deleted',
        goal: { type: 'boolean', frequency: 'daily', target: 1 },
        archived: true, archivedReason: 'category_deleted',
        createdAt: new Date().toISOString(),
        householdId: HOUSEHOLD, userId: USER,
      });

      const count = await uncategorizeHabitsByCategory('cat-deleted', HOUSEHOLD, USER);
      expect(count).toBe(1);

      const habit = await db.collection('habits').findOne({ id: 'h-archived' });
      expect(habit?.archived).toBe(false);
      expect(habit?.categoryId).toBe('');
      expect(habit?.archivedReason).toBeUndefined();
      expect(habit?.archivedAt).toBeUndefined();
    });
  });
});
