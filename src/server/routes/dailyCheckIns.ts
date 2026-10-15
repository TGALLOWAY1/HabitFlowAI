/**
 * Daily Check-in Routes
 *
 * GET /api/dailyCheckIns/:dayKey  → { checkIn: DailyCheckIn | null }
 * PUT /api/dailyCheckIns/:dayKey  → { checkIn: DailyCheckIn }
 *
 * The PUT body is the full mutable state ({ status, currentStep, habits }) and
 * replaces the stored habits list. Habit completion is never accepted here —
 * "done" is derived from habitEntries.
 */

import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { validateDayKey } from '../domain/canonicalValidators';
import {
  getDailyCheckIn,
  upsertDailyCheckIn,
  type DailyCheckInInput,
} from '../repositories/dailyCheckInRepository';
import type {
  DailyCheckInStatus,
  HabitCheckIn,
  HabitCheckInCompletionStatus,
} from '../../models/persistenceTypes';
import {
  DAILY_CHECK_IN_JOURNAL_MAX_LENGTH,
  DAILY_CHECK_IN_MAX_HABITS,
  DAILY_CHECK_IN_SCORE_MAX,
  DAILY_CHECK_IN_SCORE_MIN,
  DAILY_CHECK_IN_STEP_COUNT,
  isDailyCheckInMoodTag,
} from '../../shared/dailyCheckIn';

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_HABIT_ID_LENGTH = 128;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseScore(value: unknown, field: string): ParseResult<number | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < DAILY_CHECK_IN_SCORE_MIN ||
    value > DAILY_CHECK_IN_SCORE_MAX
  ) {
    return {
      ok: false,
      error: `${field} must be an integer from ${DAILY_CHECK_IN_SCORE_MIN} to ${DAILY_CHECK_IN_SCORE_MAX}`,
    };
  }
  return { ok: true, value };
}

function parseHabitCheckIn(raw: unknown, index: number): ParseResult<HabitCheckIn> {
  if (!isRecord(raw)) return { ok: false, error: `habits[${index}] must be an object` };

  const { habitId, completionStatus, moodTags, journalEntry } = raw;
  if (typeof habitId !== 'string' || habitId.trim() === '' || habitId.length > MAX_HABIT_ID_LENGTH) {
    return { ok: false, error: `habits[${index}].habitId is required` };
  }

  let declaredStatus: HabitCheckInCompletionStatus | null = null;
  if (completionStatus === 'partial' || completionStatus === 'skipped') {
    declaredStatus = completionStatus;
  } else if (completionStatus === 'done') {
    return {
      ok: false,
      error: `habits[${index}].completionStatus "done" is derived from habit entries and cannot be stored`,
    };
  } else if (completionStatus !== undefined && completionStatus !== null) {
    return { ok: false, error: `habits[${index}].completionStatus must be "partial", "skipped", or null` };
  }

  const mood = parseScore(raw.moodScore, `habits[${index}].moodScore`);
  if (!mood.ok) return mood;
  const effort = parseScore(raw.effortScore, `habits[${index}].effortScore`);
  if (!effort.ok) return effort;

  let tags: string[] = [];
  if (moodTags !== undefined && moodTags !== null) {
    if (!Array.isArray(moodTags) || !moodTags.every(isDailyCheckInMoodTag)) {
      return { ok: false, error: `habits[${index}].moodTags contains an unknown tag` };
    }
    tags = Array.from(new Set(moodTags));
  }

  let journal: string | null = null;
  if (journalEntry !== undefined && journalEntry !== null) {
    if (typeof journalEntry !== 'string') {
      return { ok: false, error: `habits[${index}].journalEntry must be a string` };
    }
    if (journalEntry.length > DAILY_CHECK_IN_JOURNAL_MAX_LENGTH) {
      return {
        ok: false,
        error: `habits[${index}].journalEntry must be at most ${DAILY_CHECK_IN_JOURNAL_MAX_LENGTH} characters`,
      };
    }
    journal = journalEntry.trim() === '' ? null : journalEntry;
  }

  return {
    ok: true,
    value: {
      habitId,
      completionStatus: declaredStatus,
      moodScore: mood.value,
      moodTags: tags,
      effortScore: effort.value,
      journalEntry: journal,
    },
  };
}

