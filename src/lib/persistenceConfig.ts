/**
 * Persistence Configuration
 * 
 * Centralized configuration for frontend persistence feature flags.
 */

/**
 * Frontend feature flag to enable MongoDB persistence.
 * 
 * When true: Uses REST API endpoints (persistenceClient.ts)
 * When false: Uses localStorage (existing behavior)
 * 
 * Set VITE_USE_MONGO_PERSISTENCE=true in .env to enable.
 */
export const USE_MONGO_PERSISTENCE = import.meta.env.VITE_USE_MONGO_PERSISTENCE === 'true';

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
 * Check if MongoDB persistence is enabled.
 * 
 * @returns boolean - True if MongoDB persistence is enabled
 */
export function isMongoPersistenceEnabled(): boolean {
  return USE_MONGO_PERSISTENCE;
}

/**
 * Get the API base URL.
 * 
 * @returns string - API base URL
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

