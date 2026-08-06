/**
 * Goal Utils Tests
 * 
 * Tests for goal utility functions, particularly buildGoalStacks.
 */

import { describe, it, expect } from 'vitest';
import { buildGoalStacks } from './goalUtils';
import type { Goal, Category } from '../models/persistenceTypes';

describe('buildGoalStacks', () => {
    const createCategory = (id: string, name: string, color: string = 'bg-neutral-600'): Category => ({
        id,
        name,
        color,
    });

    const createGoal = (
        id: string,
        title: string,
        categoryId?: string,
        sortOrder?: number,
        completedAt?: string,
        createdAt?: string
    ): Goal => {
        // Extract numeric part from ID (e.g., "goal-1" -> 1, "goal-12" -> 12)
        const numericMatch = id.match(/\d+/);
        const day = numericMatch ? parseInt(numericMatch[0], 10) : 1;
        const defaultCreatedAt = new Date(`2024-01-${String(day).padStart(2, '0')}`).toISOString();
        
        return {
            id,
            categoryId,
            title,
            type: 'cumulative',
            targetValue: 100,
            unit: 'units',
            linkedHabitIds: [],
            createdAt: createdAt || defaultCreatedAt,
            sortOrder,
            completedAt,
        };
    };

    describe('filtering', () => {
        it('should filter out categories with no goals', () => {
            const categories = [
                createCategory('cat-1', 'Category 1'),
                createCategory('cat-2', 'Category 2'),
                createCategory('cat-3', 'Category 3'),
            ];
            const goals = [
                createGoal('goal-1', 'Goal 1', 'cat-1'),
                createGoal('goal-2', 'Goal 2', 'cat-1'),
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(1);
            expect(stacks[0].category.id).toBe('cat-1');
            expect(stacks[0].goals).toHaveLength(2);
        });

        it('should filter out completed goals', () => {
            const categories = [createCategory('cat-1', 'Category 1')];
            const goals = [
                createGoal('goal-1', 'Active Goal', 'cat-1'),
                createGoal('goal-2', 'Completed Goal', 'cat-1', undefined, new Date().toISOString()),
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(1);
            expect(stacks[0].goals).toHaveLength(1);
            expect(stacks[0].goals[0].id).toBe('goal-1');
        });

        it('should route goals with invalid categoryId to the Uncategorized stack', () => {
            const categories = [createCategory('cat-1', 'Category 1')];
            const goals = [
                createGoal('goal-1', 'Valid Goal', 'cat-1'),
                createGoal('goal-2', 'Invalid Category Goal', 'non-existent-cat'),
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(2);
            expect(stacks[0].goals.map(g => g.id)).toEqual(['goal-1']);
            const uncategorized = stacks.find(s => s.category.id === 'uncategorized');
            expect(uncategorized?.goals.map(g => g.id)).toEqual(['goal-2']);
        });
    });

    describe('sorting', () => {
        it('should sort categories by name (ascending)', () => {
            const categories = [
                createCategory('cat-3', 'Zebra Category'),
                createCategory('cat-1', 'Alpha Category'),
                createCategory('cat-2', 'Beta Category'),
            ];
            const goals = [
                createGoal('goal-1', 'Goal 1', 'cat-1'),
                createGoal('goal-2', 'Goal 2', 'cat-2'),
                createGoal('goal-3', 'Goal 3', 'cat-3'),
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(3);
            expect(stacks[0].category.name).toBe('Alpha Category');
            expect(stacks[1].category.name).toBe('Beta Category');
            expect(stacks[2].category.name).toBe('Zebra Category');
        });

        it('should sort goals by sortOrder (lower first)', () => {
            const categories = [createCategory('cat-1', 'Category 1')];
            const goals = [
                createGoal('goal-3', 'Goal 3', 'cat-1', 2),
                createGoal('goal-1', 'Goal 1', 'cat-1', 0),
                createGoal('goal-2', 'Goal 2', 'cat-1', 1),
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(1);
            expect(stacks[0].goals.map(g => g.id)).toEqual(['goal-1', 'goal-2', 'goal-3']);
        });

        it('should use createdAt as fallback when sortOrder is missing', () => {
            const categories = [createCategory('cat-1', 'Category 1')];
            const goals = [
                createGoal('goal-3', 'Goal 3', 'cat-1', undefined), // Created on 2024-01-03
                createGoal('goal-1', 'Goal 1', 'cat-1', undefined), // Created on 2024-01-01
                createGoal('goal-2', 'Goal 2', 'cat-1', undefined), // Created on 2024-01-02
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(1);
            expect(stacks[0].goals.map(g => g.id)).toEqual(['goal-1', 'goal-2', 'goal-3']);
        });

        it('should sort goals with mixed sortOrder and missing sortOrder', () => {
            const categories = [createCategory('cat-1', 'Category 1')];
            const goals = [
                createGoal('goal-3', 'Goal 3', 'cat-1', 5), // sortOrder 5
                createGoal('goal-1', 'Goal 1', 'cat-1', 0), // sortOrder 0
                createGoal('goal-2', 'Goal 2', 'cat-1'), // No sortOrder (Infinity)
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(1);
            // Goals with sortOrder come first (0, 5), then goals without (sorted by createdAt)
            expect(stacks[0].goals[0].id).toBe('goal-1'); // sortOrder 0
            expect(stacks[0].goals[1].id).toBe('goal-3'); // sortOrder 5
            expect(stacks[0].goals[2].id).toBe('goal-2'); // No sortOrder
        });
    });

    describe('uncategorized goals', () => {
        it('should create Uncategorized stack for goals without categoryId', () => {
            const categories = [createCategory('cat-1', 'Category 1')];
            const goals = [
                createGoal('goal-1', 'Categorized Goal', 'cat-1'),
                createGoal('goal-2', 'Uncategorized Goal'),
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(2);
            const uncategorizedStack = stacks.find(s => s.category.id === 'uncategorized');
            expect(uncategorizedStack).toBeDefined();
            expect(uncategorizedStack?.goals).toHaveLength(1);
            expect(uncategorizedStack?.goals[0].id).toBe('goal-2');
        });

        it('should place Uncategorized stack at the end', () => {
            const categories = [
                createCategory('cat-1', 'Alpha Category'),
                createCategory('cat-2', 'Zebra Category'),
            ];
            const goals = [
                createGoal('goal-1', 'Goal 1', 'cat-1'),
                createGoal('goal-2', 'Goal 2', 'cat-2'),
                createGoal('goal-3', 'Uncategorized Goal'),
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(3);
            expect(stacks[0].category.name).toBe('Alpha Category');
            expect(stacks[1].category.name).toBe('Zebra Category');
            expect(stacks[2].category.id).toBe('uncategorized');
        });

        it('should sort uncategorized goals by sortOrder', () => {
            const categories: Category[] = [];
            const goals = [
                createGoal('goal-2', 'Goal 2', undefined, 1),
                createGoal('goal-1', 'Goal 1', undefined, 0),
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(1);
            expect(stacks[0].category.id).toBe('uncategorized');
            expect(stacks[0].goals.map(g => g.id)).toEqual(['goal-1', 'goal-2']);
        });
    });

    describe('lifecycle status buckets', () => {
        it('should split goals into active, scheduled, and backlog buckets', () => {
            const categories = [createCategory('cat-1', 'Category 1')];
            const goals = [
                createGoal('goal-1', 'Active Goal', 'cat-1'),
                { ...createGoal('goal-2', 'Scheduled Goal', 'cat-1'), status: 'scheduled' as const },
                { ...createGoal('goal-3', 'Backlog Goal', 'cat-1'), status: 'backlog' as const },
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(1);
            expect(stacks[0].goals.map(g => g.id)).toEqual(['goal-1']);
            expect(stacks[0].scheduledGoals.map(g => g.id)).toEqual(['goal-2']);
            expect(stacks[0].backlogGoals.map(g => g.id)).toEqual(['goal-3']);
        });

        it('should treat explicit "active" status the same as no status', () => {
            const categories = [createCategory('cat-1', 'Category 1')];
            const goals = [
                { ...createGoal('goal-1', 'Explicit Active', 'cat-1'), status: 'active' as const },
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks[0].goals).toHaveLength(1);
            expect(stacks[0].scheduledGoals).toHaveLength(0);
        });

        it('should keep a stack whose only goals are backlog', () => {
            const categories = [createCategory('cat-1', 'Category 1')];
            const goals = [
                { ...createGoal('goal-1', 'Backlog Only', 'cat-1'), status: 'backlog' as const },
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(1);
            expect(stacks[0].goals).toHaveLength(0);
            expect(stacks[0].backlogGoals).toHaveLength(1);
        });

        it('should exclude a completed scheduled goal', () => {
            const categories = [createCategory('cat-1', 'Category 1')];
            const goals = [
                {
                    ...createGoal('goal-1', 'Done Scheduled', 'cat-1', undefined, new Date().toISOString()),
                    status: 'scheduled' as const,
                },
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(0);
        });

        it('should sort scheduled goals by startDate with undated last', () => {
            const categories = [createCategory('cat-1', 'Category 1')];
            const goals = [
                { ...createGoal('goal-1', 'Undated', 'cat-1', 0), status: 'scheduled' as const },
                { ...createGoal('goal-2', 'June', 'cat-1', 1), status: 'scheduled' as const, startDate: '2026-06-01' },
                { ...createGoal('goal-3', 'March', 'cat-1', 2), status: 'scheduled' as const, startDate: '2026-03-01' },
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks[0].scheduledGoals.map(g => g.id)).toEqual(['goal-3', 'goal-2', 'goal-1']);
        });

        it('should route scheduled/backlog goals into the Uncategorized stack', () => {
            const categories: Category[] = [];
            const goals = [
                { ...createGoal('goal-1', 'Loose Backlog'), status: 'backlog' as const },
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(1);
            expect(stacks[0].category.id).toBe('uncategorized');
            expect(stacks[0].backlogGoals.map(g => g.id)).toEqual(['goal-1']);
        });

        it('should ignore lifecycle status on tracked goals (trackStatus governs)', () => {
            const categories = [createCategory('cat-1', 'Category 1')];
            const track = {
                id: 'track-1',
                name: 'Track 1',
                categoryId: 'cat-1',
                createdAt: new Date('2024-01-01').toISOString(),
            };
            const goals = [
                {
                    ...createGoal('goal-1', 'Tracked Scheduled', 'cat-1'),
                    trackId: 'track-1',
                    trackOrder: 0,
                    trackStatus: 'active' as const,
                    status: 'scheduled' as const,
                },
            ];

            const stacks = buildGoalStacks({ goals, categories, tracks: [track as any] });

            expect(stacks).toHaveLength(1);
            expect(stacks[0].scheduledGoals).toHaveLength(0);
            expect(stacks[0].tracks).toHaveLength(1);
            expect(stacks[0].tracks[0].goals.map(g => g.id)).toEqual(['goal-1']);
        });
    });

    describe('edge cases', () => {
        it('should return empty array when no goals exist', () => {
            const categories = [createCategory('cat-1', 'Category 1')];
            const goals: Goal[] = [];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(0);
        });

        it('should return empty array when no categories exist and no uncategorized goals', () => {
            const categories: Category[] = [];
            const goals: Goal[] = [];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(0);
        });

        it('should handle goals with same sortOrder (use createdAt fallback)', () => {
            const categories = [createCategory('cat-1', 'Category 1')];
            const goals = [
                createGoal('goal-2', 'Goal 2', 'cat-1', 0), // Created on 2024-01-02
                createGoal('goal-1', 'Goal 1', 'cat-1', 0), // Created on 2024-01-01
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(1);
            // When sortOrder is equal, sort by createdAt (ascending)
            expect(stacks[0].goals.map(g => g.id)).toEqual(['goal-1', 'goal-2']);
        });

        it('should handle all goals being completed', () => {
            const categories = [createCategory('cat-1', 'Category 1')];
            const goals = [
                createGoal('goal-1', 'Completed 1', 'cat-1', undefined, new Date().toISOString()),
                createGoal('goal-2', 'Completed 2', 'cat-1', undefined, new Date().toISOString()),
            ];

            const stacks = buildGoalStacks({ goals, categories });

            expect(stacks).toHaveLength(0);
        });
    });
});

