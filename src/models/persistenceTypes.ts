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

    /** 
     * Optional: ID of a parent Goal this habit contributes to.
     * New feature for Weekly Habit Redesign (Goal Linking).
     */
    linkedGoalId?: string;

    /**
     * Optional: IDs of routines that link to this habit.
     * New feature for Bi-Directional Sync.
     */
    linkedRoutineIds?: string[];

    /** Whether the habit is archived (hidden from active tracking) */
    archived: boolean;

    /** ISO 8601 timestamp of when the habit was created */
    createdAt: string;

    /** 
     * Display order of the habit. Lower numbers appear first.
     * Optional for backward compatibility (treated as infinity if missing).
     */
    order?: number;

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

    // Bundle fields
    type?: 'boolean' | 'number' | 'time' | 'bundle'; // Optional for backward compatibility
    subHabitIds?: string[]; // IDs of habits in this bundle
    bundleParentId?: string; // ID of the parent bundle (if any)


    /**
     * Optional: Assigned days of the week for weekly habits.
     * 0 = Sunday, 1 = Monday, ..., 6 = Saturday
     * Used for calendar visualization and potentially notifications.
     */
    assignedDays?: number[];

    /**
     * Optional: Preferred time of day for the habit (e.g., "09:00").
     * Used for calendar visualization.
     */
    scheduledTime?: string;

    /**
     * Optional: Duration in minutes for the habit (default: 30).
     * Used for calendar visualization.
     */
    durationMinutes?: number;

    /**
     * Optional: Whether the habit is non-negotiable.
     * Non-negotiable habits typically have a distinct visual style (Priority Ring).
     */
    nonNegotiable?: boolean;

    /**
     * Optional: Specific days where the habit is non-negotiable.
     * 0 = Sunday, 1 = Monday, etc.
     * If undefined but nonNegotiable is true, it is non-negotiable on ALL assigned days (or every day for daily habits).
     */
    nonNegotiableDays?: number[];

    /**
     * Optional: Deadline time (HH:MM) for non-negotiable habits.
     */
    deadline?: string;

    /**
     * Freeze inventory count for this habit.
     * Max: 3
     * Default: 3 (on creation)
     * Decrements when a manual freeze is used.
     * Increments (max 3) when a freeze is earned via global activity.
     */
    freezeCount?: number;

    /**
     * New fields for Frequency & Bundles (Single-Entry MVP)
     */
    frequency?: 'daily' | 'weekly';
    weeklyTarget?: number;

    /**
     * Bundle Configuration (Daily Only)
     * - 'checklist': Parent completes when ALL children complete.
     * - 'choice': Parent completes when ONE option is selected (stored in parent entry).
     */
    bundleType?: 'checklist' | 'choice';

    /**
     * Options for Choice Bundles.
     * Note: These are NOT habits. They have no independent tracking.
     * @deprecated Use subHabitIds for Choice Bundles (Child Habits) instead.
     */
    bundleOptions?: Array<{
        id: string;          // Stable UUID for the option
        label: string;
        icon?: string;
        /**
         * Optional: Metric configuration for this option.
         * If 'mode' is 'required', user MUST enter a value when selecting this option.
         */
        metricConfig?: {
            mode: 'none' | 'required';
            unit?: string;     // e.g. "miles", "reps"
            step?: number;     // e.g. 0.5, 5 (for UI increments)
        };
        /**
         * Legacy key for backward compatibility.
         * TODO: Remove after migration.
         */
        key?: string;
    }>;

    // Day View Fields
    pinned?: boolean; // For "Today's Focus"
    timeEstimate?: number; // In minutes
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
 * 
 * // DEPRECATED SOURCE OF TRUTH: derived cache from HabitEntry.
 * // This entity is now derived from HabitEntries and serves as a cache
 * // for the dashboard/calendar UI. Do not write to this directly unless
 * // recomputing from entries.
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
     * - For Choice Parents: null/undefined (value is tracked in entries)
     */
    value?: number;

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
     * Optional: Source of the habit completion
     * - 'manual': User clicked the checkbox in the habit list
     * - 'routine': Auto-completed by finishing a routine
     */
    source?: 'manual' | 'routine';

    /** 
     * Optional: ID of the Routine that produced this log entry
     * Set when a habit is completed via a routine
     */
    routineId?: string;

    /** 
     * Optional: Indicates if this day was frozen (streak protected)
     */
    isFrozen?: boolean;

    /**
     * Optional: The type of freeze applied
     * - 'manual': User explicitly used a freeze (consumes inventory)
     * - 'auto': System automatically applied freeze (consumes inventory)
     * - 'soft': System applied grace (does NOT consume inventory)
     */
    freezeType?: 'manual' | 'auto' | 'soft';

    /** 
     * Optional: Choice Bundle Option ID 
     * (Legacy/Single-Select)
     * @deprecated Use completedOptions or check choiceChildHabitId in entries
     */
    bundleOptionId?: string;

    /**
     * Map of Option IDs to their values (or true if boolean) for Multi-Select Choice Habits.
     * Use this to render the status of individual options in the Grid.
     * Key: bundleOptionId
     * Value: number (metric) or 1 (boolean/simple)
     */
    completedOptions?: Record<string, number>;
}


