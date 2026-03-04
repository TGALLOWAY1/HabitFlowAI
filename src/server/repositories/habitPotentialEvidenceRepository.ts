/**
 * HabitPotentialEvidence Repository
 *
 * MongoDB data access layer for HabitPotentialEvidence entities.
 * All queries are scoped by householdId + userId (user-owned in household).
 */

import { getDb } from '../lib/mongoClient';
import type { HabitPotentialEvidence } from '../../models/persistenceTypes';
import { MONGO_COLLECTIONS } from '../../models/persistenceTypes';
import { randomUUID } from 'crypto';
import { scopeFilter, requireScope } from '../lib/scoping';

const COLLECTION_NAME = MONGO_COLLECTIONS.HABIT_POTENTIAL_EVIDENCE;

export async function createPotentialEvidence(
  evidence: Omit<HabitPotentialEvidence, 'id'>,
  householdId: string,
  userId: string
): Promise<HabitPotentialEvidence> {
  const scope = requireScope(householdId, userId);
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const id = randomUUID();
  const newEvidence: HabitPotentialEvidence = { ...evidence, id };

  const document = {
    ...newEvidence,
    householdId: scope.householdId,
    userId: scope.userId,
    date: evidence.date,
  };

  const result = await collection.insertOne(document);
  if (!result.acknowledged) {
    throw new Error('Failed to create potential evidence');
  }

  return newEvidence;
}

export async function getPotentialEvidence(
  date: string,
  householdId: string,
  userId: string,
  habitId?: string
): Promise<HabitPotentialEvidence[]> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const query: any = scopeFilter(householdId, userId, { date });
  if (habitId) query.habitId = habitId;

  const documents = await collection
    .find(query)
    .sort({ timestamp: -1 })
    .toArray();

  return documents.map(doc => {
    const { _id, userId: _, householdId: __, ...entry } = doc;
    return entry as HabitPotentialEvidence;
  });
}

export async function evidenceExistsForStep(
  routineId: string,
  stepId: string,
  date: string,
  householdId: string,
  userId: string
): Promise<boolean> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const count = await collection.countDocuments(
    scopeFilter(householdId, userId, { routineId, stepId, date })
  );
  return count > 0;
}
