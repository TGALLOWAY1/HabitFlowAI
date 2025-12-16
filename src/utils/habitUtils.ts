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

        // 1. Get Real Children (Checklist / Legacy)
        let children = (habit.subHabitIds || [])
            .map(id => habitMap.get(id))
            .filter((h): h is Habit => !!h);

        // 2. Get Virtual Children (Choice V2)
        if (habit.bundleType === 'choice' && habit.bundleOptions) {
            const virtualChildren: Habit[] = habit.bundleOptions.map(opt => {
                const metricMode = opt.metricConfig?.mode || 'none';

                // Map Metric Config to Habit Goal
                // If required: number goal. If none: boolean goal.
                const virtualGoal = {
                    ...habit.goal, // inherited frequency/target? No, target is per-entry.
                    type: metricMode === 'required' ? 'number' : 'boolean',
                    unit: opt.metricConfig?.unit,
                    target: 0 // Target is arbitrary here, we just want the UI type
                } as any;

                return {
                    id: `virtual-${habit.id}-${opt.id}`, // Stable synthetic ID
                    categoryId: habit.categoryId,
                    name: opt.label,
                    goal: virtualGoal,
                    archived: false,
                    createdAt: habit.createdAt,
                    type: 'bundle-option-virtual' as any, // Or just 'boolean'/'number'? Let's keep 'bundle' or 'boolean' to not break renderers? 
                    // Actually, let's use the GOAL type to drive the renderer (checkbox vs #). 
                    // But we need to flag it as virtual.
                    // Let's say type = 'boolean' or 'number' based on goal.
                    // But `isVirtual` flag handles the "Italic" styling.

                    // Actually, for TrackerGrid persistence, it relies on `isVirtual`.
                    isVirtual: true,
                    associatedOptionId: opt.id,
                    bundleParentId: habit.id,

                    // User Request: "Don't indent". 
                    // We will pass the same depth as parent effectively? 
                    // Or we let the flattener handle depth, and Grid suppresses indent.
                } as Habit;
            });

            // Append virtual children
            children = [...children, ...virtualChildren];
        }

        const hasChildren = isBundle && children.length > 0;

        result.push({
            habit,
            depth,
            hasChildren,
            isExpanded: isBundle && isExpanded,
            isVisible,
            parentBundleId: parentId
        });

        if (hasChildren) {
            // Sort children? Virtual ones are already option-order. Real ones need sort.
            // If we mix them (unlikely), we might want safe sort.
            // For now, assume Choice Bundle ONLY has virtual children.
            if (habit.bundleType !== 'choice') {
                children.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
            }

            // If this bundle is NOT expanded, its children are NOT visible
            const childrenVisible = isVisible && isExpanded;

            children.forEach(child => {
                // Avoid infinite recursion safely
                if (child.id !== habit.id) {
                    // User requested "No Indentation" for choice options (virtual).
                    // We can either pass `depth` (0 relative) or handle it in CSS.
                    // Passing `depth` assumes same level.
                    // Let's pass `depth` (same as parent) if virtual, `depth + 1` if real?
                    // "Just make the text of the children habits italic... Don't indent them"
                    // If we pass `depth`, it aligns with parent checkmarks.
                    const nextDepth = child.isVirtual ? depth : depth + 1;

                    process(child, nextDepth, childrenVisible, habit.id);
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

/**
 * Filters habits to find those relevant for a specific date (Today View logic).
 * 
 * Rules:
 * - Not archived
 * - Not a child of another habit (root level only)
 * - Frequency match:
 *   - 'daily': Always included
 *   - 'weekly': Included if 'assignedDays' contains date's day-of-week
 *   - 'total': Always included
 */
export function getHabitsForDate(
    habits: Habit[],
    _date: Date
): Habit[] {
    // Identify child IDs to exclude them from root list
    const childIds = new Set<string>();
    habits.forEach(h => {
        if (h.type === 'bundle' && h.subHabitIds) {
            h.subHabitIds.forEach(id => childIds.add(id));
        }
    });

    return habits.filter(h => {
        // 1. Must not be archived
        if (h.archived) return false;

        // 2. Must be a root habit (not a child)
        if (childIds.has(h.id)) return false;

        // 3. Frequency Logic - STRICTLY DAILY for now per user feedback
        // Check both root frequency and goal.frequency (legacy/imported data might only have it in goal)
        const frequency = h.frequency || h.goal.frequency;

        if (frequency !== 'daily') return false;

        return true;
    });
}
