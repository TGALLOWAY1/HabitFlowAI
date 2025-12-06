/**
 * Persistence Configuration
 * 
 * Centralized configuration for frontend persistence feature flags.
 * 
 * See docs/mongo-migration-plan.md for details on persistence modes.
 */

/**
 * Persistence Mode
 * 
 * Defines how the application handles data persistence.
 * 
 * - 'local-only': Pure localStorage persistence (no MongoDB)
 * - 'mongo-migration': Dual-write mode (localStorage + MongoDB) - temporary transition mode
 * - 'mongo-primary': MongoDB as source of truth, localStorage is read-only fallback
 * 
 * See docs/mongo-migration-plan.md for detailed behavior of each mode.
 */
export type PersistenceMode = 'local-only' | 'mongo-migration' | 'mongo-primary';

/**
 * Frontend feature flag to enable MongoDB persistence.
 * 
 * When true: Uses REST API endpoints (persistenceClient.ts)
 * When false: Uses localStorage (existing behavior)
 * 
 * Set VITE_USE_MONGO_PERSISTENCE=true in .env to enable.
 * 
 * @deprecated This flag is being replaced by getPersistenceMode().
 * It is kept for backward compatibility and will be used internally
 * by getPersistenceMode() to determine the mode.
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
 * Get the current persistence mode.
 * 
 * Determines the persistence mode based on environment variables:
 * - If VITE_USE_MONGO_PERSISTENCE is false → 'local-only'
 * - If VITE_PERSISTENCE_MODE is explicitly set → use that value
 * - Otherwise, when Mongo is enabled but no mode specified → default to 'mongo-migration' (backward compatibility)
 * 
 * See docs/mongo-migration-plan.md for detailed behavior of each mode.
 * 
 * @returns PersistenceMode - The current persistence mode
 */
export function getPersistenceMode(): PersistenceMode {
  // If MongoDB is disabled, always use local-only
  if (!USE_MONGO_PERSISTENCE) {
    return 'local-only';
  }

  // If explicit mode is set, use it
  const explicitMode = import.meta.env.VITE_PERSISTENCE_MODE;
  if (explicitMode === 'local-only' || explicitMode === 'mongo-migration' || explicitMode === 'mongo-primary') {
    return explicitMode;
  }

  // Default to mongo-migration when MongoDB is enabled but no mode specified
  // This maintains backward compatibility with existing behavior
  return 'mongo-migration';
}

/**
 * Check if MongoDB persistence is enabled.
 * 
 * @deprecated Use getPersistenceMode() instead for more granular control.
 * This function is kept for backward compatibility.
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

/**
 * Check if the current mode is 'mongo-primary'.
 * 
 * In mongo-primary mode, MongoDB is the source of truth and localStorage
 * is only used as a read-only fallback (if enabled).
 * 
 * See docs/mongo-migration-plan.md for detailed behavior.
 * 
 * @returns boolean - True if mode is 'mongo-primary'
 */
export function isMongoPrimary(): boolean {
  return getPersistenceMode() === 'mongo-primary';
}

/**
 * Check if the current mode is 'mongo-migration'.
 * 
 * In mongo-migration mode, data is dual-written to both localStorage
 * and MongoDB. This is a temporary transition mode.
 * 
 * See docs/mongo-migration-plan.md for detailed behavior.
 * 
 * @returns boolean - True if mode is 'mongo-migration'
 */
export function isMongoMigration(): boolean {
  return getPersistenceMode() === 'mongo-migration';
}

/**
 * Check if the current mode is 'local-only'.
 * 
 * In local-only mode, all data is stored in localStorage only.
 * No MongoDB API calls are made.
 * 
 * See docs/mongo-migration-plan.md for detailed behavior.
 * 
 * @returns boolean - True if mode is 'local-only'
 */
export function isLocalOnly(): boolean {
  return getPersistenceMode() === 'local-only';
}

/**
 * Check if localStorage fallback is allowed when MongoDB fails.
 * 
 * In mongo-primary mode, this controls whether to read from localStorage
 * when MongoDB API calls fail. Defaults to false (strict mode).
 * 
 * Set VITE_ALLOW_LOCALSTORAGE_FALLBACK=true in .env to enable fallback.
 * 
 * See docs/mongo-migration-plan.md for details.
 * 
 * @returns boolean - True if localStorage fallback is allowed
 */
export function allowLocalStorageFallback(): boolean {
  return import.meta.env.VITE_ALLOW_LOCALSTORAGE_FALLBACK === 'true';
}

