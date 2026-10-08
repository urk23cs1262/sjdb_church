/**
 * Hourly Event Reminder Service — SJDB Connect
 * St. John de Britto Church, Kalayarkoil
 *
 * Implements the server-side Hourly Event Reminder & Auto-Prune System:
 * 1. Detects when an event is scheduled for tomorrow in Asia/Kolkata timezone.
 * 2. From creation time / tomorrow entry, dispatches a reminder EVERY 1 HOUR until event time is reached.
 * 3. Dispatches across all channels: Website in-app, Web Push, Email, WhatsApp (SJDB Connect).
 * 4. Cancellation protection: Immediately re-checks event in database before EVERY send.
 *    If cancelled or deleted, reminders stop instantly with zero subsequent messages.
 * 5. Deduplication: Protected by unique ReminderLog keys to prevent duplicate sends across restarts.
 * 6. After the event date/time crosses, automatically deletes the event's announcements from
 *    both Admin and Public Announcement pages.
 */

const cron = require('node-cron');
const Event = require('../models/Event');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const BotSession = require('../models/BotSession');
const ReminderLog = require('../models/ReminderLog');
const Notification = require('../models/Notification');
const { sendMail } = require('../config/mailer');
const { sendPushBroadcast } = require('./webPushService');
const { createNotification } = require('./notificationService');
const { getSiteUrl } = require('../config/siteRoutes');

function getWA() {
  try {
    return require('../bot/whatsapp');
  } catch {
    return null;
  }
}

function sendWA(phone, text) {
  const { sendWhatsAppNotification } = require('./whatsAppNotificationService');
  return sendWhatsAppNotification(phone, text).catch(() => {});
}

// ─── DATE & TIME HELPERS (Asia/Kolkata UTC+5:30) ─────────────────────────────

/**
 * Returns YYYY-MM-DD in Asia/Kolkata timezone for a given date
 */
function getKolkataDateString(dateInput = new Date()) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

/**
 * Returns tomorrow's YYYY-MM-DD in Asia/Kolkata timezone
 */
function getKolkataTomorrowDateString(referenceDate = new Date()) {
  const todayStr = getKolkataDateString(referenceDate);
  if (!todayStr) return '';
  const [y, m, d] = todayStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d + 1));
  return dateObj.toISOString().slice(0, 10);
}

/**
 * Calculates the exact Date object for an event based on its date and time in Asia/Kolkata
 */
function getEventExactDateTime(event) {
  if (!event || !event.date) return null;
  const d = new Date(event.date);
  const kolkataDateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [yearStr, monthStr, dayStr] = kolkataDateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const day = parseInt(dayStr, 10);

  let hours = 12;
  let minutes = 0;

  if (event.time && typeof event.time === 'string') {
    const raw = event.time.trim();
    const match = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2] ? parseInt(match[2], 10) : 0;
      const meridiem = match[3] ? match[3].toLowerCase() : null;

      if (meridiem === 'pm' && h < 12) h += 12;
      if (meridiem === 'am' && h === 12) h = 0;

      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        hours = h;
        minutes = m;
      }
    }
  }

  // IST offset is UTC + 5:30
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const utcEpochMs = Date.UTC(year, month, day, hours, minutes, 0, 0) - istOffsetMs;
  return new Date(utcEpochMs);
}

/**
 * Checks whether the event date is tomorrow relative to current date in Asia/Kolkata
 */
function isEventTomorrow(event, referenceDate = new Date()) {
  if (!event || !event.date) return false;
  const eventDateStr = getKolkataDateString(event.date);
  const tomorrowStr = getKolkataTomorrowDateString(referenceDate);
  return eventDateStr === tomorrowStr;
}

/**
 * Checks whether the event date is today relative to current date in Asia/Kolkata
 */
function isEventToday(event, referenceDate = new Date()) {
  if (!event || !event.date) return false;
  const eventDateStr = getKolkataDateString(event.date);
  const todayStr = getKolkataDateString(referenceDate);
  return eventDateStr === todayStr;
}

