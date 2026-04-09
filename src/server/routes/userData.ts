/**
 * DELETE /api/user/data — Permanently delete all data for the authenticated user.
 * Clears every user-scoped collection except the user account itself and sessions.
 */
import type { Request, Response } from 'express';
import type { RequestWithIdentity } from '../middleware/identity';
import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS } from '../../models/persistenceTypes';

/** Collections that hold user-scoped data (keyed by userId). */
const USER_DATA_COLLECTIONS = [
  MONGO_COLLECTIONS.CATEGORIES,
  MONGO_COLLECTIONS.HABITS,
  MONGO_COLLECTIONS.HABIT_ENTRIES,
  MONGO_COLLECTIONS.GOALS,
  MONGO_COLLECTIONS.GOAL_TRACKS,
  MONGO_COLLECTIONS.ROUTINES,
  MONGO_COLLECTIONS.ROUTINE_LOGS,
  MONGO_COLLECTIONS.ROUTINE_IMAGES,
  MONGO_COLLECTIONS.JOURNAL_ENTRIES,
  MONGO_COLLECTIONS.WELLBEING_ENTRIES,
  MONGO_COLLECTIONS.WELLBEING_LOGS,
  MONGO_COLLECTIONS.DASHBOARD_PREFS,
  MONGO_COLLECTIONS.TASKS,
  MONGO_COLLECTIONS.HABIT_POTENTIAL_EVIDENCE,
  MONGO_COLLECTIONS.DAY_LOGS,
  MONGO_COLLECTIONS.GOAL_MANUAL_LOGS,
] as const;

export async function deleteUserData(req: Request, res: Response): Promise<void> {
  const { userId } = req as RequestWithIdentity;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const db = await getDb();
  const results: Record<string, number> = {};

  await Promise.all(
    USER_DATA_COLLECTIONS.map(async (col) => {
      const { deletedCount } = await db.collection(col).deleteMany({ userId });
      results[col] = deletedCount;
    }),
  );

  res.status(200).json({ deleted: results });
}
