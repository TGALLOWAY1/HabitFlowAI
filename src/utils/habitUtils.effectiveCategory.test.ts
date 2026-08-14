/**
 * getEffectiveCategoryId Tests — bundle children group under their parent's category
 *
 * Category-filtered views (All tab) must group a bundle child under its
 * parent bundle's category, matching how the Day view renders children inside
 * the parent's card. A child whose stored categoryId drifted from its parent
 * must not surface as a standalone row under the wrong category.
 */

import { describe, it, expect } from 'vitest';
import { getEffectiveCategoryId } from './habitUtils';
import type { Habit } from '../types';

function makeHabit(overrides: Partial<Habit>): Habit {
  return {
    id: 'habit-1',
    categoryId: 'cat-1',
    name: 'Habit',
    goal: { type: 'boolean', frequency: 'daily' },
    archived: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Habit;
}

function byId(habits: Habit[]): Map<string, Habit> {
  return new Map(habits.map(h => [h.id, h]));
}

describe('getEffectiveCategoryId', () => {
  it('returns the habit own category when it is not a bundle child', () => {
    const habit = makeHabit({ id: 'solo', categoryId: 'cat-a' });
    expect(getEffectiveCategoryId(habit, byId([habit]))).toBe('cat-a');
  });

  it('returns the parent bundle category for a child that drifted out of sync', () => {
    const parent = makeHabit({ id: 'bundle', categoryId: 'cat-fitness', type: 'bundle', bundleType: 'choice', subHabitIds: ['child'] });
    const child = makeHabit({ id: 'child', categoryId: 'cat-stale', bundleParentId: 'bundle' });
    expect(getEffectiveCategoryId(child, byId([parent, child]))).toBe('cat-fitness');
  });

  it('returns the parent bundle category for an in-sync child (no-op case)', () => {
    const parent = makeHabit({ id: 'bundle', categoryId: 'cat-fitness', type: 'bundle', bundleType: 'checklist', subHabitIds: ['child'] });
    const child = makeHabit({ id: 'child', categoryId: 'cat-fitness', bundleParentId: 'bundle' });
    expect(getEffectiveCategoryId(child, byId([parent, child]))).toBe('cat-fitness');
  });

  it('falls back to the child own category when the parent is archived', () => {
    const parent = makeHabit({ id: 'bundle', categoryId: 'cat-fitness', type: 'bundle', archived: true, subHabitIds: ['child'] });
    const child = makeHabit({ id: 'child', categoryId: 'cat-own', bundleParentId: 'bundle' });
    expect(getEffectiveCategoryId(child, byId([parent, child]))).toBe('cat-own');
  });

  it('falls back to the child own category when the parent is missing', () => {
    const child = makeHabit({ id: 'child', categoryId: 'cat-own', bundleParentId: 'gone' });
    expect(getEffectiveCategoryId(child, byId([child]))).toBe('cat-own');
  });
});