/**
 * Formats user-friendly date in Asia/Kolkata (e.g. Thursday, 8 October 2026)
 */
function formatEventDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// ─── RECIPIENT RESOLUTION ───────────────────────────────────────────────────

async function getEventReminderRecipients() {
  const UserModeration = require('../models/UserModeration');
  const [blockedUsers, users, botSessions] = await Promise.all([
    UserModeration.find({ status: 'blocked' }).lean().catch(() => []),
    User.find({ isActive: { $ne: false } }).select('name email phone whatsappOptIn settings botPreferences').lean(),
    BotSession.find({ step: 'done' }).select('phoneNumber preferences').lean().catch(() => [])
  ]);

  const blockedPhone10s = new Set(
    blockedUsers.map(r => (r.phoneNumber || '').replace(/\D/g, '').slice(-10)).filter(Boolean)
  );
  const blockedUserIds = new Set(
    blockedUsers.map(r => r.userId ? r.userId.toString() : null).filter(Boolean)
  );

  const phoneSet = new Set();
  const emailSet = new Set();

  users.forEach(u => {
    if (blockedUserIds.has(u._id.toString())) return;
    const clean = (u.phone || '').replace(/\D/g, '');
    const clean10 = clean.slice(-10);
    if (clean10 && blockedPhone10s.has(clean10)) return;

    if (u.email && u.settings?.notifications?.email !== false) {
      emailSet.add(u.email);
    }
    if (u.phone && u.whatsappOptIn !== false) {
      if (clean) phoneSet.add(clean);
    }
  });

  botSessions.forEach(bs => {
    if (bs.phoneNumber) {
      const clean = bs.phoneNumber.replace(/\D/g, '');
      const clean10 = clean.slice(-10);
      if (clean10 && blockedPhone10s.has(clean10)) return;
      const prefs = bs.preferences || [];
      if (prefs.includes('events') || prefs.length === 0) {
        phoneSet.add(clean);
      }
    }
  });

  return { emails: Array.from(emailSet), phones: Array.from(phoneSet) };
}

// ─── DISPATCH HOURLY EVENT REMINDER ──────────────────────────────────────────

/**
 * Dispatches an hourly reminder for an event across all channels.
 * Performs immediate pre-send verification.
 */
