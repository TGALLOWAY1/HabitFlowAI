/**
 * HealthSuggestion Repository
 *
 * MongoDB data access layer for health-based habit suggestions.
 * All queries are scoped by householdId + userId.
 */

import { getDb } from '../lib/mongoClient';
import type { HealthSuggestion } from '../../models/persistenceTypes';
import { MONGO_COLLECTIONS } from '../../models/persistenceTypes';
import { randomUUID } from 'crypto';
import { scopeFilter, requireScope } from '../lib/scoping';

const COLLECTION_NAME = MONGO_COLLECTIONS.HEALTH_SUGGESTIONS;

function stripDoc(doc: any): HealthSuggestion {
  const { _id, userId: _, householdId: __, ...rest } = doc;
  return rest as HealthSuggestion;
}

/**
 * Create a health suggestion.
 */
export async function createSuggestion(
  data: Omit<HealthSuggestion, 'id' | 'createdAt' | 'updatedAt'>,
  householdId: string,
  userId: string
): Promise<HealthSuggestion> {
  const scope = requireScope(householdId, userId);
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const now = new Date().toISOString();
  const id = randomUUID();
  const document = {
    ...data,
    id,
    householdId: scope.householdId,
    userId: scope.userId,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(document);
  return stripDoc(document);
}

/**
 * Get suggestions for a specific day.
 */
export async function getSuggestionsForDay(
  dayKey: string,
  householdId: string,
  userId: string
): Promise<HealthSuggestion[]> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const docs = await collection
    .find(scopeFilter(householdId, userId, { dayKey }))
    .sort({ createdAt: -1 })
    .toArray();

  return docs.map(stripDoc);
}

/**
 * Get all pending suggestions for a user.
 */
export async function getPendingSuggestionsByUser(
  householdId: string,
  userId: string
): Promise<HealthSuggestion[]> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const docs = await collection
    .find(scopeFilter(householdId, userId, { status: 'pending' }))
    .sort({ dayKey: -1, createdAt: -1 })
    .toArray();

  return docs.map(stripDoc);
}

/**
 * Get a suggestion by ID.
 */
export async function getSuggestionById(
  id: string,
  householdId: string,
  userId: string
): Promise<HealthSuggestion | null> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const doc = await collection.findOne(
    scopeFilter(householdId, userId, { id })
  );
  if (!doc) return null;
  return stripDoc(doc);
}

/**
 * Update suggestion status (accept/dismiss).
 */
export async function updateSuggestionStatus(
  id: string,
  status: 'accepted' | 'dismissed',
  householdId: string,
  userId: string
): Promise<HealthSuggestion | null> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.findOneAndUpdate(
    scopeFilter(householdId, userId, { id }),
    { $set: { status, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  );

  if (!result) return null;
  return stripDoc(result);
}

/**
 * Check if a suggestion already exists for a habit+day combination.
 */
export async function suggestionExistsForDayAndHabit(
  habitId: string,
  dayKey: string,
  householdId: string,
  userId: string
): Promise<boolean> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const count = await collection.countDocuments(
    scopeFilter(householdId, userId, { habitId, dayKey, status: 'pending' })
  );
  return count > 0;
}
