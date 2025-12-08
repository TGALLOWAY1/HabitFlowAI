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
/**
 * Habit Goal (for Habit entity)
 * This represents the goal/target for a single habit, not to be confused with the Goal entity.
 */
export interface HabitGoal {
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
    goal: HabitGoal;
    
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
    
    /** 
     * Optional: ID of the Activity that produced this log entry
     * Set when a habit is completed as part of an Activity workflow
     */
    activityId?: string;
    
    /** 
     * Optional: ID of the ActivityStep within the Activity that produced this log
     * Set when a habit step in an Activity is completed
     */
    activityStepId?: string;
}

/**
 * ActivityStep Type
 * 
 * Type discriminator for activity steps.
 * - 'habit': Step that links to an existing habit
 * - 'task': Standalone task step with its own content
 */
export type ActivityStepType = 'habit' | 'task';

/**
 * ActivityStep Entity
 * 
 * Embedded within Activity entity.
 * Represents a single step in an activity workflow.
 * 
 * Steps can be either:
 * - Habit steps: Link to an existing habit for tracking
 * - Task steps: Standalone tasks with instructions, images, or timers
 */
export interface ActivityStep {
    /** 
     * Unique identifier for this step within the activity
     * Generated via crypto.randomUUID() (frontend) or randomUUID() (backend)
     */
    id: string;
    
    /** Type of step: 'habit' (links to habit) or 'task' (standalone) */
    type: ActivityStepType;
    
    /** Display title/name of the step */
    title: string;
    
    /** Optional detailed instructions for the step */
    instruction?: string;
    
    /** Optional image URL for visual guidance (used in Image View) */
    imageUrl?: string;
    
    /** 
     * Optional duration in seconds for timer-based steps
     * Used for timers in Image View
     */
    durationSeconds?: number;
    
    /** 
     * Foreign key reference to Habit.id
     * Required when type === 'habit', undefined for 'task' steps
     */
    habitId?: string;
    
    /** 
     * Optional time estimate in minutes
     * Editable in Habit View for habit steps
     */
    timeEstimateMinutes?: number;
}

/**
 * Activity Entity
 * 
 * Storage Key: 'activities'
 * Storage Format: Activity[] (array of Activity objects)
 * 
 * Represents a structured workflow or routine composed of multiple steps.
 * Activities guide users through a sequence of habits and tasks, providing
 * a structured way to complete related actions together.
 */
export interface Activity {
    /** 
     * Unique identifier, generated via crypto.randomUUID() (frontend) or randomUUID() (backend)
     * This is the application-level primary key, not MongoDB's _id
     */
    id: string;
    
    /** 
     * User ID to scope the activity to a specific user
     * Added at repository layer when inserting, stripped when returning
     * Currently uses placeholder 'anonymous-user' until authentication is implemented
     */
    userId: string;
    
    /** Display title/name of the activity */
    title: string;
    
    /** Array of steps that make up this activity */
    steps: ActivityStep[];
    
    /** ISO 8601 timestamp of when the activity was created */
    createdAt: string;
    
    /** ISO 8601 timestamp of when the activity was last updated */
    updatedAt: string;
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

/** Activities stored as an array */
export type ActivitiesStorage = Activity[];

/**
 * Goal Entity
 * 
 * Storage Key: 'goals'
 * Storage Format: Goal[] (array of Goal objects)
 * 
 * Represents a user-defined goal that can be linked to one or more habits.
 * Goals can be cumulative (total value over time) or frequency-based (recurring).
 */
export interface Goal {
    /** 
     * Unique identifier, generated via crypto.randomUUID() (frontend) or randomUUID() (backend)
     * This is the application-level primary key, not MongoDB's _id
     */
    id: string;
    
    /** Display title/name of the goal */
    title: string;
    
    /** 
     * Type of goal: 'cumulative' (total value over time) or 'frequency' (recurring)
     * - 'cumulative': Track total progress toward a target (e.g., "Run 100 miles total")
     * - 'frequency': Track how often a goal is met (e.g., "Exercise 3 times per week")
     */
    type: 'cumulative' | 'frequency';
    
    /** Target value to achieve (e.g., 100 for "100 miles", 3 for "3 times per week") */
    targetValue: number;
    
    /** Optional unit label for display (e.g., 'miles', 'times', 'hours') */
    unit?: string;
    
    /** 
     * Array of habit IDs that contribute to this goal
     * These should reference valid Habit.id values
     */
    linkedHabitIds: string[];
    
    /** Optional deadline date in ISO 8601 format (YYYY-MM-DD) */
    deadline?: string;
    
    /** ISO 8601 timestamp of when the goal was created */
    createdAt: string;
    
    /** Optional ISO 8601 timestamp of when the goal was completed */
    completedAt?: string;
    
    /** Optional free-text notes about the goal */
    notes?: string;
    
    /** Optional URL to a badge/image associated with the goal */
    badgeImageUrl?: string;
}

/** Goals stored as an array */
export type GoalsStorage = Goal[];

/**
 * Goal Progress
 * 
 * Represents the current progress toward a goal.
 */
export interface GoalProgress {
    /** Current value achieved toward the goal */
    currentValue: number;
    
    /** Percentage of goal completion (0-100) */
    percent: number;
    
    /** Array of progress data for the last 7 days (most recent first) */
    lastSevenDays: Array<{
        date: string; // YYYY-MM-DD format
        value: number; // Progress value for this day
        hasProgress: boolean; // Whether there was any progress on this day
    }>;
    
    /** Whether the goal has an inactivity warning (≥4 days with no progress in last 7 days) */
    inactivityWarning: boolean;
}

/**
 * Goal with Progress
 * 
 * Represents a goal with its computed progress information.
 */
export interface GoalWithProgress {
    goal: Goal;
    progress: GoalProgress;
}

/**
 * Goal Manual Log Entity
 * 
 * Storage Key: 'goalManualLogs'
 * Storage Format: GoalManualLog[] (array of GoalManualLog objects)
 * 
 * Represents a manual progress entry for a cumulative goal.
 * Allows users to log progress that isn't tracked through habits.
 */
export interface GoalManualLog {
    /**
     * Unique identifier, generated via crypto.randomUUID() (frontend) or randomUUID() (backend)
     * This is the application-level primary key, not MongoDB's _id
     */
    id: string;

    /** Foreign key reference to Goal.id */
    goalId: string;

    /** Amount added toward the goal (must be > 0) */
    value: number;

    /** ISO 8601 timestamp of when the progress happened (defaults to now if not provided) */
    loggedAt: string;

    /** ISO 8601 timestamp of when the log was created */
    createdAt: string;
}

export type GoalManualLogsStorage = GoalManualLog[];

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
 * - activities → 'activities' collection
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
    
    /** Array of all activities */
    activities: ActivitiesStorage;
    
    /** Array of all goals */
    goals: GoalsStorage;
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
    ACTIVITIES: 'activities',
    GOALS: 'goals',
    GOAL_MANUAL_LOGS: 'goalManualLogs',
} as const;

