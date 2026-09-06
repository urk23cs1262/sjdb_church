/**
 * Daily Broadcast Service — SJDB Connect
 * 
 * Provides unified broadcast triggers for Admin API and WhatsApp Birthday cron.
 * Scheduled daily Catholic broadcast is managed at 04:00 AM IST by dailyNotificationService.
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
⛪ *St. John de britto Church*
_SJDB Connect — Connecting Faith & Community_`;
}

// ─── Manual Trigger (for admin API) ─────────────────────────────────────────

async function triggerBroadcastNow() {
  console.log('📢 Manual broadcast triggered from admin panel...');
  return sendDailyChurchNotifications({ force: true, triggerType: 'admin_manual' });
}

async function runDailyBroadcast() {
  return sendDailyChurchNotifications();
}

// ─── Birthday Wishes via WhatsApp ────────────────────────────────────────────

async function runWhatsAppBirthdayWishes() {
  const { sendBirthdayWishes } = require('./birthdayService');
  return sendBirthdayWishes();
}

// NOTE: Birthday cron is managed by birthdayService.js — do NOT add a duplicate cron here.
// Having two midnight birthday crons would send duplicate messages to all users.

module.exports = { runDailyBroadcast, triggerBroadcastNow, runWhatsAppBirthdayWishes };
