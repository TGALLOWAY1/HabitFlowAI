import type { Request, Response } from 'express';
import type { DayLog, HabitEntry } from '../../models/persistenceTypes';
import { validateDayKey, assertTimeZone } from '../domain/canonicalValidators';
import { getHabitsByUser } from '../repositories/habitRepository';
import { getHabitEntriesByUser } from '../repositories/habitEntryRepository';

type AggregatedDayEntry = {
  habitId: string;
  dayKey: string;
  count: number;
  valueSum: number;
  hasFreeze: boolean;
  freezeType?: DayLog['freezeType'];
  latestTimestamp: string;
  latestSource: HabitEntry['source'];
  latestRoutineId?: string;
  latestBundleOptionId?: string;
  completedOptions: Record<string, number>;
};

function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultRange(): { startDayKey: string; endDayKey: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 400);
  return {
    startDayKey: toLocalDayKey(start),
    endDayKey: toLocalDayKey(end),
  };
}

function getUserIdFromRequest(req: Request): string {
  const candidate = (req as Request & { userId?: unknown }).userId;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : 'anonymous-user';
}

function isDayKeyInRange(dayKey: string, startDayKey: string, endDayKey: string): boolean {
  return dayKey >= startDayKey && dayKey <= endDayKey;
}

function parseFreezeType(note?: string): DayLog['freezeType'] | undefined {
  if (!note || !note.startsWith('freeze:')) return undefined;
  const raw = note.slice('freeze:'.length);
  if (raw === 'manual' || raw === 'auto' || raw === 'soft') {
    return raw;
  }
  return 'auto';
}

function aggregateEntries(
  entries: HabitEntry[],
  allowedHabitIds: Set<string>,
  startDayKey: string,
  endDayKey: string
): Map<string, AggregatedDayEntry> {
  const aggregates = new Map<string, AggregatedDayEntry>();

  for (const entry of entries) {
    if (entry.deletedAt) continue;
    if (!allowedHabitIds.has(entry.habitId)) continue;

    const dayKey = entry.dayKey || entry.date || entry.dateKey;
    if (!dayKey || !isDayKeyInRange(dayKey, startDayKey, endDayKey)) continue;

    const compositeKey = `${entry.habitId}-${dayKey}`;
    const existing = aggregates.get(compositeKey) ?? {
      habitId: entry.habitId,
      dayKey,
      count: 0,
      valueSum: 0,
      hasFreeze: false,
      latestTimestamp: '',
      latestSource: 'manual' as HabitEntry['source'],
      completedOptions: {},
    };

    const freezeType = parseFreezeType(entry.note);
    if (freezeType) {
      existing.hasFreeze = true;
      existing.freezeType = freezeType;
    } else {
      existing.count += 1;
      if (typeof entry.value === 'number') {
        existing.valueSum += entry.value;
      }

      const optionKey = entry.choiceChildHabitId || entry.bundleOptionId;
      if (optionKey) {
        existing.completedOptions[optionKey] = typeof entry.value === 'number' ? entry.value : 1;
      }
    }

    if (!existing.latestTimestamp || entry.timestamp > existing.latestTimestamp) {
      existing.latestTimestamp = entry.timestamp;
      existing.latestSource = entry.source;
      existing.latestRoutineId = entry.routineId;
      existing.latestBundleOptionId = entry.bundleOptionId;
    }

    aggregates.set(compositeKey, existing);
  }

  return aggregates;
}

export async function getDaySummary(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserIdFromRequest(req);
    const queryStart = typeof req.query.startDayKey === 'string' ? req.query.startDayKey : undefined;
    const queryEnd = typeof req.query.endDayKey === 'string' ? req.query.endDayKey : undefined;
    const timeZone = typeof req.query.timeZone === 'string' ? req.query.timeZone : 'UTC';

    const defaultRange = getDefaultRange();
    const startDayKey = queryStart ?? defaultRange.startDayKey;
    const endDayKey = queryEnd ?? defaultRange.endDayKey;

    const startValidation = validateDayKey(startDayKey);
    if (!startValidation.valid) {
      res.status(400).json({ error: startValidation.error });
      return;
    }

    const endValidation = validateDayKey(endDayKey);
    if (!endValidation.valid) {
      res.status(400).json({ error: endValidation.error });
      return;
    }

    if (startDayKey > endDayKey) {
      res.status(400).json({ error: 'startDayKey must be <= endDayKey' });
      return;
    }

    const timeZoneValidation = assertTimeZone(timeZone);
    if (!timeZoneValidation.valid) {
      res.status(400).json({ error: timeZoneValidation.error });
      return;
    }

    const [habits, entries] = await Promise.all([
      getHabitsByUser(userId),
      getHabitEntriesByUser(userId),
    ]);

    const activeHabits = habits.filter(habit => !habit.archived);
    const habitById = new Map(activeHabits.map(habit => [habit.id, habit]));
    const aggregates = aggregateEntries(entries, new Set(habitById.keys()), startDayKey, endDayKey);

    const logs: Record<string, DayLog> = {};

    for (const aggregate of aggregates.values()) {
      const habit = habitById.get(aggregate.habitId);
      if (!habit) continue;

      let value: number | undefined;
      let completed = false;
      const isFrozen = aggregate.hasFreeze && aggregate.count === 0;

      if (habit.bundleType === 'choice') {
        value = undefined;
        completed = aggregate.count > 0;
      } else if (habit.goal.type === 'number') {
        value = isFrozen ? 0 : aggregate.valueSum;
        const target = habit.goal.target ?? 0;
        completed = !isFrozen && aggregate.valueSum >= target;
      } else {
        value = isFrozen ? 0 : (aggregate.valueSum > 0 ? aggregate.valueSum : aggregate.count);
        completed = !isFrozen && value > 0;
      }

      const completedOptions =
        Object.keys(aggregate.completedOptions).length > 0 ? aggregate.completedOptions : undefined;

      logs[`${aggregate.habitId}-${aggregate.dayKey}`] = {
        habitId: aggregate.habitId,
        date: aggregate.dayKey,
        value,
        completed,
        source: aggregate.latestSource === 'routine' ? 'routine' : 'manual',
        routineId: aggregate.latestRoutineId,
        bundleOptionId: aggregate.latestBundleOptionId,
        completedOptions,
        isFrozen,
        freezeType: isFrozen ? aggregate.freezeType : undefined,
      };
    }

    res.status(200).json({
      startDayKey,
      endDayKey,
      logs,
      metadata: {
        source: 'habitEntries',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching day summary:', message);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch day summary',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
    });
  }
}
