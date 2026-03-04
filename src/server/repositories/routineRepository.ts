/**
 * Routine Repository
 *
 * Handles persistence for Routine entities.
 * All queries are scoped by householdId + userId (user-owned in household).
 */

import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS, type Routine } from '../../models/persistenceTypes';
import { scopeFilter, requireScope } from '../lib/scoping';

const COLLECTION = MONGO_COLLECTIONS.ROUTINES;

function stripScope(doc: any): Routine {
  const { _id, userId: _, householdId: __, ...routine } = doc;
  return routine as Routine;
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

  const newRoutine: Routine & { householdId: string } = {
    ...data,
    id: randomUUID(),
    userId: scope.userId,
    createdAt: now,
    updatedAt: now,
    steps: data.steps.map(step => ({
      ...step,
      id: step.id || randomUUID(),
    })),
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
