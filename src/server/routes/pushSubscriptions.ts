/**
 * Push Subscription Routes
 *
 * REST endpoints for Web Push device subscriptions:
 *   GET    /api/push/public-key     — VAPID public key + feature availability
 *   POST   /api/push/subscriptions  — create/refresh this device's subscription
 *   DELETE /api/push/subscriptions  — remove this device's subscription
 *   POST   /api/push/test           — send a test notification to the caller's devices
 */

import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { getVapidPublicKey } from '../config/env';
import { isPushConfigured, sendPush } from '../lib/webPush';
import { resolveTimeZone } from '../utils/dayKey';
import {
  upsertPushSubscription,
  deletePushSubscriptionByEndpoint,
  disablePushSubscriptionByEndpoint,
  getActivePushSubscriptionsForUser,
} from '../repositories/pushSubscriptionRepository';

function respondPushDisabled(res: Response): void {
  res.status(501).json({
    error: {
      code: 'PUSH_DISABLED',
      message: 'Push notifications are not enabled on this server',
    },
  });
}

function internalError(res: Response, action: string, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Error ${action}:`, errorMessage);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to ${action}`,
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    },
  });
}

/**
 * GET /api/push/public-key
 * Always 200: clients use `enabled` to decide whether to show push UI at all.
 */
export async function getPushPublicKeyRoute(_req: Request, res: Response): Promise<void> {
  const enabled = isPushConfigured();
  res.status(200).json({
    enabled,
    publicKey: enabled ? getVapidPublicKey() : null,
  });
}

/**
 * POST /api/push/subscriptions
 * Body: { subscription: { endpoint, keys: { p256dh, auth } }, timeZone, userAgent? }
 * Idempotent: re-subscribing refreshes keys/timeZone/lastSeenAt.
 */
export async function savePushSubscriptionRoute(req: Request, res: Response): Promise<void> {
  try {
    if (!isPushConfigured()) {
      respondPushDisabled(res);
      return;
    }

    const { subscription, timeZone, userAgent } = req.body ?? {};
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (
      typeof endpoint !== 'string' || endpoint.trim().length === 0 ||
      typeof p256dh !== 'string' || p256dh.trim().length === 0 ||
      typeof auth !== 'string' || auth.trim().length === 0
    ) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'subscription with endpoint and keys (p256dh, auth) is required',
        },
      });
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);

    const saved = await upsertPushSubscription(householdId, userId, {
      endpoint: endpoint.trim(),
      keys: { p256dh, auth },
      // Invalid/missing timezone falls back to the server default rather than 400 —
      // a reminder in the wrong timezone beats a device that can't subscribe.
      timeZone: resolveTimeZone(typeof timeZone === 'string' ? timeZone : undefined),
      userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : undefined,
    });

    res.status(201).json({
      subscription: {
        id: saved.id,
        endpoint: saved.endpoint,
        timeZone: saved.timeZone,
        createdAt: saved.createdAt,
        lastSeenAt: saved.lastSeenAt,
      },
    });
  } catch (error) {
    internalError(res, 'save push subscription', error);
  }
}

/**
 * DELETE /api/push/subscriptions
 * Body: { endpoint } (endpoints are long URLs — body, not path param)
 */
export async function deletePushSubscriptionRoute(req: Request, res: Response): Promise<void> {
  try {
    const { endpoint } = req.body ?? {};
    if (typeof endpoint !== 'string' || endpoint.trim().length === 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'endpoint is required' },
      });
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);
    const deleted = await deletePushSubscriptionByEndpoint(householdId, userId, endpoint.trim());
    res.status(200).json({ deleted });
  } catch (error) {
    internalError(res, 'delete push subscription', error);
  }
}

/**
 * POST /api/push/test
 * Sends a test notification to every active subscription of the caller.
 */
export async function sendTestPushRoute(req: Request, res: Response): Promise<void> {
  try {
    if (!isPushConfigured()) {
      respondPushDisabled(res);
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);
    const subscriptions = await getActivePushSubscriptionsForUser(householdId, userId);

    let sent = 0;
    let gone = 0;
    let errors = 0;

    for (const sub of subscriptions) {
      const result = await sendPush(
        { endpoint: sub.endpoint, keys: sub.keys },
        {
          title: 'HabitFlow',
          body: 'Test notification — habit reminders are working on this device.',
          data: { url: '/?view=tracker' },
        }
      );
      if (result === 'sent') sent += 1;
      else if (result === 'gone') {
        gone += 1;
        await disablePushSubscriptionByEndpoint(householdId, userId, sub.endpoint);
      } else errors += 1;
    }

    res.status(200).json({ sent, gone, errors });
  } catch (error) {
    internalError(res, 'send test push', error);
  }
}
