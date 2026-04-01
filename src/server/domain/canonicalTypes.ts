/**
 * Canonical Types
 * 
 * Centralized type definitions that enforce canonical vocabulary and invariants.
 * These types represent the "contract" for how data flows through the system.
 * 
 * Core Invariants:
 * - HabitEntry is the only historical truth
 * - Completion is derived, never stored
 * - DayKey is the aggregation boundary
 */

// Re-export for convenience
export type { DayKey } from '../../domain/time/dayKey';
export type { EntryView } from '../services/truthQuery';

/**
 * EntrySource - Canonical source types for HabitEntry
 * 
 * Defines where an entry came from, used for provenance tracking.
 */
export type EntrySource = 'manual' | 'routine' | 'quick' | 'import' | 'apple_health' | 'test';

/**
 * HabitEntryRecord - Canonical shape for HabitEntry stored in database
 * 
 * This represents the actual shape stored in MongoDB.
 * All fields are required except where explicitly marked optional.
 */
export interface HabitEntryRecord {
    /** Unique identifier */
    id: string;

    /** Foreign key reference to Habit.id */
    habitId: string;

    /** Timestamp of the entry (ISO 8601 UTC) */
    timestamp: string;

    /** Value contribution (null/undefined for boolean habits, number for numeric) */
    value?: number | null;

    /** Source of the entry */
    source: EntrySource;

    /** Optional: linked routine ID */
    routineId?: string;

    /** Optional: variant that generated this entry */
    variantId?: string;

    /** DayKey (YYYY-MM-DD) - the aggregation boundary */
    date: string;

    /** Optional: Logical Date Key (should match date) */
    dateKey?: string;

    /** Optional note */
    note?: string;

    /** Soft delete timestamp */
    deletedAt?: string;

    /** Creation timestamp */
    createdAt: string;

    /** Update timestamp */
    updatedAt: string;

    // Choice Bundle fields
    /** @deprecated Use choiceChildHabitId */
    bundleOptionId?: string;
    choiceChildHabitId?: string;
    bundleOptionLabel?: string;
    unitSnapshot?: string;
    optionKey?: string;

    // Apple Health provenance fields
    /** ID of the health rule that created this entry */
    sourceRuleId?: string;
    /** The metric value that triggered auto-log */
    importedMetricValue?: number;
    /** The metric type that triggered auto-log */
    importedMetricType?: string;
}

/**
 * GoalLinkRecord - Canonical shape for GoalLink (embedded in Goal)
 * 
 * Represents how a Goal links to Habits for progress tracking.
 */
export interface GoalLinkRecord {
    /** Array of habit IDs that contribute to this goal */
    linkedHabitIds: string[];

    /**
     * Aggregation mode for goal progress calculation.
     * - 'count': Count entries or distinct days (see countMode)
     * - 'sum': Sum entry values
     * 
     * Default: inferred from goal.type ('cumulative' → 'sum', 'onetime' → 'count')
     */
    aggregationMode?: 'count' | 'sum';

    /**
     * Count mode for count aggregation (only applies when aggregationMode === 'count').
     * - 'distinctDays': Count distinct dayKeys (default for count goals)
     * - 'entries': Count total number of entries
     * 
     * Default: 'distinctDays' for count goals
     */
    countMode?: 'distinctDays' | 'entries';

    /**
     * Optional unit for sum-mode validation.
     * If provided, entries with mismatched units will generate warnings.
     */
    unit?: string;

    /**
     * Optional: Granular linking for Choice Habits V2.
     * Allows linking to specific options with aggregation mode.
     */
    linkedTargets?: Array<
        | { type: 'habit'; habitId: string }
        | {
            type: 'option';
            parentHabitId: string;
            bundleOptionId: string;
            /** How to aggregate: 'days' (count days) or 'sum' (sum values) */
            aggregation: 'days' | 'sum';
        }
    >;
}

/**
 * GoalAggregationMode - How a goal aggregates progress from linked habits
 */
export type GoalAggregationMode = 'count' | 'sum';

/**
 * GoalCountMode - How to count entries for count-mode goals
 */
export type GoalCountMode = 'distinctDays' | 'entries';

/**
 * BundleMembershipRecord - Temporal parent-child relationship for bundles
 *
 * Represents a time range during which a child habit belongs to a parent bundle.
 * Used to derive bundle parent completion with historical accuracy.
 * Applies to both choice and checklist bundles.
 */
export interface BundleMembershipRecord {
    /** Unique identifier */
    id: string;

    /** Parent bundle habit ID */
    parentHabitId: string;

    /** Child habit ID */
    childHabitId: string;

    /** DayKey when membership starts (inclusive) */
    activeFromDayKey: string;

    /** DayKey when membership ends (inclusive). Null = currently active. */
    activeToDayKey?: string | null;

    /** Days of week this child is scheduled. 0=Sun...6=Sat. Null/undefined = every day. */
    daysOfWeek?: number[] | null;

    /** ISO timestamp when the habit was graduated (behavior became automatic). */
    graduatedAt?: string | null;

    /** UX hint: hide from active lists. Does not affect temporal logic. */
    archivedAt?: string | null;

    /** Creation timestamp */
    createdAt: string;

    /** Update timestamp */
    updatedAt: string;
}

/**
 * ChecklistSuccessRule - Re-exported from shared module (single source of truth).
 */
export type { ChecklistSuccessRule } from '../../shared/checklistSuccessRule';

/**
 * Validation helper types
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * HabitEntryPayload - Shape for creating/updating HabitEntry via API
 * 
 * This is the shape expected by route handlers before validation.
 */
export interface HabitEntryPayload {
    habitId: string;
    dayKey?: string; // DayKey format (YYYY-MM-DD) - preferred
    date?: string; // DayKey format (YYYY-MM-DD) - legacy alias
    value?: number | null;
    source?: EntrySource;
    routineId?: string;
    variantId?: string;
    timestamp?: string; // ISO 8601, defaults to now
    timeZone?: string; // IANA timezone (required if deriving dayKey from timestamp)
    note?: string;
    bundleOptionId?: string;
    choiceChildHabitId?: string;
    bundleOptionLabel?: string;
    unitSnapshot?: string;
}

