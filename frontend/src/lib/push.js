/**
 * Browser push helpers (US-156).
 *
 * Everything here degrades quietly: on a browser without Notification or
 * PushManager, `pushSupport()` reports why and the UI explains instead of
 * throwing. Permission is only ever requested from a user gesture.
 */

/** Web Push wants the VAPID key as a Uint8Array, not base64url. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** @returns {{supported: boolean, reason?: string}} */
export function pushSupport() {
  if (typeof window === 'undefined') return { supported: false, reason: 'server' };
  if (!('serviceWorker' in navigator)) {
    return { supported: false, reason: 'This browser does not support service workers.' };
  }
  if (!('PushManager' in window)) {
    return { supported: false, reason: 'This browser does not support push notifications.' };
  }
  if (!('Notification' in window)) {
    return { supported: false, reason: 'This browser does not support notifications.' };
  }
  if (!window.isSecureContext) {
    return { supported: false, reason: 'Push notifications need a secure (https) connection.' };
  }
  return { supported: true };
}

export function permissionState() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/** The push subscription for this browser, if it already has one. */
export async function existingSubscription() {
  const { supported } = pushSupport();
  if (!supported) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function fetchConfig(endpoint) {
  const url = endpoint
    ? `/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`
    : '/api/push/subscribe';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not load notification settings');
  return res.json();
}

/** Server config plus whatever this browser is currently watching. */
export async function loadPushState() {
  const support = pushSupport();
  if (!support.supported) {
    return { ...support, permission: 'unsupported', configured: false, watching: [] };
  }

  const sub = await existingSubscription();
  const config = await fetchConfig(sub?.endpoint);

  return {
    supported: true,
    permission: permissionState(),
    configured: config.configured,
    vapidKey: config.vapid_public_key,
    watching: config.watching || [],
    minSeverity: config.min_severity || 'major',
    endpoint: sub?.endpoint || null,
  };
}

/**
 * Subscribes this browser (requesting permission if needed) and saves the watch
 * list. Must be called from a user gesture.
 *
 * @param {string[]} slugs
 * @param {{vapidKey: string, minSeverity?: string}} opts
 */
export async function subscribeToPush(slugs, { vapidKey, minSeverity = 'major' } = {}) {
  const support = pushSupport();
  if (!support.supported) throw new Error(support.reason);
  if (!vapidKey) throw new Error('Push notifications are not configured on this deployment.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked for this site. Enable them in your browser settings to continue.'
        : 'Notification permission was dismissed.',
    );
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  const raw = sub.toJSON();
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: raw.endpoint,
      keys: raw.keys,
      slugs,
      min_severity: minSeverity,
    }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Could not save your notification settings.');
  return body;
}

/** Drops the server record and this browser's push subscription. */
export async function unsubscribeFromPush() {
  const sub = await existingSubscription();
  if (!sub) return { unsubscribed: true };

  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });

  await sub.unsubscribe();
  return { unsubscribed: true };
}
