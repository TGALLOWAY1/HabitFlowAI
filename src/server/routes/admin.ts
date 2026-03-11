import type { Request, Response } from 'express';
import { validateDayKey } from '../domain/canonicalValidators';
import { getRequestIdentity } from '../middleware/identity';
import { getDb } from '../lib/mongoClient';
import type { Document } from 'mongodb';

type HabitDoc = {
  id: string;
};

type GoalDoc = {
  id: string;
  title?: string;
  linkedHabitIds?: string[];
};

type HabitEntryDoc = {
  id: string;
  habitId: string;
  dayKey?: string;
  timestamp?: string;
  source?: string;
  value?: number;
  bundleOptionId?: string;
  choiceChildHabitId?: string;
};

export async function getIntegrityReport(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = getRequestIdentity(req);
    const db = await getDb();

    const [habits, goals, entries] = await Promise.all([
      db.collection('habits')
        .find({ userId }, { projection: { _id: 0, id: 1 } })
        .toArray() as unknown as Promise<HabitDoc[]>,
      db.collection('goals')
        .find({ userId }, { projection: { _id: 0, id: 1, title: 1, linkedHabitIds: 1 } })
        .toArray() as unknown as Promise<GoalDoc[]>,
      db.collection('habitEntries')
        .find({ userId, deletedAt: { $exists: false } }, {
          projection: {
            _id: 0,
            id: 1,
            habitId: 1,
            dayKey: 1,
            timestamp: 1,
            source: 1,
            value: 1,
            bundleOptionId: 1,
            choiceChildHabitId: 1,
          }
        })
        .toArray() as unknown as Promise<HabitEntryDoc[]>,
    ]);

    const habitIdSet = new Set(habits.map(habit => habit.id));

    const invalidDayKeyEntries = entries.filter(entry => {
      if (!entry.dayKey) return true;
      return !validateDayKey(entry.dayKey).valid;
    });
    const entriesMissingDayKey = invalidDayKeyEntries.filter(entry => !entry.dayKey);

    const habitEntryDuplicateMap = new Map<string, string[]>();
    for (const entry of entries) {
      const signature = [
        entry.habitId,
        entry.dayKey ?? '',
        entry.timestamp ?? '',
        entry.source ?? '',
        String(entry.value ?? ''),
        entry.bundleOptionId ?? '',
        entry.choiceChildHabitId ?? '',
      ].join('|');
      const existing = habitEntryDuplicateMap.get(signature) ?? [];
      existing.push(entry.id);
      habitEntryDuplicateMap.set(signature, existing);
    }
    const duplicateHabitEntries = Array.from(habitEntryDuplicateMap.entries())
      .filter(([, ids]) => ids.length > 1)
      .map(([signature, ids]) => ({ signature, count: ids.length, ids }))
      .slice(0, 100);

    const orphanHabitEntries = entries
      .filter(entry => !habitIdSet.has(entry.habitId))
      .slice(0, 100);

    const goalLinksMissingHabits = goals
      .flatMap(goal => {
        const linkedHabitIds = goal.linkedHabitIds ?? [];
        const missingHabitIds = linkedHabitIds.filter(habitId => !habitIdSet.has(habitId));
        if (missingHabitIds.length === 0) return [];
        return [{
          goalId: goal.id,
          goalTitle: goal.title,
          missingHabitIds,
        }];
      })
      .slice(0, 100);

    res.status(200).json({
      generatedAt: new Date().toISOString(),
      userId,
      summary: {
        habits: habits.length,
        goals: goals.length,
        activeHabitEntries: entries.length,
        invalidDayKeys: invalidDayKeyEntries.length,
        missingDayKeys: entriesMissingDayKey.length,
        duplicateHabitEntrySignatures: duplicateHabitEntries.length,
        orphanHabitEntries: orphanHabitEntries.length,
        goalLinksMissingHabits: goalLinksMissingHabits.length,
      },
      samples: {
        invalidDayKeyEntries: invalidDayKeyEntries.slice(0, 50),
        duplicateHabitEntries,
        orphanHabitEntries,
        goalLinksMissingHabits,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating integrity report:', message);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to generate integrity report',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
    });
  }
}

/**
 * POST /api/admin/dedup-habits
 *
 * Deduplicates habits and categories for the authenticated user.
 * For each group of duplicates (same name + categoryId + user scope):
 *   1. Keeps the oldest record (earliest createdAt)
 *   2. Remaps any habitEntries referencing deleted IDs to the kept ID
 *   3. Remaps any goal linkedHabitIds referencing deleted IDs
 *   4. Deletes the duplicate records
 *
 * Returns a dry-run summary by default. Pass ?commit=true to actually apply changes.
 */
