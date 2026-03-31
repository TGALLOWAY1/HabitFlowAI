import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { convertToBundleRoute } from '../habits';

// Mock repositories
vi.mock('../../repositories/habitRepository', () => ({
  getHabitById: vi.fn(),
  createHabit: vi.fn(),
  updateHabit: vi.fn(),
  getHabitsByUser: vi.fn(),
  getHabitsByCategory: vi.fn(),
  deleteHabit: vi.fn(),
  reorderHabits: vi.fn(),
  recoverCategoryDeletedHabits: vi.fn(),
}));

vi.mock('../../repositories/habitEntryRepository', () => ({
  reassignEntries: vi.fn(),
  deleteHabitEntriesByHabit: vi.fn(),
}));

vi.mock('../../repositories/bundleMembershipRepository', () => ({
  createMembership: vi.fn(),
  endMembership: vi.fn(),
}));

vi.mock('../../repositories/categoryRepository', () => ({
  createCategory: vi.fn(),
  getCategoriesByUser: vi.fn(),
  getCategoryById: vi.fn(),
}));

import { getHabitById, createHabit, updateHabit } from '../../repositories/habitRepository';
import { reassignEntries } from '../../repositories/habitEntryRepository';
import { createMembership } from '../../repositories/bundleMembershipRepository';

const HOUSEHOLD = 'household-1';
const USER = 'test-user';

function createReq(id: string, body: Record<string, unknown> = {}): Request {
  return {
    params: { id },
    body,
    householdId: HOUSEHOLD,
    userId: USER,
  } as unknown as Request;
}

function createRes(): Response & { _status: number; _json: unknown } {
  const res = {
    _status: 0,
    _json: null as unknown,
    status(code: number) { res._status = code; return res; },
    json(data: unknown) { res._json = data; return res; },
  };
  return res as unknown as Response & { _status: number; _json: unknown };
}

