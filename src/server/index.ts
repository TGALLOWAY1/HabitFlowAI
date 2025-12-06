/**
 * Express Server Entry Point
 * 
 * Starts the Express server to handle API routes for MongoDB persistence.
 */

import express, { Express } from 'express';
import './config/env'; // Load environment variables first
import { getCategories, createCategoryRoute, getCategory, updateCategoryRoute, deleteCategoryRoute, reorderCategoriesRoute } from './routes/categories';
import { closeConnection } from './lib/mongoClient';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// CORS middleware (for development)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// Temporary: Add userId to request (simulating auth middleware)
// TODO: Replace with actual authentication middleware
app.use((req, res, next) => {
  (req as any).userId = 'anonymous-user'; // Default user ID until auth is implemented
  next();
});

// API Routes
// Note: Specific routes (like /reorder) must come before parameterized routes (like /:id)
app.get('/api/categories', getCategories);
app.post('/api/categories', createCategoryRoute);
app.patch('/api/categories/reorder', reorderCategoriesRoute);
app.get('/api/categories/:id', getCategory);
app.patch('/api/categories/:id', updateCategoryRoute);
app.delete('/api/categories/:id', deleteCategoryRoute);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`💾 MongoDB persistence: ${process.env.USE_MONGO_PERSISTENCE === 'true' ? 'ENABLED' : 'DISABLED'}`);
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

