/**
 * Express app factory. Used by server entry (index.ts) and tests.
 * Dev-only routes (/api/debug/*, /api/dev/*) are only registered when NODE_ENV !== 'production'.
 */

import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { Express, Request, Response } from 'express';
import { getCategories, createCategoryRoute, getCategory, updateCategoryRoute, deleteCategoryRoute, reorderCategoriesRoute } from './routes/categories';
import { getHabits, createHabitRoute, getHabit, updateHabitRoute, deleteHabitRoute, reorderHabitsRoute, unlinkBundleChildRoute, convertToBundleRoute, archiveHabitRoute, unarchiveHabitRoute } from './routes/habits';
import { getDaySummary } from './routes/daySummary';
import { getWellbeingLogs, upsertWellbeingLogRoute, getWellbeingLogRoute, deleteWellbeingLogRoute } from './routes/wellbeingLogs';
import { getWellbeingEntriesRoute, upsertWellbeingEntriesRoute, deleteWellbeingEntryRoute } from './routes/wellbeingEntries';
import { seedDemoEmotionalWellbeingRoute, resetDemoEmotionalWellbeingRoute } from './routes/devDemoEmotionalWellbeing';
import { getRoutinesRoute, getRoutineRoute, createRoutineRoute, updateRoutineRoute, deleteRoutineRoute, submitRoutineRoute, uploadRoutineImageRoute, uploadRoutineImageMiddleware, getRoutineImageRoute, deleteRoutineImageRoute } from './routes/routines';
import { getRoutineLogs } from './routes/routineLogs';
import { getGoals, getGoal, getGoalProgress, getGoalsWithProgress, getCompletedGoals, createGoalRoute, updateGoalRoute, deleteGoalRoute, reorderGoalsRoute, getGoalDetailRoute, acknowledgeMilestoneRoute } from './routes/goals';
import { getGoalTracks, createGoalTrackRoute, getGoalTrackRoute, updateGoalTrackRoute, deleteGoalTrackRoute, addGoalToTrack, removeGoalFromTrack, reorderTrackGoals, reorderGoalTracksRoute } from './routes/goalTracks';
import { getProgressOverview } from './routes/progress';
import { getIntegrityReport, dedupHabits, recoverHabits, remapOrphanedCategories } from './routes/admin';
import { getEntriesRoute, createEntryRoute, upsertEntryByKeyRoute, getEntryRoute, updateEntryRoute, deleteEntryRoute } from './routes/journal';
import { getTasksRoute, createTaskRoute, updateTaskRoute, deleteTaskRoute } from './routes/tasks';
import { getDashboardPrefsRoute, updateDashboardPrefsRoute } from './routes/dashboardPrefs';
import {
  getAuthMe,
  postInviteRedeem,
  postLogin,
  postLogout,
  postBootstrapAdmin,
} from './routes/auth';
import { postCreateInvite, getInvites, postRevokeInvite } from './routes/adminInvites';
import householdUsersRouter from './routes/householdUsers';
import { identityMiddleware } from './middleware/identity';
import { sessionMiddleware } from './middleware/session';
import { requireAdmin } from './middleware/requireAdmin';
import { noPersonaInHabitEntryRequests } from './middleware/noPersonaInHabitEntryRequests';
import { requestContextMiddleware } from './middleware/requestContext';
import { requestLoggingMiddleware } from './middleware/requestLogging';
import { authRateLimiter, adminInviteRateLimiter, entriesWriteRateLimiter } from './middleware/rateLimitAuth';
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
import {
  getBundleMembershipsRoute,
  createBundleMembershipRoute,
  endBundleMembershipRoute,
  archiveBundleMembershipRoute,
  graduateBundleMembershipRoute,
  deleteBundleMembershipRoute,
} from './routes/bundleMemberships';
import habitPotentialEvidenceRoutes from './routes/habitPotentialEvidence';
import healthRoutes from './routes/health';
import habitHealthRuleRoutes from './routes/habitHealthRules';
import healthSuggestionRoutes from './routes/healthSuggestions';
import { requireHealthFeature } from './middleware/requireHealthFeature';
import { deleteUserData } from './routes/userData';
import { postWeeklySummary } from './routes/aiSummary';
import { postSuggestVariants } from './routes/aiVariantSuggestion';
import { postJournalSummary } from './routes/aiJournalSummary';
import {
  getHabitAnalyticsSummary,
  getHabitAnalyticsHeatmap,
  getHabitAnalyticsTrends,
  getHabitAnalyticsCategoryBreakdown,
  getHabitAnalyticsInsights,
  getAllHabitAnalytics,
  getRoutineAnalyticsSummary,
  getGoalAnalyticsSummary,
} from './routes/analytics';