async function dispatchHourlyEventReminder(eventId, { isInitial = false } = {}) {
  const now = new Date();

  // 1. Immediate pre-send check on fresh document
  const freshEvent = await Event.findById(eventId);
  if (!freshEvent) {
    console.log(`[HourlyEventReminder] Event ${eventId} was deleted. Aborting reminder.`);
    return { skipped: true, reason: 'deleted' };
  }

  if (freshEvent.status !== 'active') {
    console.log(`[HourlyEventReminder] Event ${freshEvent.title} status is "${freshEvent.status}". Aborting reminder.`);
    return { skipped: true, reason: 'status_inactive' };
  }

  if (freshEvent.isCancelled === true) {
    console.log(`[HourlyEventReminder] Event ${freshEvent.title} is cancelled. Aborting reminder.`);
    return { skipped: true, reason: 'cancelled' };
  }

  if (freshEvent.isPublished === false) {
    console.log(`[HourlyEventReminder] Event ${freshEvent.title} is unpublished. Aborting reminder.`);
    return { skipped: true, reason: 'unpublished' };
  }

  const eventDateTime = getEventExactDateTime(freshEvent);
  if (now >= eventDateTime) {
    console.log(`[HourlyEventReminder] Event ${freshEvent.title} scheduled time reached/passed. Completing reminders and purging announcements.`);
    freshEvent.reminderStatus = 'completed';
    freshEvent.status = 'completed';
    await freshEvent.save().catch(() => {});
    await cleanupCrossedEventAnnouncements(freshEvent._id);
    return { skipped: true, reason: 'time_reached' };
  }

  // 2. Deduplication check via ReminderLog for the current hour slot
  // e.g. "hourly_65123abc_2026-10-07_14"
  const kolkataNowStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const kolkataHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
  const reminderSlotKey = `hourly_${freshEvent._id}_${kolkataNowStr}_H${kolkataHour}`;

  const alreadySentInHour = await ReminderLog.findOne({
    itemId: freshEvent._id,
    reminderType: reminderSlotKey
  });

  if (alreadySentInHour) {
    return { skipped: true, reason: 'already_sent_in_hour' };
  }

  // 3. Prepare Multi-Channel Content
  const clientUrl = getSiteUrl('');
  const eventPageUrl = `${clientUrl}/events`;
  const eventTitle = freshEvent.title || 'Church Event';
  const dateFormatted = formatEventDate(freshEvent.date);
  const timeFormatted = freshEvent.time || '12:00 PM';
  const venueFormatted = freshEvent.venue || 'Church Premises';
  const description = freshEvent.description || '';

  const isTomorrow = isEventTomorrow(freshEvent, now);
  const timingBadge = isTomorrow ? 'HAPPENING TOMORROW' : 'HAPPENING TODAY';

  // A. In-App Notification (Broadcast)
  createNotification({
    isBroadcast: true,
    recipient: 'user',
    title: `🔔 Event Reminder: ${eventTitle}`,
    message: `${timingBadge} — ${dateFormatted} at ${timeFormatted} (${venueFormatted}). Click to view full details.`,
    type: 'event',
    category: 'events',
    priority: 'high',
    actionUrl: '/events',
    relatedId: freshEvent._id,
    relatedModel: 'Event',
    channels: ['in_app', 'push', 'email', 'whatsapp']
  }).catch(e => console.warn('[HourlyEventReminder] In-app notification warning:', e.message));

  // B. Web Push Notification
  sendPushBroadcast({
    title: `🔔 Event Reminder: ${eventTitle}`,
    body: `${timingBadge} at ${timeFormatted} • ${venueFormatted}. Tap to view event details.`,
    url: '/events',
    tag: `sjdb-hourly-event-${freshEvent._id}`
  }).catch(e => console.warn('[HourlyEventReminder] Push broadcast warning:', e.message));

  // C. Recipients (Email & WhatsApp)
  const { emails, phones } = await getEventReminderRecipients();

  // D. Email Template
  const emailHtml = buildEventReminderEmailHtml({
    eventTitle,
    timingBadge,
    dateFormatted,
    timeFormatted,
    venueFormatted,
    description,
    eventPageUrl
  });

  for (const em of emails) {
    sendMail({
      to: em,
      subject: `🔔 Reminder: ${eventTitle} — ${timingBadge} at ${timeFormatted}`,
      html: emailHtml
    }).catch(e => console.warn(`[HourlyEventReminder] Email error to ${em}:`, e.message));
  }

  // E. WhatsApp Message via SJDB Connect
  const waMsg =
`🔔 *PARISH EVENT REMINDER*
⛪ *St. John de Britto Church, Kalayarkoil*

*${eventTitle}*
⏰ *${timingBadge}*

📅 *Date:* ${dateFormatted}
🕒 *Time:* ${timeFormatted}
📍 *Venue:* ${venueFormatted}
${description ? `\n_${description}_\n` : ''}
🔗 *View Event Details on Website:*
${eventPageUrl}

_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_`;

  for (const phone of phones) {
    sendWA(phone, waMsg);
  }

  // F. Publish to WhatsApp Official Channel (if available)
  try {
    const { publishChannelReminder } = require('./whatsappChannelService');
    publishChannelReminder({
      itemId: freshEvent._id,
      itemModel: 'Event',
      title: eventTitle,
      details: description,
      dateText: dateFormatted,
      timeText: timeFormatted,
      venueText: venueFormatted,
      typeLabel: timingBadge,
      targetUrl: '/events'
    }).catch(() => {});
  } catch {}

  // 4. Log to ReminderLog for strict idempotency
  await ReminderLog.create({
    itemId: freshEvent._id,
    itemModel: 'Event',
    reminderType: reminderSlotKey,
    title: eventTitle,
    sentCount: emails.length + phones.length,
    sentAt: now
  }).catch(() => {});

  // 5. Update Event in Database: nextReminderAt = now + 1 hour
  freshEvent.lastReminderSentAt = now;
  freshEvent.nextReminderAt = new Date(now.getTime() + 60 * 60 * 1000); // exactly 1 hour from now
  freshEvent.reminderStatus = 'active';
  freshEvent.reminderCount = (freshEvent.reminderCount || 0) + 1;
  freshEvent.reminderHistory = freshEvent.reminderHistory || [];
  freshEvent.reminderHistory.push({
    sentAt: now,
    channels: ['in_app', 'push', 'email', 'whatsapp'],
    recipientCount: emails.length + phones.length
  });
  await freshEvent.save();

  console.log(`✅ [HourlyEventReminder] Sent reminder #${freshEvent.reminderCount} for "${eventTitle}" (${timingBadge}). Next reminder at ${freshEvent.nextReminderAt.toISOString()}`);

  return { success: true, count: emails.length + phones.length, nextReminderAt: freshEvent.nextReminderAt };
}

