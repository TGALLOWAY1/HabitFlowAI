/**
 * Activity Repository
 * 
 * MongoDB data access layer for Activity entities.
 * Provides CRUD operations for activities with user-scoped queries.
 */

import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS, type Activity } from '../../models/persistenceTypes';

const COLLECTION_NAME = MONGO_COLLECTIONS.ACTIVITIES;

/**
 * Create a new activity.
 * 
 * @param data - Activity data (without id, userId, createdAt, updatedAt)
 * @param userId - User ID to associate with the activity
 * @returns Created activity with generated ID
 */
export async function createActivity(
  data: Omit<Activity, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Activity> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  // Generate ID (using UUID format to match frontend)
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const updatedAt = createdAt;

  // Create document to store in MongoDB (includes userId)
  const document = {
    id,
    ...data,
    userId,
    createdAt,
    updatedAt,
  } as any;

  await collection.insertOne(document);

  // Return Activity (without userId and _id)
  const { _id, userId: _, ...activity } = document;
  return activity as Activity;
}

/**
 * Get all activities for a user.
 * 
 * @param userId - User ID to filter activities
 * @returns Array of activities for the user
 */
export async function getActivitiesByUser(userId: string): Promise<Activity[]> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find({ userId })
    .toArray();

  // Remove MongoDB _id and userId before returning
  return documents.map((doc: any) => {
    const { _id, userId: _, ...activity } = doc;
    return activity as Activity;
  });
}

/**
 * Get a single activity by ID.
 * 
 * @param id - Activity ID
 * @param userId - User ID to verify ownership
 * @returns Activity if found, null otherwise
 */
export async function getActivityById(
  id: string,
  userId: string
): Promise<Activity | null> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const document = await collection.findOne({ id, userId });

  if (!document) {
    return null;
  }

  // Remove MongoDB _id and userId before returning
  const { _id, userId: _, ...activity } = document as any;
  return activity as Activity;
}

/**
 * Update an activity.
 * 
 * @param id - Activity ID
 * @param userId - User ID to verify ownership
 * @param patch - Partial activity data to update
 * @returns Updated activity if found, null otherwise
 */
export async function updateActivity(
  id: string,
  userId: string,
  patch: Partial<Omit<Activity, 'id' | 'userId' | 'createdAt'>>
): Promise<Activity | null> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  // Always update updatedAt timestamp
  const updateData = {
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  const result = await collection.findOneAndUpdate(
    { id, userId },
    { $set: updateData },
    { returnDocument: 'after' }
  );

  if (!result) {
    return null;
  }

  // Remove MongoDB _id and userId before returning
  const { _id, userId: _, ...activity } = result as any;
  return activity as Activity;
}

/**
 * Delete an activity.
 * 
 * @param id - Activity ID
 * @param userId - User ID to verify ownership
 * @returns True if activity was deleted, false if not found
 */
export async function deleteActivity(
  id: string,
  userId: string
): Promise<boolean> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.deleteOne({ id, userId });

  return result.deletedCount > 0;
}
