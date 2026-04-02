/**
 * Habit Conversion Service
 *
 * Orchestrates converting a regular habit into a bundle (choice or checklist).
 * Creates a hidden legacy child to preserve historical entries and streak continuity.
 */

import { getHabitById, createHabit, updateHabit } from '../repositories/habitRepository';
import { reassignEntries } from '../repositories/habitEntryRepository';
import { createMembership } from '../repositories/bundleMembershipRepository';
import { getClient } from '../lib/mongoClient';
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

  // 1. Validate the existing habit (read-only, before transaction)
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

  // 2. Execute all mutations in a transaction (requires replica set).
  // Falls back to non-transactional execution if replica set unavailable
  // (e.g., standalone mongod in tests).
  const client = await getClient();
  const session = client.startSession();

  try {
    let result: ConvertToBundleResult | undefined;

    const doConversion = async () => {
      let legacyChild: Habit | null = null;
      const memberships: BundleMembershipRecord[] = [];

      // 2a. Reassign historical entries to a legacy child
      const { modifiedCount, earliestDayKey } = await reassignEntries(
        habitId, '__pending__', householdId, userId, session
      );

      if (modifiedCount > 0 && earliestDayKey) {
        legacyChild = await createHabit(
          {
            name: `${habit.name} (history)`,
            categoryId: habit.categoryId,
            goal: { type: 'boolean', target: 1, frequency: 'daily' },
            bundleParentId: habitId,
          },
          householdId,
          userId,
          session
        );

        await reassignEntries('__pending__', legacyChild.id, householdId, userId, session);
        await updateHabit(legacyChild.id, householdId, userId, { archived: true }, session);
        legacyChild = { ...legacyChild, archived: true };

        const dayBefore = getDayBefore(todayDayKey);
        const legacyMembership = await createMembership(
          habitId, legacyChild.id, earliestDayKey,
          householdId, userId, dayBefore, null, session
        );
        memberships.push(legacyMembership);
      }

      // 2b. Create new child habits
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
          userId,
          session
        );
        createdChildren.push(child);

        const membership = await createMembership(
          habitId, child.id, todayDayKey,
          householdId, userId, null, null, session
        );
        memberships.push(membership);
      }

      // 2c. Update the parent habit to be a bundle
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

      const updatedParent = await updateHabit(habitId, householdId, userId, parentPatch, session);
      if (!updatedParent) {
        throw new ConversionError('UPDATE_FAILED', 'Failed to update parent habit');
      }

      result = {
        parent: updatedParent,
        children: createdChildren,
        legacyChild,
        memberships,
      };
    };

    try {
      await session.withTransaction(doConversion);
    } catch (txError: unknown) {
      // If transactions aren't supported (standalone mongod), fall back to direct execution.
      // This ensures tests and dev environments without replica sets still work.
      const code = (txError as { codeName?: string })?.codeName;
      if (code === 'IllegalOperation' || code === 'NotAReplicaSet' || code === 'NoSuchTransaction') {
        session.endSession();
        // Re-run without session (non-transactional fallback)
        return convertHabitToBundleNoTx(habitId, householdId, userId, habit, childDefs, bundleType, checklistSuccessRule, todayDayKey);
      }
      throw txError;
    }

    if (!result) {
      throw new ConversionError('TRANSACTION_FAILED', 'Transaction completed but result is undefined');
    }
    return result;
  } finally {
    session.endSession();
  }
}

/**
 * Non-transactional fallback for environments without replica set support.
 * Same logic as the transactional path but without session passing.
 */
async function convertHabitToBundleNoTx(
  habitId: string,
  householdId: string,
  userId: string,
  habit: Habit,
  childDefs: ConvertToBundleChild[],
  bundleType: 'choice' | 'checklist',
  checklistSuccessRule: ChecklistSuccessRule | null | undefined,
  todayDayKey: string
): Promise<ConvertToBundleResult> {
  let legacyChild: Habit | null = null;
  const memberships: BundleMembershipRecord[] = [];

  const { modifiedCount, earliestDayKey } = await reassignEntries(
    habitId, '__pending__', householdId, userId
  );

  if (modifiedCount > 0 && earliestDayKey) {
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

    await reassignEntries('__pending__', legacyChild.id, householdId, userId);
    await updateHabit(legacyChild.id, householdId, userId, { archived: true });
    legacyChild = { ...legacyChild, archived: true };

    const dayBefore = getDayBefore(todayDayKey);
    const legacyMembership = await createMembership(
      habitId, legacyChild.id, earliestDayKey,
      householdId, userId, dayBefore
    );
    memberships.push(legacyMembership);
  }

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

    const membership = await createMembership(
      habitId, child.id, todayDayKey,
      householdId, userId, null
    );
    memberships.push(membership);
  }

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
