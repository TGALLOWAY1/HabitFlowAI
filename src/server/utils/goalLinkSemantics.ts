/**
 * GoalLink Semantics Utilities
 * 
 * Utilities for determining and applying GoalLink aggregation semantics.
 * Ensures deterministic goal progress calculation.
 */

import type { Goal } from '../../models/persistenceTypes';
import type { GoalAggregationMode, GoalCountMode } from '../domain/canonicalTypes';

/**
 * Determines the aggregation mode for a goal.
 * 
 * @param goal - Goal object
 * @returns Aggregation mode ('count' or 'sum')
 */
export function getAggregationMode(goal: Goal): GoalAggregationMode {
    // If explicitly set, use it
    if (goal.aggregationMode === 'count' || goal.aggregationMode === 'sum') {
        return goal.aggregationMode;
    }

    // Default: infer from goal type
    if (goal.type === 'cumulative') {
        return 'sum';
    }
    // frequency or onetime
    return 'count';
}

/**
 * Determines the count mode for a goal.
 * 
 * @param goal - Goal object
 * @returns Count mode ('distinctDays' or 'entries')
 */
export function getCountMode(goal: Goal): GoalCountMode {
    // Only applies to count-mode goals
    const aggregationMode = getAggregationMode(goal);
    if (aggregationMode !== 'count') {
        return 'distinctDays'; // Not used, but return default
    }

    // If explicitly set, use it
    if (goal.countMode === 'entries' || goal.countMode === 'distinctDays') {
        return goal.countMode;
    }

    // Default: distinctDays for count goals
    return 'distinctDays';
}

/**
 * Checks if a unit matches the expected unit (with tolerance for minor variations).
 * 
 * @param expected - Expected unit (from goal)
 * @param found - Found unit (from entry or habit)
 * @returns True if units match (case-insensitive, handles pluralization)
 */
export function unitsMatch(expected: string | undefined, found: string | undefined): boolean {
    if (!expected || !found) {
        return true; // No unit requirement or no unit provided
    }

    const normalizedExpected = expected.toLowerCase().trim();
    const normalizedFound = found.toLowerCase().trim();

    // Exact match
    if (normalizedExpected === normalizedFound) {
        return true;
    }

    // Handle pluralization (simple: add/remove 's')
    if (normalizedExpected === normalizedFound + 's' || normalizedExpected + 's' === normalizedFound) {
        return true;
    }

    return false;
}

