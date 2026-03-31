/**
 * Habit Conversion Service
 *
 * Orchestrates converting a regular habit into a bundle (choice or checklist).
 * Creates a hidden legacy child to preserve historical entries and streak continuity.
 */

import { getHabitById, createHabit, updateHabit } from '../repositories/habitRepository';
import { reassignEntries } from '../repositories/habitEntryRepository';
import { createMembership } from '../repositories/bundleMembershipRepository';
import { getNowDayKey, resolveTimeZone } from '../utils/dayKey';
import type { Habit } from '../../models/persistenceTypes';
import type { BundleMembershipRecord } from '../domain/canonicalTypes';
import type { ChecklistSuccessRule } from '../../shared/checklistSuccessRule';

export interface ConvertToBundleChild {
  name: string;
  goal?: Habit['goal'];
}

export interface ConvertToBundleRequest {
  bundleType: 'choice' | 'checklist';
  children: ConvertToBundleChild[];
  checklistSuccessRule?: ChecklistSuccessRule | null;
  timeZone?: string;
}

export interface ConvertToBundleResult {
  parent: Habit;
  children: Habit[];
  legacyChild: Habit | null;
  memberships: BundleMembershipRecord[];
}

export async function convertHabitToBundle(
  habitId: string,
  householdId: string,
  userId: string,
  request: ConvertToBundleRequest
): Promise<ConvertToBundleResult> {
  const { bundleType, children: childDefs, checklistSuccessRule, timeZone } = request;

  // 1. Validate the existing habit
  const habit = await getHabitById(habitId, householdId, userId);
  if (!habit) {
    throw new ConversionError('HABIT_NOT_FOUND', 'Habit not found');
  }
  if (habit.type === 'bundle') {
    throw new ConversionError('ALREADY_BUNDLE', 'Habit is already a bundle');
  }
  if (habit.archived) {
    throw new ConversionError('HABIT_ARCHIVED', 'Cannot convert an archived habit');
  }
  if (!childDefs || childDefs.length === 0) {
    throw new ConversionError('NO_CHILDREN', 'At least one child habit is required');
  }

  const resolvedTz = resolveTimeZone(timeZone);
  const todayDayKey = getNowDayKey(resolvedTz);

  // 2. Reassign historical entries to a legacy child (if any entries exist)
  let legacyChild: Habit | null = null;
  const memberships: BundleMembershipRecord[] = [];

  const { modifiedCount, earliestDayKey } = await reassignEntries(
    habitId, '__pending__', householdId, userId
  );

  if (modifiedCount > 0 && earliestDayKey) {
    // Create the legacy child habit
    legacyChild = await createHabit(
      {
        name: `${habit.name} (history)`,
        categoryId: habit.categoryId,
        goal: { type: 'boolean', target: 1, frequency: 'daily' },
        bundleParentId: habitId,
      },
      householdId,
      userId
    );

    // Now reassign the entries from '__pending__' to the real legacy child ID
    await reassignEntries('__pending__', legacyChild.id, householdId, userId);

    // Archive the legacy child so it's hidden from active lists
    await updateHabit(legacyChild.id, householdId, userId, { archived: true });
    legacyChild = { ...legacyChild, archived: true };

    // Compute activeToDayKey: day before conversion
    const dayBefore = getDayBefore(todayDayKey);

    // Create membership for legacy child covering historical range
    const legacyMembership = await createMembership(
      habitId,
      legacyChild.id,
      earliestDayKey,
      householdId,
      userId,
      dayBefore
    );
    memberships.push(legacyMembership);
  } else if (modifiedCount === 0) {
    // No entries to reassign — revert the placeholder (no-op since nothing was changed)
  }

  // 3. Create new child habits
  const defaultGoal: Habit['goal'] = { type: 'boolean', target: 1, frequency: 'daily' };
  const createdChildren: Habit[] = [];

  for (const childDef of childDefs) {
    const child = await createHabit(
      {
        name: childDef.name.trim(),
        categoryId: habit.categoryId,
        goal: childDef.goal || defaultGoal,
        bundleParentId: habitId,
      },
      householdId,
      userId
    );
    createdChildren.push(child);

    // Create active membership for each new child
    const membership = await createMembership(
      habitId,
      child.id,
      todayDayKey,
      householdId,
      userId,
      null
    );
    memberships.push(membership);
  }

  // 4. Update the parent habit to be a bundle
  const allChildIds = [
    ...(legacyChild ? [legacyChild.id] : []),
    ...createdChildren.map(c => c.id),
  ];

  const parentPatch: Partial<Omit<Habit, 'id' | 'createdAt'>> = {
    type: 'bundle',
    bundleType,
    subHabitIds: allChildIds,
  };

  if (bundleType === 'checklist' && checklistSuccessRule) {
    parentPatch.checklistSuccessRule = checklistSuccessRule;
  }

  const updatedParent = await updateHabit(habitId, householdId, userId, parentPatch);
  if (!updatedParent) {
    throw new ConversionError('UPDATE_FAILED', 'Failed to update parent habit');
  }

  return {
    parent: updatedParent,
    children: createdChildren,
    legacyChild,
    memberships,
  };
}

/**
 * Get the day before a YYYY-MM-DD dayKey.
 */
function getDayBefore(dayKey: string): string {
  const date = new Date(dayKey + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export class ConversionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ConversionError';
  }
}
