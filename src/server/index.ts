/**
 * Express Server Entry Point
 *
 * Starts the Express server to handle API routes for MongoDB persistence.
 * Dev-only routes (/api/debug/*, /api/dev/*) are not registered when NODE_ENV === 'production'.
 */

import './config/env'; // Load environment variables first
import { assertMongoEnabled } from './config';
import { createApp } from './app';
import { closeConnection } from './lib/mongoClient';

assertMongoEnabled();

const app = createApp();
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`💾 MongoDB persistence: ENABLED (required)`);
});

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
export { createApp } from './app';
