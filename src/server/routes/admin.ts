import type { Request, Response } from 'express';
import { validateDayKey } from '../domain/canonicalValidators';
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

type DayLogDoc = {
  habitId: string;
  date: string;
  compositeKey?: string;
};

function getUserIdFromRequest(req: Request): string {
  const candidate = (req as Request & { userId?: unknown }).userId;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : 'anonymous-user';
}

export async function getIntegrityReport(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserIdFromRequest(req);
    const db = await getDb();

    const [habits, goals, entries, dayLogs] = await Promise.all([
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
      db.collection('dayLogs')
        .find({ userId }, { projection: { _id: 0, habitId: 1, date: 1, compositeKey: 1 } })
        .toArray() as Promise<DayLogDoc[]>,
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

    const dayLogDuplicateMap = new Map<string, number>();
    for (const dayLog of dayLogs) {
      const compositeKey = dayLog.compositeKey ?? `${dayLog.habitId}-${dayLog.date}`;
      const existing = dayLogDuplicateMap.get(compositeKey) ?? 0;
      dayLogDuplicateMap.set(compositeKey, existing + 1);
    }
    const duplicateDayLogs = Array.from(dayLogDuplicateMap.entries())
      .filter(([, count]) => count > 1)
      .map(([compositeKey, count]) => ({ compositeKey, count }))
      .slice(0, 100);

    const orphanHabitEntries = entries
      .filter(entry => !habitIdSet.has(entry.habitId))
      .slice(0, 100);
    const orphanDayLogs = dayLogs
      .filter(dayLog => !habitIdSet.has(dayLog.habitId))
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
        dayLogs: dayLogs.length,
        invalidDayKeys: invalidDayKeyEntries.length,
        missingDayKeys: entriesMissingDayKey.length,
        duplicateHabitEntrySignatures: duplicateHabitEntries.length,
        duplicateDayLogCompositeKeys: duplicateDayLogs.length,
        orphanHabitEntries: orphanHabitEntries.length,
        orphanDayLogs: orphanDayLogs.length,
        goalLinksMissingHabits: goalLinksMissingHabits.length,
      },
      samples: {
        invalidDayKeyEntries: invalidDayKeyEntries.slice(0, 50),
        duplicateHabitEntries,
        duplicateDayLogs,
        orphanHabitEntries,
        orphanDayLogs,
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

