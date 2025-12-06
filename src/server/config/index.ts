/**
 * Server Configuration
 * 
 * Centralized configuration for server-side features and feature flags.
 */

/**
 * Feature flag to enable MongoDB persistence.
 * 
 * MongoDB persistence is required for the app to function. Set USE_MONGO_PERSISTENCE=true in .env.
 * When false, repository functions will throw errors because MongoDB is the only persistence layer.
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

