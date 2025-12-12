/**
 * Routine Repository
 *
 * Handles persistence for Routine entities.
 * Default sort: updatedAt descending (most recently modified first)
 */

import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS, type Routine } from '../../models/persistenceTypes';

const COLLECTION = MONGO_COLLECTIONS.ROUTINES;

/**
 * Fetch all routines for a user.
 * 
 * @param userId - ID of the user
 * @returns Promise<Routine[]> - Array of routines
 */
export async function getRoutines(userId: string): Promise<Routine[]> {
  const db = await getDb();

  // Find all routines for the user, sort by updatedAt desc
  const routines = await db.collection<Routine>(COLLECTION)
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();

  // Clean up MongoDB specific fields (_id)
  return routines.map(({ _id, ...routine }) => routine as Routine);
}

/**
 * Get a single routine by ID.
 * 
 * @param userId - ID of the user
 * @param routineId - ID of the routine
 * @returns Promise<Routine | null> - Routine or null if not found
 */
export async function getRoutine(userId: string, routineId: string): Promise<Routine | null> {
  const db = await getDb();

  const routine = await db.collection<Routine>(COLLECTION).findOne({
    id: routineId,
    userId
  });

  if (!routine) return null;

  const { _id, ...cleanRoutine } = routine;
  return cleanRoutine as Routine;
}

/**
 * Create a new routine.
 * 
 * @param userId - ID of the user
 * @param data - Routine data
 * @returns Promise<Routine> - Created routine
 */
export async function createRoutine(
  userId: string,
  data: Omit<Routine, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Routine> {
  const db = await getDb();

  const now = new Date().toISOString();

  const newRoutine: Routine = {
    ...data,
    id: randomUUID(),
    userId,
    createdAt: now,
    updatedAt: now,
    // Ensure steps have IDs if not provided (though frontend should provide them)
    steps: data.steps.map(step => ({
      ...step,
      id: step.id || randomUUID()
    }))
  };

  await db.collection<Routine>(COLLECTION).insertOne(newRoutine);

  // Return without _id
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...cleanRoutine } = newRoutine as any;
  return cleanRoutine as Routine;
}

/**
 * Update a routine.
 * 
 * @param userId - ID of the user
 * @param routineId - ID of the routine
 * @param patch - Partial routine data
 * @returns Promise<Routine | null> - Updated routine or null if not found
 */
export async function updateRoutine(
  userId: string,
  routineId: string,
  patch: Partial<Omit<Routine, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<Routine | null> {
  const db = await getDb();

  const now = new Date().toISOString();

  // Prepare update data
  const updateData: any = {
    ...patch,
    updatedAt: now
  };

  // If steps are being updated, ensure they have IDs
  if (patch.steps) {
    updateData.steps = patch.steps.map((step: any) => ({
      ...step,
      id: step.id || randomUUID()
    }));
  }

  const result = await db.collection<Routine>(COLLECTION).findOneAndUpdate(
    { id: routineId, userId },
    { $set: updateData },
    { returnDocument: 'after' }
  );

  if (!result) return null;

  const { _id, ...cleanRoutine } = result;
  return cleanRoutine as Routine;
}

/**
 * Delete a routine.
 * 
 * @param userId - ID of the user
 * @param routineId - ID of the routine
 * @returns Promise<boolean> - True if deleted, false if not found
 */
export async function deleteRoutine(userId: string, routineId: string): Promise<boolean> {
  const db = await getDb();

  const result = await db.collection<Routine>(COLLECTION).deleteOne({
    id: routineId,
    userId
  });

  return result.deletedCount === 1;
}