function hasReflection(habit: HabitCheckIn): boolean {
  return habit.completionStatus !== null || habit.moodScore !== null || habit.moodTags.length > 0 ||
    habit.effortScore !== null || habit.journalEntry !== null;
}

/**
 * Validate and normalize a PUT body. Records carrying no reflection at all
 * are dropped so the stored list only holds meaningful data.
 */
export function parseDailyCheckInBody(body: unknown): ParseResult<DailyCheckInInput> {
  if (!isRecord(body)) return { ok: false, error: 'Request body must be an object' };

  let status: DailyCheckInStatus;
  if (body.status === undefined || body.status === 'in_progress') {
    status = 'in_progress';
  } else if (body.status === 'complete') {
    status = 'complete';
  } else {
    return { ok: false, error: 'status must be "in_progress" or "complete"' };
  }

  const currentStep = body.currentStep ?? 1;
  if (
    typeof currentStep !== 'number' ||
    !Number.isInteger(currentStep) ||
    currentStep < 1 ||
    currentStep > DAILY_CHECK_IN_STEP_COUNT
  ) {
    return { ok: false, error: `currentStep must be an integer from 1 to ${DAILY_CHECK_IN_STEP_COUNT}` };
  }

  const rawHabits = body.habits ?? [];
  if (!Array.isArray(rawHabits)) return { ok: false, error: 'habits must be an array' };
  if (rawHabits.length > DAILY_CHECK_IN_MAX_HABITS) {
    return { ok: false, error: `habits must contain at most ${DAILY_CHECK_IN_MAX_HABITS} items` };
  }

  const habits: HabitCheckIn[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rawHabits.length; i++) {
    const parsed = parseHabitCheckIn(rawHabits[i], i);
    if (!parsed.ok) return parsed;
    if (seen.has(parsed.value.habitId)) {
      return { ok: false, error: `Duplicate habitId in habits: ${parsed.value.habitId}` };
    }
    seen.add(parsed.value.habitId);
    if (hasReflection(parsed.value)) habits.push(parsed.value);
  }

  return { ok: true, value: { status, currentStep, habits } };
}

function serverError(res: Response, error: unknown, message: string): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message,
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    },
  });
}

function validationError(res: Response, message: string): void {
  res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
}

/** GET /api/dailyCheckIns/:dayKey */
export async function getDailyCheckInRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const dayKey = String(req.params.dayKey ?? '');
    const dayKeyValidation = validateDayKey(dayKey);
    if (!dayKeyValidation.valid) {
      validationError(res, dayKeyValidation.error ?? 'Invalid dayKey');
      return;
    }

    const checkIn = await getDailyCheckIn(householdId, userId, dayKey);
    res.status(200).json({ checkIn });
  } catch (error) {
    serverError(res, error, 'Failed to fetch daily check-in');
  }
}

/** PUT /api/dailyCheckIns/:dayKey  Body: { status, currentStep, habits } */
export async function upsertDailyCheckInRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const dayKey = String(req.params.dayKey ?? '');
    const dayKeyValidation = validateDayKey(dayKey);
    if (!dayKeyValidation.valid) {
      validationError(res, dayKeyValidation.error ?? 'Invalid dayKey');
      return;
    }

    const parsed = parseDailyCheckInBody(req.body);
    if (!parsed.ok) {
      validationError(res, parsed.error);
      return;
    }

    const checkIn = await upsertDailyCheckIn(householdId, userId, dayKey, parsed.value);
    res.status(200).json({ checkIn });
  } catch (error) {
    serverError(res, error, 'Failed to save daily check-in');
  }
}
