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
    pace?: string | null; // Estimated completion date

    // Calendar View Fields
    assignedDays?: number[]; // 0=Sun, 6=Sat
    scheduledTime?: string; // HH:mm
    durationMinutes?: number;
}

export interface DayLog {
    habitId: string;
    date: string; // YYYY-MM-DD
    value: number; // 0 or 1 for boolean, actual value for number
    completed: boolean;
    activityId?: string; // which Activity produced this log (if any)
    activityStepId?: string; // which step within that Activity
}

export type ActivityStepType = 'habit' | 'task';

export interface ActivityStep {
    id: string;
    type: ActivityStepType;
    title: string;
    instruction?: string;
    imageUrl?: string;
    durationSeconds?: number;
    habitId?: string; // required when type === 'habit'
    timeEstimateMinutes?: number;
}

export interface Activity {
    id: string;
    userId: string;
    title: string;
    steps: ActivityStep[];
    createdAt: string;
    updatedAt: string;
}

export type Theme = 'dark' | 'light';

// Re-export Goal and GoalProgress from persistenceTypes for frontend use
export type { Goal, GoalProgress, GoalWithProgress, GoalManualLog } from '../models/persistenceTypes';

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
    }>;
    goalsWithProgress: GoalWithProgress[];
}
