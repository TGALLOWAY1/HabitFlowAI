/**
 * Demo Mode (frontend helpers)
 *
 * The public demo lets visitors browse the app read-only, without an account,
 * against the seeded demo dataset (see docs/DEMO_ARCHITECTURE.md):
 * - Active mode lives in localStorage (`habitflow_active_user_mode`).
 * - In demo mode, persistenceClient sends `X-Demo-Mode: true` (the server maps
 *   it to the fixed demo identity) and blocks mutating requests client-side.
 *
 * Boot URL params (used by the tour's embedded preview and demo links):
 * - `?demo=1` enters demo mode before the app renders; `?demo=0` exits it.
 * - `?embed=1` marks this window as an embedded preview: navigation uses
 *   replaceState (so the iframe doesn't pollute the parent's history) and the
 *   app listens for `habitflow-demo-navigate` postMessages from the parent.
 */

import { ACTIVE_USER_MODE_STORAGE_KEY, type ActiveUserMode } from '../shared/demo';

/**
 * Embedded previews keep their mode in memory only: persisting it would flip
 * the parent window (which shares localStorage) into demo mode on reload.
 */
let bootModeOverride: ActiveUserMode | null = null;

/** Read boot params and apply demo mode before the app renders. */
export function applyDemoBootParams(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const demo = params.get('demo');
  if (params.get('embed') === '1') {
    if (demo === '1') bootModeOverride = 'demo';
    return;
  }
  if (demo === '1') {
    localStorage.setItem(ACTIVE_USER_MODE_STORAGE_KEY, 'demo');
  } else if (demo === '0') {
    localStorage.setItem(ACTIVE_USER_MODE_STORAGE_KEY, 'real');
  }
}

/** In-memory mode override for embedded previews (null = use localStorage). */
export function getBootModeOverride(): ActiveUserMode | null {
  return bootModeOverride;
}

/** Whether this window is an embedded preview (inside the tour iframe). */
export function isEmbedMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('embed') === '1';
}

/** Enter the read-only public demo and reload into the app. */
export function enterDemoMode(): void {
  localStorage.setItem(ACTIVE_USER_MODE_STORAGE_KEY, 'demo');
  window.location.href = '/?demo=1';
}

/** Leave the demo and land back on the login screen. */
export function exitDemoMode(): void {
  localStorage.setItem(ACTIVE_USER_MODE_STORAGE_KEY, 'real');
  window.location.href = '/?demo=0';
}

/** Message type the tour posts into the embedded preview iframe. */
export interface DemoNavigateMessage {
  type: 'habitflow-demo-navigate';
  route: string;
  params?: Record<string, string>;
}

export function isDemoNavigateMessage(data: unknown): data is DemoNavigateMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'habitflow-demo-navigate' &&
    typeof (data as { route?: unknown }).route === 'string'
  );
}

/** Event fired by persistenceClient when a write is blocked in demo mode. */
export const DEMO_WRITE_BLOCKED_EVENT = 'habitflow:demo-write-blocked';

export const DEMO_READ_ONLY_MESSAGE = 'Demo mode is read-only — create an account to make changes.';