/**
 * RoutineStep Entity
 * 
 * Embedded within Routine entity.
 * Represents a single step in a routine workflow.
 * 
 * Steps are now purely instructional/guiding content.
 * They do NOT directly link to habits for tracking (habit completion is handled at the Routine level).
 */
export interface RoutineStep {
    /** 
     * Unique identifier for this step within the routine
     * Generated via crypto.randomUUID() (frontend) or randomUUID() (backend)
     */
    id: string;

    /** Display title/name of the step */
    title: string;

    /** Optional detailed instructions for the step */
    instruction?: string;

    /** Optional image URL for visual guidance */
    imageUrl?: string;

    /** 
     * Optional duration in seconds for timer-based steps
     * Renamed from durationSeconds to timerSeconds for consistency with usage
     */
    timerSeconds?: number;

    /** 
     * Optional: ID of the habit linked to this step.
     * Reaching this step generates potential evidence for the habit.
     */
    linkedHabitId?: string;
}

/**
 * Routine Entity
 * 
 * Storage Key: 'routines'
 * Storage Format: Routine[] (array of Routine objects)
 * 
 * Represents a structured workflow designed to support one or more habits.
 * "Doing the work" (Routine) is separate from "Tracking the outcome" (Habit).
 */
export interface Routine {
    /** 
     * Unique identifier
     * This is the application-level primary key
     */
    id: string;

    /** 
     * User ID to scope the routine to a specific user
     */
    userId: string;

    /** Display title/name of the routine */
    title: string;

    /** Optional category ID to group this routine and filter linked habits */
    categoryId?: string;

    /** 
     * IDs of habits that this routine is "in service of".
     * Completing this routine can offer to mark these habits as complete.
     */
    linkedHabitIds: string[];

    /** Array of steps that make up this routine */
    steps: RoutineStep[];

    /** ISO 8601 timestamp of when the routine was created */
    createdAt: string;

    /** ISO 8601 timestamp of when the routine was last updated */
    updatedAt: string;
}

/**
 * RoutineLog Entity (formerly ActivityLog)
 * 
 * Storage Key: 'routineLogs'
 * Storage Format: Record<string, RoutineLog> (object keyed by composite key)
 * 
 * Composite Key: `${routineId}-${date}`
 * 
 * Represents a record that a routine was completed on a specific day.
 */
export interface RoutineLog {
    /** Foreign key reference to Routine.id */
    routineId: string;

    /** Date in YYYY-MM-DD format */
    date: string;

    /** ISO 8601 timestamp of when the routine was completed */
    completedAt: string;
}

/**
 * Journal Entry Entity
 * 
 * Storage Key: 'journalEntries'
 * Storage Format: JournalEntry[] (array of JournalEntry objects)
 * 
 * Represents a single journal entry based on a template.
 */
export interface JournalEntry {
    /** 
     * Unique identifier
     */
    id: string;

    /** Foreign key reference to User (for future multi-user support) */
    userId: string;

    /** 
     * ID of the template used (e.g., 'morning-primer', 'free-write') 
     */
    templateId: string;

    /** 
     * The specific variant/mode used for this entry
     * - 'standard': Default questions
     * - 'deep': Extended questions
     * - 'free': No structure
     */
    mode: 'standard' | 'deep' | 'free';

    /**
     * The persona active for this entry (e.g., "The Strategic Coach")
     * Captured at time of writing in case templates change.
     */
    persona?: string;

    /**
     * The actual content of the entry.
     * Keyed by prompt ID (or 'free-write' for unstructured).
     * Value is the user's answer.
     */
    content: Record<string, string>;

    /** date in YYYY-MM-DD format */
    date: string;

    /** ISO 8601 timestamp of when the entry was created */
    createdAt: string;

    /** ISO 8601 timestamp of when the entry was last updated */
    updatedAt: string;
}

/** Journal Entries stored as an array */
export type JournalEntriesStorage = JournalEntry[];

/**
 * Identity Entity
 * 
 * Storage Key: 'identities'
 * Storage Format: Identity[]
 * 
 * Represents a high-level identity area (e.g., "Physical Health", "Musician").
 */
export interface Identity {
    /** Unique identifier */
    id: string;

    /** User ID owner */
    userId: string;

    /** Display name */
    name: string;

    /** Display order (lower = earlier) */
    sortOrder: number;

    /** Optional icon name or emoji */
    icon?: string;