const baseHabit = {
  id: 'habit-1',
  name: 'Dog Activity',
  categoryId: 'cat-1',
  goal: { type: 'boolean' as const, target: 1, frequency: 'daily' as const },
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

let childCounter = 0;

describe('convertToBundleRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    childCounter = 0;

    // Default: createHabit returns a child with incrementing IDs
    vi.mocked(createHabit).mockImplementation(async (data) => ({
      id: `child-${++childCounter}`,
      name: data.name,
      categoryId: data.categoryId,
      goal: data.goal || { type: 'boolean', target: 1, frequency: 'daily' },
      archived: false,
      createdAt: '2026-03-31T00:00:00.000Z',
      bundleParentId: data.bundleParentId,
    } as any));

    // Default: createMembership returns a membership record
    vi.mocked(createMembership).mockImplementation(async (parentId, childId, activeFrom, _hh, _u, activeTo) => ({
      id: `mem-${childId}`,
      parentHabitId: parentId,
      childHabitId: childId,
      activeFromDayKey: activeFrom,
      activeToDayKey: activeTo ?? null,
      daysOfWeek: null,
      graduatedAt: null,
      archivedAt: null,
      createdAt: '2026-03-31T00:00:00.000Z',
      updatedAt: '2026-03-31T00:00:00.000Z',
    }));
  });

  it('converts a habit to a choice bundle with historical entries', async () => {
    vi.mocked(getHabitById).mockResolvedValue(baseHabit as any);
    vi.mocked(reassignEntries).mockResolvedValueOnce({
      modifiedCount: 10,
      earliestDayKey: '2026-01-15',
    });
    // Second call: reassign from __pending__ to legacy child
    vi.mocked(reassignEntries).mockResolvedValueOnce({
      modifiedCount: 10,
      earliestDayKey: '2026-01-15',
    });
    vi.mocked(updateHabit).mockImplementation(async (_id, _hh, _u, patch) => ({
      ...baseHabit,
      ...patch,
    } as any));

    const req = createReq('habit-1', {
      bundleType: 'choice',
      children: [
        { name: 'Fetch' },
        { name: 'Walk' },
      ],
      timeZone: 'America/New_York',
    });
    const res = createRes();

    await convertToBundleRoute(req, res);

    expect(res._status).toBe(200);
    const result = res._json as any;

    // Parent should be updated to bundle
    expect(result.parent.type).toBe('bundle');
    expect(result.parent.bundleType).toBe('choice');

    // Legacy child should exist (entries were reassigned)
    expect(result.legacyChild).not.toBeNull();
    expect(result.legacyChild.name).toBe('Dog Activity (history)');
    expect(result.legacyChild.archived).toBe(true);

    // Two new children created
    expect(result.children).toHaveLength(2);
    expect(result.children[0].name).toBe('Fetch');
    expect(result.children[1].name).toBe('Walk');

    // Memberships: 1 legacy + 2 active children = 3
    expect(result.memberships).toHaveLength(3);

    // Legacy membership should have activeToDayKey (day before today)
    const legacyMembership = result.memberships[0];
    expect(legacyMembership.activeToDayKey).toBeTruthy();
    expect(legacyMembership.activeFromDayKey).toBe('2026-01-15');

    // Active children memberships should have no end date
    expect(result.memberships[1].activeToDayKey).toBeNull();
    expect(result.memberships[2].activeToDayKey).toBeNull();

    // Entries were reassigned twice (first to __pending__, then to legacy child)
    expect(reassignEntries).toHaveBeenCalledTimes(2);
    expect(reassignEntries).toHaveBeenCalledWith('habit-1', '__pending__', HOUSEHOLD, USER);
  });

  it('converts without legacy child when no entries exist', async () => {
    vi.mocked(getHabitById).mockResolvedValue(baseHabit as any);
    vi.mocked(reassignEntries).mockResolvedValue({
      modifiedCount: 0,
      earliestDayKey: null,
    });
    vi.mocked(updateHabit).mockImplementation(async (_id, _hh, _u, patch) => ({
      ...baseHabit,
      ...patch,
    } as any));

    const req = createReq('habit-1', {
      bundleType: 'choice',
      children: [{ name: 'Fetch' }, { name: 'Walk' }],
    });
    const res = createRes();

    await convertToBundleRoute(req, res);

    expect(res._status).toBe(200);
    const result = res._json as any;

    expect(result.legacyChild).toBeNull();
    expect(result.children).toHaveLength(2);
    // Only 2 memberships (no legacy)
    expect(result.memberships).toHaveLength(2);
  });

  it('converts to a checklist bundle with success rule', async () => {
    vi.mocked(getHabitById).mockResolvedValue(baseHabit as any);
    vi.mocked(reassignEntries).mockResolvedValue({ modifiedCount: 0, earliestDayKey: null });
    vi.mocked(updateHabit).mockImplementation(async (_id, _hh, _u, patch) => ({
      ...baseHabit,
      ...patch,
    } as any));

    const req = createReq('habit-1', {
      bundleType: 'checklist',
      children: [{ name: 'Fetch' }, { name: 'Walk' }, { name: 'Training' }],
      checklistSuccessRule: { type: 'threshold', threshold: 2 },
    });
    const res = createRes();

    await convertToBundleRoute(req, res);

    expect(res._status).toBe(200);
    const result = res._json as any;
    expect(result.parent.bundleType).toBe('checklist');
    expect(result.parent.checklistSuccessRule).toEqual({ type: 'threshold', threshold: 2 });
    expect(result.children).toHaveLength(3);
  });

  it('rejects if habit is already a bundle', async () => {
    vi.mocked(getHabitById).mockResolvedValue({
      ...baseHabit,
      type: 'bundle',
      bundleType: 'choice',
    } as any);

    const req = createReq('habit-1', {
      bundleType: 'choice',
      children: [{ name: 'Fetch' }],
    });
    const res = createRes();

    await convertToBundleRoute(req, res);

    expect(res._status).toBe(400);
    expect((res._json as any).error.code).toBe('ALREADY_BUNDLE');
  });

  it('rejects if habit is archived', async () => {
    vi.mocked(getHabitById).mockResolvedValue({
      ...baseHabit,
      archived: true,
    } as any);

    const req = createReq('habit-1', {
      bundleType: 'choice',
      children: [{ name: 'Fetch' }],
    });
    const res = createRes();

    await convertToBundleRoute(req, res);

    expect(res._status).toBe(400);
    expect((res._json as any).error.code).toBe('HABIT_ARCHIVED');
  });

  it('returns 404 if habit does not exist', async () => {
    vi.mocked(getHabitById).mockResolvedValue(null);

    const req = createReq('nonexistent', {
      bundleType: 'choice',
      children: [{ name: 'Fetch' }],
    });
    const res = createRes();

    await convertToBundleRoute(req, res);

    expect(res._status).toBe(404);
  });

  it('validates bundleType', async () => {
    const req = createReq('habit-1', {
      bundleType: 'invalid',
      children: [{ name: 'Fetch' }],
    });
    const res = createRes();

    await convertToBundleRoute(req, res);

    expect(res._status).toBe(400);
    expect((res._json as any).error.message).toMatch(/bundleType/);
  });

  it('validates children array is not empty', async () => {
    const req = createReq('habit-1', {
      bundleType: 'choice',
      children: [],
    });
    const res = createRes();

    await convertToBundleRoute(req, res);

    expect(res._status).toBe(400);
    expect((res._json as any).error.message).toMatch(/child/i);
  });

  it('validates child names are non-empty', async () => {
    const req = createReq('habit-1', {
      bundleType: 'choice',
      children: [{ name: '' }],
    });
    const res = createRes();

    await convertToBundleRoute(req, res);

    expect(res._status).toBe(400);
    expect((res._json as any).error.message).toMatch(/name/i);
  });
});
