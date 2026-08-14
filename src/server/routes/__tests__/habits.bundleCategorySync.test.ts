/**
 * Bundle Child Category Sync Tests
 *
 * Server-enforced invariant: a bundle child always lives in its live parent
 * bundle's category. Without it, children drift into other categories and
 * surface as standalone rows under the wrong tab in the habits All view
 * (while the Day view renders them inside the bundle).
 *
 * Covered write paths:
 * - PATCH bundle categoryId          → cascades to all children
 * - PATCH bundle archived:false      → realigns children moved while archived
 * - PATCH habit bundleParentId       → child inherits parent's category
 * - PATCH child categoryId           → snapped back to parent's category
 * - POST habit with bundleParentId   → created in parent's category
 * - POST bundle-membership           → child realigned to parent's category
 *
 * Uses mocked repositories (same pattern as habits.goalSync.test.ts) so the
 * suite runs without a MongoDB binary.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createHabitRoute, updateHabitRoute } from '../habits';
import { createBundleMembershipRoute } from '../bundleMemberships';

vi.mock('../../repositories/habitRepository', () => ({
  createHabit: vi.fn(),
  getHabitById: vi.fn(),
  updateHabit: vi.fn(),
  getHabitsByUser: vi.fn(),
  getHabitsByCategory: vi.fn(),
  deleteHabit: vi.fn(),
  archiveHabit: vi.fn(),
  unarchiveHabit: vi.fn(),
  reorderHabits: vi.fn(),
  recoverCategoryDeletedHabits: vi.fn(),
  releaseBundleChildren: vi.fn(),
}));

vi.mock('../../repositories/categoryRepository', () => ({
  createCategory: vi.fn(),
  getCategoriesByUser: vi.fn(),
  getCategoryById: vi.fn(),
}));

vi.mock('../../repositories/goalRepository', () => ({
  addHabitToGoalLinkedIds: vi.fn(),
  removeHabitFromGoalLinkedIds: vi.fn(),
}));

vi.mock('../../repositories/bundleMembershipRepository', () => ({
  createMembership: vi.fn(),
  endMembership: vi.fn(),
  archiveMembership: vi.fn(),
  graduateMembership: vi.fn(),
  getMembershipById: vi.fn(),
  getMembershipsByParent: vi.fn(),
  getMembershipsForDay: vi.fn(),
  deleteMembership: vi.fn(),
  hasActiveMembership: vi.fn(),
}));

vi.mock('../../repositories/habitEntryRepository', () => ({
  getHabitEntriesByHabit: vi.fn(),
}));

vi.mock('../../services/habitConversionService', () => ({
  convertHabitToBundle: vi.fn(),
  ConversionError: class extends Error {},
}));

vi.mock('../../middleware/identity', () => ({
  getRequestIdentity: (req: any) => ({
    householdId: req.householdId,
    userId: req.userId,
  }),
}));

import { createHabit, getHabitById, updateHabit, getHabitsByUser } from '../../repositories/habitRepository';
import { getCategoryById } from '../../repositories/categoryRepository';
import { createMembership, hasActiveMembership } from '../../repositories/bundleMembershipRepository';

const HOUSEHOLD = 'test-household';
const USER = 'test-user';

function createRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

function patchReq(id: string, body: Record<string, unknown>): Request {
  return { params: { id }, body, householdId: HOUSEHOLD, userId: USER } as unknown as Request;
}

function postReq(body: Record<string, unknown>): Request {
  return { body, householdId: HOUSEHOLD, userId: USER } as unknown as Request;
}

const baseHabit = (overrides: Record<string, unknown>) => ({
  goal: { type: 'boolean', frequency: 'daily' },
  archived: false,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const bundle = baseHabit({
  id: 'bundle-1',
  name: 'Recover Activity',
  categoryId: 'cat-fitness',
  type: 'bundle',
  bundleType: 'choice',
  subHabitIds: ['child-1', 'child-2'],
});

const child1 = baseHabit({
  id: 'child-1',
  name: 'Bath',
  categoryId: 'cat-fitness',
  bundleParentId: 'bundle-1',
});

const child2 = baseHabit({
  id: 'child-2',
  name: 'Foam roll',
  categoryId: 'cat-fitness',
  // In subHabitIds only — no bundleParentId back-reference (legacy shape)
});

function mockHabitsById(habits: Record<string, unknown>) {
  vi.mocked(getHabitById).mockImplementation(
    async (id: string) => (habits[id] ?? null) as any
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCategoryById).mockResolvedValue({ id: 'cat-any', name: 'Any', color: 'bg-blue-500' } as any);
});

describe('updateHabitRoute — bundle category cascade', () => {
  it('cascades a bundle category change to all its children', async () => {
    const staleChild1 = { ...child1 };
    const staleChild2 = { ...child2 };
    const unrelated = baseHabit({ id: 'other', name: 'Other', categoryId: 'cat-fitness' });
    mockHabitsById({ 'bundle-1': bundle });
    const movedBundle = { ...bundle, categoryId: 'cat-recovery' };
    vi.mocked(updateHabit).mockResolvedValue(movedBundle as any);
    vi.mocked(getHabitsByUser).mockResolvedValue([movedBundle, staleChild1, staleChild2, unrelated] as any);

    const res = createRes();
    await updateHabitRoute(patchReq('bundle-1', { categoryId: 'cat-recovery' }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    // Both children realigned — via bundleParentId and via subHabitIds-only linkage
    expect(updateHabit).toHaveBeenCalledWith('child-1', HOUSEHOLD, USER, { categoryId: 'cat-recovery' });
    expect(updateHabit).toHaveBeenCalledWith('child-2', HOUSEHOLD, USER, { categoryId: 'cat-recovery' });
    const updatedIds = vi.mocked(updateHabit).mock.calls.map(c => c[0]);
    expect(updatedIds).not.toContain('other');
  });

  it('realigns drifted children when a bundle is unarchived', async () => {
    const archivedBundle = { ...bundle, archived: true, archivedReason: 'user' };
    const driftedChild = { ...child1, categoryId: 'cat-elsewhere' };
    mockHabitsById({ 'bundle-1': archivedBundle });
    const restored = { ...bundle, archived: false };
    vi.mocked(updateHabit).mockResolvedValue(restored as any);
    vi.mocked(getHabitsByUser).mockResolvedValue([restored, driftedChild, child2] as any);

    const res = createRes();
    await updateHabitRoute(patchReq('bundle-1', { archived: false }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(updateHabit).toHaveBeenCalledWith('child-1', HOUSEHOLD, USER, { categoryId: 'cat-fitness' });
    // In-sync child is not rewritten
    const child2Calls = vi.mocked(updateHabit).mock.calls.filter(c => c[0] === 'child-2');
    expect(child2Calls).toHaveLength(0);
  });

  it('does not cascade when a non-bundle habit changes category', async () => {
    const solo = baseHabit({ id: 'solo', name: 'Solo', categoryId: 'cat-a' });
    mockHabitsById({ solo });
    vi.mocked(updateHabit).mockResolvedValue({ ...solo, categoryId: 'cat-b' } as any);

    const res = createRes();
    await updateHabitRoute(patchReq('solo', { categoryId: 'cat-b' }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(getHabitsByUser).not.toHaveBeenCalled();
    expect(updateHabit).toHaveBeenCalledTimes(1);
  });
});

describe('updateHabitRoute — child inherits parent category', () => {
  it('snaps categoryId to the parent category when bundleParentId is set', async () => {
    const loner = baseHabit({ id: 'loner', name: 'TENS unit', categoryId: 'cat-elsewhere' });
    mockHabitsById({ loner, 'bundle-1': bundle });
    vi.mocked(updateHabit).mockResolvedValue({ ...loner, bundleParentId: 'bundle-1', categoryId: 'cat-fitness' } as any);

    const res = createRes();
    await updateHabitRoute(patchReq('loner', { bundleParentId: 'bundle-1' }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(updateHabit).toHaveBeenCalledWith(
      'loner', HOUSEHOLD, USER,
      expect.objectContaining({ bundleParentId: 'bundle-1', categoryId: 'cat-fitness' })
    );
  });

  it('snaps a linked child categoryId patch back to the parent category', async () => {
    mockHabitsById({ 'child-1': child1, 'bundle-1': bundle });
    vi.mocked(updateHabit).mockResolvedValue(child1 as any);

    const res = createRes();
    await updateHabitRoute(patchReq('child-1', { categoryId: 'cat-elsewhere' }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(updateHabit).toHaveBeenCalledWith(
      'child-1', HOUSEHOLD, USER,
      expect.objectContaining({ categoryId: 'cat-fitness' })
    );
  });

  it('keeps the requested category when the parent is archived', async () => {
    const archivedBundle = { ...bundle, archived: true };
    mockHabitsById({ 'child-1': child1, 'bundle-1': archivedBundle });
    vi.mocked(updateHabit).mockResolvedValue({ ...child1, categoryId: 'cat-elsewhere' } as any);

    const res = createRes();
    await updateHabitRoute(patchReq('child-1', { categoryId: 'cat-elsewhere' }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(updateHabit).toHaveBeenCalledWith(
      'child-1', HOUSEHOLD, USER,
      expect.objectContaining({ categoryId: 'cat-elsewhere' })
    );
  });

  it('lets a habit move categories freely when unlinking from its bundle', async () => {
    mockHabitsById({ 'child-1': child1, 'bundle-1': bundle });
    vi.mocked(updateHabit).mockResolvedValue({ ...child1, bundleParentId: null, categoryId: 'cat-elsewhere' } as any);

    const res = createRes();
    await updateHabitRoute(patchReq('child-1', { bundleParentId: null, categoryId: 'cat-elsewhere' }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(updateHabit).toHaveBeenCalledWith(
      'child-1', HOUSEHOLD, USER,
      expect.objectContaining({ bundleParentId: null, categoryId: 'cat-elsewhere' })
    );
  });
});

describe('createHabitRoute — bundle child creation', () => {
  it('creates a habit with bundleParentId in the parent category', async () => {
    mockHabitsById({ 'bundle-1': bundle });
    vi.mocked(createHabit).mockImplementation(async (data: any) => ({ id: 'new-child', ...data }));

    const res = createRes();
    await createHabitRoute(postReq({
      name: 'Massage gun',
      categoryId: 'cat-elsewhere',
      bundleParentId: 'bundle-1',
      goal: { type: 'boolean', target: 1, frequency: 'daily' },
    }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(createHabit).toHaveBeenCalledWith(
      expect.objectContaining({ bundleParentId: 'bundle-1', categoryId: 'cat-fitness' }),
      HOUSEHOLD, USER
    );
    // The category-exists check runs against the inherited category
    expect(getCategoryById).toHaveBeenCalledWith('cat-fitness', HOUSEHOLD, USER);
  });

  it('keeps the requested category for a habit without a bundle parent', async () => {
    vi.mocked(createHabit).mockImplementation(async (data: any) => ({ id: 'new-solo', ...data }));

    const res = createRes();
    await createHabitRoute(postReq({
      name: 'Journal',
      categoryId: 'cat-elsewhere',
      goal: { type: 'boolean', target: 1, frequency: 'daily' },
    }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(createHabit).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-elsewhere' }),
      HOUSEHOLD, USER
    );
  });
});

describe('createBundleMembershipRoute — category realignment', () => {
  it('realigns the child category to the parent when a membership is created', async () => {
    const outsider = baseHabit({ id: 'outsider', name: 'Shower + Stretch', categoryId: 'cat-elsewhere' });
    mockHabitsById({ 'bundle-1': bundle, outsider });
    vi.mocked(hasActiveMembership).mockResolvedValue(false);
    vi.mocked(createMembership).mockResolvedValue({ id: 'membership-1' } as any);

    const res = createRes();
    await createBundleMembershipRoute(postReq({
      parentHabitId: 'bundle-1',
      childHabitId: 'outsider',
      activeFromDayKey: '2026-08-14',
    }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(updateHabit).toHaveBeenCalledWith('outsider', HOUSEHOLD, USER, { categoryId: 'cat-fitness' });
  });

  it('does not rewrite an already-aligned child on membership creation', async () => {
    const aligned = baseHabit({ id: 'aligned', name: 'Bath', categoryId: 'cat-fitness' });
    mockHabitsById({ 'bundle-1': bundle, aligned });
    vi.mocked(hasActiveMembership).mockResolvedValue(false);
    vi.mocked(createMembership).mockResolvedValue({ id: 'membership-2' } as any);

    const res = createRes();
    await createBundleMembershipRoute(postReq({
      parentHabitId: 'bundle-1',
      childHabitId: 'aligned',
      activeFromDayKey: '2026-08-14',
    }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(updateHabit).not.toHaveBeenCalled();
  });
});