    /** ISO 8601 timestamp */
    createdAt: string;
}

/**
 * Skill Entity
 * 
 * Storage Key: 'skills'
 * Storage Format: Skill[]
 * 
 * Represents a learnable capability within an identity.
 */
export interface Skill {
    /** Unique identifier */
    id: string;

    /** User ID owner */
    userId: string;

    /** ID of the parent Identity */
    identityId: string;

    /** Display name */
    name: string;

    /** IDs of habits that contribute to this skill */
    habitIds: string[];

    /** How progress is calculated */
    progressMode: 'volume' | 'consistency' | 'hybrid';

    /** Optional config for level thresholds */
    levelConfig?: {
        baseXp: number; // XP needed for first level
        growthFactor: number; // Multiplier for subsequent levels
    };

    /** Display order */
    sortOrder: number;

    /** ISO 8601 timestamp */
    createdAt: string;
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

/** Routines stored as an array */
export type RoutinesStorage = Routine[];

/** RoutineLogs stored as a record with composite keys */
export type RoutineLogsStorage = Record<string, RoutineLog>;

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
    /** 
     * Unique identifier
     */
    id: string;

    /** 
     * ID of the Category this goal belongs to.
     * Required for Skill Tree visualization.
     */
    categoryId?: string;

    /** Display title/name of the goal */
    title: string;

    /** 
     * Type of goal: 'cumulative', 'frequency', or 'onetime'
     * - 'cumulative': Track total progress toward a target (e.g., "Run 100 miles total")
     * - 'frequency': Track how often a goal is met (e.g., "Exercise 3 times per week")
     * - 'onetime': A specific event or binary outcome (e.g., "Pass AWS Exam")
     */
    type: 'cumulative' | 'frequency' | 'onetime';

    /** 
     * Target value to achieve (e.g., 100 for "100 miles", 3 for "3 times per week")
     * Optional for 'onetime' goals (which are binary)
     */
    targetValue?: number;

    /** Optional unit label for display (e.g., 'miles', 'times', 'hours') */
    unit?: string;

    /** 
     * Array of habit IDs that contribute to this goal
     * These should reference valid Habit.id values
     */
    linkedHabitIds: string[];

    /**
     * Aggregation mode for goal progress calculation.
     * - 'count': Count entries or distinct days (see countMode)
     * - 'sum': Sum entry values
     * 
     * Default: inferred from goal.type ('cumulative' → 'sum', 'frequency' → 'count')
     */
    aggregationMode?: 'count' | 'sum';

    /**
     * Count mode for count aggregation (only applies when aggregationMode === 'count').
     * - 'distinctDays': Count distinct dayKeys (default for frequency goals)
     * - 'entries': Count total number of entries
     * 
     * Default: 'distinctDays' for count goals
     */
    countMode?: 'distinctDays' | 'entries';

    /**
     * Optional: Granular linking for Choice Habits V2.
     * Allows linking to specific options (e.g., "Run 5 miles" linked to "Running" option).
     */
    linkedTargets?: Array<
        | { type: 'habit'; habitId: string }
        | {
            type: 'option';
            parentHabitId: string;
            bundleOptionId: string;
            aggregation: 'days' | 'sum';
        }
    >;

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
 * Goal Progress Warning
 * 
 * Represents a warning about goal progress calculation.
 */
export interface GoalProgressWarning {
    /** Type of warning */
    type: 'UNIT_MISMATCH';
    /** Habit ID that caused the warning */
    habitId: string;
    /** Expected unit */
    expectedUnit: string;
    /** Found unit */
    foundUnit: string;
}

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

    /** Optional warnings about progress calculation */
    warnings?: GoalProgressWarning[];

    /** Array of progress data for the last 7 days (most recent first) */
    lastSevenDays: Array<{
        date: string; // YYYY-MM-DD format
        value: number; // Progress value for this day
        hasProgress: boolean; // Whether there was any progress on this day
    }>;

    /** Array of progress data for the last 30 days (most recent first), used for sparklines and heatmaps */
    lastThirtyDays: Array<{
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
 * - routines → 'routines' collection
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

    /** Array of all routines */
    routines: RoutinesStorage;

    /** Array of all goals */
    goals: GoalsStorage;

    /** Record of all routine logs */
    routineLogs: RoutineLogsStorage;

    /** Record of all journal entries */
    journalEntries: JournalEntriesStorage;

    /** Array of all identities */
    identities: Identity[];

    /** Array of all skills */
    skills: Skill[];
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
    ROUTINES: 'routines',
    GOALS: 'goals',
    GOAL_MANUAL_LOGS: 'goalManualLogs',
    ROUTINE_LOGS: 'routineLogs',
    JOURNAL_ENTRIES: 'journalEntries',
    TASKS: 'tasks',
    HABIT_ENTRIES: 'habitEntries',
    HABIT_POTENTIAL_EVIDENCE: 'habitPotentialEvidence',
} as const;



/**
 * HabitEntry Entity (New Canonical Source of Truth)
 * 
 * Storage Key: 'habitEntries'
 * Storage Format: HabitEntry[] (array of HabitEntry documents)
 * 
 * Represents a single granular event contributing to a habit.
 * This is the SOURCE OF TRUTH. DayLogs are derived from these entries.
 */
export interface HabitEntry {
    /** 
     * Unique identifier
     */
    id: string;

