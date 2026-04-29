/**
 * Habit Repository
 *
 * MongoDB data access layer for Habit entities.
 * All queries are scoped by householdId + userId (user-owned in household).
 */

import type { ClientSession } from 'mongodb';
import { getDb } from '../lib/mongoClient';
import { scopeFilter, requireScope } from '../lib/scoping';
import { MONGO_COLLECTIONS, type Habit, type Goal } from '../../models/persistenceTypes';

const COLLECTION_NAME = 'habits';
const GOALS_COLLECTION = MONGO_COLLECTIONS.GOALS;

function stripScope(doc: any): Habit {
  const { _id, userId: _, householdId: __, ...habit } = doc;
  return normalizeHabit(habit as Habit);
}

/**
 * Normalize legacy habit data from MongoDB.
 * Handles the weekly frequency migration: old habits may have
 * `frequency: 'weekly'` (top-level) + `weeklyTarget` instead of `timesPerWeek`,
 * and `goal.frequency: 'weekly'` instead of `'daily'`.
 */
function normalizeHabit(habit: Habit): Habit {
  const raw = habit as any;

  // Ensure goal exists (safety net for malformed MongoDB documents)
  if (!habit.goal) {
    habit.goal = { type: 'boolean', frequency: 'daily' };
  }

  // Migrate top-level frequency:'weekly' + weeklyTarget → timesPerWeek
  if (raw.frequency === 'weekly' && habit.timesPerWeek == null) {
    habit.timesPerWeek = raw.weeklyTarget ?? 1;
  }

  // Migrate goal.frequency:'weekly' → 'daily'
  if ((habit.goal as any).frequency === 'weekly') {
    habit.goal = { ...habit.goal, frequency: 'daily' };
    // If timesPerWeek still not set, derive from goal.target
    if (habit.timesPerWeek == null) {
      habit.timesPerWeek = habit.goal.target ?? 1;
    }
  }

  // Clean up legacy fields (don't persist, just strip from returned object)
  delete raw.frequency;
  delete raw.weeklyTarget;

  return habit;
}

export async function createHabit(
  data: Omit<Habit, 'id' | 'createdAt' | 'archived'>,
  householdId: string,
  userId: string,
  session?: ClientSession
): Promise<Habit> {
  const scope = requireScope(householdId, userId);
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // Atomic upsert: prevents TOCTOU race where concurrent requests both
  // pass a findOne check and then both insert, creating duplicates.
  // $setOnInsert only applies fields when a new document is created.
  // Filter by deletedAt absent so a soft-deleted habit with the same name
  // does not silently resurrect when the user creates a new habit.
  const result = await collection.findOneAndUpdate(
    scopeFilter(householdId, userId, {
      name: data.name,
      categoryId: data.categoryId,
      deletedAt: { $exists: false },
    }),
    {
      $setOnInsert: {
        id,
        ...data,
        archived: false,
        createdAt,
        householdId: scope.householdId,
        userId: scope.userId,
      },
    },
    { upsert: true, returnDocument: 'after', session }
  );

  if (!result) {
    throw new Error(`Failed to create or find habit '${data.name}'`);
  }

  // Log only if we actually created a new document (id matches what we generated)
  if ((result as any).id === id) {
    console.log(`[Persistence] Created habit '${data.name}' (ID: ${id}) for User: ${userId}`);
  }

  return stripScope(result);
}

export interface HabitReadOptions {
  /**
   * When true, include soft-deleted habits (deletedAt set) in results.
   * Default: false. Used by goal progress to resolve historical names/units.
   */
  includeDeleted?: boolean;
}

function withDeletedFilter(
  extra: Record<string, unknown>,
  includeDeleted: boolean | undefined
): Record<string, unknown> {
  if (includeDeleted) return extra;
  return { ...extra, deletedAt: { $exists: false } };
}

export async function getHabitsByUser(
  householdId: string,
  userId: string,
  options?: HabitReadOptions
): Promise<Habit[]> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find(scopeFilter(householdId, userId, withDeletedFilter({}, options?.includeDeleted)))
    .sort({ order: 1, createdAt: 1 })
    .toArray();

  return documents.map(stripScope);
}

export async function getHabitsByCategory(
  categoryId: string,
  householdId: string,
  userId: string,
  options?: HabitReadOptions
): Promise<Habit[]> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find(scopeFilter(householdId, userId, withDeletedFilter({ categoryId }, options?.includeDeleted)))
    .sort({ order: 1, createdAt: 1 })
    .toArray();

  return documents.map(stripScope);
}

export async function getHabitById(
  id: string,
  householdId: string,
  userId: string,
  options?: HabitReadOptions
): Promise<Habit | null> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const document = await collection.findOne(
    scopeFilter(householdId, userId, withDeletedFilter({ id }, options?.includeDeleted))
  );
  if (!document) return null;

  return stripScope(document);
}

