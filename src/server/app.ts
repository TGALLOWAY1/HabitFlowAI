/**
 * Express app factory. Used by server entry (index.ts) and tests.
 * Dev-only routes (/api/debug/*, /api/dev/*) are only registered when NODE_ENV !== 'production'.
 */

import express from 'express';
import type { Express, Request, Response } from 'express';
import { getCategories, createCategoryRoute, getCategory, updateCategoryRoute, deleteCategoryRoute, reorderCategoriesRoute } from './routes/categories';
import { getHabits, createHabitRoute, getHabit, updateHabitRoute, deleteHabitRoute, reorderHabitsRoute } from './routes/habits';
import { getDaySummary } from './routes/daySummary';
import { getWellbeingLogs, upsertWellbeingLogRoute, getWellbeingLogRoute, deleteWellbeingLogRoute } from './routes/wellbeingLogs';
import { getWellbeingEntriesRoute, upsertWellbeingEntriesRoute, deleteWellbeingEntryRoute } from './routes/wellbeingEntries';
import { seedDemoEmotionalWellbeingRoute, resetDemoEmotionalWellbeingRoute } from './routes/devDemoEmotionalWellbeing';
import { getRoutinesRoute, getRoutineRoute, createRoutineRoute, updateRoutineRoute, deleteRoutineRoute, submitRoutineRoute, uploadRoutineImageRoute, uploadRoutineImageMiddleware, getRoutineImageRoute, deleteRoutineImageRoute } from './routes/routines';
import { getRoutineLogs } from './routes/routineLogs';
import { getGoals, getGoal, getGoalProgress, getGoalsWithProgress, getCompletedGoals, createGoalRoute, updateGoalRoute, deleteGoalRoute, reorderGoalsRoute, getGoalDetailRoute, uploadGoalBadgeRoute, uploadBadgeMiddleware } from './routes/goals';
import { getProgressOverview } from './routes/progress';
import { getIntegrityReport } from './routes/admin';
import { getEntriesRoute, createEntryRoute, upsertEntryByKeyRoute, getEntryRoute, updateEntryRoute, deleteEntryRoute } from './routes/journal';
import { getTasksRoute, createTaskRoute, updateTaskRoute, deleteTaskRoute } from './routes/tasks';
import { getDashboardPrefsRoute, updateDashboardPrefsRoute } from './routes/dashboardPrefs';
import { getAuthMe } from './routes/auth';
import householdUsersRouter from './routes/householdUsers';
import { identityMiddleware } from './middleware/identity';
import { noPersonaInHabitEntryRequests } from './middleware/noPersonaInHabitEntryRequests';
import { requestContextMiddleware } from './middleware/requestContext';
import {
  getHabitEntriesRoute,
  createHabitEntryRoute,
  deleteHabitEntryRoute,
  updateHabitEntryRoute,
  deleteHabitEntriesForDayRoute,
  upsertHabitEntryRoute,
  deleteHabitEntryByKeyRoute,
  batchCreateEntriesRoute,
} from './routes/habitEntries';
import { getDayView } from './routes/dayView';
import habitPotentialEvidenceRoutes from './routes/habitPotentialEvidence';

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/uploads', express.static('public/uploads'));

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id, X-Household-Id');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(identityMiddleware);
  app.use(noPersonaInHabitEntryRequests);

  app.get('/api/auth/me', getAuthMe);
  app.use('/api/household', householdUsersRouter);
  app.get('/api/categories', getCategories);
  app.post('/api/categories', createCategoryRoute);
  app.patch('/api/categories/reorder', reorderCategoriesRoute);
  app.get('/api/categories/:id', getCategory);
  app.patch('/api/categories/:id', updateCategoryRoute);
  app.delete('/api/categories/:id', deleteCategoryRoute);
  app.get('/api/habits', getHabits);
  app.post('/api/habits', createHabitRoute);
  app.patch('/api/habits/reorder', reorderHabitsRoute);
  app.get('/api/habits/:id', getHabit);
  app.patch('/api/habits/:id', updateHabitRoute);
  app.delete('/api/habits/:id', deleteHabitRoute);
  app.get('/api/daySummary', getDaySummary);
  app.get('/api/wellbeingLogs', getWellbeingLogs);
  app.post('/api/wellbeingLogs', upsertWellbeingLogRoute);
  app.put('/api/wellbeingLogs', upsertWellbeingLogRoute);
  app.get('/api/wellbeingLogs/:date', getWellbeingLogRoute);
  app.delete('/api/wellbeingLogs/:date', deleteWellbeingLogRoute);
  app.get('/api/wellbeingEntries', getWellbeingEntriesRoute);
  app.post('/api/wellbeingEntries', upsertWellbeingEntriesRoute);
  app.delete('/api/wellbeingEntries/:id', deleteWellbeingEntryRoute);

  if (process.env.NODE_ENV !== 'production') {
    app.post('/api/dev/seedDemoEmotionalWellbeing', seedDemoEmotionalWellbeingRoute);
    app.post('/api/dev/resetDemoEmotionalWellbeing', resetDemoEmotionalWellbeingRoute);
  }

  app.get('/api/routines', getRoutinesRoute);
  app.post('/api/routines', createRoutineRoute);
  app.post('/api/routines/:routineId/image', uploadRoutineImageMiddleware, uploadRoutineImageRoute);
  app.get('/api/routines/:routineId/image', getRoutineImageRoute);
  app.delete('/api/routines/:routineId/image', deleteRoutineImageRoute);
  app.get('/api/routines/:id', getRoutineRoute);
  app.patch('/api/routines/:id', updateRoutineRoute);
  app.delete('/api/routines/:id', deleteRoutineRoute);
  app.post('/api/routines/:id/submit', submitRoutineRoute);
  app.get('/api/routineLogs', getRoutineLogs);
  app.get('/api/progress/overview', getProgressOverview);
  app.get('/api/journal', getEntriesRoute);
  app.post('/api/journal', createEntryRoute);
  app.put('/api/journal/byKey', upsertEntryByKeyRoute);
  app.get('/api/journal/:id', getEntryRoute);
  app.patch('/api/journal/:id', updateEntryRoute);
  app.delete('/api/journal/:id', deleteEntryRoute);
  app.get('/api/dashboardPrefs', getDashboardPrefsRoute);
  app.put('/api/dashboardPrefs', updateDashboardPrefsRoute);
  app.get('/api/goals', getGoals);
  app.get('/api/goals/completed', getCompletedGoals);
  app.get('/api/goals-with-progress', getGoalsWithProgress);
  app.post('/api/goals', createGoalRoute);
  app.patch('/api/goals/reorder', reorderGoalsRoute);
  app.get('/api/goals/:id/progress', getGoalProgress);
  app.get('/api/goals/:id/detail', getGoalDetailRoute);
  app.post('/api/goals/:id/badge', uploadBadgeMiddleware, uploadGoalBadgeRoute);
  app.get('/api/goals/:id', getGoal);
  app.put('/api/goals/:id', updateGoalRoute);
  app.delete('/api/goals/:id', deleteGoalRoute);
  app.get('/api/tasks', getTasksRoute);
  app.post('/api/tasks', createTaskRoute);
  app.patch('/api/tasks/:id', updateTaskRoute);
  app.delete('/api/tasks/:id', deleteTaskRoute);
  app.get('/api/entries', getHabitEntriesRoute);
  app.post('/api/entries/batch', batchCreateEntriesRoute);
  app.post('/api/entries', createHabitEntryRoute);
  app.put('/api/entries', upsertHabitEntryRoute);
  app.delete('/api/entries/key', deleteHabitEntryByKeyRoute);
  app.delete('/api/entries', deleteHabitEntriesForDayRoute);
  app.delete('/api/entries/:id', deleteHabitEntryRoute);
  app.patch('/api/entries/:id', updateHabitEntryRoute);
  app.get('/api/dayView', getDayView);
  app.use('/api/evidence', habitPotentialEvidenceRoutes);
  app.get('/api/admin/integrity-report', getIntegrityReport);
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  if (process.env.NODE_ENV !== 'production') {
    app.get('/api/debug/whoami', (req: Request, res: Response) => {
      const householdId = (req as any).householdId ?? '(not set)';
      const userId = (req as any).userId ?? '(not set)';
      res.json({
        householdId,
        userId,
        identitySource: req.headers['x-household-id'] && req.headers['x-user-id'] ? 'headers' : 'fallback',
        dbName: process.env.MONGODB_DB_NAME ?? '(unset)',
        nodeEnv: process.env.NODE_ENV ?? '(unset)',
        mongoUriPresent: !!process.env.MONGODB_URI,
        timestamp: new Date().toISOString(),
      });
    });
  }

  return app;
}
