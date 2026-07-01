import { DEMO_USER_ID } from '../../shared/demo';

export { DEMO_USER_ID };

/**
 * DEMO_MODE_ENABLED env flag.
 *
 * Must be explicitly set to "true" to enable demo seed/reset endpoints.
 * Defaults to false when missing.
 */
export function isDemoModeEnabled(): boolean {
  return process.env.DEMO_MODE_ENABLED === 'true';
}

/**
 * PUBLIC_DEMO_ENABLED env flag.
 *
 * Enables the production-safe, read-only public demo: requests carrying the
 * X-Demo-Mode header are mapped to the fixed demo identity and restricted to
 * read methods. Independent of DEMO_MODE_ENABLED (which is dev-only and
 * writable). Defaults to false when missing.
 */
export function isPublicDemoEnabled(): boolean {
  return process.env.PUBLIC_DEMO_ENABLED === 'true' || process.env.PUBLIC_DEMO_ENABLED === '1';
}

export function assertDemoSeedAllowed(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed/reset endpoints are disabled in production');
  }
  if (!isDemoModeEnabled()) {
    throw new Error('Demo mode is disabled. Set DEMO_MODE_ENABLED=true to enable demo seed/reset endpoints.');
  }
}


