/**
 * Explicit Data Models for Persistent Entities
 * 
 * This file defines the TypeScript interfaces for all data that is persisted
 * to localStorage (and will be migrated to MongoDB).
 * 
 * These models represent the exact shape of data as stored, including any
 * legacy fields or inconsistencies documented in the storage audit.
 */

/**
 * Category Entity
 * 
 * Storage Key: 'categories'
 * Storage Format: Category[] (array of Category objects)
 * 
 * Represents a grouping/category for habits (e.g., "Physical Health", "Mental Health").
 */
export interface Category {
    /** Unique identifier, generated via crypto.randomUUID() */
    id: string;
    
    /** Display name of the category (e.g., "Physical Health") */
    name: string;
    
    /** 
     * Tailwind CSS color class (e.g., "bg-emerald-500")
     * Format: Always a Tailwind class string, not a hex code
     */
    color: string;
}

/**
 * Goal Configuration
 * 
 * Embedded within Habit entity.
 * Defines the tracking goal for a habit.
 */
export interface Goal {
    /** Type of goal: boolean (yes/no) or number (tracked value) */
    type: 'boolean' | 'number';
    
    /** 
     * Target value (required for 'number' type, optional for 'boolean')
     * Examples: 8 (glasses of water), 4 (hours of deep work)
     */
    target?: number;
    
    /** 
     * Unit label for display (e.g., 'glasses', 'hours', 'steps')
     * Only used when type is 'number'
     */
    unit?: string;
    
    /** 
     * Tracking frequency: 'daily', 'weekly', or 'total' (cumulative goal)
     * 'total' means the goal is cumulative across all time (e.g., "Run 100 miles total")
     */
    frequency: 'daily' | 'weekly' | 'total';
}

/**
 * Habit Entity
 * 
 * Storage Key: 'habits'
 * Storage Format: Habit[] (array of Habit objects)
 * 
 * Represents a single habit that the user is tracking.
 */
export interface Habit {
    /** Unique identifier, generated via crypto.randomUUID() */
    id: string;
    
    /** Foreign key reference to Category.id */
    categoryId: string;
    
    /** Display name of the habit (e.g., "Morning Jog") */
    name: string;
    
    /** 
     * Optional description field
     * TODO: This field is defined in the type but never used in the UI.
     * It is not set when creating habits and not displayed anywhere.
     * Consider removing or implementing in future.
     */
    description?: string;
    
    /** Goal configuration for this habit */
    goal: Goal;
    
    /** Whether the habit is archived (hidden from active tracking) */
    archived: boolean;
    
    /** ISO 8601 timestamp of when the habit was created */
    createdAt: string;
    
    /** 
     * Estimated completion date (for cumulative goals)
     * TODO: This field is NOT persisted - it is calculated on-the-fly
     * using getEstimatedCompletionDate() utility. The field exists in the
     * type but is never written to storage. It should not be included in
     * persistence models for MongoDB migration.
     */
    pace?: string | null;
}

/**
 * DayLog Entity
 * 
 * Storage Key: 'logs'
 * Storage Format: Record<string, DayLog> (object with composite keys)
 * 
 * Composite Key Format: `${habitId}-${date}` (e.g., "abc123-2025-01-27")
 * Date Format: YYYY-MM-DD (ISO date string)
 * 
 * Represents a single day's completion record for a specific habit.
 */
export interface DayLog {
    /** Foreign key reference to Habit.id */
    habitId: string;
    
    /** 
     * Date in YYYY-MM-DD format (ISO date string)
     * Examples: "2025-01-27", "2024-12-25"
     */
    date: string;
    
    /** 
     * Tracked value for this day
     * - For boolean habits: 0 (not completed) or 1 (completed)
     * - For number habits: actual numeric value (e.g., 8 for 8 glasses)
     */
    value: number;
    
    /** 
     * Whether the goal was met for this day
     * - For boolean habits: true if value > 0
     * - For number habits: true if value >= goal.target
     */
    completed: boolean;
}

/**
 * WellbeingSession Entity
 * 
 * Embedded within DailyWellbeing entity.
 * Represents a single check-in session (morning or evening).
 */
export interface WellbeingSession {
    /** Depression level on a scale of 1-5 */
    depression: number;
    
    /** Anxiety level on a scale of 1-5 */
    anxiety: number;
    
    /** Energy level on a scale of 1-5 */
    energy: number;
    
    /** Sleep score on a scale of 0-100 */
    sleepScore: number;
    
    /** Optional free-text notes for this session */
    notes?: string;
}

/**
 * DailyWellbeing Entity
 * 
 * Storage Key: 'wellbeingLogs'
 * Storage Format: Record<string, DailyWellbeing> (object keyed by date string)
 * 
 * Key Format: YYYY-MM-DD (ISO date string, same as DayLog.date)
 * 
 * Represents wellbeing check-in data for a single day, which may include
 * both morning and evening sessions.
 */
export interface DailyWellbeing {
    /** Date in YYYY-MM-DD format (ISO date string) */
    date: string;
    
    /** Optional morning check-in session */
    morning?: WellbeingSession;
    
    /** Optional evening check-in session */
    evening?: WellbeingSession;
    
    /** 
     * Legacy fields for backward compatibility
     * TODO: These fields are read-only for backward compatibility with old data.
     * New data is only written in morning/evening session format.
     * Priority order when reading: evening → morning → legacy top-level
     * Consider deprecating these fields after migration.
     */
    depression?: number;
    anxiety?: number;
    energy?: number;
    sleepScore?: number;
    notes?: string;
}

/**
 * Storage Structure Types
 * 
 * These types represent the exact structure as stored in localStorage.
 */

/** Categories stored as an array */
export type CategoriesStorage = Category[];

/** Habits stored as an array */
export type HabitsStorage = Habit[];

/** DayLogs stored as a record with composite keys */
export type DayLogsStorage = Record<string, DayLog>;

/** WellbeingLogs stored as a record keyed by date */
export type WellbeingLogsStorage = Record<string, DailyWellbeing>;

/**
 * Complete Persistence Schema
 * 
 * Represents all persistent data in the application.
 */
export interface PersistenceSchema {
    /** Array of all categories */
    categories: CategoriesStorage;
    
    /** Array of all habits */
    habits: HabitsStorage;
    
    /** Record of all day logs, keyed by `${habitId}-${date}` */
    logs: DayLogsStorage;
    
    /** Record of all wellbeing logs, keyed by date (YYYY-MM-DD) */
    wellbeingLogs: WellbeingLogsStorage;
}

/**
 * localStorage Keys
 * 
 * Constants for the keys used in localStorage.
 */
export const STORAGE_KEYS = {
    CATEGORIES: 'categories',
    HABITS: 'habits',
    LOGS: 'logs',
    WELLBEING_LOGS: 'wellbeingLogs',
} as const;