    /** Foreign key reference to Habit.id */
    habitId: string;

    /** 
     * Timestamp of the entry (ISO 8601)
     * For daily habits, this typically matches the date, but stores full time.
     */
    timestamp: string;

    /** 
     * Value contribution
     * - For binary habits: usually 1
     * - For numeric habits: the amount added (e.g., 50 pushups)
     * - For Choice V2: Optional. Required if option metric is required. undefined/null if option metric is none.
     */
    value?: number;

    /**
     * Choice Habit V2 Fields
     */

    /** ID of the specific option selected (for Choice Bundles) 
     * @deprecated Use choiceChildHabitId
     */
    bundleOptionId?: string;

    /**
     * ID of the child habit selected (Unification Model).
     * Used when bundleType='choice' and the choice is a real Habit.
     */
    choiceChildHabitId?: string;

    /** Snapshot of the option label at time of entry (for history resilience) */
    bundleOptionLabel?: string;

    /** Snapshot of the unit (e.g. "miles") at time of entry */
    unitSnapshot?: string;

    /** 
     * Source of the entry
     * - 'manual': User clicked/typed
     * - 'routine': From a routine completion
     * - 'quick': Quick-add interface
     * - 'import': Imported data
     * - 'test': Test data
     */
    source: 'manual' | 'routine' | 'quick' | 'import' | 'test';

    /** Optional: linked activity/routine ID */
    routineId?: string;

    /**
     * DayKey (YYYY-MM-DD) - Canonical aggregation boundary
     * Required: All entries must have a dayKey for aggregation.
     * This is the primary field for day-based queries and grouping.
     * This is the ONLY persisted aggregation day field.
     */
    dayKey: string;

    /** 
     * Legacy date field (YYYY-MM-DD) - READ-ONLY, NOT PERSISTED
     * @deprecated Use dayKey instead. This field is:
     * - Accepted as input for backward compatibility (normalized to dayKey)
     * - Returned in API responses as a derived alias from dayKey
     * - NOT stored in the database
     * 
     * For reads: If present in legacy records, it is ignored in favor of dayKey.
     */
    date?: string;

    /** Optional note */
    note?: string;

    /** Soft delete timestamp */
    deletedAt?: string;

    /** Creation timestamp */
    createdAt: string;

    /** Update timestamp */
    updatedAt: string;

    /**
     * Deprecated dateKey field (YYYY-MM-DD)
     * @deprecated Use dayKey instead. This field is kept for backward compatibility only.
     */
    dateKey?: string;

    /**
     * Option Key for Choice Bundles
     * If this entry represents a Choice Bundle completion, this stores which option was selected.
     */
    optionKey?: string;
}

export type HabitEntriesStorage = HabitEntry[];

export interface PersistenceSchema {
    categories: CategoriesStorage;
    habits: HabitsStorage;
    logs: DayLogsStorage;
    habitEntries: HabitEntriesStorage;
    wellbeingLogs: WellbeingLogsStorage;
    routines: RoutinesStorage;
    goals: GoalsStorage;
    routineLogs: RoutineLogsStorage;
    journalEntries: JournalEntriesStorage;
    habitPotentialEvidence: HabitPotentialEvidenceStatsStorage;
}

/**
 * HabitPotentialEvidence Entity
 * 
 * Storage Key: 'habitPotentialEvidence'
 * Storage Format: HabitPotentialEvidence[] (array of HabitPotentialEvidence documents)
 * 
 * Represents a signal that a user *might* have completed a habit, based on
 * external context (like a routine step).
 * 
 * This is "Potential" evidence. It requires user confirmation to become a HabitEntry.
 */
export interface HabitPotentialEvidence {
    /** Unique identifier */
    id: string;

    /** Foreign key reference to Habit.id */
    habitId: string;

    /** ID of the Routine that generated this evidence */
    routineId: string;

    /** ID of the specific Step that generated this evidence */
    stepId: string;

    /** 
     * Date in YYYY-MM-DD format
     * Used for querying evidence for a specific day
     */
    date: string;

    /** ISO 8601 timestamp of when the evidence was generated */
    timestamp: string;

    /** Source type (currently only 'routine-step') */
    source: 'routine-step';
}

export type HabitPotentialEvidenceStatsStorage = HabitPotentialEvidence[];



