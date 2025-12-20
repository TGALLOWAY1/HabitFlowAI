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

import type { DayKey } from '../../domain/time/dayKey';
import type { EntryView } from '../services/truthQuery';

// Re-export DayKey for convenience
export type { DayKey } from '../../domain/time/dayKey';

// Re-export EntryView for convenience
export type { EntryView } from '../services/truthQuery';

/**
 * EntrySource - Canonical source types for HabitEntry
 * 
 * Defines where an entry came from, used for provenance tracking.
 */
export type EntrySource = 'manual' | 'routine' | 'quick' | 'import' | 'test';

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
export type GoalAggregationMode = 'days' | 'sum';

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
    date: string; // DayKey format (YYYY-MM-DD)
    value?: number | null;
    source?: EntrySource;
    routineId?: string;
    timestamp?: string; // ISO 8601, defaults to now
    note?: string;
    bundleOptionId?: string;
    choiceChildHabitId?: string;
    bundleOptionLabel?: string;
    unitSnapshot?: string;
}

