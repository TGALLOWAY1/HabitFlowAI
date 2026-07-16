/**
 * Express Server Entry Point
 *
 * Starts the Express server to handle API routes for MongoDB persistence.
 * Dev-only routes (/api/debug/*, /api/dev/*) are not registered when NODE_ENV === 'production'.
 */

import './config/env'; // Load environment variables first
import { assertMongoEnabled } from './config';
import { isPublicDemoEnabled } from './config/demo';
import { createApp } from './app';
import { closeConnection } from './lib/mongoClient';
import { runStartupMigrations } from './migrations/startup';
import { maybeSeedDemoShowcase } from './demo/seedShowcase';
import { isPushConfigured } from './lib/webPush';
import { startReminderScheduler, type ReminderSchedulerHandle } from './services/reminderScheduler';

assertMongoEnabled();

const app = createApp();
const PORT = process.env.PORT || 3001;

let schedulerHandle: ReminderSchedulerHandle | null = null;

const server = app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`💾 MongoDB persistence: ENABLED (required)`);

  // Run data migrations after server is listening (non-blocking)
  try {
    await runStartupMigrations();
  } catch (err) {
    console.error('Startup migrations failed (non-fatal):', err);
  }

  // Seed/refresh the read-only public demo dataset (non-fatal)
  if (isPublicDemoEnabled()) {
    await maybeSeedDemoShowcase();
  }

  // Web Push reminder scheduler (in-process; requires an always-on instance)
  if (isPushConfigured()) {
    schedulerHandle = startReminderScheduler();
  } else {
    console.log('🔕 Push reminders disabled (PUSH_REMINDERS_ENABLED/VAPID keys not configured)');
  }
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  schedulerHandle?.stop();
  server.close(async () => {
    await closeConnection();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  schedulerHandle?.stop();
  server.close(async () => {
    await closeConnection();
    process.exit(0);
  });
});

export default app;
export { createApp } from './app';