export function createApp(): Express {
  const app = express();

  // Safe behind a reverse proxy (Vercel → Render/Railway); required for correct client IP and secure cookies
  app.set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestContextMiddleware);
  app.use(requestLoggingMiddleware);
  app.use('/uploads', express.static('public/uploads'));

  app.use((req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const origin = isProduction && process.env.FRONTEND_ORIGIN
      ? process.env.FRONTEND_ORIGIN
      : '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id, X-Household-Id, X-Bootstrap-Key');
    if (origin !== '*') {
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Public health check (no auth); for Render/Railway and proxy smoke tests
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV ?? 'development',
    });
  });

  // Auth routes that do not require identity (rate-limited)
  app.post('/api/auth/invite/redeem', authRateLimiter, postInviteRedeem);
  app.post('/api/auth/login', authRateLimiter, postLogin);
  app.post('/api/auth/bootstrap-admin', authRateLimiter, postBootstrapAdmin);
  app.post('/api/auth/logout', postLogout); // No session required — just clears cookie

  app.use(sessionMiddleware);
  app.use(identityMiddleware);
  app.use(noPersonaInHabitEntryRequests);

  app.get('/api/auth/me', getAuthMe);
  app.delete('/api/user/data', deleteUserData);
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
  app.post('/api/habits/:id/unlink-child', unlinkBundleChildRoute);
  app.post('/api/habits/:id/convert-to-bundle', convertToBundleRoute);
  app.post('/api/habits/:id/archive', archiveHabitRoute);
  app.post('/api/habits/:id/unarchive', unarchiveHabitRoute);

  // Apple Health integration (feature-gated)
  app.use('/api/health', requireHealthFeature, healthRoutes);
  app.use('/api/health/suggestions', requireHealthFeature, healthSuggestionRoutes);
  app.use('/api/habits/:habitId/health-rule', requireHealthFeature, habitHealthRuleRoutes);
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
  app.get('/api/goals/:id', getGoal);
  app.put('/api/goals/:id', updateGoalRoute);
  app.delete('/api/goals/:id', deleteGoalRoute);
  app.post('/api/goals/:id/milestones/:milestoneId/acknowledge', acknowledgeMilestoneRoute);
  app.get('/api/goal-tracks', getGoalTracks);
  app.post('/api/goal-tracks', createGoalTrackRoute);
  app.patch('/api/goal-tracks/reorder', reorderGoalTracksRoute);
  app.get('/api/goal-tracks/:id', getGoalTrackRoute);
  app.put('/api/goal-tracks/:id', updateGoalTrackRoute);
  app.delete('/api/goal-tracks/:id', deleteGoalTrackRoute);
  app.post('/api/goal-tracks/:id/goals', addGoalToTrack);
  app.delete('/api/goal-tracks/:id/goals/:goalId', removeGoalFromTrack);
  app.patch('/api/goal-tracks/:id/goals/reorder', reorderTrackGoals);
  app.get('/api/tasks', getTasksRoute);
  app.post('/api/tasks', createTaskRoute);
  app.patch('/api/tasks/:id', updateTaskRoute);
  app.delete('/api/tasks/:id', deleteTaskRoute);
  app.get('/api/entries', getHabitEntriesRoute);
  app.post('/api/entries/batch', entriesWriteRateLimiter, batchCreateEntriesRoute);
  app.post('/api/entries', entriesWriteRateLimiter, createHabitEntryRoute);
  app.put('/api/entries', entriesWriteRateLimiter, upsertHabitEntryRoute);
  app.delete('/api/entries/key', entriesWriteRateLimiter, deleteHabitEntryByKeyRoute);
  app.delete('/api/entries', entriesWriteRateLimiter, deleteHabitEntriesForDayRoute);
  app.delete('/api/entries/:id', entriesWriteRateLimiter, deleteHabitEntryRoute);
  app.patch('/api/entries/:id', entriesWriteRateLimiter, updateHabitEntryRoute);
  app.get('/api/bundle-memberships', getBundleMembershipsRoute);
  app.post('/api/bundle-memberships', createBundleMembershipRoute);
  app.patch('/api/bundle-memberships/:id/end', endBundleMembershipRoute);
  app.patch('/api/bundle-memberships/:id/archive', archiveBundleMembershipRoute);
  app.patch('/api/bundle-memberships/:id/graduate', graduateBundleMembershipRoute);
  app.delete('/api/bundle-memberships/:id', deleteBundleMembershipRoute);
  app.get('/api/dayView', getDayView);
  app.use('/api/evidence', habitPotentialEvidenceRoutes);
  app.post('/api/ai/weekly-summary', postWeeklySummary);
  app.post('/api/ai/suggest-variants', postSuggestVariants);
  app.post('/api/ai/journal-summary', postJournalSummary);
  app.get('/api/analytics/habits/all', getAllHabitAnalytics);
  app.get('/api/analytics/habits/summary', getHabitAnalyticsSummary);
  app.get('/api/analytics/habits/heatmap', getHabitAnalyticsHeatmap);
  app.get('/api/analytics/habits/trends', getHabitAnalyticsTrends);
  app.get('/api/analytics/habits/category-breakdown', getHabitAnalyticsCategoryBreakdown);
  app.get('/api/analytics/habits/insights', getHabitAnalyticsInsights);
  app.get('/api/analytics/routines/summary', getRoutineAnalyticsSummary);
  app.get('/api/analytics/goals/summary', getGoalAnalyticsSummary);
  app.get('/api/admin/integrity-report', getIntegrityReport);
  app.post('/api/admin/dedup-habits', requireAdmin, dedupHabits);
  app.post('/api/admin/recover-habits', requireAdmin, recoverHabits);
  app.post('/api/admin/remap-categories', requireAdmin, remapOrphanedCategories);
  app.post('/api/admin/invites', adminInviteRateLimiter, requireAdmin, postCreateInvite);
  app.get('/api/admin/invites', adminInviteRateLimiter, requireAdmin, getInvites);
  app.post('/api/admin/invites/:id/revoke', adminInviteRateLimiter, requireAdmin, postRevokeInvite);

  if (process.env.NODE_ENV !== 'production') {
    app.get('/api/debug/whoami', (req: Request, res: Response) => {
      const r = req as import('./middleware/identity').RequestWithIdentity;
      const householdId = r.householdId ?? '(not set)';
      const userId = r.userId ?? '(not set)';
      const identitySource = r.identitySource ?? (householdId !== '(not set)' ? 'session' : 'none');
      res.json({
        householdId,
        userId,
        identitySource,
        dbName: process.env.MONGODB_DB_NAME ?? '(unset)',
        nodeEnv: process.env.NODE_ENV ?? '(unset)',
        mongoUriPresent: !!process.env.MONGODB_URI,
        timestamp: new Date().toISOString(),
      });
    });
  }

  // Error handler: return JSON with error message so crashes are diagnosable
  app.use((err: unknown, _req: Request, res: Response, _next: import('express').NextFunction) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Express error handler]', message, err instanceof Error ? err.stack : '');
    res.status(500).json({ error: message });
  });

  return app;
}
