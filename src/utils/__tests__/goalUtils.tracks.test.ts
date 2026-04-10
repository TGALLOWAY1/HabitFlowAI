/**
 * Goal Utils Track Grouping Tests
 *
 * Verifies that buildGoalStacks correctly groups tracked goals into TrackGroups
 * and keeps standalone goals separate.
 */

import { describe, it, expect } from 'vitest';
import { buildGoalStacks } from '../goalUtils';
import type { Goal, GoalTrack, Category } from '../../models/persistenceTypes';

const categories: Category[] = [
  { id: 'cat-music', name: 'Music', color: 'bg-purple-500' },
  { id: 'cat-fitness', name: 'Fitness', color: 'bg-emerald-500' },
];

function makeGoal(id: string, categoryId: string, overrides: Partial<Goal> = {}): Goal {
  return {
    id,
    title: `Goal ${id}`,
    type: 'onetime',
    linkedHabitIds: [],
    categoryId,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('buildGoalStacks with tracks', () => {
  it('separates standalone goals from tracked goals', () => {
    const tracks: GoalTrack[] = [
      { id: 'track-1', name: 'Cert Path', categoryId: 'cat-music', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ];

    const goals: Goal[] = [
      makeGoal('g1', 'cat-music', {}), // standalone
      makeGoal('g2', 'cat-music', { trackId: 'track-1', trackOrder: 0, trackStatus: 'active' }),
      makeGoal('g3', 'cat-music', { trackId: 'track-1', trackOrder: 1, trackStatus: 'locked' }),
    ];

    const stacks = buildGoalStacks({ goals, categories, tracks });

    expect(stacks).toHaveLength(1); // one category
    expect(stacks[0].category.id).toBe('cat-music');
    expect(stacks[0].goals).toHaveLength(1); // 1 standalone
    expect(stacks[0].goals[0].id).toBe('g1');
    expect(stacks[0].tracks).toHaveLength(1); // 1 track group
    expect(stacks[0].tracks[0].track.name).toBe('Cert Path');
    expect(stacks[0].tracks[0].goals).toHaveLength(2);
    expect(stacks[0].tracks[0].goals[0].id).toBe('g2'); // ordered by trackOrder
    expect(stacks[0].tracks[0].goals[1].id).toBe('g3');
  });

  it('filters out completed standalone goals', () => {
    const goals: Goal[] = [
      makeGoal('g1', 'cat-music', { completedAt: '2026-03-01T00:00:00Z' }), // completed
      makeGoal('g2', 'cat-music', {}), // active standalone
    ];

    const stacks = buildGoalStacks({ goals, categories, tracks: [] });
    expect(stacks).toHaveLength(1);
    expect(stacks[0].goals).toHaveLength(1);
    expect(stacks[0].goals[0].id).toBe('g2');
  });

  it('keeps completed goals within tracks (for track history)', () => {
    const tracks: GoalTrack[] = [
      { id: 'track-1', name: 'Track', categoryId: 'cat-music', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ];

    const goals: Goal[] = [
      makeGoal('g1', 'cat-music', {
        trackId: 'track-1', trackOrder: 0, trackStatus: 'completed',
        completedAt: '2026-02-01T00:00:00Z',
      }),
      makeGoal('g2', 'cat-music', { trackId: 'track-1', trackOrder: 1, trackStatus: 'active' }),
    ];

    const stacks = buildGoalStacks({ goals, categories, tracks });
    expect(stacks[0].tracks[0].goals).toHaveLength(2);
    expect(stacks[0].tracks[0].goals[0].trackStatus).toBe('completed');
    expect(stacks[0].tracks[0].goals[1].trackStatus).toBe('active');
  });

  it('handles empty tracks array gracefully', () => {
    const goals: Goal[] = [
      makeGoal('g1', 'cat-fitness', {}),
    ];

    const stacks = buildGoalStacks({ goals, categories, tracks: [] });
    expect(stacks).toHaveLength(1);
    expect(stacks[0].goals).toHaveLength(1);
    expect(stacks[0].tracks).toHaveLength(0);
  });

  it('sorts tracks by sortOrder (not createdAt) within a category', () => {
    const tracks: GoalTrack[] = [
      // Intentionally out of sortOrder, and with createdAt timestamps that
      // would produce a different order if we fell back to createdAt.
      { id: 'track-a', name: 'Alpha', categoryId: 'cat-music', sortOrder: 2, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'track-b', name: 'Beta', categoryId: 'cat-music', sortOrder: 0, createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z' },
      { id: 'track-c', name: 'Gamma', categoryId: 'cat-music', sortOrder: 1, createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z' },
    ];

    const goals: Goal[] = [
      makeGoal('g1', 'cat-music', { trackId: 'track-a', trackOrder: 0, trackStatus: 'active' }),
      makeGoal('g2', 'cat-music', { trackId: 'track-b', trackOrder: 0, trackStatus: 'active' }),
      makeGoal('g3', 'cat-music', { trackId: 'track-c', trackOrder: 0, trackStatus: 'active' }),
    ];

    const stacks = buildGoalStacks({ goals, categories, tracks });
    expect(stacks).toHaveLength(1);
    expect(stacks[0].tracks.map(tg => tg.track.id)).toEqual(['track-b', 'track-c', 'track-a']);
  });

  it('falls back to createdAt order for tracks without sortOrder', () => {
    const tracks: GoalTrack[] = [
      { id: 'track-new', name: 'New', categoryId: 'cat-music', createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z' },
      { id: 'track-old', name: 'Old', categoryId: 'cat-music', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ];

    const goals: Goal[] = [
      makeGoal('g1', 'cat-music', { trackId: 'track-new', trackOrder: 0, trackStatus: 'active' }),
      makeGoal('g2', 'cat-music', { trackId: 'track-old', trackOrder: 0, trackStatus: 'active' }),
    ];

    const stacks = buildGoalStacks({ goals, categories, tracks });
    expect(stacks[0].tracks.map(tg => tg.track.id)).toEqual(['track-old', 'track-new']);
  });

  it('skips completed tracks', () => {
    const tracks: GoalTrack[] = [
      { id: 'track-1', name: 'Done Track', categoryId: 'cat-music', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', completedAt: '2026-03-01T00:00:00Z' },
    ];

    const goals: Goal[] = [
      makeGoal('g1', 'cat-music', { trackId: 'track-1', trackOrder: 0, trackStatus: 'completed' }),
    ];

    const stacks = buildGoalStacks({ goals, categories, tracks });
    // Completed track should not appear
    expect(stacks).toHaveLength(0);
  });
});
