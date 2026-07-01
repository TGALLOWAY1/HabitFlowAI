/**
 * Demo Mode Constants
 *
 * Shared between client and server (no React / no Node-specific imports).
 */

export const DEMO_USER_ID = 'demo_emotional_wellbeing';

export type ActiveUserMode = 'real' | 'demo';

export const ACTIVE_USER_MODE_STORAGE_KEY = 'habitflow_active_user_mode';

/**
 * Public Demo Mode (production-safe, read-only).
 *
 * Unlike the dev-only DEMO_MODE_ENABLED path above, the public demo lets
 * unauthenticated visitors browse the seeded demo dataset in any environment:
 * - Client: persistenceClient sends `X-Demo-Mode: true` when active mode is 'demo'.
 * - Server: when PUBLIC_DEMO_ENABLED=true, that header maps the request to the
 *   fixed identity { PUBLIC_DEMO_HOUSEHOLD_ID, DEMO_USER_ID } (never an
 *   arbitrary user), and all mutating methods are rejected with
 *   403 { demoReadOnly: true }.
 */
export const PUBLIC_DEMO_HOUSEHOLD_ID = 'demo-household';

/** Request header that opts a request into the public demo identity. */
export const PUBLIC_DEMO_HEADER = 'X-Demo-Mode';


