import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { deleteHabitRoute } from '../habits';

function makeApp(userId: string): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).householdId = 'default-household';
    (req as any).userId = userId;
    next();
  });
  app.delete('/api/habits/:id', deleteHabitRoute);
  return app;
}

const baseHabit = (userId: string) => ({
  goal: { type: 'boolean', frequency: 'daily' },
  archived: false,
  createdAt: new Date().toISOString(),
  householdId: 'default-household',
  userId,
});

describe('DELETE /api/habits/:id bundle child release', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  it('clears bundleParentId on all children when a bundle parent is deleted', async () => {
    const userId = 'test-delete-cascade-user';
    const testDb = await getTestDb();
    await testDb.collection('habits').insertMany([
      {
        id: 'bundle-parent',
        name: 'Music Practice',
        categoryId: 'cat-1',
        type: 'bundle',
        subHabitIds: ['child-a', 'child-b'],
        ...baseHabit(userId),
      },
      {
        id: 'child-a',
        name: 'Guitar',
        categoryId: 'cat-1',
        bundleParentId: 'bundle-parent',
        ...baseHabit(userId),
      },
      {
        id: 'child-b',
        name: 'Piano',
        categoryId: 'cat-1',
        bundleParentId: 'bundle-parent',
        ...baseHabit(userId),
        archived: true,
        archivedReason: 'user',
      },
    ]);

    const res = await request(makeApp(userId)).delete('/api/habits/bundle-parent');
    expect(res.status).toBe(200);

    const parent = await testDb.collection('habits').findOne({ id: 'bundle-parent', userId });
    expect(parent?.deletedAt).toBeDefined();

    // Both children (active and archived) are released as root habits.
    const childA = await testDb.collection('habits').findOne({ id: 'child-a', userId });
    expect(childA?.bundleParentId ?? null).toBeNull();
    expect(childA?.deletedAt).toBeUndefined();

    const childB = await testDb.collection('habits').findOne({ id: 'child-b', userId });
    expect(childB?.bundleParentId ?? null).toBeNull();
    expect(childB?.archived).toBe(true);
  });

  it('leaves children of other bundles untouched', async () => {
    const userId = 'test-delete-cascade-other-user';
    const testDb = await getTestDb();
    await testDb.collection('habits').insertMany([
      {
        id: 'doomed-bundle',
        name: 'Doomed',
        categoryId: 'cat-1',
        type: 'bundle',
        subHabitIds: [],
        ...baseHabit(userId),
      },
      {
        id: 'other-bundle',
        name: 'Other Bundle',
        categoryId: 'cat-1',
        type: 'bundle',
        subHabitIds: ['other-child'],
        ...baseHabit(userId),
      },
      {
        id: 'other-child',
        name: 'Other Child',
        categoryId: 'cat-1',
        bundleParentId: 'other-bundle',
        ...baseHabit(userId),
      },
    ]);

    const res = await request(makeApp(userId)).delete('/api/habits/doomed-bundle');
    expect(res.status).toBe(200);

    const otherChild = await testDb.collection('habits').findOne({ id: 'other-child', userId });
    expect(otherChild?.bundleParentId).toBe('other-bundle');
  });
});
