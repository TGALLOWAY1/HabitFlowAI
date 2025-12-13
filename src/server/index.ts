/**
 * Express Server Entry Point
 * 
 * Starts the Express server to handle API routes for MongoDB persistence.
 */

import express from 'express';
import type { Express } from 'express';
import './config/env'; // Load environment variables first
import { assertMongoEnabled } from './config';
import { getCategories, createCategoryRoute, getCategory, updateCategoryRoute, deleteCategoryRoute, reorderCategoriesRoute } from './routes/categories';
import { getHabits, createHabitRoute, getHabit, updateHabitRoute, deleteHabitRoute, reorderHabitsRoute } from './routes/habits';
import { getDayLogs, upsertDayLogRoute, getDayLogRoute, deleteDayLogRoute } from './routes/dayLogs';
import { getWellbeingLogs, upsertWellbeingLogRoute, getWellbeingLogRoute, deleteWellbeingLogRoute } from './routes/wellbeingLogs';
import { getRoutinesRoute, getRoutineRoute, createRoutineRoute, updateRoutineRoute, deleteRoutineRoute, submitRoutineRoute, uploadRoutineImageRoute, uploadRoutineImageMiddleware } from './routes/routines';
import { getRoutineLogs } from './routes/routineLogs';
import { getGoals, getGoal, getGoalProgress, getGoalsWithProgress, getCompletedGoals, createGoalRoute, updateGoalRoute, deleteGoalRoute, createGoalManualLogRoute, getGoalManualLogsRoute, getGoalDetailRoute, uploadGoalBadgeRoute, uploadBadgeMiddleware } from './routes/goals';
import { getProgressOverview } from './routes/progress';
import { getEntriesRoute, createEntryRoute, getEntryRoute, updateEntryRoute, deleteEntryRoute } from './routes/journal';
import { getTasksRoute, createTaskRoute, updateTaskRoute, deleteTaskRoute } from './routes/tasks';
import { closeConnection } from './lib/mongoClient';

// Assert MongoDB is enabled at startup (fail fast if misconfigured)
assertMongoEnabled();

const app: Express = express();
const PORT = process.env.PORT || 3000;

import { userIdMiddleware } from './middleware/auth';

// Middleware
app.use(express.json());

// Serve static files from public directory (for uploaded images)
app.use('/uploads', express.static('public/uploads'));

// CORS middleware (for development)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

// Authentication Middleware
app.use(userIdMiddleware);

// API Routes
// Note: Specific routes (like /reorder) must come before parameterized routes (like /:id)

// Category routes
app.get('/api/categories', getCategories);
app.post('/api/categories', createCategoryRoute);
app.patch('/api/categories/reorder', reorderCategoriesRoute);
app.get('/api/categories/:id', getCategory);
app.patch('/api/categories/:id', updateCategoryRoute);
app.delete('/api/categories/:id', deleteCategoryRoute);

// Habit routes
app.get('/api/habits', getHabits);
app.post('/api/habits', createHabitRoute);
app.patch('/api/habits/reorder', reorderHabitsRoute);
app.get('/api/habits/:id', getHabit);
app.patch('/api/habits/:id', updateHabitRoute);
app.delete('/api/habits/:id', deleteHabitRoute);


// DayLog routes (habit tracking results)
app.get('/api/dayLogs', getDayLogs);
app.post('/api/dayLogs', upsertDayLogRoute);
app.put('/api/dayLogs', upsertDayLogRoute);
app.get('/api/dayLogs/:habitId/:date', getDayLogRoute);
app.delete('/api/dayLogs/:habitId/:date', deleteDayLogRoute);

// WellbeingLog routes
app.get('/api/wellbeingLogs', getWellbeingLogs);
app.post('/api/wellbeingLogs', upsertWellbeingLogRoute);
app.put('/api/wellbeingLogs', upsertWellbeingLogRoute);
app.get('/api/wellbeingLogs/:date', getWellbeingLogRoute);
app.delete('/api/wellbeingLogs/:date', deleteWellbeingLogRoute);

// Routine routes
app.get('/api/routines', getRoutinesRoute);
app.post('/api/routines', createRoutineRoute);
// Upload route (must come before /:id)
app.post('/api/upload/routine-image', uploadRoutineImageMiddleware, uploadRoutineImageRoute);
app.get('/api/routines/:id', getRoutineRoute);
app.patch('/api/routines/:id', updateRoutineRoute);
app.delete('/api/routines/:id', deleteRoutineRoute);
app.post('/api/routines/:id/submit', submitRoutineRoute);

// Routine Log routes
app.get('/api/routineLogs', getRoutineLogs);

// Progress routes
app.get('/api/progress/overview', getProgressOverview);

// Journal routes
app.get('/api/journal', getEntriesRoute);
app.post('/api/journal', createEntryRoute);
app.get('/api/journal/:id', getEntryRoute);
app.patch('/api/journal/:id', updateEntryRoute);
app.delete('/api/journal/:id', deleteEntryRoute);

// Goal routes
app.get('/api/goals', getGoals);
app.get('/api/goals/completed', getCompletedGoals);
app.get('/api/goals-with-progress', getGoalsWithProgress);
app.post('/api/goals', createGoalRoute);
app.get('/api/goals/:id/progress', getGoalProgress);
app.get('/api/goals/:id/detail', getGoalDetailRoute);
// Badge upload route (must come before /goals/:id to match first)
app.post('/api/goals/:id/badge', uploadBadgeMiddleware, uploadGoalBadgeRoute);
// Manual log routes (must come before /goals/:id to match first)
app.post('/api/goals/:id/manual-logs', createGoalManualLogRoute);
app.get('/api/goals/:id/manual-logs', getGoalManualLogsRoute);
app.get('/api/goals/:id', getGoal);
app.put('/api/goals/:id', updateGoalRoute);
app.delete('/api/goals/:id', deleteGoalRoute);

// Task routes
app.get('/api/tasks', getTasksRoute);
app.post('/api/tasks', createTaskRoute);
app.patch('/api/tasks/:id', updateTaskRoute);
app.delete('/api/tasks/:id', deleteTaskRoute);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`💾 MongoDB persistence: ENABLED (required)`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    await closeConnection();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(async () => {
    await closeConnection();
    process.exit(0);
  });
});

export default app;

