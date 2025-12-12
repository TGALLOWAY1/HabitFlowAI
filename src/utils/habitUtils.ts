import type { Habit, DayLog } from '../types';

export interface FlattenedHabitItem {
    habit: Habit;
    depth: number;
    hasChildren: boolean;
    isExpanded: boolean;
    isVisible: boolean; // True if parent is expanded (or root)
    parentBundleId?: string;
}

/**
 * Flattens a list of habits into a tree-like structure for rendering.
 * Respects indentation and parent-child relationships.
 * 
 * @param habits - List of all habits (unsorted or sorted by db order)
 * @param expandedIds - Set of bundle IDs that are currently expanded
 * @returns Array of flattened items with depth and visibility info
 */
export function flattenHabitList(
    habits: Habit[],
    expandedIds: Set<string>
): FlattenedHabitItem[] {
    // 1. Map ID -> Habit
    const habitMap = new Map(habits.map(h => [h.id, h]));

    // 2. Separate roots and children
    // If a habit is present in another habit's subHabitIds, it is a child.
    const childIds = new Set<string>();
    habits.forEach(h => {
        if (h.type === 'bundle' && h.subHabitIds) {
            h.subHabitIds.forEach(id => childIds.add(id));
        }
    });

    const roots = habits.filter(h => !childIds.has(h.id));

    // Sort roots by order/createdAt
    const sortedRoots = roots.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

    const result: FlattenedHabitItem[] = [];

    // 3. Recursive builder
    function process(habit: Habit, depth: number, isVisible: boolean, parentId?: string) {
        const isBundle = habit.type === 'bundle';
        const isExpanded = expandedIds.has(habit.id);
        const children = (habit.subHabitIds || [])
            .map(id => habitMap.get(id))
            .filter((h): h is Habit => !!h);

        result.push({
            habit,
            depth,
            hasChildren: isBundle && children.length > 0,
            isExpanded: isBundle && isExpanded,
            isVisible,
            parentBundleId: parentId
        });

        if (isBundle && children.length > 0) {
            // Sort children
            children.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

            // If this bundle is NOT expanded, its children are NOT visible
            const childrenVisible = isVisible && isExpanded;

            children.forEach(child => {
                // Avoid infinite recursion safely
                if (child.id !== habit.id) {
                    process(child, depth + 1, childrenVisible, habit.id);
                }
            });
        }
    }

    sortedRoots.forEach(root => process(root, 0, true));

    return result;
}

/**
 * Computes the completion status for a bundle parent on a specific date.
 * MVP: OR logic (if any child is completed, parent is completed).
 * 
 * @param habit - The bundle habit
 * @param logs - All day logs
 * @param date - YYYY-MM-DD
 * @returns Object with completion status and optional value
 */
export function computeBundleStatus(
    habit: Habit,
    logs: Record<string, DayLog>,
    date: string
): { completed: boolean; value: number } {
    if (habit.type !== 'bundle' || !habit.subHabitIds || habit.subHabitIds.length === 0) {
        // Fallback for non-bundle or empty bundle
        const log = logs[`${habit.id}-${date}`];
        return {
            completed: !!log?.completed,
            value: log?.value || 0
        };
    }

    let isCompleted = false;
    let totalValue = 0;

    for (const subId of habit.subHabitIds) {
        const log = logs[`${subId}-${date}`];
        if (log?.completed) {
            isCompleted = true; // OR logic
        }
        if (log?.value) {
            totalValue += log.value; // Sum value (for cumulative view if needed)
        }
    }

    return {
        completed: isCompleted,
        value: totalValue
    };
}

/**
 * Calculates detailed statistics for a bundle's completion on a specific date.
 */
export function getBundleStats(
    habit: Habit,
    logs: Record<string, DayLog>,
    date: string
): { total: number; completed: number; percent: number; isAllDone: boolean } {
    if (habit.type !== 'bundle' || !habit.subHabitIds) {
        return { total: 0, completed: 0, percent: 0, isAllDone: false };
    }

    const total = habit.subHabitIds.length;
    if (total === 0) return { total: 0, completed: 0, percent: 0, isAllDone: false };

    let completed = 0;
    for (const subId of habit.subHabitIds) {
        if (logs[`${subId}-${date}`]?.completed) {
            completed++;
        }
    }

    return {
        total,
        completed,
        percent: (completed / total) * 100,
        isAllDone: completed === total
    };
}
