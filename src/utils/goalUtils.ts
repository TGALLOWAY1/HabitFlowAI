/**
 * Goal Utility Functions
 * 
 * Helper functions for goal-related operations, particularly around sorting and ordering.
 */

import type { Goal, Category } from '../models/persistenceTypes';

/**
 * Goal Stack
 * 
 * Represents a category with its associated goals, ready for display.
 */
export interface GoalStack {
    category: Category;
    goals: Goal[];
}

/**
 * Normalizes sort orders for goals within a category.
 * 
 * Assigns missing sort orders deterministically based on:
 * 1. Existing sortOrder values (preserved)
 * 2. createdAt timestamp (ascending) as fallback
 * 3. title (alphabetical) as final fallback
 * 
 * This ensures stable ordering without changing progress computation.
 * 
 * @param goalsInCategory - Array of goals in the same category (or all goals if categoryId is undefined)
 * @returns Array of goals with sortOrder assigned (mutates input array)
 */
export function normalizeGoalSortOrders(goalsInCategory: Goal[]): Goal[] {
    if (goalsInCategory.length === 0) {
        return goalsInCategory;
    }

    // Sort goals to determine stable order:
    // 1. By existing sortOrder (lower first, undefined = Infinity)
    // 2. By createdAt (ascending)
    // 3. By title (alphabetical) as final tiebreaker
    const sorted = [...goalsInCategory].sort((a, b) => {
        // Compare sortOrder first
        const orderA = a.sortOrder ?? Infinity;
        const orderB = b.sortOrder ?? Infinity;
        if (orderA !== orderB) {
            return orderA - orderB;
        }

        // If sortOrder is equal (or both undefined), compare by createdAt
        const createdAtA = new Date(a.createdAt).getTime();
        const createdAtB = new Date(b.createdAt).getTime();
        if (createdAtA !== createdAtB) {
            return createdAtA - createdAtB;
        }

        // Final tiebreaker: title (alphabetical)
        return a.title.localeCompare(b.title);
    });

    // Assign sortOrder values based on sorted position
    // Start from 0 and increment by 1 for each goal
    sorted.forEach((goal, index) => {
        goal.sortOrder = index;
    });

    return sorted;
}

/**
 * Builds goal stacks grouped by category.
 * 
 * Groups goals by their categoryId, filters out empty categories and completed goals,
 * and orders both stacks and goals within stacks according to the specified rules.
 * 
 * Ordering Rules:
 * - Stacks ordered by category name (ascending) - categories don't have sortOrder
 * - Goals within a stack ordered by goal.sortOrder (fallback: createdAt asc)
 * 
 * Filtering Rules:
 * - Only includes categories that have at least one goal
 * - Excludes completed goals (where completedAt is not null)
 * - Goals without categoryId are placed in an "Uncategorized" synthetic category
 *   (following the pattern used in RoutineList)
 * 
 * @param params - Parameters object
 * @param params.goals - Array of goals to group
 * @param params.categories - Array of all categories
 * @returns Array of goal stacks, ordered and filtered
 */
export function buildGoalStacks({
    goals,
    categories,
}: {
    goals: Goal[];
    categories: Category[];
}): GoalStack[] {
    // Filter out completed goals (they belong in Win Archive)
    const activeGoals = goals.filter(goal => !goal.completedAt);

    // Create a map of category ID to Category for quick lookup
    const categoryMap = new Map<string, Category>(
        categories.map(cat => [cat.id, cat])
    );

    // Group goals by categoryId
    const goalsByCategoryId = new Map<string, Goal[]>();
    const uncategorizedGoals: Goal[] = [];

    for (const goal of activeGoals) {
        if (goal.categoryId && categoryMap.has(goal.categoryId)) {
            // Goal has a valid category
            const existing = goalsByCategoryId.get(goal.categoryId) || [];
            existing.push(goal);
            goalsByCategoryId.set(goal.categoryId, existing);
        } else if (!goal.categoryId) {
            // Goal has no categoryId - add to uncategorized
            uncategorizedGoals.push(goal);
        } else {
            // Goal has categoryId but category doesn't exist - log warning and exclude
            if (process.env.NODE_ENV === 'development') {
                console.warn(
                    `[buildGoalStacks] Goal "${goal.title}" (${goal.id}) references non-existent category "${goal.categoryId}". Excluding from stacks.`
                );
            }
        }
    }

    // Build stacks from categories that have goals
    const stacks: GoalStack[] = [];

    // Add stacks for categories that have goals
    for (const category of categories) {
        const categoryGoals = goalsByCategoryId.get(category.id);
        if (categoryGoals && categoryGoals.length > 0) {
            // Sort goals within the stack: sortOrder (lower first), then createdAt (asc)
            const sortedGoals = [...categoryGoals].sort((a, b) => {
                const orderA = a.sortOrder ?? Infinity;
                const orderB = b.sortOrder ?? Infinity;
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                // Fallback to createdAt ascending
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            });

            stacks.push({
                category,
                goals: sortedGoals,
            });
        }
    }

    // Add "Uncategorized" stack if there are uncategorized goals
    if (uncategorizedGoals.length > 0) {
        // Sort uncategorized goals: sortOrder (lower first), then createdAt (asc)
        const sortedUncategorized = [...uncategorizedGoals].sort((a, b) => {
            const orderA = a.sortOrder ?? Infinity;
            const orderB = b.sortOrder ?? Infinity;
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            // Fallback to createdAt ascending
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        stacks.push({
            category: {
                id: 'uncategorized',
                name: 'Uncategorized',
                color: 'bg-neutral-600',
            },
            goals: sortedUncategorized,
        });
    }

    // Sort stacks by category name (ascending) - categories don't have sortOrder
    // Put "Uncategorized" at the end
    stacks.sort((a, b) => {
        // Uncategorized always goes last
        if (a.category.id === 'uncategorized') return 1;
        if (b.category.id === 'uncategorized') return -1;
        // Otherwise sort by name
        return a.category.name.localeCompare(b.category.name);
    });

    // Dev-only console log for testing
    if (process.env.NODE_ENV === 'development') {
        console.log('[buildGoalStacks]', {
            totalStacks: stacks.length,
            stacksByCategory: stacks.map(stack => ({
                categoryName: stack.category.name,
                goalCount: stack.goals.length,
            })),
            totalGoals: stacks.reduce((sum, stack) => sum + stack.goals.length, 0),
        });
    }

    return stacks;
}

