export interface Category {
    id: string;
    name: string;
    color: string; // Hex code or Tailwind color class
}

export interface WellbeingSession {
    depression: number; // 1-5
    anxiety: number; // 1-5
    energy: number; // 1-5
    sleepScore: number; // 0-100
    notes?: string;
}

export interface DailyWellbeing {
    date: string;
    morning?: WellbeingSession;
    evening?: WellbeingSession;
    // Legacy fields for backward compatibility (optional)
    depression?: number;
    anxiety?: number;
    energy?: number;
    sleepScore?: number;
    notes?: string;
}

export interface HabitGoal {
    type: 'boolean' | 'number';
    target?: number; // e.g., 8 (hours), 2000 (calories)
    unit?: string; // e.g., 'hrs', 'kcal'
    frequency: 'daily' | 'weekly' | 'total'; // 'total' for cumulative goals
}

export interface Habit {
    id: string;
    categoryId: string;
    name: string;
    description?: string;
    goal: HabitGoal;
    archived: boolean;
    createdAt: string;

    // Bundle fields
    type?: 'boolean' | 'number' | 'time' | 'bundle'; // Optional for backward compatibility
    subHabitIds?: string[]; // IDs of habits in this bundle
    bundleParentId?: string; // ID of the parent bundle (if any)
    order?: number; // Display order

    pace?: string | null; // Estimated completion date

    // Calendar View Fields
    assignedDays?: number[]; // 0=Sun, 6=Sat
    scheduledTime?: string; // HH:mm
    durationMinutes?: number;

    // Non-Negotiable Fields
    nonNegotiable?: boolean;
    nonNegotiableDays?: number[]; // 0=Sun, 6=Sat
    deadline?: string; // HH:mm

    // Freeze Mechanics
    freezeCount?: number; // Max 3

    /**
     * Frequency & Bundles (frontend aligned)
     */
    frequency?: 'daily' | 'weekly';
    weeklyTarget?: number;

    bundleType?: 'checklist' | 'choice';
    bundleOptions?: Array<{
        key: string;
        label: string;
        icon?: string;
    }>;
}

export interface DayLog {
    habitId: string;
    date: string; // YYYY-MM-DD
    value: number; // 0 or 1 for boolean, actual value for number
    completed: boolean;
    source?: 'manual' | 'routine';
    routineId?: string;

    // Freeze Mechanics
    isFrozen?: boolean;
    freezeType?: 'manual' | 'auto' | 'soft';

    /** Optional: Choice Bundle Option ID */
    bundleOptionId?: string;
}

// Re-export Routine types
import type { Routine, RoutineStep, HabitEntry, HabitPotentialEvidence } from '../models/persistenceTypes';
export type { Routine, RoutineStep, HabitEntry, HabitPotentialEvidence };

export type Theme = 'dark' | 'light';

// Re-export Goal and GoalProgress from persistenceTypes for frontend use
// Re-export Goal and GoalProgress from persistenceTypes for frontend use
import type { Goal, GoalProgress, GoalWithProgress, GoalManualLog } from '../models/persistenceTypes';
export type { Goal, GoalProgress, GoalWithProgress, GoalManualLog };

/**
 * Completed Goal
 * 
 * Type alias for a completed goal (used in Win Archive).
 * A completed goal is simply a Goal where completedAt is not null.
 */
export type CompletedGoal = Goal;

/**
 * Goal Detail
 * 
 * Comprehensive data for a goal detail page, including the goal,
 * its progress, and manual logs.
 */
export interface GoalDetail {
    goal: Goal;
    progress: GoalProgress;
    manualLogs: GoalManualLog[];
}

/**
 * Progress Overview
 * 
 * Combined data for the Progress page, including today's habit completions
 * and all goals with their progress.
 */
export interface ProgressOverview {
    todayDate: string; // YYYY-MM-DD format
    habitsToday: Array<{
        habit: Habit;
        completed: boolean;
        value?: number; // Present if quantified habit has a value
        streak: number;
        formattedStreak: string; // "3 day streak" or "5 weeks"

        freezeStatus?: 'active' | 'used' | 'none'; // 'active' = currently frozen today
    }>;
    goalsWithProgress: GoalWithProgress[];
    momentum: {
        global: {
            state: MomentumState;
            activeDays: number;
            trend: 'up' | 'down' | 'neutral';
            copy: string;
        };
        category: Record<string, CategoryMomentumState>; // Keep simple for now or expand if needed
    };
}

// Momentum Types
export type GlobalMomentumState = 'Strong' | 'Steady' | 'Building' | 'Gentle Restart' | 'Ready';
export type CategoryMomentumState = 'Strong' | 'Steady' | 'Building' | 'Paused';

// Unified Momentum State for generic use (union of both)
export type MomentumState = GlobalMomentumState | CategoryMomentumState;

export interface MomentumConfig {
    global: {
        state: GlobalMomentumState;
        copy: string;
        activeDays: number;
    };
    categories: Record<string, {
        state: CategoryMomentumState;
        copy: string;
        activeDays: number;
    }>;
}
