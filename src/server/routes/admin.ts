import type { Request, Response } from 'express';
import { validateDayKey } from '../domain/canonicalValidators';
import { getRequestIdentity } from '../middleware/identity';
import { getDb } from '../lib/mongoClient';

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
        .toArray() as Promise<HabitDoc[]>,
      db.collection('goals')
        .find({ userId }, { projection: { _id: 0, id: 1, title: 1, linkedHabitIds: 1 } })
        .toArray() as Promise<GoalDoc[]>,
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
        .toArray() as Promise<HabitEntryDoc[]>,
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

