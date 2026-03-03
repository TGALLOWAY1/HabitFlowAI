import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { createCategory } from '../../repositories/categoryRepository';
import { createHabit } from '../../repositories/habitRepository';
import { createGoal } from '../../repositories/goalRepository';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { createHabitEntryRoute, deleteHabitEntryByKeyRoute } from '../habitEntries';
import { getDayView } from '../dayView';
import { getDaySummary } from '../daySummary';
import { getProgressOverview } from '../progress';
import { getGoalsWithProgress, getGoalProgress } from '../goals';
import { requestContextMiddleware } from '../../middleware/requestContext';

const TEST_USER_ID = 'test-user-entries-only-invariants';

type Snapshot = {
  dayViewHabit: any;
  daySummaryLog: any;
  overviewHabit: any;
  goalsWithProgressRow: any;
  goalProgress: any;
};

let app: Express;
let habitId: string;
let goalId: string;

function getTodayDayKeyUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchSnapshot(dayKey: string): Promise<Snapshot> {
  const [dayViewResponse, daySummaryResponse, progressResponse, goalsResponse, goalProgressResponse] = await Promise.all([
    request(app).get('/api/dayView').query({ dayKey, timeZone: 'UTC' }),
    request(app).get('/api/daySummary').query({ startDayKey: dayKey, endDayKey: dayKey, timeZone: 'UTC' }),
    request(app).get('/api/progress/overview').query({ timeZone: 'UTC' }),
    request(app).get('/api/goals-with-progress').query({ timeZone: 'UTC' }),
    request(app).get(`/api/goals/${goalId}/progress`).query({ timeZone: 'UTC' }),
  ]);

  expect(dayViewResponse.status).toBe(200);
  expect(daySummaryResponse.status).toBe(200);
  expect(progressResponse.status).toBe(200);
  expect(goalsResponse.status).toBe(200);
  expect(goalProgressResponse.status).toBe(200);

  const dayViewHabit = dayViewResponse.body.habits.find((row: any) => row.habit.id === habitId);
  const overviewHabit = progressResponse.body.habitsToday.find((row: any) => row.habit.id === habitId);
  const goalsWithProgressRow = goalsResponse.body.goals.find((row: any) => row.goal.id === goalId);
  const daySummaryLog = daySummaryResponse.body.logs[`${habitId}-${dayKey}`];

  expect(dayViewHabit).toBeDefined();
  expect(overviewHabit).toBeDefined();
  expect(goalsWithProgressRow).toBeDefined();

  return {
    dayViewHabit,
    daySummaryLog,
    overviewHabit,
    goalsWithProgressRow,
    goalProgress: goalProgressResponse.body.progress,
  };
}

async function createTodayEntry(dayKey: string): Promise<void> {
  const response = await request(app).post('/api/entries').send({
    habitId,
    dayKey,
    value: 1,
    source: 'manual',
    timeZone: 'UTC',
  });

  expect(response.status).toBe(201);
}

