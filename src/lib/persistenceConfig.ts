/**
 * Persistence Configuration
 * 
 * The app runs in Mongo-only mode. All persistent data
 * (categories, habits, logs, wellbeingLogs) is stored in MongoDB via the backend API.
 * 
 * localStorage-based persistence is no longer supported.
 */

/**
 * MongoDB persistence enabled flag.
 * 
 * When true: Uses REST API endpoints (persistenceClient.ts) to store data in MongoDB.
 * When false: Disables persistence (useful for special dev/testing scenarios).
 * 
 * Set VITE_USE_MONGO_PERSISTENCE=false in .env to disable (defaults to true).
 * 
 * In normal usage, this should be true.
 */
export const MONGO_ENABLED = import.meta.env.VITE_USE_MONGO_PERSISTENCE !== 'false';

/**
 * Check if MongoDB persistence is enabled.
 * 
 * NOTE: This is effectively 'isMongoEnabled' now; Mongo is the only persistence mode.
 * The name 'isMongoPrimary' is kept for backward compatibility.
 * 
 * @returns boolean - True if MongoDB persistence is enabled
 */
export function isMongoPrimary(): boolean {
  return MONGO_ENABLED;
}

/**
 * API base URL for persistence requests.
 * 
 * Defaults to '/api' (relative path).
 * Can be overridden with VITE_API_BASE_URL environment variable.
 * 
 * Examples:
 * - '/api' (relative, same origin)
 * - 'http://localhost:3000/api' (absolute, development)
 * - 'https://api.example.com' (absolute, production)
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Get the API base URL.
 * 
 * @returns string - API base URL
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
