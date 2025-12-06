/**
 * Explicit Data Models for Persistent Entities
 * 
 * This file defines the TypeScript interfaces for all data that is persisted
 * to MongoDB via the backend API.
 * 
 * These models represent the exact shape of data as stored in MongoDB.
 * 
 * IMPORTANT: These interfaces represent the APPLICATION-LEVEL data models.
 * MongoDB documents include additional fields (_id, userId, compositeKey) that
 * are added at the repository layer and stripped before returning to the application.
 * See storage audit for MongoDB document structure details.
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
    /** 
     * Unique identifier, generated via crypto.randomUUID() (frontend) or randomUUID() (backend)
     * This is the application-level primary key, not MongoDB's _id
     */
    id: string;
    
    /** Display name of the category (e.g., "Physical Health") */
    name: string;
    
    /** 
     * Tailwind CSS color class (e.g., "bg-emerald-500")
     * Format: Always a Tailwind class string, not a hex code
     * TODO: Verify if hex codes are ever used in practice (type comment in types/index.ts suggests hex is possible)
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
    /** 
     * Unique identifier, generated via crypto.randomUUID() (frontend) or randomUUID() (backend)
     * This is the application-level primary key, not MongoDB's _id
     */
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
     * 
     * Note: This field IS stored in MongoDB if provided, but frontend never sets it.
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
     * 
     * ⚠️ CRITICAL: This field is NOT persisted to MongoDB.
     * It is calculated on-the-fly using getEstimatedCompletionDate() utility.
     * The field exists in the type for runtime use but is never written to storage.
     * 
     * TODO: Exclude this field from MongoDB schema. It should be a computed property
     * or calculated in the application layer, not stored in the database.
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
     * 
     * Note: In MongoDB, this is combined with habitId to create a compositeKey
     * field for efficient querying: `${habitId}-${date}`
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
     * 
     * Note: This is calculated when the log is created/updated, not stored
     * independently. The calculation logic is in HabitContext.tsx (lines 446, 412)
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
    /** 
     * Date in YYYY-MM-DD format (ISO date string)
     * This serves as the unique key for wellbeing logs (combined with userId in MongoDB)
     */
    date: string;
    
    /** Optional morning check-in session */
    morning?: WellbeingSession;
    
    /** Optional evening check-in session */
    evening?: WellbeingSession;
    
    /** 
     * Legacy fields for backward compatibility
     * 
     * TODO: These fields are read-only for backward compatibility with old data.
     * New data is only written in morning/evening session format.
     * Priority order when reading: evening → morning → legacy top-level
     * (See ProgressRings.tsx for reading logic)
     * 
     * Migration consideration: After MongoDB migration is complete and all
     * users have migrated, consider deprecating these fields. They are preserved
     * in MongoDB for backward compatibility but should not be written to.
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
 * These types represent the structure used in the frontend application state.
 * 
 * Note: MongoDB stores these differently:
 * - Arrays (categories, habits) are stored as document arrays in collections
 * - Records (logs, wellbeingLogs) are stored as separate documents with composite keys
 * 
 * The repository layer converts between these formats when reading/writing to MongoDB.
 */

/** Categories stored as an array */
export type CategoriesStorage = Category[];

/** Habits stored as an array */
export type HabitsStorage = Habit[];

/** 
 * DayLogs stored as a record with composite keys
 * 
 * Key Format: `${habitId}-${date}` (e.g., "abc123-2025-01-27")
 * This matches the compositeKey field stored in MongoDB for efficient querying.
 */
export type DayLogsStorage = Record<string, DayLog>;

/** 
 * WellbeingLogs stored as a record keyed by date
 * 
 * Key Format: YYYY-MM-DD (e.g., "2025-01-27")
 * This matches the date field used as unique key in MongoDB (combined with userId).
 */
export type WellbeingLogsStorage = Record<string, DailyWellbeing>;

/**
 * Complete Persistence Schema
 * 
 * Represents all persistent data in the application.
 * All data is stored in MongoDB via the backend API.
 * 
 * In MongoDB, each entity type is stored in a separate collection:
 * - categories → 'categories' collection
 * - habits → 'habits' collection
 * - logs → 'dayLogs' collection
 * - wellbeingLogs → 'wellbeingLogs' collection
 * 
 * All MongoDB documents are scoped by userId (currently 'anonymous-user' placeholder).
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
 * MongoDB Collection Names
 * 
 * Constants for MongoDB collection names.
 * These are used in the repository layer (src/server/repositories/).
 */
export const MONGO_COLLECTIONS = {
    CATEGORIES: 'categories',
    HABITS: 'habits',
    DAY_LOGS: 'dayLogs',
    WELLBEING_LOGS: 'wellbeingLogs',
} as const;

