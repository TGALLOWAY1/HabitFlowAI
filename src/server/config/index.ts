/**
 * Server Configuration
 * 
 * Centralized configuration for server-side features and feature flags.
 */

/**
 * Feature flag to enable MongoDB persistence.
 * 
 * Set USE_MONGO_PERSISTENCE=true in .env to enable MongoDB-backed persistence.
 * When false, repository functions will throw "not implemented" errors.
 * 
 * Uses a function to read dynamically for test compatibility.
 */
export function getUseMongoPersistence(): boolean {
  return process.env.USE_MONGO_PERSISTENCE === 'true';
}

// Export as constant for backward compatibility (reads at import time)
// For tests, use getUseMongoPersistence() or set env var before importing
export const USE_MONGO_PERSISTENCE = getUseMongoPersistence();

/**
 * Get feature flag value with optional default.
 * 
 * @param key - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns Boolean value of the feature flag
 */
export function getFeatureFlag(key: string, defaultValue: boolean = false): boolean {
  return process.env[key] === 'true' || (process.env[key] === undefined && defaultValue);
}