describe('Entries-only invariants across derived reads', () => {
  beforeAll(async () => {
    await setupTestMongo();
    process.env.LEGACY_DAYLOG_READS = 'false';

    app = express();
    app.use(express.json());
    app.use(requestContextMiddleware);
    app.use((req, _res, next) => {
      (req as any).userId = TEST_USER_ID;
      next();
    });

    app.post('/api/entries', createHabitEntryRoute);
    app.delete('/api/entries/key', deleteHabitEntryByKeyRoute);
    app.get('/api/dayView', getDayView);
    app.get('/api/daySummary', getDaySummary);
    app.get('/api/progress/overview', getProgressOverview);
    app.get('/api/goals-with-progress', getGoalsWithProgress);
    app.get('/api/goals/:id/progress', getGoalProgress);
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    process.env.LEGACY_DAYLOG_READS = 'false';

    const db = await getTestDb();
    await Promise.all([
      db.collection('categories').deleteMany({ userId: TEST_USER_ID }),
      db.collection('habits').deleteMany({ userId: TEST_USER_ID }),
      db.collection('habitEntries').deleteMany({ userId: TEST_USER_ID }),
      db.collection('dayLogs').deleteMany({ userId: TEST_USER_ID }),
      db.collection('goals').deleteMany({ userId: TEST_USER_ID }),
      db.collection('goalManualLogs').deleteMany({ userId: TEST_USER_ID }),
    ]);

    const category = await createCategory(
      {
        name: 'Invariant Category',
        color: '#0A84FF',
      },
      TEST_USER_ID
    );

    const habit = await createHabit(
      {
        name: 'Invariant Habit',
        categoryId: category.id,
        goal: {
          type: 'boolean',
          frequency: 'daily',
          target: 1,
        },
      },
      TEST_USER_ID
    );

    habitId = habit.id;

    const goal = await createGoal(
      {
        title: 'Invariant Goal',
        type: 'frequency',
        targetValue: 1,
        linkedHabitIds: [habit.id],
        aggregationMode: 'count',
        countMode: 'distinctDays',
      },
      TEST_USER_ID
    );

    goalId = goal.id;
  });

  it('no entries -> habit is incomplete and no streak/progress increments', async () => {
    const todayDayKey = getTodayDayKeyUtc();
    const snapshot = await fetchSnapshot(todayDayKey);

    expect(snapshot.dayViewHabit.isComplete).toBe(false);
    expect(snapshot.daySummaryLog).toBeUndefined();
    expect(snapshot.overviewHabit.completed).toBe(false);
    expect(snapshot.overviewHabit.currentStreak).toBe(0);
    expect(snapshot.goalsWithProgressRow.progress.currentValue).toBe(0);
    expect(snapshot.goalsWithProgressRow.progress.percent).toBe(0);
    expect(snapshot.goalProgress.currentValue).toBe(0);
    expect(snapshot.goalProgress.percent).toBe(0);
  });

  it('create entry -> day view, summary, overview, and goal progress agree on completion', async () => {
    const todayDayKey = getTodayDayKeyUtc();
    await createTodayEntry(todayDayKey);

    const snapshot = await fetchSnapshot(todayDayKey);

    expect(snapshot.dayViewHabit.isComplete).toBe(true);
    expect(snapshot.daySummaryLog).toEqual(
      expect.objectContaining({
        completed: true,
      })
    );
    expect(snapshot.overviewHabit.completed).toBe(true);
    expect(snapshot.overviewHabit.currentStreak).toBeGreaterThanOrEqual(1);
    expect(snapshot.goalsWithProgressRow.progress.currentValue).toBe(1);
    expect(snapshot.goalsWithProgressRow.progress.percent).toBe(100);
    expect(snapshot.goalProgress.currentValue).toBe(1);
    expect(snapshot.goalProgress.percent).toBe(100);
  });

  it('delete entry -> derived completion/progress recomputes back to incomplete', async () => {
    const todayDayKey = getTodayDayKeyUtc();
    await createTodayEntry(todayDayKey);

    const deleteResponse = await request(app)
      .delete('/api/entries/key')
      .query({ habitId, dateKey: todayDayKey });

    expect(deleteResponse.status).toBe(200);

    const snapshot = await fetchSnapshot(todayDayKey);

    expect(snapshot.dayViewHabit.isComplete).toBe(false);
    expect(snapshot.daySummaryLog).toBeUndefined();
    expect(snapshot.overviewHabit.completed).toBe(false);
    expect(snapshot.overviewHabit.currentStreak).toBe(0);
    expect(snapshot.goalsWithProgressRow.progress.currentValue).toBe(0);
    expect(snapshot.goalsWithProgressRow.progress.percent).toBe(0);
    expect(snapshot.goalProgress.currentValue).toBe(0);
    expect(snapshot.goalProgress.percent).toBe(0);
  });
});
