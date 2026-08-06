/**
 * Goal Utility Functions
 *
 * Helper functions for goal-related operations, particularly around sorting and ordering.
 */

import type { Goal, GoalTrack, Category } from '../models/persistenceTypes';

/**
 * A group of goals belonging to a single track within a category stack.
 */
export interface TrackGroup {
    track: GoalTrack;
    goals: Goal[];
}

/**
 * Goal Stack
 *
 * Represents a category with its associated goals, ready for display.
 * Goals are split into standalone goals and track-grouped goals.
 */
export interface GoalStack {
    category: Category;
    /** Active standalone goals (not in any track) */
    goals: Goal[];
    /** Goals grouped by track */
    tracks: TrackGroup[];
    /** Standalone goals with status 'scheduled', sorted by startDate (undated last) */
    scheduledGoals: Goal[];
    /** Standalone goals with status 'backlog' */
    backlogGoals: Goal[];
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
 * Sort goals by sortOrder then createdAt.
 */
function sortGoalsByOrder(goals: Goal[]): Goal[] {
    return [...goals].sort((a, b) => {
        const orderA = a.sortOrder ?? Infinity;
        const orderB = b.sortOrder ?? Infinity;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

/**
 * Builds goal stacks grouped by category, with track sub-grouping.
 *
 * Within each category, goals are split into:
 * - standalone goals (no trackId)
 * - track groups (goals grouped by trackId, ordered by trackOrder)
 *
 * Completed standalone goals are filtered out (they belong in Win Archive).
 * Completed goals within tracks are kept (they show track history).
 */
export function buildGoalStacks({
    goals,
    categories,
    tracks = [],
}: {
    goals: Goal[];
    categories: Category[];
    tracks?: GoalTrack[];
}): GoalStack[] {
    const categoryMap = new Map<string, Category>(
        categories.map(cat => [cat.id, cat])
    );
    const trackMap = new Map<string, GoalTrack>(
        tracks.map(t => [t.id, t])
    );

    // Separate tracked goals from standalone goals, and split standalone
    // goals by lifecycle status (absent/null status = active). Tracked goals
    // ignore lifecycle status entirely — trackStatus governs them.
    const standaloneGoals = goals.filter(g => !g.trackId && !g.completedAt);
    const trackedGoals = goals.filter(g => !!g.trackId);

    const activeGoals = standaloneGoals.filter(g => !g.status || g.status === 'active');
    const scheduledGoals = standaloneGoals.filter(g => g.status === 'scheduled');
    const backlogGoals = standaloneGoals.filter(g => g.status === 'backlog');

    // Group standalone goals by categoryId ('uncategorized' bucket for the rest)
    const bucketByCategory = (list: Goal[]): Map<string, Goal[]> => {
        const byCategory = new Map<string, Goal[]>();
        for (const goal of list) {
            const key = goal.categoryId && categoryMap.has(goal.categoryId)
                ? goal.categoryId
                : 'uncategorized';
            const existing = byCategory.get(key) || [];
            existing.push(goal);
            byCategory.set(key, existing);
        }
        return byCategory;
    };

    const standaloneByCategory = bucketByCategory(activeGoals);
    const scheduledByCategory = bucketByCategory(scheduledGoals);
    const backlogByCategory = bucketByCategory(backlogGoals);

    // Scheduled goals show soonest start first; undated ones sink to the end.
    const sortScheduled = (list: Goal[]): Goal[] =>
        sortGoalsByOrder(list).sort((a, b) => {
            const dateA = a.startDate ?? '9999-99-99';
            const dateB = b.startDate ?? '9999-99-99';
            return dateA.localeCompare(dateB);
        });

    // Group tracked goals by trackId, then by category
    const trackGroupsByCategory = new Map<string, TrackGroup[]>();

    const goalsByTrackId = new Map<string, Goal[]>();
    for (const goal of trackedGoals) {
        const existing = goalsByTrackId.get(goal.trackId!) || [];
        existing.push(goal);
        goalsByTrackId.set(goal.trackId!, existing);
    }

    for (const [trackId, trackGoals] of goalsByTrackId) {
        const track = trackMap.get(trackId);
        if (!track) continue; // orphaned track reference — skip

        // Skip completed tracks entirely (all goals done)
        if (track.completedAt) continue;

        const categoryId = track.categoryId;
        const sortedTrackGoals = [...trackGoals].sort(
            (a, b) => (a.trackOrder ?? 0) - (b.trackOrder ?? 0)
        );

        const group: TrackGroup = { track, goals: sortedTrackGoals };
        const existing = trackGroupsByCategory.get(categoryId) || [];
        existing.push(group);
        trackGroupsByCategory.set(categoryId, existing);
    }

    // Build stacks
    const stacks: GoalStack[] = [];

    // Collect all category IDs that have content
    const categoriesWithContent = new Set<string>();
    for (const catId of standaloneByCategory.keys()) categoriesWithContent.add(catId);
    for (const catId of scheduledByCategory.keys()) categoriesWithContent.add(catId);
    for (const catId of backlogByCategory.keys()) categoriesWithContent.add(catId);
    for (const catId of trackGroupsByCategory.keys()) categoriesWithContent.add(catId);

    for (const category of categories) {
        if (!categoriesWithContent.has(category.id)) continue;

        const catStandalone = standaloneByCategory.get(category.id) || [];
        const catTracks = trackGroupsByCategory.get(category.id) || [];

        stacks.push({
            category,
            goals: sortGoalsByOrder(catStandalone),
            tracks: catTracks.sort((a, b) => {
                const orderA = a.track.sortOrder ?? Infinity;
                const orderB = b.track.sortOrder ?? Infinity;
                if (orderA !== orderB) return orderA - orderB;
                return a.track.createdAt.localeCompare(b.track.createdAt);
            }),
            scheduledGoals: sortScheduled(scheduledByCategory.get(category.id) || []),
            backlogGoals: sortGoalsByOrder(backlogByCategory.get(category.id) || []),
        });
    }

    // Add "Uncategorized" stack if there are uncategorized goals
    if (
        standaloneByCategory.has('uncategorized') ||
        scheduledByCategory.has('uncategorized') ||
        backlogByCategory.has('uncategorized')
    ) {
        stacks.push({
            category: {
                id: 'uncategorized',
                name: 'Uncategorized',
                color: 'bg-neutral-600',
            },
            goals: sortGoalsByOrder(standaloneByCategory.get('uncategorized') || []),
            tracks: [],
            scheduledGoals: sortScheduled(scheduledByCategory.get('uncategorized') || []),
            backlogGoals: sortGoalsByOrder(backlogByCategory.get('uncategorized') || []),
        });
    }

    // Sort stacks by category name, "Uncategorized" last
    stacks.sort((a, b) => {
        if (a.category.id === 'uncategorized') return 1;
        if (b.category.id === 'uncategorized') return -1;
        return a.category.name.localeCompare(b.category.name);
    });

    return stacks;
}