export async function dedupHabits(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const commit = req.query.commit === 'true';
    const db = await getDb();

    // --- Deduplicate habits ---
    const habitsColl = db.collection('habits');
    const allHabits = await habitsColl
      .find({ householdId, userId })
      .sort({ createdAt: 1 })
      .toArray();

    // Group by name only — duplicates were created with different categoryIds
    // due to the race condition, so (name, categoryId) grouping misses them.
    // The kept record's categoryId is preserved; duplicates are remapped.
    const habitGroups = new Map<string, Document[]>();
    for (const habit of allHabits) {
      const key = habit.name;
      const group = habitGroups.get(key) ?? [];
      group.push(habit);
      habitGroups.set(key, group);
    }

    const habitDuplicateIds: string[] = [];
    const habitIdRemapMap = new Map<string, string>(); // duplicateId -> keepId
    let habitGroupsWithDupes = 0;

    for (const [, group] of habitGroups) {
      if (group.length <= 1) continue;
      habitGroupsWithDupes++;
      const keep = group[0]; // oldest by createdAt (sorted above)
      for (let i = 1; i < group.length; i++) {
        habitDuplicateIds.push(group[i].id);
        habitIdRemapMap.set(group[i].id, keep.id);
      }
    }

    // --- Deduplicate categories ---
    const categoriesColl = db.collection('categories');
    const allCategories = await categoriesColl
      .find({ householdId, userId })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();

    const categoryGroups = new Map<string, Document[]>();
    for (const cat of allCategories) {
      const key = cat.name;
      const group = categoryGroups.get(key) ?? [];
      group.push(cat);
      categoryGroups.set(key, group);
    }

    const categoryDuplicateIds: string[] = [];
    const categoryIdRemapMap = new Map<string, string>();
    let categoryGroupsWithDupes = 0;

    for (const [, group] of categoryGroups) {
      if (group.length <= 1) continue;
      categoryGroupsWithDupes++;
      const keep = group[0];
      for (let i = 1; i < group.length; i++) {
        categoryDuplicateIds.push(group[i].id);
        categoryIdRemapMap.set(group[i].id, keep.id);
      }
    }

    // Summary for dry-run
    const summary = {
      habits: {
        total: allHabits.length,
        uniqueGroups: habitGroups.size,
        groupsWithDuplicates: habitGroupsWithDupes,
        duplicatesToRemove: habitDuplicateIds.length,
        afterDedup: allHabits.length - habitDuplicateIds.length,
      },
      categories: {
        total: allCategories.length,
        uniqueGroups: categoryGroups.size,
        groupsWithDuplicates: categoryGroupsWithDupes,
        duplicatesToRemove: categoryDuplicateIds.length,
        afterDedup: allCategories.length - categoryDuplicateIds.length,
      },
    };

    // --- Near-duplicate detection (case-insensitive, trimmed) ---
    const normalizedGroups = new Map<string, Document[]>();
    for (const habit of allHabits) {
      const key = String(habit.name ?? '').trim().toLowerCase();
      const group = normalizedGroups.get(key) ?? [];
      group.push(habit);
      normalizedGroups.set(key, group);
    }
    const nearDuplicates = Array.from(normalizedGroups.entries())
      .filter(([, group]) => group.length > 1)
      .map(([normalizedName, group]) => ({
        normalizedName,
        count: group.length,
        variants: group.map(h => ({ id: h.id, name: h.name, categoryId: h.categoryId, createdAt: h.createdAt })),
      }))
      .slice(0, 50);

    // --- Habit name frequency (top names for inspection) ---
    const nameFrequency = Array.from(habitGroups.entries())
      .map(([name, group]) => ({ name, count: group.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);

    if (!commit) {
      res.status(200).json({
        mode: 'dry-run',
        message: 'Pass ?commit=true to apply changes',
        summary,
        habitIdRemapping: Object.fromEntries(habitIdRemapMap),
        categoryIdRemapping: Object.fromEntries(categoryIdRemapMap),
        diagnostics: {
          nearDuplicates,
          nameFrequency,
          totalUniqueNormalizedNames: normalizedGroups.size,
        },
      });
      return;
    }

    // --- Apply changes ---
    const results: Record<string, number> = {};

    // 1. Remap habitEntries.habitId from duplicate -> kept
    if (habitIdRemapMap.size > 0) {
      let remappedEntries = 0;
      for (const [oldId, newId] of habitIdRemapMap) {
        const r = await db.collection('habitEntries').updateMany(
          { householdId, userId, habitId: oldId },
          { $set: { habitId: newId } }
        );
        remappedEntries += r.modifiedCount;
      }
      results.remappedHabitEntries = remappedEntries;
    }

    // 2. Remap goal linkedHabitIds
    if (habitIdRemapMap.size > 0) {
      const goals = await db.collection('goals')
        .find({ householdId, userId, linkedHabitIds: { $exists: true } })
        .toArray();

      let remappedGoalLinks = 0;
      for (const goal of goals) {
        const linked: string[] = goal.linkedHabitIds ?? [];
        const updated = linked.map(id => habitIdRemapMap.get(id) ?? id);
        // Deduplicate in case remap creates dupes within the array
        const deduped = [...new Set(updated)];
        if (JSON.stringify(linked) !== JSON.stringify(deduped)) {
          await db.collection('goals').updateOne(
            { householdId, userId, id: goal.id },
            { $set: { linkedHabitIds: deduped } }
          );
          remappedGoalLinks++;
        }
      }
      results.remappedGoalLinks = remappedGoalLinks;
    }

    // 3. Remap habit categoryId from duplicate category -> kept category
    if (categoryIdRemapMap.size > 0) {
      let remappedHabitCategories = 0;
      for (const [oldId, newId] of categoryIdRemapMap) {
        const r = await habitsColl.updateMany(
          { householdId, userId, categoryId: oldId },
          { $set: { categoryId: newId } }
        );
        remappedHabitCategories += r.modifiedCount;
      }
      results.remappedHabitCategories = remappedHabitCategories;
    }

    // 4. Delete duplicate habits
    if (habitDuplicateIds.length > 0) {
      const r = await habitsColl.deleteMany({
        householdId,
        userId,
        id: { $in: habitDuplicateIds },
      });
      results.deletedDuplicateHabits = r.deletedCount;
    }

    // 5. Delete duplicate categories
    if (categoryDuplicateIds.length > 0) {
      const r = await categoriesColl.deleteMany({
        householdId,
        userId,
        id: { $in: categoryDuplicateIds },
      });
      results.deletedDuplicateCategories = r.deletedCount;
    }

    res.status(200).json({
      mode: 'committed',
      summary,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in dedup-habits:', message);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to deduplicate habits',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
    });
  }
}

