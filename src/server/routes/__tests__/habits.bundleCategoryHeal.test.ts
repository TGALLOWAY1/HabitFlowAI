/**
 * Bundle Child Category Self-Heal Tests
 *
 * GET /api/habits realigns bundle children whose stored categoryId drifted
 * from their live parent bundle's category (data written before the
 * write-path invariant existed). Without the heal, such children surface
 * under the wrong category tab in the All view while the Day view renders
 * them inside the bundle.
 *
 * Self-heal runs once per user per server process, so each test uses its own
 * user id. Uses mocked repositories (same pattern as habits.goalSync.test.ts)
 * so the suite runs without a MongoDB binary.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { getHabits } from '../habits';

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
  endMembership: vi.fn(),
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

import { getHabitsByUser, updateHabit, recoverCategoryDeletedHabits } from '../../repositories/habitRepository';
import { getCategoriesByUser } from '../../repositories/categoryRepository';

const HOUSEHOLD = 'test-household-heal';

function createRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

function getReq(userId: string): Request {
  return { query: {}, householdId: HOUSEHOLD, userId } as unknown as Request;
}

const baseHabit = (overrides: Record<string, unknown>) => ({
  goal: { type: 'boolean', frequency: 'daily' },
  archived: false,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const categories = [
  { id: 'cat-fitness', name: 'Fitness', color: 'bg-emerald-600' },
  { id: 'cat-recovery', name: 'Recovery', color: 'bg-blue-600' },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(recoverCategoryDeletedHabits).mockResolvedValue(0);
  vi.mocked(getCategoriesByUser).mockResolvedValue(categories as any);
  vi.mocked(updateHabit).mockImplementation(async (_id, _h, _u, patch) => ({ ...patch }) as any);
});

describe('GET /api/habits — bundle child category self-heal', () => {
  it('realigns children whose category drifted from their live parent', async () => {
    const bundle = baseHabit({
      id: 'bundle-1', name: 'Recover Activity', categoryId: 'cat-fitness',
      type: 'bundle', bundleType: 'choice', subHabitIds: ['child-1', 'child-2'],
    });
    // Drifted via bundleParentId back-reference
    const drifted = baseHabit({ id: 'child-1', name: 'Bath', categoryId: 'cat-recovery', bundleParentId: 'bundle-1' });
    // Drifted via subHabitIds-only linkage (legacy shape, no back-reference)
    const legacyDrifted = baseHabit({ id: 'child-2', name: 'Foam roll', categoryId: 'cat-recovery' });
    const solo = baseHabit({ id: 'solo', name: 'Journal', categoryId: 'cat-recovery' });
    vi.mocked(getHabitsByUser).mockResolvedValue([bundle, drifted, legacyDrifted, solo] as any);

    const res = createRes();
    await getHabits(getReq('heal-user-1'), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(updateHabit).toHaveBeenCalledWith('child-1', HOUSEHOLD, 'heal-user-1', { categoryId: 'cat-fitness' });
    expect(updateHabit).toHaveBeenCalledWith('child-2', HOUSEHOLD, 'heal-user-1', { categoryId: 'cat-fitness' });
    const updatedIds = vi.mocked(updateHabit).mock.calls.map(c => c[0]);
    expect(updatedIds).not.toContain('solo');
  });

  it('leaves children of archived parents alone', async () => {
    const archivedBundle = baseHabit({
      id: 'bundle-1', name: 'Old Bundle', categoryId: 'cat-fitness',
      type: 'bundle', bundleType: 'checklist', subHabitIds: ['child-1'],
      archived: true, archivedReason: 'user',
    });
    const standalone = baseHabit({ id: 'child-1', name: 'Bath', categoryId: 'cat-recovery', bundleParentId: 'bundle-1' });
    vi.mocked(getHabitsByUser).mockResolvedValue([archivedBundle, standalone] as any);

    const res = createRes();
    await getHabits(getReq('heal-user-2'), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(updateHabit).not.toHaveBeenCalled();
  });

  it('does not rewrite already-aligned children', async () => {
    const bundle = baseHabit({
      id: 'bundle-1', name: 'Recover Activity', categoryId: 'cat-fitness',
      type: 'bundle', bundleType: 'choice', subHabitIds: ['child-1'],
    });
    const aligned = baseHabit({ id: 'child-1', name: 'Bath', categoryId: 'cat-fitness', bundleParentId: 'bundle-1' });
    vi.mocked(getHabitsByUser).mockResolvedValue([bundle, aligned] as any);

    const res = createRes();
    await getHabits(getReq('heal-user-3'), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(updateHabit).not.toHaveBeenCalled();
  });

  it('returns the realigned habits in the response', async () => {
    const bundle = baseHabit({
      id: 'bundle-1', name: 'Recover Activity', categoryId: 'cat-fitness',
      type: 'bundle', bundleType: 'choice', subHabitIds: ['child-1'],
    });
    const drifted = baseHabit({ id: 'child-1', name: 'Bath', categoryId: 'cat-recovery', bundleParentId: 'bundle-1' });
    vi.mocked(getHabitsByUser).mockResolvedValue([bundle, drifted] as any);
    vi.mocked(updateHabit).mockResolvedValue({ ...drifted, categoryId: 'cat-fitness' } as any);

    const res = createRes();
    await getHabits(getReq('heal-user-4'), res);

    const payload = vi.mocked(res.json).mock.calls[0][0] as { habits: Array<{ id: string; categoryId: string }> };
    const healed = payload.habits.find(h => h.id === 'child-1');
    expect(healed?.categoryId).toBe('cat-fitness');
  });
});
