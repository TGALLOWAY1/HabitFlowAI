/**
 * Browser Web Push client
 *
 * All permission/subscription logic for push reminders lives here. iOS
 * constraints shape this module: Web Push requires iOS 16.4+, the app must be
 * installed to the Home Screen (standalone), and Notification.requestPermission
 * must run inside a user-gesture call stack — so enablePush() is designed to
 * be called directly from an onClick handler.
 */

import {
  getPushPublicKey,
  savePushSubscription,
  deletePushSubscription,
  getLocalTimeZone,
} from './persistenceClient';

export type PushStatus =
  | 'unsupported'   // browser lacks Push API (or iOS Safari outside a PWA install)
  | 'needs-install' // iOS: must Add to Home Screen before push is available
  | 'denied'        // permission hard-denied; only device settings can undo
  | 'enabled'       // permission granted + active subscription on this device
  | 'disabled';     // available but not turned on for this device

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Macintosh; the touch check distinguishes it
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** iOS only exposes Web Push to Home-Screen-installed apps. */
export function needsInstallForPush(): boolean {
  return isIos() && !isStandalone();
}

export async function getPushStatus(): Promise<PushStatus> {
  if (needsInstallForPush()) return 'needs-install';
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'disabled';

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? 'enabled' : 'disabled';
  } catch {
    return 'disabled';
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  // Explicit ArrayBuffer backing so the result satisfies BufferSource
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Request permission, subscribe this device, and register it with the API.
 * MUST be called from a user-gesture handler (iOS requirement) — pass a
 * prefetched VAPID key so Notification.requestPermission() is the first await
 * and the gesture's transient activation is still valid.
 * Throws with a user-presentable message on failure.
 */
export async function enablePush(prefetchedPublicKey?: string): Promise<void> {
  if (needsInstallForPush()) {
    throw new Error('Add HabitFlow to your Home Screen first, then enable reminders from the installed app.');
  }
  if (!isPushSupported()) {
    throw new Error('This browser does not support push notifications.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  let publicKey = prefetchedPublicKey;
  if (!publicKey) {
    const response = await getPushPublicKey();
    if (!response.enabled || !response.publicKey) {
      throw new Error('Push notifications are not enabled on the server.');
    }
    publicKey = response.publicKey;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  await registerSubscription(subscription);
}

/** Unsubscribe this device and remove it from the API. */
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await deletePushSubscription(endpoint);
}

/**
 * Re-register the existing subscription on app open. Refreshes the device's
 * timezone (heals drift when traveling) and lastSeenAt, and is the reliable
 * backstop for push-service endpoint rotation. Never throws.
 */
export async function syncPushSubscription(): Promise<void> {
  try {
    if (!isPushSupported() || Notification.permission !== 'granted') return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await registerSubscription(subscription);
  } catch {
    // Best-effort: sync failures must never affect app startup
  }
}

async function registerSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Push subscription is missing endpoint or keys.');
  }
  await savePushSubscription({
    subscription: {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    },
    timeZone: getLocalTimeZone(),
    userAgent: navigator.userAgent,
  });
}
