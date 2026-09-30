/**
 * Daily Broadcast Service — SJDB Connect
 * 
 * Provides unified broadcast triggers for Admin API and WhatsApp Birthday cron.
 * Scheduled daily Catholic broadcast is managed at 4:00 AM IST by dailyNotificationService.
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
⛪ *St. John de Britto Church*
_SJDB Connect — "Come; Listen; and you will find life"_`;
}

// ─── Manual Trigger (for admin API) ─────────────────────────────────────────

async function triggerBroadcastNow() {
  console.log('📢 Manual broadcast triggered from admin panel...');
  return sendDailyChurchNotifications({ force: true });
}

async function runDailyBroadcast() {
  return sendDailyChurchNotifications();
}

// ─── Birthday Wishes Delegation ─────────────────────────────────────────────
// Delegated to unified, multi-channel Birthday Service (scheduled at 12:00 AM IST in birthdayService.js)
async function runWhatsAppBirthdayWishes(options = {}) {
  const { sendBirthdayWishes } = require('./birthdayService');
  return sendBirthdayWishes(options);
}

module.exports = { runDailyBroadcast, triggerBroadcastNow, runWhatsAppBirthdayWishes };
