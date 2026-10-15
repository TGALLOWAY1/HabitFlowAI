/**
 * DailyCheckIn Repository Tests
 *
 * Integration tests for the per-day Daily Check-in reflection record.
 * Uses mongodb-memory-server via shared test helper.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { getDailyCheckIn, upsertDailyCheckIn } from '../dailyCheckInRepository';
import type { HabitCheckIn } from '../../../models/persistenceTypes';

const HOUSEHOLD_ID = 'house-1';
const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const DAY = '2026-10-12';

function reflection(habitId: string, overrides: Partial<HabitCheckIn> = {}): HabitCheckIn {
  return {
    habitId,
    completionStatus: null,
    moodScore: null,
    moodTags: [],
    effortScore: null,
    journalEntry: null,
    ...overrides,
  };
}

describe('DailyCheckInRepository', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('dailyCheckIns').deleteMany({});
  });

  it('returns null for a day that has no check-in (not started)', async () => {
    expect(await getDailyCheckIn(HOUSEHOLD_ID, USER_ID, DAY)).toBeNull();
  });

  it('creates the check-in on first save with startedAt and in_progress status', async () => {
    const created = await upsertDailyCheckIn(HOUSEHOLD_ID, USER_ID, DAY, {
      status: 'in_progress',
      currentStep: 2,
      habits: [reflection('habit-a', { completionStatus: 'skipped' })],
    });

    expect(created.id).toBeTruthy();
    expect(created.userId).toBe(USER_ID);
    expect(created.dayKey).toBe(DAY);
    expect(created.status).toBe('in_progress');
    expect(created.currentStep).toBe(2);
    expect(created.startedAt).toBeTruthy();
    expect(created.completedAt).toBeNull();
    expect(created.habits).toEqual([reflection('habit-a', { completionStatus: 'skipped' })]);
    expect(created).not.toHaveProperty('householdId');
    expect(created).not.toHaveProperty('_id');
  });

  it('replaces habits and step on later saves while keeping id and startedAt', async () => {
    const first = await upsertDailyCheckIn(HOUSEHOLD_ID, USER_ID, DAY, {
      status: 'in_progress',
      currentStep: 2,
      habits: [reflection('habit-a', { moodScore: 2 })],
    });
    const second = await upsertDailyCheckIn(HOUSEHOLD_ID, USER_ID, DAY, {
      status: 'in_progress',
      currentStep: 4,
      habits: [reflection('habit-b', { effortScore: 5, journalEntry: 'Tough one' })],
    });

    expect(second.id).toBe(first.id);
    expect(second.startedAt).toBe(first.startedAt);
    expect(second.currentStep).toBe(4);
    expect(second.habits).toEqual([reflection('habit-b', { effortScore: 5, journalEntry: 'Tough one' })]);

    const db = await getTestDb();
    expect(await db.collection('dailyCheckIns').countDocuments({})).toBe(1);
  });

  it('records completedAt once and keeps completion sticky across later edits', async () => {
    const completed = await upsertDailyCheckIn(HOUSEHOLD_ID, USER_ID, DAY, {
      status: 'complete',
      currentStep: 5,
      habits: [reflection('habit-a', { moodScore: 4 })],
    });
    expect(completed.status).toBe('complete');
    expect(completed.completedAt).toBeTruthy();

    // Re-opening to edit (client still sends in_progress) never reopens the check-in.
    const edited = await upsertDailyCheckIn(HOUSEHOLD_ID, USER_ID, DAY, {
      status: 'in_progress',
      currentStep: 3,
      habits: [reflection('habit-a', { moodScore: 5 })],
    });
    expect(edited.status).toBe('complete');
    expect(edited.completedAt).toBe(completed.completedAt);
    expect(edited.habits[0].moodScore).toBe(5);
  });

  it('keeps each day separate so a new day never overwrites a prior check-in', async () => {
    await upsertDailyCheckIn(HOUSEHOLD_ID, USER_ID, DAY, {
      status: 'complete',
      currentStep: 5,
      habits: [reflection('habit-a', { journalEntry: 'Yesterday' })],
    });
    await upsertDailyCheckIn(HOUSEHOLD_ID, USER_ID, '2026-10-13', {
      status: 'in_progress',
      currentStep: 2,
      habits: [],
    });

    const previous = await getDailyCheckIn(HOUSEHOLD_ID, USER_ID, DAY);
    const next = await getDailyCheckIn(HOUSEHOLD_ID, USER_ID, '2026-10-13');
    expect(previous?.status).toBe('complete');
    expect(previous?.habits[0].journalEntry).toBe('Yesterday');
    expect(next?.status).toBe('in_progress');
    expect(next?.habits).toEqual([]);
  });

  it('scopes check-ins by user and household', async () => {
    await upsertDailyCheckIn(HOUSEHOLD_ID, USER_ID, DAY, {
      status: 'in_progress',
      currentStep: 2,
      habits: [reflection('habit-a', { moodScore: 3 })],
    });

    expect(await getDailyCheckIn(HOUSEHOLD_ID, OTHER_USER_ID, DAY)).toBeNull();
    expect(await getDailyCheckIn('other-house', USER_ID, DAY)).toBeNull();
  });
});
