/**
 * HabitHealthRule Repository
 *
 * MongoDB data access layer for habit-to-health-data rule mappings.
 * All queries are scoped by householdId + userId.
 * One rule per habit enforced by unique index.
 */

import { getDb } from '../lib/mongoClient';
import type { HabitHealthRule } from '../../models/persistenceTypes';
import { MONGO_COLLECTIONS } from '../../models/persistenceTypes';
import { randomUUID } from 'crypto';
import { scopeFilter, requireScope } from '../lib/scoping';

const COLLECTION_NAME = MONGO_COLLECTIONS.HABIT_HEALTH_RULES;

function stripDoc(doc: any): HabitHealthRule {
  const { _id, userId: _, householdId: __, ...rest } = doc;
  return rest as HabitHealthRule;
}

/**
 * Create a health rule for a habit.
 * Returns null if a rule already exists for this habit (conflict).
 */
export async function createHealthRule(
  data: Omit<HabitHealthRule, 'id' | 'createdAt' | 'updatedAt'>,
  householdId: string,
  userId: string
): Promise<HabitHealthRule | null> {
  const scope = requireScope(householdId, userId);
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const now = new Date().toISOString();

  // Check for existing active rule
  const existing = await collection.findOne(
    scopeFilter(householdId, userId, { habitId: data.habitId, active: true })
  );
  if (existing) return null;

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
 * Get the active health rule for a habit.
 */
export async function getHealthRuleByHabitId(
  habitId: string,
  householdId: string,
  userId: string
): Promise<HabitHealthRule | null> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const doc = await collection.findOne(
    scopeFilter(householdId, userId, { habitId, active: true })
  );
  if (!doc) return null;
  return stripDoc(doc);
}

/**
 * Get all active health rules for a user.
 */
export async function getActiveRulesByUser(
  householdId: string,
  userId: string
): Promise<HabitHealthRule[]> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const docs = await collection
    .find(scopeFilter(householdId, userId, { active: true }))
    .toArray();

  return docs.map(stripDoc);
}

/**
 * Update a health rule.
 */
export async function updateHealthRule(
  id: string,
  patch: Partial<Pick<HabitHealthRule, 'metricType' | 'operator' | 'thresholdValue' | 'behavior' | 'active'>>,
  householdId: string,
  userId: string
): Promise<HabitHealthRule | null> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.findOneAndUpdate(
    scopeFilter(householdId, userId, { id }),
    { $set: { ...patch, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  );

  if (!result) return null;
  return stripDoc(result);
}

/**
 * Deactivate a health rule (soft delete).
 * Past HabitEntries created by this rule are NOT affected.
 */
export async function deactivateHealthRule(
  id: string,
  householdId: string,
  userId: string
): Promise<boolean> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.findOneAndUpdate(
    scopeFilter(householdId, userId, { id }),
    { $set: { active: false, updatedAt: new Date().toISOString() } }
  );

  return !!result;
}
