/**
 * Routine Variant Utilities
 *
 * Centralized resolver functions for accessing variant steps regardless of
 * migration state. All consumers should use these instead of reading
 * `routine.steps` directly.
 */

import type { Routine, RoutineVariant, RoutineStep } from '../models/persistenceTypes';

/**
 * Resolve the correct variant for a routine.
 *
 * Resolution order:
 * 1. By explicit `variantId` if provided
 * 2. By `routine.defaultVariantId` if set
 * 3. First variant in the array
 * 4. Synthesize a virtual variant from `routine.steps` (legacy fallback)
 *
 * @returns The resolved variant, or null if no steps exist at all.
 */
export function resolveVariant(routine: Routine, variantId?: string): RoutineVariant | null {
  const variants = routine.variants;

  // If routine has variants, resolve from them
  if (variants && variants.length > 0) {
    // 1. Explicit variantId
    if (variantId) {
      const found = variants.find(v => v.id === variantId);
      if (found) return found;
    }

    // 2. defaultVariantId
    if (routine.defaultVariantId) {
      const found = variants.find(v => v.id === routine.defaultVariantId);
      if (found) return found;
    }

    // 3. First variant
    return variants[0];
  }

  // 4. Legacy fallback: synthesize virtual variant from routine.steps
  if (routine.steps && routine.steps.length > 0) {
    const totalSeconds = routine.steps.reduce(
      (acc, step) => acc + (step.timerSeconds || 60), 0
    );
    return {
      id: '__legacy__',
      name: 'Default',
      estimatedDurationMinutes: Math.max(1, Math.ceil(totalSeconds / 60)),
      sortOrder: 0,
      steps: routine.steps,
      linkedHabitIds: routine.linkedHabitIds || [],
      isAiGenerated: false,
      createdAt: routine.createdAt,
      updatedAt: routine.updatedAt,
    };
  }

  return null;
}

/**
 * Resolve the steps for a routine, considering variants.
 *
 * @returns The steps array from the resolved variant, or empty array.
 */
export function resolveSteps(routine: Routine, variantId?: string): RoutineStep[] {
  const variant = resolveVariant(routine, variantId);
  return variant ? variant.steps : [];
}

/**
 * Compute the union of all variant-level linkedHabitIds.
 * Used to maintain the top-level `Routine.linkedHabitIds` for reverse lookups.
 */
export function computeRoutineLevelLinkedHabits(routine: Routine): string[] {
  if (!routine.variants || routine.variants.length === 0) {
    return routine.linkedHabitIds || [];
  }
  const habitIdSet = new Set<string>();
  for (const variant of routine.variants) {
    for (const habitId of variant.linkedHabitIds || []) {
      habitIdSet.add(habitId);
    }
  }
  return Array.from(habitIdSet);
}

/**
 * Compute linkedHabitIds for a single variant from its steps.
 */
export function computeVariantLinkedHabits(steps: RoutineStep[]): string[] {
  const habitIds = new Set<string>();
  for (const step of steps) {
    if (step.linkedHabitId) {
      habitIds.add(step.linkedHabitId);
    }
  }
  return Array.from(habitIds);
}

/**
 * Get the composite key for a RoutineLog.
 * Handles both legacy (routineId-date) and variant-aware (routineId-variantId-date) formats.
 */
export function getLogCompositeKey(routineId: string, date: string, variantId?: string): string {
  if (variantId) {
    return `${routineId}-${variantId}-${date}`;
  }
  return `${routineId}-${date}`;
}

/**
 * Check if a routine has been migrated to the variants model.
 */
export function hasVariants(routine: Routine): boolean {
  return !!(routine.variants && routine.variants.length > 0);
}

/**
 * Check if a routine has multiple variants (showing variant selector is needed).
 */
export function isMultiVariant(routine: Routine): boolean {
  return !!(routine.variants && routine.variants.length > 1);
}

/**
 * Get the estimated duration for a routine (from default/first variant or computed from steps).
 */
export function getEstimatedDurationMinutes(routine: Routine, variantId?: string): number {
  const variant = resolveVariant(routine, variantId);
  if (variant) return variant.estimatedDurationMinutes;

  // Final fallback: compute from root steps
  const totalSeconds = (routine.steps || []).reduce(
    (acc, step) => acc + (step.timerSeconds || 60), 0
  );
  return Math.max(1, Math.ceil(totalSeconds / 60));
}
