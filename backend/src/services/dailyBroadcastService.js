/**
 * Daily Broadcast Service — SJDB Connect
 * 
 * Provides unified broadcast triggers for Admin API and WhatsApp Birthday cron.
 * Scheduled daily Catholic broadcast is managed at 12:00 AM IST by dailyNotificationService.
 */
const cron = require('node-cron');
const User = require('../models/User');
const { sendDailyChurchNotifications } = require('./dailyNotificationService');

function sendWA(phone, text) {
  return require('../bot/whatsapp').sendWhatsAppMessage(phone, text);
}

function formatBirthdayMessage(user) {
  return `🎂 *Happy Birthday, ${user.name}!* 🎉

✨ *"May the Lord bless you and keep you;
May the Lord make his face shine on you
and be gracious to you."*
— Numbers 6:24-25

May God fill your life with joy, peace, and abundant blessings today and always!

With love & prayers,
⛪ *St. John de Britto's Church*
_SJDB Connect — Connecting Faith & Community_`;
}

// ─── Manual Trigger (for admin API) ─────────────────────────────────────────

async function triggerBroadcastNow() {
  console.log('📢 Manual broadcast triggered from admin panel...');
  return sendDailyChurchNotifications({ force: true });
}

async function runDailyBroadcast() {
  return sendDailyChurchNotifications();
}

// ─── Birthday Wishes via WhatsApp ────────────────────────────────────────────

async function runWhatsAppBirthdayWishes() {
  try {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const birthdayUsers = await User.find({
      whatsappOptIn: { $ne: false },
      isActive: { $ne: false },
      phone: { $exists: true, $ne: '' },
      $expr: {
        $and: [
          { $eq: [{ $month: '$dob' }, month] },
          { $eq: [{ $dayOfMonth: '$dob' }, day] }
        ]
      }
    });

    for (const user of birthdayUsers) {
      const phone = user.phone?.replace(/\D/g, '');
      if (!phone) continue;
      try {
        await sendWA(phone, formatBirthdayMessage(user));
        console.log(`🎂 Birthday WhatsApp sent to ${user.name}`);
      } catch (err) {
        console.error(`❌ Birthday WhatsApp failed for ${user.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('❌ WhatsApp Birthday Service Error:', err.message);
  }
}

// ─── Midnight Birthday Wishes Cron Job ────────────────────────────────────────
cron.schedule('0 0 * * *', () => {
  console.log('🎂 [CRON Midnight IST] Running WhatsApp birthday wishes...');
  runWhatsAppBirthdayWishes();
}, { timezone: 'Asia/Kolkata' });

module.exports = { runDailyBroadcast, triggerBroadcastNow, runWhatsAppBirthdayWishes };
