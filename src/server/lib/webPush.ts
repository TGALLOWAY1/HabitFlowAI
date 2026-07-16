/**
 * Web Push sender
 *
 * Thin wrapper around the web-push library: lazy VAPID initialization from
 * env, and a sendPush() that maps push-service responses to a small result
 * union. Isolated in one module so tests can vi.mock it.
 */

import webpush from 'web-push';
import { getVapidPublicKey, getVapidPrivateKey, getVapidSubject } from '../config/env';
import { getFeatureFlag } from '../config';

let vapidInitialized = false;

/**
 * True when push is switched on AND VAPID keys are configured.
 * Routes return PUSH_DISABLED and the scheduler stays off otherwise.
 */
export function isPushConfigured(): boolean {
  return (
    getFeatureFlag('PUSH_REMINDERS_ENABLED') &&
    getVapidPublicKey().length > 0 &&
    getVapidPrivateKey().length > 0
  );
}

function ensureVapid(): void {
  if (vapidInitialized) return;
  const subject = getVapidSubject() || 'mailto:admin@habitflow.local';
  webpush.setVapidDetails(subject, getVapidPublicKey(), getVapidPrivateKey());
  vapidInitialized = true;
}

export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  /** Coalesces notifications with the same tag on the device. */
  tag?: string;
  data?: { url?: string };
}

export type PushSendResult = 'sent' | 'gone' | 'error';

/**
 * Send one push message. 'gone' means the push service reported the endpoint
 * dead (404/410) and the subscription should be disabled; 'error' is
 * transient (caller may retry).
 */
export async function sendPush(target: PushTarget, payload: PushPayload): Promise<PushSendResult> {
  ensureVapid();
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: target.keys },
      JSON.stringify(payload),
      { TTL: 600, urgency: 'high' }
    );
    return 'sent';
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      return 'gone';
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[WebPush] send failed (status ${statusCode ?? 'n/a'}): ${message}`);
    return 'error';
  }
}
