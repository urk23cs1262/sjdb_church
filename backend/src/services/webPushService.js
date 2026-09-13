const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');

let activeVapidPublicKey = process.env.VAPID_PUBLIC_KEY;
let activeVapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:stjdbchurch@gmail.com';

if (activeVapidPublicKey && activeVapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidEmail, activeVapidPublicKey, activeVapidPrivateKey);
  } catch (err) {
    console.warn('[WebPush Service] Provided VAPID keys were invalid, generating dynamic pair:', err.message);
    const generated = webpush.generateVAPIDKeys();
    activeVapidPublicKey = generated.publicKey;
    activeVapidPrivateKey = generated.privateKey;
    webpush.setVapidDetails(vapidEmail, activeVapidPublicKey, activeVapidPrivateKey);
  }
} else {
  // Generate dynamic keys for development / fallback without hardcoding private secrets in source
  const generated = webpush.generateVAPIDKeys();
  activeVapidPublicKey = generated.publicKey;
  activeVapidPrivateKey = generated.privateKey;
  webpush.setVapidDetails(vapidEmail, activeVapidPublicKey, activeVapidPrivateKey);
  console.log('[WebPush Service] Generated dynamic VAPID Public Key for current session:', activeVapidPublicKey);
}

function getVapidPublicKey() {
  return activeVapidPublicKey;
}

/**
 * Save or update a user's browser push subscription
 */
async function saveSubscription({ userId, subscription, userAgent = '' }) {
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    throw new Error('Invalid subscription object');
  }

  const { endpoint, keys } = subscription;
  const sub = await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      userId: userId || null,
      endpoint,
      keys,
      userAgent,
      lastUsedAt: new Date()
    },
    { upsert: true, new: true }
  );

  return sub;
}

/**
 * Remove an invalid/unsubscribed push subscription endpoint
 */
async function removeSubscription(endpoint) {
  await PushSubscription.deleteOne({ endpoint });
}

/**
 * Dispatch a push notification to a specific user
 */
async function sendPushToUser(userId, payload) {
  try {
    const user = await User.findById(userId).select('settings');
    if (user && user.settings?.notifications?.push === false) {
      return { success: false, reason: 'Push disabled by user setting' };
    }

    const subscriptions = await PushSubscription.find({ userId }).lean();
    if (!subscriptions.length) {
      return { success: false, reason: 'No push subscriptions found' };
    }

    const jsonPayload = JSON.stringify(payload);
    let sentCount = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys
          },
          jsonPayload,
          {
            TTL: 86400, // 24 hours
            urgency: 'high'
          }
        );
        sentCount++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription expired or unsubscribed
          await removeSubscription(sub.endpoint);
        } else {
          console.warn(`[WebPush] Push failed for endpoint ${sub.endpoint.slice(0, 30)}...:`, err.message);
        }
      }
    }

    return { success: sentCount > 0, sentCount };
  } catch (err) {
    console.error('[WebPush] Error sending push to user:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Broadcast a push notification to all subscribed users/devices
 */
async function sendPushBroadcast(payload) {
  try {
    const subscriptions = await PushSubscription.find({}).lean();
    if (!subscriptions.length) {
      return { success: false, reason: 'No active push subscriptions' };
    }

    const jsonPayload = JSON.stringify(payload);
    let sentCount = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys
          },
          jsonPayload,
          {
            TTL: 86400,
            urgency: 'high'
          }
        );
        sentCount++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await removeSubscription(sub.endpoint);
        }
      }
    }

    return { success: sentCount > 0, sentCount, total: subscriptions.length };
  } catch (err) {
    console.error('[WebPush] Error broadcasting push:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Dispatch an immediate push notification to all administrator devices
 */
async function sendPushToAdmins(payload) {
  try {
    const adminUsers = await User.find({ role: 'admin' }).select('_id');
    const adminIds = adminUsers.map(u => u._id);
    if (!adminIds.length) return { success: false, reason: 'No admin accounts' };

    const subscriptions = await PushSubscription.find({ userId: { $in: adminIds } }).lean();
    if (!subscriptions.length) {
      return { success: false, reason: 'No active push subscriptions for admins' };
    }

    const jsonPayload = JSON.stringify(payload);
    let sentCount = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys
          },
          jsonPayload,
          {
            TTL: 86400,
            urgency: 'high'
          }
        );
        sentCount++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await removeSubscription(sub.endpoint);
        } else {
          console.warn(`[WebPush] Admin push failed for endpoint:`, err.message);
        }
      }
    }

    return { success: sentCount > 0, sentCount, total: subscriptions.length };
  } catch (err) {
    console.error('[WebPush] Error sending push to admins:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  sendPushToUser,
  sendPushBroadcast,
  sendPushToAdmins
};