export async function updateHabit(
  id: string,
  householdId: string,
  userId: string,
  patch: Partial<Omit<Habit, 'id' | 'createdAt'>>,
  session?: ClientSession
): Promise<Habit | null> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  // Refuse to update soft-deleted habits: they should only be resurrectable
  // via an explicit restore path, not via an ordinary PATCH.
  const result = await collection.findOneAndUpdate(
    scopeFilter(householdId, userId, { id, deletedAt: { $exists: false } }),
    { $set: patch },
    { returnDocument: 'after', session }
  );

  if (!result) return null;
  return stripScope(result);
}

/**
 * Archive a habit (user-initiated). Sets `archived: true` plus archive
 * metadata so the habit is hidden from active views but can be restored
 * later with all entries intact.
 *
 * Uses `archivedReason: 'user'` to distinguish from category-deletion
 * archives, which the GET /api/habits self-heal logic auto-restores.
 */
export async function archiveHabit(
  id: string,
  householdId: string,
  userId: string
): Promise<Habit | null> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.findOneAndUpdate(
    scopeFilter(householdId, userId, { id, deletedAt: { $exists: false } }),
    {
      $set: {
        archived: true,
        archivedAt: new Date().toISOString(),
        archivedReason: 'user',
      },
    },
    { returnDocument: 'after' }
  );

  if (!result) return null;
  return stripScope(result);
}

/**
 * Restore a habit from archive. Sets `archived: false` and unsets the
 * archive metadata so the habit re-appears in active views.
 */
export async function unarchiveHabit(
  id: string,
  householdId: string,
  userId: string
): Promise<Habit | null> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.findOneAndUpdate(
    scopeFilter(householdId, userId, { id, deletedAt: { $exists: false } }),
    {
      $set: { archived: false },
      $unset: { archivedAt: '', archivedReason: '' },
    },
    { returnDocument: 'after' }
  );

  if (!result) return null;
  return stripScope(result);
}

/**
 * Soft-delete a habit. Sets `deletedAt`; the document is retained so that
 * orphaned entries (which still contribute to goal progress) can display
 * the habit's original name and unit in historical views.
 *
 * Idempotent: deleting an already-deleted habit returns false without
 * updating deletedAt (so the original deletion timestamp is preserved).
 */
export async function deleteHabit(
  id: string,
  householdId: string,
  userId: string
): Promise<boolean> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.updateOne(
    scopeFilter(householdId, userId, { id, deletedAt: { $exists: false } }),
    { $set: { deletedAt: new Date().toISOString() } }
  );
  return result.modifiedCount > 0;
}

export async function reorderHabits(
  householdId: string,
  userId: string,
  habitIds: string[]
): Promise<boolean> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const operations = habitIds.map((id, index) => ({
    updateOne: {
      filter: scopeFilter(householdId, userId, { id }),
      update: { $set: { order: index } },
    },
  }));

  if (operations.length === 0) return true;

  try {
    await collection.bulkWrite(operations);
    return true;
  } catch (error) {
    console.error('Failed to reorder habits:', error);
    return false;
  }
}

/**
 * Archive all habits belonging to a category.
 * Called when a category is deleted to prevent orphaned habit references.
 * Archived habits are preserved in the database but hidden from active tracking.
 * Returns the number of habits archived.
 */
export async function uncategorizeHabitsByCategory(
  categoryId: string,
  householdId: string,
  userId: string
): Promise<number> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  // Clear categoryId so habits become "uncategorized" instead of being archived.
  // Also unarchive any habits that were previously archived due to category deletion.
  // Must set archived: false here — previously only archivedReason was cleared,
  // leaving habits permanently invisible when archived: true remained set.
  const result = await collection.updateMany(
    scopeFilter(householdId, userId, { categoryId }),
    { $set: { categoryId: '', archived: false }, $unset: { archivedReason: '', archivedAt: '' } }
  );

  return result.modifiedCount;
}

/**
 * Recover habits that were previously archived due to category deletion.
 * Clears their categoryId and unarchives them so they appear as "uncategorized".
 */
export async function recoverCategoryDeletedHabits(
  householdId: string,
  userId: string
): Promise<number> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.updateMany(
    scopeFilter(householdId, userId, { archived: true, archivedReason: 'category_deleted' }),
    { $set: { archived: false, categoryId: '' }, $unset: { archivedAt: '', archivedReason: '' } }
  );

  return result.modifiedCount;
}

/**
 * Set linkedGoalId on specified habits as a "primary goal" UI hint — but
 * ONLY on habits that don't already point at another goal that still
 * references them. This preserves the multi-goal case: one habit linked
 * to multiple goals keeps a stable, valid primary-goal badge instead of
 * flipping every time any of those goals is edited.
 *
 * Note: `linkedGoalId` is purely UI metadata. Progress computation uses
 * `Goal.linkedHabitIds` (the authoritative many-to-many side). This helper
 * just keeps the UI hint from going stale.
 *
 * Called when a goal is created or updated.
 */
