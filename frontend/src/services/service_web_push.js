import api from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      return reg;
    } catch (err) {
      console.warn('Service worker registration failed:', err.message);
    }
  }
  return null;
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  // If granted, auto-subscribe device to Web Push
  if (permission === 'granted') {
    subscribeToPushNotifications().catch(err => console.warn('Push subscription error:', err.message));
  }

  return permission;
}

export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg) return null;

    // Get VAPID public key from backend
    const vapidRes = await api.get('/notifications/vapid-key');
    const vapidKey = vapidRes.data?.publicKey;

    if (!vapidKey) return null;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const convertedVapidKey = urlBase64ToUint8Array(vapidKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
    }

    if (sub) {
      // Send subscription to backend
      await api.post('/notifications/subscribe-push', {
        subscription: sub.toJSON()
      });
      return sub;
    }
  } catch (err) {
    console.warn('Failed to subscribe to Web Push:', err.message);
  }
  return null;
}

export async function showNativeNotification({
  title,
  body,
  icon = '/favicon.png',
  url = '/notifications',
  notificationId = null,
  tag = null
}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  const targetUrl = url || (notificationId ? `/notifications?notification=${notificationId}` : '/notifications');

  try {
    const options = {
      body,
      icon,
      badge: icon,
      tag: tag || (notificationId ? `sjdb-notif-${notificationId}` : `sjdb-${Date.now()}`),
      data: {
        url: targetUrl,
        notificationId
      },
      renotify: true,
      vibrate: [100, 50, 100]
    };

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title || "St. John de Britto's Church", options);
        return true;
      }
    }

    const n = new Notification(title || "St. John de Britto's Church", options);
    n.onclick = (e) => {
      e.preventDefault();
      window.focus();
      if (targetUrl) window.location.href = targetUrl;
      n.close();
    };
    return true;
  } catch (err) {
    console.warn('Native notification error:', err.message);
    return false;
  }
}