// ─── SCHEDULER SCANNER ────────────────────────────────────────────────────────

/**
 * Scans all active events.
 * 1. Prunes announcements for events whose time has passed.
 * 2. Activates hourly reminders for tomorrow's events.
 * 3. Triggers hourly reminders when currentTime >= nextReminderAt.
 */
async function processHourlyEventReminders() {
  try {
    const now = new Date();

    // 1. First, cleanup all passed events & their announcements
    await cleanupCrossedEventAnnouncements();

    // 2. Query active, published events
    const activeEvents = await Event.find({
      isPublished: { $ne: false },
      status: 'active',
      isCancelled: { $ne: true }
    });

    for (const ev of activeEvents) {
      const eventDateTime = getEventExactDateTime(ev);
      if (!eventDateTime) continue;

      // Check if event time has passed
      if (now >= eventDateTime) {
        ev.status = 'completed';
        ev.reminderStatus = 'completed';
        await ev.save().catch(() => {});
        await cleanupCrossedEventAnnouncements(ev._id);
        continue;
      }

      const isTomorrow = isEventTomorrow(ev, now);
      const isToday = isEventToday(ev, now);

      // If event is tomorrow or today (and before event time), and reminder cycle not yet activated:
      if ((isTomorrow || isToday) && ev.reminderStatus !== 'active') {
        console.log(`[HourlyEventReminder] Event "${ev.title}" is ${isTomorrow ? 'tomorrow' : 'today'}. Initializing hourly reminder cycle.`);
        await dispatchHourlyEventReminder(ev._id, { isInitial: true });
        continue;
      }

      // If hourly reminders are active:
      if (ev.reminderStatus === 'active') {
        // If nextReminderAt is reached (or missing)
        if (!ev.nextReminderAt || now >= new Date(ev.nextReminderAt)) {
          await dispatchHourlyEventReminder(ev._id);
        }
      }
    }
  } catch (err) {
    console.error('[HourlyEventReminder] Scheduler scan error:', err.message);
  }
}

// ─── ANNOUNCEMENT SYNCHRONIZATION & AUTO-PRUNE ────────────────────────────────

/**
 * Ensures an announcement exists for an upcoming event, with event page link and expiresAt.
 */