export async function linkHabitsToGoal(
  habitIds: string[],
  goalId: string,
  householdId: string,
  userId: string
): Promise<number> {
  if (habitIds.length === 0) return 0;

  const db = await getDb();
  const habitsCollection = db.collection(COLLECTION_NAME);
  const goalsCollection = db.collection(GOALS_COLLECTION);

  // Fetch the habits we're linking and their existing linkedGoalId values.
  // Skip soft-deleted habits: re-linking a removed habit would resurrect it.
  const habits = await habitsCollection
    .find(scopeFilter(householdId, userId, { id: { $in: habitIds }, deletedAt: { $exists: false } }))
    .project({ id: 1, linkedGoalId: 1 })
    .toArray();

  // Collect existing linkedGoalIds that are NOT the goal we're now linking to.
  const existingLinkedGoalIds = Array.from(
    new Set(
      habits
        .map((h: any) => h.linkedGoalId as string | undefined)
        .filter((gid): gid is string => !!gid && gid !== goalId)
    )
  );

  // Fetch those goals so we can check whether they still reference the habit.
  const existingGoals = existingLinkedGoalIds.length > 0
    ? await goalsCollection
        .find(scopeFilter(householdId, userId, { id: { $in: existingLinkedGoalIds } }))
        .project({ id: 1, linkedHabitIds: 1 })
        .toArray()
    : [];
  const goalsById = new Map<string, { linkedHabitIds?: string[] }>(
    existingGoals.map((g: any) => [g.id, { linkedHabitIds: g.linkedHabitIds }])
  );

  // Decide which habits should receive linkedGoalId = goalId.
  // Update only habits whose current linkedGoalId is missing OR points to a
  // goal that no longer contains this habit in linkedHabitIds.
  const habitIdsToUpdate: string[] = [];
  for (const h of habits) {
    const current = (h as any).linkedGoalId as string | undefined;
    if (!current || current === goalId) {
      habitIdsToUpdate.push((h as any).id);
      continue;
    }
    const otherGoal = goalsById.get(current);
    const stillLinked = otherGoal?.linkedHabitIds?.includes((h as any).id) ?? false;
    if (!stillLinked) {
      habitIdsToUpdate.push((h as any).id);
    }
  }

  if (habitIdsToUpdate.length === 0) return 0;

  const result = await habitsCollection.updateMany(
    scopeFilter(householdId, userId, { id: { $in: habitIdsToUpdate } }),
    { $set: { linkedGoalId: goalId } }
  );

  return result.modifiedCount;
}

/**
 * Clear linkedGoalId from habits that currently point at the given goal —
 * but only if no OTHER goal still references the habit. If another goal does
 * reference it, switch linkedGoalId to that other goal instead of clearing
 * it, so the "primary goal" UI hint stays valid for multi-goal habits.
 *
 * Called when a goal is deleted, or when a habit is removed from a goal's
 * linkedHabitIds list.
 */
export async function unlinkHabitsFromGoal(
  goalId: string,
  householdId: string,
  userId: string
): Promise<number> {
  const db = await getDb();
  const habitsCollection = db.collection(COLLECTION_NAME);
  const goalsCollection = db.collection(GOALS_COLLECTION);

  // Find habits currently pointing at this goal.
  // Skip soft-deleted habits: they no longer carry the primary-goal UI hint.
  const habitsPointingHere = await habitsCollection
    .find(scopeFilter(householdId, userId, { linkedGoalId: goalId, deletedAt: { $exists: false } }))
    .project({ id: 1 })
    .toArray();

  if (habitsPointingHere.length === 0) return 0;

  const affectedHabitIds = habitsPointingHere.map((h: any) => h.id as string);

  // Find other goals that still reference any of these habits.
  const otherGoals = (await goalsCollection
    .find(
      scopeFilter(householdId, userId, {
        id: { $ne: goalId },
        linkedHabitIds: { $in: affectedHabitIds },
      })
    )
    .project({ id: 1, linkedHabitIds: 1 })
    .toArray()) as unknown as Array<Pick<Goal, 'id' | 'linkedHabitIds'>>;

  // For each affected habit, pick a replacement goal (deterministically: the
  // first other goal that references it) or clear linkedGoalId if none found.
  const bulkOps: any[] = [];
  let modified = 0;
  for (const habitId of affectedHabitIds) {
    const replacement = otherGoals.find(g => g.linkedHabitIds?.includes(habitId));
    if (replacement) {
      bulkOps.push({
        updateOne: {
          filter: scopeFilter(householdId, userId, { id: habitId }),
          update: { $set: { linkedGoalId: replacement.id } },
        },
      });
    } else {
      bulkOps.push({
        updateOne: {
          filter: scopeFilter(householdId, userId, { id: habitId }),
          update: { $unset: { linkedGoalId: '' } },
        },
      });
    }
    modified += 1;
  }

  if (bulkOps.length > 0) {
    await habitsCollection.bulkWrite(bulkOps);
  }

  return modified;
}
