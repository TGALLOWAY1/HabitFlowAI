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
 * MongoDB is required for this app. In normal usage, this should always be true.
 * Set VITE_USE_MONGO_PERSISTENCE=false in .env only for special dev/testing scenarios.
 * 
 * @default true (if env var is not set)
 */
export const MONGO_ENABLED = import.meta.env.VITE_USE_MONGO_PERSISTENCE !== 'false';

/**
 * Check if MongoDB persistence is enabled.
 * 
 * NOTE: Mongo is the only persistence mode. This function always returns true in normal usage.
 * 
 * @returns boolean - True if MongoDB persistence is enabled
 */
export function isMongoEnabled(): boolean {
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