async function syncEventToAnnouncement(event) {
  try {
    if (!event || event.isPublished === false || event.isCancelled === true || event.status !== 'active') {
      if (event?._id) {
        await Announcement.deleteMany({ eventId: event._id });
      }
      return;
    }

    const eventDateTime = getEventExactDateTime(event);
    const dateFormatted = formatEventDate(event.date);
    const timeFormatted = event.time || '12:00 PM';
    const venueFormatted = event.venue || 'Church Premises';
    const clientUrl = getSiteUrl('');
    const eventUrl = `${clientUrl}/events`;

    const existing = await Announcement.findOne({ eventId: event._id });
    const content = `${event.description ? event.description + '\n\n' : ''}📅 Date: ${dateFormatted} at ${timeFormatted}\n📍 Venue: ${venueFormatted}\n\nView Event Details: ${eventUrl}`;

    if (existing) {
      existing.title = `Event: ${event.title}`;
      existing.content = content;
      existing.date = event.date;
      existing.expiresAt = eventDateTime;
      existing.eventLink = '/events';
      existing.isPublished = true;
      await existing.save();
    } else {
      await Announcement.create({
        title: `Event: ${event.title}`,
        content,
        type: event.category === 'feast' ? 'feast' : 'general',
        priority: 'high',
        isPublished: true,
        eventId: event._id,
        eventLink: '/events',
        date: event.date,
        expiresAt: eventDateTime
      });
    }
  } catch (err) {
    console.warn('[HourlyEventReminder] syncEventToAnnouncement warning:', err.message);
  }
}

/**
 * Deletes announcements for events whose date/time has passed from both Admin and Public pages.
 */
async function cleanupCrossedEventAnnouncements(specificEventId = null) {
  try {
    const now = new Date();

    if (specificEventId) {
      await Announcement.deleteMany({ eventId: specificEventId });
      await Notification.deleteMany({ relatedId: specificEventId, category: 'events' });
      return;
    }

    // 1. Delete all announcements with expiresAt <= now
    const expiredResult = await Announcement.deleteMany({
      expiresAt: { $exists: true, $ne: null, $lte: now }
    });

    if (expiredResult.deletedCount > 0) {
      console.log(`🧹 [HourlyEventReminder] Purged ${expiredResult.deletedCount} expired event announcements from database.`);
    }

    // 2. Cross-reference: find any announcement with eventId whose event has passed
    const eventAnnouncements = await Announcement.find({ eventId: { $exists: true, $ne: null } });
    for (const ann of eventAnnouncements) {
      const parentEvent = await Event.findById(ann.eventId);
      if (!parentEvent || parentEvent.status === 'completed' || parentEvent.isCancelled === true) {
        await Announcement.findByIdAndDelete(ann._id);
        continue;
      }
      const eventTime = getEventExactDateTime(parentEvent);
      if (now >= eventTime) {
        await Announcement.findByIdAndDelete(ann._id);
      }
    }

    // 3. Mark completed and purge announcements for any active events that have passed
    const passedActiveEvents = await Event.find({ status: 'active' });
    for (const pe of passedActiveEvents) {
      const peTime = getEventExactDateTime(pe);
      if (peTime && now >= peTime) {
        pe.status = 'completed';
        pe.reminderStatus = 'completed';
        await pe.save().catch(() => {});
        await Announcement.deleteMany({ eventId: pe._id });
        await Notification.deleteMany({ relatedId: pe._id, category: 'events' });
      }
    }
  } catch (err) {
    console.warn('[HourlyEventReminder] cleanupCrossedEventAnnouncements warning:', err.message);
  }
}

// ─── EVENT LIFECYCLE HOOKS ──────────────────────────────────────────────────

/**
 * Called immediately when an admin creates a new event.
 * Delegates to Central Notification Scheduler.
 */
async function onEventCreated(event) {
  const central = require('./centralNotificationScheduler');
  return central.onEventCreated(event);
}

/**
 * Called immediately when an admin cancels or deletes an event.
 * Delegates to Central Notification Scheduler.
 */
async function onEventCancelledOrDeleted(eventId) {
  const central = require('./centralNotificationScheduler');
  return central.onEventCancelledOrDeleted(eventId);
}

