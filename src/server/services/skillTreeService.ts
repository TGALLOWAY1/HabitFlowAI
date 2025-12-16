import { getCategoriesByUser } from '../repositories/categoryRepository';
import { getGoalsByUser } from '../repositories/goalRepository';
import { getHabitsByUser } from '../repositories/habitRepository';
import { computeGoalProgress } from '../utils/goalProgressUtils';
import type { Goal } from '../../models/persistenceTypes';

/**
 * Service to handle Skill Tree logic
 */

const SKILL_TREE_ENABLED = true; // Feature flag

// Explicit Contracts for Skill Tree API

export interface SkillTreeHabitNode {
    id: string;
    name: string;
    progressText: string; // e.g. "25 / 50 reps"
    percent: number;      // 0-100
    atRisk: boolean;
}

export interface SkillTreeSkillNode {
    id: string; // Goal ID
    title: string;
    categoryId: string;
    progress: {
        current: number;
        target: number;
        percent: number;
    };
    linkedHabits: SkillTreeHabitNode[];
}

export interface SkillTreeIdentityNode {
    id: string; // Category ID
    name: string;
    color: string;
    skills: SkillTreeSkillNode[]; // Goals in this category
}

export interface SkillTreeData {
    identities: SkillTreeIdentityNode[];
}

/**
 * Get the full skill tree for a user.
 * Maps: Categories -> Identities, Goals -> Skills, Linked Habits -> Leaves.
 * 
 * Filters:
 * - Only Categories that have at least one Goal.
 * - Only Goals that have a Category assigned.
 */
export async function getSkillTree(userId: string): Promise<SkillTreeData> {
    if (!SKILL_TREE_ENABLED) {
        return { identities: [] };
    }

    // 1. Fetch all raw data
    // Parallelize for performance
    const [categories, goals, habits] = await Promise.all([
        getCategoriesByUser(userId),
        getGoalsByUser(userId),
        getHabitsByUser(userId)
    ]);

    // Create a lookup for habits
    const habitMap = new Map(habits.map(h => [h.id, h]));

    // 2. Filter Goals that have a categoryId
    const categorizedGoals = goals.filter(g => g.categoryId && categories.some(c => c.id === g.categoryId));

    // 3. Group Goals by Category
    const goalsByCategory = new Map<string, Goal[]>();
    for (const goal of categorizedGoals) {
        if (!goal.categoryId) continue;
        const existing = goalsByCategory.get(goal.categoryId) || [];
        existing.push(goal);
        goalsByCategory.set(goal.categoryId, existing);
    }

    // 4. Build Identity Nodes
    const resultIdentities: SkillTreeIdentityNode[] = [];

    for (const category of categories) {
        const categoryGoals = goalsByCategory.get(category.id);

        // Skip categories with no goals
        if (!categoryGoals || categoryGoals.length === 0) continue;

        // Build Skills (Goals) for this Identity
        const skillNodes: SkillTreeSkillNode[] = [];

        for (const goal of categoryGoals) {
            // Compute Goal Progress
            // We use the existing utility which calculates cumulative/frequency progress
            const progressData = await computeGoalProgress(goal.id, userId);

            // Build Habit Nodes (Leaves)
            const linkedHabitNodes: SkillTreeHabitNode[] = [];

            // Goals have linkedHabitIds
            for (const habitId of goal.linkedHabitIds) {
                const habit = habitMap.get(habitId);
                if (!habit) continue;

                linkedHabitNodes.push({
                    id: habit.id,
                    name: habit.name,
                    progressText: progressData ? `${progressData.currentValue} / ${goal.targetValue || '?'}` : '0 / ?',
                    percent: progressData ? progressData.percent : 0,
                    atRisk: progressData ? progressData.inactivityWarning : false
                });
            }

            skillNodes.push({
                id: goal.id,
                title: goal.title,
                categoryId: category.id,
                progress: {
                    current: progressData?.currentValue || 0,
                    target: goal.targetValue || 100, // Default to avoid div/0
                    percent: progressData?.percent || 0
                },
                linkedHabits: linkedHabitNodes
            });
        }

        resultIdentities.push({
            id: category.id,
            name: category.name,
            color: category.color,
            skills: skillNodes
        });
    }

    return {
        identities: resultIdentities
    };
}

/**
 * Seeding is deprecated in favor of user-created Goals.
 * Keeping function stub to avoid breaking imports but it does nothing.
 */
export async function seedDefaultSkillTree(_userId: string): Promise<void> {
    // Deprecated
    return;
}
