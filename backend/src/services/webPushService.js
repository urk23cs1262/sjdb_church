const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');

// Default VAPID keys for SJDB Church (persisted unless overridden in .env)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BCKx4J3W2N8U9Xp_ZgY1vQaLrMfOkTiVhDuJeGwKpRtSnL_Xp8W2N7U9Qz_YgV1vBaLrPfOkTiVhDuJeGwKpRtS';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'kPtRnS2W8U9Xp_ZgY1vQaLrMfOkTiVhDuJeGwKpR';
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:parish@sjdbchurch.org';

try {
  webpush.setVapidDetails(
    vapidEmail,
    vapidPublicKey,
    vapidPrivateKey
  );
} catch (err) {
  // If fallback key is malformed, generate new VAPID keys dynamically
  const generatedKeys = webpush.generateVAPIDKeys();
  webpush.setVapidDetails(
    vapidEmail,
    generatedKeys.publicKey,
    generatedKeys.privateKey
  );
  console.log('[WebPush Service] Generated active VAPID Public Key:', generatedKeys.publicKey);
}

function getVapidPublicKey() {
  return vapidPublicKey;
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

module.exports = {
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  sendPushToUser,
  sendPushBroadcast
};
