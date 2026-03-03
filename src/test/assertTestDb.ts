/**
 * Hard guard: prevent any test from running against a non-test database.
 *
 * Call this at the top of any integration test that touches MongoDB.
 * If the resolved DB name does not contain "_test" or "test_",
 * the process aborts immediately to prevent data loss.
 */

const TEST_DB_PATTERN = /(_test|test_)/i;

export function assertTestDb(label?: string): void {
  const dbName = process.env.MONGODB_DB_NAME || '';
  if (!TEST_DB_PATTERN.test(dbName)) {
    const msg = [
      '🛑 SAFETY ABORT: Test attempted to use a non-test database!',
      `   MONGODB_DB_NAME = "${dbName}"`,
      `   Expected a name containing "_test" or "test_".`,
      label ? `   Context: ${label}` : '',
      '',
      '   Fix: set process.env.MONGODB_DB_NAME to a test-safe name',
      '   before calling getDb() in your test setup.',
    ].filter(Boolean).join('\n');

    console.error(msg);
    throw new Error(msg);
  }
}