// ─── EMAIL TEMPLATE BUILDER ──────────────────────────────────────────────────

function buildEventReminderEmailHtml({
  eventTitle,
  timingBadge,
  dateFormatted,
  timeFormatted,
  venueFormatted,
  description,
  eventPageUrl
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Reminder: ${escapeHtml(eventTitle)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div style="background-color: #f8fafc; padding: 24px 12px; width: 100%; box-sizing: border-box;">
    <div style="max-width: 580px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; box-sizing: border-box;">
      
      <!-- HEADER -->
      <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 30px 20px; text-align: center; color: #ffffff;">
        <div style="width: 75px; height: 75px; background: #ffffff; border-radius: 50%; margin: 0 auto 12px; overflow: hidden; border: 3px solid #fbbf24; box-shadow: 0 4px 14px rgba(0,0,0,0.25);">
          <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
        </div>
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #fbbf24; letter-spacing: 0.5px;">St. John de Britto Church</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #e2e8f0; font-weight: 500;">புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்</p>
        <div style="display: inline-block; margin-top: 12px; padding: 5px 16px; background: #ea580c; border-radius: 999px; font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.8px;">
          ${escapeHtml(timingBadge)}
        </div>
      </div>

      <!-- BODY -->
      <div style="padding: 26px 20px;">
        <h2 style="margin: 0 0 10px; font-size: 19px; font-weight: 800; color: #0f172a;">
          ${escapeHtml(eventTitle)}
        </h2>

        <!-- EVENT DETAILS CARD -->
        <div style="background-color: #f8fafc; border-left: 4px solid #fbbf24; padding: 14px 16px; border-radius: 0 10px 10px 0; margin-bottom: 20px;">
          <p style="margin: 0 0 6px; font-size: 13.5px; color: #334155;">
            <strong>📅 Date:</strong> ${escapeHtml(dateFormatted)}
          </p>
          <p style="margin: 0 0 6px; font-size: 13.5px; color: #334155;">
            <strong>🕒 Time:</strong> ${escapeHtml(timeFormatted)}
          </p>
          <p style="margin: 0; font-size: 13.5px; color: #334155;">
            <strong>📍 Venue:</strong> ${escapeHtml(venueFormatted)}
          </p>
        </div>

        ${description ? `
        <div style="margin-bottom: 20px; font-size: 13.5px; line-height: 1.6; color: #475569;">
          ${escapeHtml(description)}
        </div>` : ''}

        <!-- ACTION BUTTON -->
        <div style="text-align: center; margin: 26px 0 10px;">
          <a href="${eventPageUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 800; padding: 13px 30px; border-radius: 10px; box-shadow: 0 4px 14px rgba(30, 58, 138, 0.35); text-align: center;">
            View Full Event Details on Website →
          </a>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="background-color: #0f172a; padding: 16px 18px; text-align: center; color: #94a3b8; font-size: 11.5px;">
        <p style="margin: 0; font-weight: 700; color: #f8fafc;">St. John de Britto Church, Kalayarkoil</p>
        <p style="margin: 4px 0 0; color: #64748b;">Automated Parish Event Notification • Do not reply</p>
      </div>

    </div>
  </div>
</body>
</html>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Note: Cron execution is centralized in centralNotificationScheduler.js to prevent duplicate sends.

module.exports = {
  processHourlyEventReminders: () => {
    const central = require('./centralNotificationScheduler');
    return central.runCentralSchedulerTick();
  },
  dispatchHourlyEventReminder,
  onEventCreated,
  onEventCancelledOrDeleted,
  syncEventToAnnouncement: (event) => {
    const central = require('./centralNotificationScheduler');
    return central.syncEventToAnnouncement(event);
  },
  cleanupCrossedEventAnnouncements: (id) => {
    const central = require('./centralNotificationScheduler');
    return central.cleanupCrossedEventAnnouncements(id);
  },
  getEventExactDateTime,
  isEventTomorrow,
  isEventToday
};
