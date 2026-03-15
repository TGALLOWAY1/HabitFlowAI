/**
 * Routine Repository
 *
 * Handles persistence for Routine entities.
 * All queries are scoped by householdId + userId (user-owned in household).
 */

import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS, type Routine, type RoutineVariant } from '../../models/persistenceTypes';
import { scopeFilter, requireScope } from '../lib/scoping';

const COLLECTION = MONGO_COLLECTIONS.ROUTINES;

function stripScope(doc: any): Routine {
  const { _id, userId: _, householdId: __, ...routine } = doc;
  return routine as Routine;
}

/**
 * Ensure all steps within a variant have IDs.
 */
function ensureStepIds(variant: RoutineVariant): RoutineVariant {
  return {
    ...variant,
    id: variant.id || randomUUID(),
    steps: (variant.steps || []).map(step => ({
      ...step,
      id: step.id || randomUUID(),
    })),
  };
}

/**
 * Process variants array: ensure IDs, compute linkedHabitIds per variant.
 */
function processVariants(variants: RoutineVariant[]): RoutineVariant[] {
  const now = new Date().toISOString();
  return variants.map((variant, index) => {
    const processed = ensureStepIds(variant);
    // Compute linkedHabitIds from steps
    const linkedHabitIds = new Set<string>();
    for (const step of processed.steps) {
      if (step.linkedHabitId) {
        linkedHabitIds.add(step.linkedHabitId);
      }
    }
    return {
      ...processed,
      linkedHabitIds: Array.from(linkedHabitIds),
      sortOrder: variant.sortOrder ?? index,
      isAiGenerated: variant.isAiGenerated ?? false,
      createdAt: variant.createdAt || now,
      updatedAt: now,
    };
  });
}

/**
 * Compute the union of all variant-level linkedHabitIds for the routine.
 */
function computeRoutineLevelLinkedHabits(variants: RoutineVariant[]): string[] {
  const habitIdSet = new Set<string>();
  for (const variant of variants) {
    for (const habitId of variant.linkedHabitIds || []) {
      habitIdSet.add(habitId);
    }
  }
  return Array.from(habitIdSet);
}

export async function getRoutines(householdId: string, userId: string): Promise<Routine[]> {
  const db = await getDb();

  const routines = await db
    .collection<Routine>(COLLECTION)
    .find(scopeFilter(householdId, userId))
    .sort({ updatedAt: -1 })
    .toArray();

  return routines.map(stripScope);
}

export async function getRoutine(
  householdId: string,
  userId: string,
  routineId: string
): Promise<Routine | null> {
  const db = await getDb();

  const routine = await db.collection<Routine>(COLLECTION).findOne(
    scopeFilter(householdId, userId, { id: routineId })
  );

  if (!routine) return null;
  return stripScope(routine);
}

export async function createRoutine(
  householdId: string,
  userId: string,
  data: Omit<Routine, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Routine> {
  const scope = requireScope(householdId, userId);
  const db = await getDb();

  const now = new Date().toISOString();

  // Process variants if provided
  const variants = data.variants && data.variants.length > 0
    ? processVariants(data.variants)
    : undefined;

  // Compute routine-level linkedHabitIds from variants (union) or use provided
  const linkedHabitIds = variants
    ? computeRoutineLevelLinkedHabits(variants)
    : (data.linkedHabitIds || []);

  const newRoutine: Routine & { householdId: string } = {
    ...data,
    id: randomUUID(),
    userId: scope.userId,
    createdAt: now,
    updatedAt: now,
    steps: (data.steps || []).map(step => ({
      ...step,
      id: step.id || randomUUID(),
    })),
    linkedHabitIds,
    ...(variants ? {
      variants,
      defaultVariantId: data.defaultVariantId || variants[0]?.id,
    } : {}),
  } as any;

  const document = { ...newRoutine, householdId: scope.householdId };
  await db.collection<Routine>(COLLECTION).insertOne(document as any);

  return stripScope(document);
}

export async function updateRoutine(
  householdId: string,
  userId: string,
  routineId: string,
  patch: Partial<Omit<Routine, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<Routine | null> {
  const db = await getDb();

  const now = new Date().toISOString();
  const updateData: any = { ...patch, updatedAt: now };

  if (patch.steps) {
    updateData.steps = patch.steps.map((step: any) => ({
      ...step,
      id: step.id || randomUUID(),
    }));
  }

  // Process variants if provided in the patch
  if (patch.variants && patch.variants.length > 0) {
    updateData.variants = processVariants(patch.variants);
    // Recompute routine-level linkedHabitIds as union of all variants
    updateData.linkedHabitIds = computeRoutineLevelLinkedHabits(updateData.variants);
    // Set defaultVariantId if not already set
    if (!patch.defaultVariantId) {
      updateData.defaultVariantId = updateData.variants[0]?.id;
    }
  }

  const result = await db.collection<Routine>(COLLECTION).findOneAndUpdate(
    scopeFilter(householdId, userId, { id: routineId }),
    { $set: updateData },
    { returnDocument: 'after' }
  );

  if (!result) return null;
  return stripScope(result);
}

export async function deleteRoutine(
  householdId: string,
  userId: string,
  routineId: string
): Promise<boolean> {
  const db = await getDb();

  const result = await db.collection<Routine>(COLLECTION).deleteOne(
    scopeFilter(householdId, userId, { id: routineId })
  );

  return result.deletedCount === 1;
}
