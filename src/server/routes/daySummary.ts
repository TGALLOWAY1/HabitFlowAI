import type { Request, Response } from 'express';
import type { DayLog, HabitEntry, Habit } from '../../models/persistenceTypes';
import { validateDayKey } from '../domain/canonicalValidators';
import { getHabitsByUser } from '../repositories/habitRepository';
import { getHabitEntriesByUser } from '../repositories/habitEntryRepository';
import { getAllMembershipsByUser } from '../repositories/bundleMembershipRepository';
import type { BundleMembershipRecord } from '../domain/canonicalTypes';
import { evaluateChecklistSuccess } from '../services/checklistSuccessService';
import { resolveTimeZone, getNowDayKey, getDayKeyForDate, getCanonicalDayKeyFromEntry } from '../utils/dayKey';
import { getRequestIdentity } from '../middleware/identity';

type AggregatedDayEntry = {
  habitId: string;
  dayKey: string;
  count: number;
  valueSum: number;
  hasFreeze: boolean;
  freezeType?: 'manual' | 'auto' | 'soft';
  latestTimestamp: string;
  latestSource: HabitEntry['source'];
  latestRoutineId?: string;
  latestVariantId?: string;
  latestBundleOptionId?: string;
  completedOptions: Record<string, number>;
};

function getDefaultRange(timeZone: string): { startDayKey: string; endDayKey: string } {
  const now = new Date();
  const endDayKey = getNowDayKey(timeZone);
  const startDate = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);
  const startDayKey = getDayKeyForDate(startDate, timeZone);
  return { startDayKey, endDayKey };
}


function isDayKeyInRange(dayKey: string, startDayKey: string, endDayKey: string): boolean {
  return dayKey >= startDayKey && dayKey <= endDayKey;
}

function parseFreezeType(entry: { freezeType?: string; note?: string }): 'manual' | 'auto' | 'soft' | undefined {
  // Prefer dedicated field; fall back to legacy note parsing
  if (entry.freezeType === 'manual' || entry.freezeType === 'auto' || entry.freezeType === 'soft') return entry.freezeType;
  const note = entry.note;
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
  endDayKey: string,
  timeZone: string
): Map<string, AggregatedDayEntry> {
  const aggregates = new Map<string, AggregatedDayEntry>();

  for (const entry of entries) {
    if (entry.deletedAt) continue;
    if (!allowedHabitIds.has(entry.habitId)) continue;

    const dayKey = getCanonicalDayKeyFromEntry(entry, { timeZone });
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

    const freezeType = parseFreezeType(entry);
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
      existing.latestVariantId = entry.variantId;
      existing.latestBundleOptionId = entry.bundleOptionId;
    }

    aggregates.set(compositeKey, existing);
  }

  return aggregates;
}

export async function getDaySummary(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const queryStart = typeof req.query.startDayKey === 'string' ? req.query.startDayKey : undefined;
    const queryEnd = typeof req.query.endDayKey === 'string' ? req.query.endDayKey : undefined;
    const timeZone = resolveTimeZone(typeof req.query.timeZone === 'string' ? req.query.timeZone : undefined);

    const defaultRange = getDefaultRange(timeZone);
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

    const [habits, entries] = await Promise.all([
      getHabitsByUser(householdId, userId),
      getHabitEntriesByUser(householdId, userId),
    ]);

    const activeHabits = habits.filter(habit => !habit.archived);
    const habitById = new Map(activeHabits.map(habit => [habit.id, habit]));
    const aggregates = aggregateEntries(entries, new Set(habitById.keys()), startDayKey, endDayKey, timeZone);

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
        variantId: aggregate.latestVariantId,
        bundleOptionId: aggregate.latestBundleOptionId,
        completedOptions,
        isFrozen,
        freezeType: isFrozen ? aggregate.freezeType : undefined,
      };
    }

    // Derive bundle parent completion from children's logs.
    // Bundle parents have no entries of their own — completion is derived.
    const bundleParents = activeHabits.filter(
      (h: Habit) => h.type === 'bundle' && (h.bundleType === 'checklist' || h.bundleType === 'choice')
    );

    // Batch-fetch all memberships in one query instead of N+1 per parent
    const allMemberships = await getAllMembershipsByUser(householdId, userId);
    const membershipsByParent = new Map<string, BundleMembershipRecord[]>();
    for (const m of allMemberships) {
      const existing = membershipsByParent.get(m.parentHabitId) ?? [];
      existing.push(m);
      membershipsByParent.set(m.parentHabitId, existing);
    }

    for (const parent of bundleParents) {
      // Resolve children: memberships (temporal) or fallback to static subHabitIds
      const childIds: string[] = parent.subHabitIds ?? [];
      const memberships = membershipsByParent.get(parent.id) ?? [];

      // Collect all dayKeys where at least one child has a log
      const dayKeysWithChildLogs = new Set<string>();
      const allChildIds = memberships.length > 0
        ? [...new Set(memberships.map(m => m.childHabitId))]
        : childIds;
      for (const cid of allChildIds) {
        // Scan logs for this child across all days
        for (const key of Object.keys(logs)) {
          if (key.startsWith(`${cid}-`)) {
            const dayKey = key.slice(cid.length + 1);
            dayKeysWithChildLogs.add(dayKey);
          }
        }
      }

      for (const dayKey of dayKeysWithChildLogs) {
        // Resolve active children for this specific day
        let activeChildIds: string[];
        if (memberships.length > 0) {
          activeChildIds = memberships
            .filter(m => {
              if (m.activeFromDayKey > dayKey) return false;
              if (m.activeToDayKey && m.activeToDayKey < dayKey) return false;
              if (m.daysOfWeek && m.daysOfWeek.length > 0) {
                // Noon-UTC + getUTCDay so the day-of-week is independent of
                // the server's local timezone, matching bundleMembershipRepository,
                // progress.ts, scheduleEngine, and client habitUtils.
                const dayOfWeek = new Date(dayKey + 'T12:00:00Z').getUTCDay();
                if (!m.daysOfWeek.includes(dayOfWeek)) return false;
              }
              return true;
            })
            .map(m => m.childHabitId);
        } else {
          activeChildIds = childIds;
        }

        if (activeChildIds.length === 0) continue;

        let completedCount = 0;
        for (const cid of activeChildIds) {
          const childLog = logs[`${cid}-${dayKey}`];
          if (childLog?.completed) completedCount++;
        }

        const parentComplete = parent.bundleType === 'choice'
          ? completedCount > 0
          : evaluateChecklistSuccess(completedCount, activeChildIds.length, parent.checklistSuccessRule).meetsSuccessRule;

        const parentLogKey = `${parent.id}-${dayKey}`;
        // Only add/override if there isn't already a log (shouldn't be, since parents don't have entries)
        if (!logs[parentLogKey]) {
          logs[parentLogKey] = {
            habitId: parent.id,
            date: dayKey,
            value: completedCount,
            completed: parentComplete,
            source: 'manual',
          };
        }
      }
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
