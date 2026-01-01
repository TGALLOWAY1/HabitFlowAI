/**
 * Routine Image Repository
 *
 * Handles persistence for routine images stored as binary data in MongoDB.
 * One image per routine (enforced by unique index on routineId).
 */

import { Binary } from 'mongodb';
import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS } from '../../models/persistenceTypes';

const COLLECTION = MONGO_COLLECTIONS.ROUTINE_IMAGES;

let indexesEnsured = false;

/**
 * Ensure indexes are created for the routine images collection.
 * Called lazily on first use.
 */
async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;

  const db = await getDb();
  const collection = db.collection(COLLECTION);

  // Unique index on routineId ensures one image per routine
  await collection.createIndex(
    { routineId: 1 },
    { name: 'by_routineId', unique: true }
  );

  indexesEnsured = true;
}

/**
 * Upsert a routine image.
 * 
 * @param routineId - ID of the routine this image belongs to
 * @param contentType - MIME type of the image (e.g., 'image/jpeg', 'image/png')
 * @param data - Image binary data as Buffer
 * @returns Promise<{ imageId: string }> - Returns the routineId as imageId
 */
export async function upsertRoutineImage({
  routineId,
  contentType,
  data,
}: {
  routineId: string;
  contentType: string;
  data: Buffer;
}): Promise<{ imageId: string }> {
  await ensureIndexes();
  const db = await getDb();
  const collection = db.collection(COLLECTION);

  const now = new Date();

  // Convert Buffer to MongoDB Binary
  const binaryData = new Binary(data);

  // Upsert the image document
  await collection.findOneAndUpdate(
    { routineId },
    {
      $set: {
        routineId,
        contentType,
        data: binaryData,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );

  // Return routineId as imageId (since it's the unique identifier)
  return { imageId: routineId };
}

/**
 * Get a routine image by routine ID.
 * 
 * @param routineId - ID of the routine
 * @returns Promise<{ _id, contentType, data } | null> - Image document or null if not found
 */
export async function getRoutineImageByRoutineId(
  routineId: string
): Promise<{ _id: any; contentType: string; data: Buffer } | null> {
  await ensureIndexes();
  const db = await getDb();
  const collection = db.collection(COLLECTION);

  const doc = await collection.findOne({ routineId });

  if (!doc) {
    return null;
  }

  // Convert MongoDB Binary back to Buffer
  let data: Buffer;
  if (doc.data instanceof Binary) {
    data = Buffer.from(doc.data.buffer);
  } else if (Buffer.isBuffer(doc.data)) {
    data = doc.data;
  } else {
    // Fallback: try to convert to buffer
    data = Buffer.from(doc.data as any);
  }

  return {
    _id: doc._id,
    contentType: doc.contentType as string,
    data,
  };
}

/**
 * Delete a routine image by routine ID.
 * 
 * @param routineId - ID of the routine
 * @returns Promise<void>
 */
export async function deleteRoutineImageByRoutineId(
  routineId: string
): Promise<void> {
  await ensureIndexes();
  const db = await getDb();
  const collection = db.collection(COLLECTION);

  await collection.deleteOne({ routineId });
}

