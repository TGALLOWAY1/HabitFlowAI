/**
 * Environment Configuration
 * 
 * Loads and validates environment variables.
 * Should be imported early in the application lifecycle (before MongoDB connection).
 */

import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env file from project root
dotenv.config({ path: resolve(process.cwd(), '.env') });

/**
 * Validate that required environment variables are set.
 * 
 * @param requiredVars - Array of required environment variable names
 * @throws Error if any required variable is missing
 */
export function validateEnv(requiredVars: string[]): void {
  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Please check your .env file or environment configuration.'
    );
  }
}

/**
 * Get environment variable with optional default value.
 * 
 * @param key - Environment variable name
 * @param defaultValue - Default value if variable is not set
 * @returns Environment variable value or default
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${key} is required but not set`);
    }
    return defaultValue;
  }
  
  return value;
}

// Export commonly used environment variables
// Use getter functions to read from process.env dynamically (for test compatibility)
export function getMongoDbUri(): string {
  return process.env.MONGODB_URI || '';
}

export function getMongoDbName(): string {
  return process.env.MONGODB_DB_NAME || '';
}

// For backward compatibility, also export as constants (but they read from process.env)
// Note: These will be evaluated at import time, so set env vars before importing
export const MONGODB_URI = getMongoDbUri();
export const MONGODB_DB_NAME = getMongoDbName();

