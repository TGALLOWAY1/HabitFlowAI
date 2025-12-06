/**
 * Server Configuration
 * 
 * Centralized configuration for server-side features and feature flags.
 */

/**
 * MongoDB persistence enabled flag.
 * 
 * MongoDB is required for this app. If this is false, we treat it as a misconfiguration.
 * Set USE_MONGO_PERSISTENCE=true in .env (or omit it, defaults to true).
 * 
 * Uses a function to read dynamically for test compatibility.
 */
export function getMongoEnabled(): boolean {
  return process.env.USE_MONGO_PERSISTENCE !== 'false';
}

// Export as constant for convenience (reads at import time)
// For tests, use getMongoEnabled() or set env var before importing
export const MONGO_ENABLED = getMongoEnabled();

/**
 * Assert that MongoDB persistence is enabled.
 * 
 * Call this once at startup to fail fast if MongoDB is misconfigured.
 * 
 * @throws Error if MongoDB persistence is not enabled
 */
export function assertMongoEnabled(): void {
  if (!MONGO_ENABLED) {
    throw new Error(
      'MongoDB persistence is required for this app. Set USE_MONGO_PERSISTENCE=true or remove it (defaults to true).'
    );
  }
}

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

