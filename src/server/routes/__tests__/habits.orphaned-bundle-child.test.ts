import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { getHabits } from '../habits';

// Self-heal runs once per user per server process, so each test uses its own
// user id to get a fresh recovery pass.
function makeApp(userId: string): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).householdId = 'default-household';
    (req as any).userId = userId;
    next();
  });
  app.get('/api/habits', getHabits);
  return app;
}

const baseHabit = (userId: string) => ({
  goal: { type: 'boolean', frequency: 'daily' },
  archived: false,
  createdAt: new Date().toISOString(),
  householdId: 'default-household',
  userId,
});

describe('GET /api/habits orphaned bundle child recovery', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  it('clears bundleParentId when the parent bundle no longer exists', async () => {
    const userId = 'test-orphaned-child-user';
    const testDb = await getTestDb();
    await testDb.collection('categories').insertOne({
      id: 'cat-1',
      name: 'Physical Health',
      color: 'bg-emerald-600',
      householdId: 'default-household',
      userId,
    });
    // Child pointing at a parent id that has no habit document at all
    await testDb.collection('habits').insertOne({
      id: 'ghost-child',
      name: 'Ghost Child',
      categoryId: 'cat-1',
      bundleParentId: 'deleted-parent-id',
      ...baseHabit(userId),
    });

    const res = await request(makeApp(userId)).get('/api/habits');
    expect(res.status).toBe(200);

    const healed = res.body.habits.find((h: any) => h.id === 'ghost-child');
    expect(healed).toBeDefined();
    expect(healed.bundleParentId ?? null).toBeNull();

    const doc = await testDb.collection('habits').findOne({ id: 'ghost-child' });
    expect(doc?.bundleParentId ?? null).toBeNull();
  });

  it('clears bundleParentId when the parent bundle is soft-deleted', async () => {
    const userId = 'test-orphaned-child-softdel-user';
    const testDb = await getTestDb();
    await testDb.collection('categories').insertOne({
      id: 'cat-2',
      name: 'Physical Health',
      color: 'bg-emerald-600',
      householdId: 'default-household',
      userId,
    });
    await testDb.collection('habits').insertMany([
      {
        id: 'soft-deleted-parent',
        name: 'Old Bundle',
        categoryId: 'cat-2',
        type: 'bundle',
        subHabitIds: ['stranded-child'],
        deletedAt: new Date().toISOString(),
        ...baseHabit(userId),
      },
      {
        id: 'stranded-child',
        name: 'Stranded Child',
        categoryId: 'cat-2',
        bundleParentId: 'soft-deleted-parent',
        ...baseHabit(userId),
      },
    ]);

    const res = await request(makeApp(userId)).get('/api/habits');
    expect(res.status).toBe(200);

    const healed = res.body.habits.find((h: any) => h.id === 'stranded-child');
    expect(healed).toBeDefined();
    expect(healed.bundleParentId ?? null).toBeNull();
  });

  it('keeps bundleParentId when the parent exists (even archived)', async () => {
    const userId = 'test-orphaned-child-intact-user';
    const testDb = await getTestDb();
    await testDb.collection('categories').insertOne({
      id: 'cat-3',
      name: 'Physical Health',
      color: 'bg-emerald-600',
      householdId: 'default-household',
      userId,
    });
    await testDb.collection('habits').insertMany([
      {
        id: 'live-parent',
        name: 'Live Bundle',
        categoryId: 'cat-3',
        type: 'bundle',
        subHabitIds: ['live-child'],
        ...baseHabit(userId),
      },
      {
        id: 'live-child',
        name: 'Live Child',
        categoryId: 'cat-3',
        bundleParentId: 'live-parent',
        ...baseHabit(userId),
      },
      {
        id: 'archived-parent',
        name: 'Archived Bundle',
        categoryId: 'cat-3',
        type: 'bundle',
        subHabitIds: ['archived-parent-child'],
        ...baseHabit(userId),
        archived: true,
        archivedReason: 'user',
      },
      {
        id: 'archived-parent-child',
        name: 'Child Of Archived',
        categoryId: 'cat-3',
        bundleParentId: 'archived-parent',
        ...baseHabit(userId),
      },
    ]);

    const res = await request(makeApp(userId)).get('/api/habits');
    expect(res.status).toBe(200);

    const liveChild = res.body.habits.find((h: any) => h.id === 'live-child');
    expect(liveChild.bundleParentId).toBe('live-parent');

    const archivedParentChild = res.body.habits.find((h: any) => h.id === 'archived-parent-child');
    expect(archivedParentChild.bundleParentId).toBe('archived-parent');
  });

  it('does not unarchive habits archived with reason system (conversion history children)', async () => {
    const userId = 'test-system-archived-user';
    const testDb = await getTestDb();
    await testDb.collection('categories').insertOne({
      id: 'cat-4',
      name: 'Physical Health',
      color: 'bg-emerald-600',
      householdId: 'default-household',
      userId,
    });
    await testDb.collection('habits').insertMany([
      {
        id: 'converted-bundle',
        name: 'Guitar',
        categoryId: 'cat-4',
        type: 'bundle',
        subHabitIds: ['guitar-history'],
        ...baseHabit(userId),
      },
      {
        id: 'guitar-history',
        name: 'Guitar (history)',
        categoryId: 'cat-4',
        bundleParentId: 'converted-bundle',
        ...baseHabit(userId),
        archived: true,
        archivedReason: 'system',
      },
    ]);

    const res = await request(makeApp(userId)).get('/api/habits');
    expect(res.status).toBe(200);

    const historyChild = res.body.habits.find((h: any) => h.id === 'guitar-history');
    expect(historyChild.archived).toBe(true);
    expect(historyChild.archivedReason).toBe('system');
  });
});
