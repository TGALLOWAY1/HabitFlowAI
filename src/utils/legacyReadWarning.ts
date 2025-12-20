/**
 * Legacy Read Warning Utility
 * 
 * Dev-only warnings for legacy DayLog read paths.
 * Helps identify code that still treats DayLogs as truth.
 */

const WARNINGS_ENABLED = process.env.NODE_ENV === 'development';

/**
 * Warn when DayLogs are being read as truth.
 * 
 * @param context - Context where the warning occurred (e.g., component name, function name)
 * @param details - Additional details about what was being read
 */
export function warnLegacyDayLogRead(context: string, details?: string): void {
  if (!WARNINGS_ENABLED) return;

  const message = `[LEGACY READ WARNING] ${context} is reading DayLogs as truth.${details ? ` ${details}` : ''} Use truthQuery-backed endpoints instead.`;
  console.warn(message, new Error().stack);
}

/**
 * Warn when logs/completion is computed from DayLog state.
 * 
 * @param context - Context where the warning occurred
 */
export function warnLegacyCompletionRead(context: string): void {
  if (!WARNINGS_ENABLED) return;

  const message = `[LEGACY READ WARNING] ${context} is computing completion from DayLog state. Use /api/dayView endpoint instead.`;
  console.warn(message, new Error().stack);
}

/**
 * Warn when goal progress is computed from DayLogs.
 * 
 * @param context - Context where the warning occurred
 */
export function warnLegacyGoalProgressRead(context: string): void {
  if (!WARNINGS_ENABLED) return;

  const message = `[LEGACY READ WARNING] ${context} is computing goal progress from DayLogs. Use /api/goalProgress endpoint instead.`;
  console.warn(message, new Error().stack);
}

