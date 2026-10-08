/**
 * Central Notification Scheduler — SJDB Connect
 * St. John de Britto Church, Kalayarkoil
 *
 * Implements the Unified Notification Architecture:
 * 1. Treats Event and Announcement as two distinct notification types.
 * 2. Deduplicates notifications:
 *    - When an Event is mirrored into Announcements (sourceType: 'event'),
 *      NO Announcement notification is ever triggered.
 *    - Standalone announcements have sourceType: 'announcement'.
 * 3. Event Notification & Reminder Timeline:
 *    - Event Created: 1 Event notification across Website, WhatsApp, Email, Push.
 *    - 12 hours before event start: 1 Event reminder across all channels.
 *    - 6 hours before event start: 1 Event reminder, DEDUPLICATED/SUPPRESSED if
 *      it falls in the hourly reminder window (Event day >= 04:00 AM IST) so
 *      parishioners never receive two notifications at 4:30 AM.
 *    - Event Day 04:00 AM IST onwards: Hourly reminder sent at the top of each hour
 *      (4 AM, 5 AM, 6 AM, ..., until event start time).
 *    - Event start time: Reminders stop immediately. Event marked completed.
 * 4. Announcement Notification & Reminder Timeline:
 *    - Standalone Announcement Created: 1 Announcement notification across all channels.
 *    - Reminders continue until "Expires At".
 *    - Upon Expiry: Reminders stop immediately, marked expired, excluded from public & admin pages.
 * 5. Strict Deduplication via NotificationLog:
 *    - Unique compound index: { entityType: 1, entityId: 1, notificationType: 1, reminderType: 1, scheduledFor: 1 }
 *    - Every reminder is ONE logical notification record delivered through all enabled channels.
 */

const cron = require('node-cron');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const BotSession = require('../models/BotSession');
const Notification = require('../models/Notification');
const NotificationLog = require('../models/NotificationLog');
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

// ─── TIMEZONE & DATE UTILITIES (Asia/Kolkata UTC+5:30) ───────────────────────

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Extracts date parts in Asia/Kolkata timezone
 */
function getKolkataDateParts(dateInput = new Date()) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(d);
  const map = {};
  for (const p of parts) map[p.type] = p.value;

  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10), // 1-12
    day: parseInt(map.day, 10),
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
    dateString: `${map.year}-${map.month}-${map.day}`
  };
}

/**
 * Returns YYYY-MM-DD in Asia/Kolkata
 */
function getKolkataDateString(dateInput = new Date()) {
  const parts = getKolkataDateParts(dateInput);
  return parts ? parts.dateString : '';
}

/**
 * Normalizes Date to 0 milliseconds to ensure exact equality in DB queries
 */
function normalizeScheduleDate(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return new Date();
  d.setMilliseconds(0);
  return d;
}

/**
 * Constructs an exact Date object for a given hour in Asia/Kolkata
 */
function getKolkataSlotDate(kolkataDateStr, hourInt) {
  const [y, m, d] = kolkataDateStr.split('-').map(Number);
  const utcEpochMs = Date.UTC(y, m - 1, d, hourInt, 0, 0, 0) - IST_OFFSET_MS;
  return new Date(utcEpochMs);
}

/**
 * Calculates exact start Date for an Event in Asia/Kolkata
 */
function getEventExactDateTime(event) {
  if (!event || !event.date) return null;
  const d = new Date(event.date);
  if (isNaN(d.getTime())) return null;

  const parts = getKolkataDateParts(d);
  if (!parts) return null;

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

  const utcEpochMs = Date.UTC(parts.year, parts.month - 1, parts.day, hours, minutes, 0, 0) - IST_OFFSET_MS;
  return new Date(utcEpochMs);
}

/**
 * Calculates exact expiry Date for an Announcement in Asia/Kolkata
 */
function getAnnouncementExactExpiry(announcement) {
  if (!announcement || !announcement.expiresAt) return null;
  const d = new Date(announcement.expiresAt);
  if (isNaN(d.getTime())) return null;

  const iso = d.toISOString();
  if (iso.endsWith('T00:00:00.000Z')) {
    // Stored without specific time -> Treat as end of that IST calendar day (23:59:59.999)
    const parts = getKolkataDateParts(d);
    if (parts) {
      const utcEpochMs = Date.UTC(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999) - IST_OFFSET_MS;
      return new Date(utcEpochMs);
    }
  }

  return d;
}

/**
 * Checks whether event is today in Asia/Kolkata
 */
function isEventToday(event, referenceDate = new Date()) {
  if (!event || !event.date) return false;
  const eventDateStr = getKolkataDateString(event.date);
  const refDateStr = getKolkataDateString(referenceDate);
  return eventDateStr === refDateStr;
}

/**
 * Checks whether event is tomorrow in Asia/Kolkata
 */
function isEventTomorrow(event, referenceDate = new Date()) {
  if (!event || !event.date) return false;
  const todayParts = getKolkataDateParts(referenceDate);
  if (!todayParts) return false;

  const tomorrowUtcEpoch = Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day + 1) - IST_OFFSET_MS;
  const tomorrowDateStr = getKolkataDateString(new Date(tomorrowUtcEpoch));
  const eventDateStr = getKolkataDateString(event.date);

  return eventDateStr === tomorrowDateStr;
}

/**
 * User-friendly Catholic date formatter in Tamil Nadu (en-IN)
 */
function formatEventDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * User-friendly expiry date formatter
 */
function formatExpiryDate(dateInput) {
  if (!dateInput) return 'Valid until further notice';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Valid until further notice';
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// ─── RECIPIENT RESOLUTION ───────────────────────────────────────────────────

/**
 * Resolves active, non-blocked parishioners for a given category ('events' or 'announcements')
 */
async function getRecipients(category = 'events') {
  try {
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
        if (category === 'events' && u.settings?.notifications?.eventReminders === false) {
          // skipped by preference
        } else {
          emailSet.add(u.email);
        }
      }

      if (u.phone && u.whatsappOptIn !== false) {
        let phoneNorm = clean;
        while (phoneNorm.startsWith('0')) phoneNorm = phoneNorm.substring(1);
        if (phoneNorm.length === 10) phoneNorm = '91' + phoneNorm;
        if (phoneNorm && phoneNorm.length >= 10) phoneSet.add(phoneNorm);
      }
    });

    botSessions.forEach(bs => {
      if (bs.phoneNumber) {
        const clean = bs.phoneNumber.replace(/\D/g, '');
        const clean10 = clean.slice(-10);
        if (clean10 && blockedPhone10s.has(clean10)) return;

        const prefs = bs.preferences || [];
        if (prefs.includes(category) || prefs.includes('all') || prefs.length === 0) {
          let phoneNorm = clean;
          while (phoneNorm.startsWith('0')) phoneNorm = phoneNorm.substring(1);
          if (phoneNorm.length === 10) phoneNorm = '91' + phoneNorm;
          if (phoneNorm && phoneNorm.length >= 10) phoneSet.add(phoneNorm);
          else if (bs.phoneNumber && bs.phoneNumber.includes('@')) phoneSet.add(bs.phoneNumber);
        }
      }
    });

    return { emails: Array.from(emailSet), phones: Array.from(phoneSet) };
  } catch (err) {
    console.error('[CentralScheduler] Recipient resolution error:', err.message);
    return { emails: [], phones: [] };
  }
}

// ─── CENTRAL LOGICAL NOTIFICATION DISPATCHER ─────────────────────────────────

/**
 * Dispatches ONE logical notification across all enabled channels:
 * - Website In-App Notification (isBroadcast: true)
 * - Browser / Web Push Notification
 * - User Emails (branded responsive HTML card)
 * - WhatsApp (SJDB Connect bot + Official Parish Channel)
 *
 * Guaranteed atomic idempotency via NotificationLog compound unique key:
 * { entityType, entityId, notificationType, reminderType, scheduledFor }
 */
async function sendLogicalNotification({
  entityType, // 'event' | 'announcement'
  entityId,
  notificationType, // 'event_created' | 'event_reminder' | 'announcement_created' | 'announcement_reminder'
  reminderType, // 'creation' | '12_hours' | '6_hours' | 'hourly_04:00' ...
  scheduledFor,
  title,
  message,
  badgeText = '',
  actionUrl = '',
  eventDate = '',
  eventTime = '',
  venue = '',
  description = '',
  priority = 'high'
}) {
  const normalizedSchedule = normalizeScheduleDate(scheduledFor);

  // 1. Strict Deduplication Check before sending
  const alreadySent = await NotificationLog.findOne({
    entityType,
    entityId,
    notificationType,
    reminderType,
    scheduledFor: normalizedSchedule
  });

  if (alreadySent) {
    return { skipped: true, reason: alreadySent.status === 'suppressed' ? 'suppressed' : 'already_sent' };
  }

  // 2. Reserve / Lock in NotificationLog to prevent race conditions
  let logRecord;
  try {
    logRecord = await NotificationLog.create({
      entityType,
      entityId,
      notificationType,
      reminderType,
      scheduledFor: normalizedSchedule,
      title,
      status: 'sent',
      channels: ['website', 'push', 'email', 'whatsapp'],
      sentAt: new Date()
    });
  } catch (dupErr) {
    if (dupErr.code === 11000) {
      return { skipped: true, reason: 'concurrency_collision' };
    }
    throw dupErr;
  }

  const clientUrl = getSiteUrl('');
  const fullTargetUrl = `${clientUrl}${actionUrl}`;
  const category = entityType === 'event' ? 'events' : 'announcements';

  // 3. Channel A: Website In-App Notification (Broadcast)
  createNotification({
    isBroadcast: true,
    recipient: 'user',
    title,
    message,
    type: entityType,
    category,
    priority: priority === 'urgent' ? 'urgent' : 'high',
    actionUrl,
    relatedId: entityId,
    relatedModel: entityType === 'event' ? 'Event' : 'Announcement',
    channels: ['inApp', 'website']
  }).catch(e => console.warn(`[CentralScheduler] In-app notification error: ${e.message}`));

  // 4. Channel B: Web Push Notification
  sendPushBroadcast({
    title,
    body: message.length > 120 ? message.slice(0, 117) + '...' : message,
    url: actionUrl,
    tag: `sjdb-${entityType}-${entityId}-${reminderType}`,
    data: { url: actionUrl, entityId }
  }).catch(e => console.warn(`[CentralScheduler] Web push error: ${e.message}`));

  // 5. Channel C & D: Email and WhatsApp
  const { emails, phones } = await getRecipients(category);

  // Email Dispatch
  const emailHtml = buildEmailHtml({
    entityType,
    title,
    badgeText,
    message,
    eventDate,
    eventTime,
    venue,
    description,
    targetUrl: fullTargetUrl
  });

  for (const em of emails) {
    sendMail({
      to: em,
      subject: title,
      html: emailHtml
    }).catch(e => console.warn(`[CentralScheduler] Email delivery error to ${em}: ${e.message}`));
  }

  // WhatsApp Dispatch
  const waMsg = buildWhatsAppMessage({
    entityType,
    title,
    badgeText,
    eventDate,
    eventTime,
    venue,
    description,
    targetUrl: fullTargetUrl
  });

  for (const phone of phones) {
    sendWA(phone, waMsg);
  }

  // Channel Publication: WhatsApp Official Parish Channel
  try {
    const { publishChannelReminder } = require('./whatsappChannelService');
    publishChannelReminder({
      itemId: entityId,
      itemModel: entityType === 'event' ? 'Event' : 'Announcement',
      title,
      details: description || message,
      dateText: eventDate,
      timeText: eventTime || 'Active',
      venueText: venue || 'Church Premises',
      typeLabel: badgeText || title,
      targetUrl: actionUrl
    }).catch(() => {});
  } catch {}

  // 6. Update Log Record with stats
  const totalCount = emails.length + phones.length;
  logRecord.recipientCount = totalCount;
  await logRecord.save().catch(() => {});

  console.log(`✅ [CentralScheduler] Sent logical ${entityType} notification [${notificationType}:${reminderType}] to ${totalCount} recipients.`);

  return { success: true, count: totalCount };
}

// ─── ANNOUNCEMENT SYNCHRONIZATION FROM EVENT ─────────────────────────────────

/**
 * Ensures an Announcement representation exists for an Event with sourceType = "event".
 * Never triggers an announcement notification because sourceType === "event".
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
      existing.sourceType = 'event'; // STRICT EVENT SOURCE TYPE
      existing.date = event.date;
      existing.expiresAt = eventDateTime;
      existing.eventLink = '/events';
      existing.isPublished = true;
      existing.status = 'published';
      await existing.save();
    } else {
      await Announcement.create({
        title: `Event: ${event.title}`,
        content,
        type: event.category === 'feast' ? 'feast' : 'general',
        priority: 'high',
        sourceType: 'event', // STRICT EVENT SOURCE TYPE
        isPublished: true,
        status: 'published',
        eventId: event._id,
        eventLink: '/events',
        date: event.date,
        expiresAt: eventDateTime
      });
    }
  } catch (err) {
    console.warn('[CentralScheduler] syncEventToAnnouncement error:', err.message);
  }
}

/**
 * Removes crossed/passed event representations from Announcements page
 */
async function cleanupCrossedEventAnnouncements(specificEventId = null) {
  try {
    const now = new Date();

    if (specificEventId) {
      await Announcement.deleteMany({ eventId: specificEventId });
      await Notification.deleteMany({ relatedId: specificEventId, category: 'events' });
      return;
    }

    // 1. Delete all event mirror announcements with expiresAt <= now
    await Announcement.deleteMany({
      sourceType: 'event',
      expiresAt: { $exists: true, $ne: null, $lte: now }
    });

    // 2. Cross-reference: find any announcement with eventId whose parent event is completed/cancelled
    const eventAnnouncements = await Announcement.find({ eventId: { $exists: true, $ne: null } });
    for (const ann of eventAnnouncements) {
      const parentEvent = await Event.findById(ann.eventId);
      if (!parentEvent || parentEvent.status === 'completed' || parentEvent.isCancelled === true) {
        await Announcement.findByIdAndDelete(ann._id);
        continue;
      }
      const eventTime = getEventExactDateTime(parentEvent);
      if (eventTime && now >= eventTime) {
        await Announcement.findByIdAndDelete(ann._id);
      }
    }

    // 3. Mark completed for any active events that have passed
    const passedActiveEvents = await Event.find({ status: 'active' });
    for (const pe of passedActiveEvents) {
      const peTime = getEventExactDateTime(pe);
      if (peTime && now >= peTime) {
        pe.status = 'completed';
        pe.reminderStatus = 'completed';
        await pe.save().catch(() => {});
        await Announcement.deleteMany({ eventId: pe._id });
      }
    }
  } catch (err) {
    console.warn('[CentralScheduler] cleanupCrossedEventAnnouncements error:', err.message);
  }
}

/**
 * Marks expired standalone announcements as status="expired" and halts reminders
 */
async function cleanupExpiredAnnouncements(specificAnnId = null) {
  try {
    const now = new Date();

    if (specificAnnId) {
      await Announcement.findByIdAndUpdate(specificAnnId, {
        status: 'expired',
        reminderStatus: 'expired',
        isPublished: false
      }).catch(() => {});
      return;
    }

    const expiredAnnouncements = await Announcement.find({
      sourceType: 'announcement',
      status: { $ne: 'expired' },
      expiresAt: { $exists: true, $ne: null, $lte: now }
    });

    for (const ann of expiredAnnouncements) {
      ann.status = 'expired';
      ann.reminderStatus = 'expired';
      ann.isPublished = false;
      await ann.save().catch(() => {});
      console.log(`🧹 [CentralScheduler] Marked announcement "${ann.title}" as EXPIRED (halted all reminders).`);
    }
  } catch (err) {
    console.warn('[CentralScheduler] cleanupExpiredAnnouncements error:', err.message);
  }
}

// ─── EVENT LIFECYCLE HANDLERS ────────────────────────────────────────────────

/**
 * 1. Event Created
 * Dispatches ONE Event notification across Website + WhatsApp + Email + Push.
 * Mirrors into Announcements as sourceType: "event" WITHOUT triggering an announcement notification.
 */
async function onEventCreated(event) {
  try {
    if (!event || event.isPublished === false || event.isCancelled === true) return;

    // A. Mirror into Announcements (sourceType: 'event') WITHOUT triggering an announcement notification
    await syncEventToAnnouncement(event);

    // B. Activate reminder status on the event
    event.reminderStatus = 'active';
    await event.save().catch(() => {});

    // C. Single Notification Pipeline: Dispatch ONE Event Created notification using Template 1 (PARISH EVENT NOTICE)
    // Deduplication via NotificationLog ensures strictly ONE send across all channels
    const { broadcastEventPublished } = require('./broadcastNotificationService');
    await broadcastEventPublished({ event, action: 'created' });
  } catch (err) {
    console.error('[CentralScheduler] onEventCreated error:', err.message);
  }
}

/**
 * Event Updated
 */
async function onEventUpdated(event) {
  try {
    if (!event) return;
    await syncEventToAnnouncement(event);
  } catch (err) {
    console.error('[CentralScheduler] onEventUpdated error:', err.message);
  }
}

/**
 * Event Cancelled or Deleted
 * Immediately halts reminders and purges announcements
 */
async function onEventCancelledOrDeleted(eventId) {
  try {
    console.log(`[CentralScheduler] Event ${eventId} cancelled/deleted. Halting reminders and purging announcements.`);
    await Event.findByIdAndUpdate(eventId, {
      status: 'cancelled',
      isCancelled: true,
      cancelledAt: new Date(),
      reminderStatus: 'cancelled'
    }).catch(() => {});

    await cleanupCrossedEventAnnouncements(eventId);
  } catch (err) {
    console.error('[CentralScheduler] onEventCancelledOrDeleted error:', err.message);
  }
}

// ─── ANNOUNCEMENT LIFECYCLE HANDLERS ─────────────────────────────────────────

/**
 * 2. Standalone Announcement Created
 * Dispatches ONE Announcement notification across Website + WhatsApp + Email + Push.
 * If sourceType is "event", it is skipped to prevent duplicate notifications!
 */
async function onAnnouncementCreated(announcement) {
  try {
    if (!announcement || announcement.isPublished === false) return;

    // Strict Duplication Guard:
    if (announcement.sourceType === 'event' || announcement.eventId) {
      console.log(`[CentralScheduler] Skipping announcement notification for event mirror: "${announcement.title}"`);
      return;
    }

    const now = new Date();
    const expiryDate = getAnnouncementExactExpiry(announcement);
    if (expiryDate && now >= expiryDate) return;

    announcement.reminderStatus = 'active';
    await announcement.save().catch(() => {});

    // Single Notification Pipeline: Dispatch ONE Announcement Created notification
    // Deduplication via NotificationLog ensures strictly ONE send across all channels
    const { broadcastAnnouncementPublished } = require('./broadcastNotificationService');
    await broadcastAnnouncementPublished({ announcement, action: 'created' });
  } catch (err) {
    console.error('[CentralScheduler] onAnnouncementCreated error:', err.message);
  }
}

/**
 * Announcement Cancelled, Expired, or Deleted
 */
async function onAnnouncementCancelledOrExpired(announcementId) {
  try {
    await Announcement.findByIdAndUpdate(announcementId, {
      status: 'expired',
      reminderStatus: 'expired',
      isPublished: false
    }).catch(() => {});

    await Notification.deleteMany({ relatedId: announcementId, category: 'announcements' }).catch(() => {});
  } catch (err) {
    console.error('[CentralScheduler] onAnnouncementCancelledOrExpired error:', err.message);
  }
}

// ─── EVENT REMINDERS SCANNER ─────────────────────────────────────────────────

/**
 * Evaluates active events and sends:
 * 1. 12 hours before event start time
 * 2. 6 hours before event start time (DEDUPLICATED if within the 4:00 AM hourly window)
 * 3. Hourly reminders starting at 04:00 AM IST on event day until event start time
 */
async function processEventReminders() {
  const now = new Date();
  const kolkataParts = getKolkataDateParts(now);
  if (!kolkataParts) return;

  const activeEvents = await Event.find({
    isPublished: { $ne: false },
    status: 'active',
    isCancelled: { $ne: true }
  });

  for (const ev of activeEvents) {
    const eventDateTime = getEventExactDateTime(ev);
    if (!eventDateTime) continue;

    // Check if event start time reached:
    if (now >= eventDateTime) {
      ev.status = 'completed';
      ev.reminderStatus = 'completed';
      await ev.save().catch(() => {});
      await cleanupCrossedEventAnnouncements(ev._id);
      continue;
    }

    const dateFormatted = formatEventDate(ev.date);
    const timeFormatted = ev.time || '12:00 PM';
    const venueFormatted = ev.venue || 'Church Premises';
    const eventTitle = ev.title;
    const isToday = isEventToday(ev, now);

    // ─────────────────────────────────────────────────────────────────────────
    // REMINDER A: 12 Hours Before
    // ─────────────────────────────────────────────────────────────────────────
    const twelveHoursBefore = new Date(eventDateTime.getTime() - 12 * 60 * 60 * 1000);
    const scheduled12h = normalizeScheduleDate(twelveHoursBefore);

    if (now >= twelveHoursBefore && now < new Date(twelveHoursBefore.getTime() + 45 * 60 * 1000)) {
      const alreadySent12h = await NotificationLog.findOne({
        entityType: 'event',
        entityId: ev._id,
        notificationType: 'event_reminder',
        reminderType: '12_hours',
        scheduledFor: scheduled12h
      });

      if (!alreadySent12h) {
        await sendLogicalNotification({
          entityType: 'event',
          entityId: ev._id,
          notificationType: 'event_reminder',
          reminderType: '12_hours',
          scheduledFor: scheduled12h,
          title: `🔔 Event Reminder: ${eventTitle}`,
          message: `Starts in 12 hours — ${dateFormatted} at ${timeFormatted} (${venueFormatted}). Tap to view full details.`,
          badgeText: 'STARTS IN 12 HOURS',
          actionUrl: '/events',
          eventDate: dateFormatted,
          eventTime: timeFormatted,
          venue: venueFormatted,
          description: ev.description || ''
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REMINDER B: 6 Hours Before (with strict 4:00 AM window deduplication)
    // ─────────────────────────────────────────────────────────────────────────
    const sixHoursBefore = new Date(eventDateTime.getTime() - 6 * 60 * 60 * 1000);
    const scheduled6h = normalizeScheduleDate(sixHoursBefore);

    if (now >= sixHoursBefore && now < new Date(sixHoursBefore.getTime() + 45 * 60 * 1000)) {
      const alreadySent6h = await NotificationLog.findOne({
        entityType: 'event',
        entityId: ev._id,
        notificationType: 'event_reminder',
        reminderType: '6_hours',
        scheduledFor: scheduled6h
      });

      if (!alreadySent6h) {
        // Deduplication rule: If event is today and current hour is >= 4 AM,
        // the hourly reminder system is already active and sending reminders every hour.
        // Therefore, suppress the 6-hour reminder (e.g. at 4:30 AM) so parishioners
        // don't get two reminders in 30 minutes!
        const isHourlyWindowActive = isToday && kolkataParts.hour >= 4;

        if (isHourlyWindowActive) {
          console.log(`[CentralScheduler] Deduplicating 6-hour reminder for "${eventTitle}" — suppressed in favor of 4:00 AM hourly reminder window.`);
          await NotificationLog.create({
            entityType: 'event',
            entityId: ev._id,
            notificationType: 'event_reminder',
            reminderType: '6_hours',
            scheduledFor: scheduled6h,
            status: 'suppressed',
            suppressionReason: 'hourly_window_active_at_4am',
            title: eventTitle,
            sentAt: now
          }).catch(() => {});
        } else {
          await sendLogicalNotification({
            entityType: 'event',
            entityId: ev._id,
            notificationType: 'event_reminder',
            reminderType: '6_hours',
            scheduledFor: scheduled6h,
            title: `🔔 Event Reminder: ${eventTitle}`,
            message: `Starts in 6 hours — ${dateFormatted} at ${timeFormatted} (${venueFormatted}). Tap to view full details.`,
            badgeText: 'STARTS IN 6 HOURS',
            actionUrl: '/events',
            eventDate: dateFormatted,
            eventTime: timeFormatted,
            venue: venueFormatted,
            description: ev.description || ''
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REMINDER C: Hourly reminders on Event Day starting at 04:00 AM IST
    // ─────────────────────────────────────────────────────────────────────────
    if (isToday && kolkataParts.hour >= 4 && now < eventDateTime) {
      const currentHour = kolkataParts.hour;
      const slotScheduleDate = getKolkataSlotDate(kolkataParts.dateString, currentHour);
      const reminderSlot = `hourly_${String(currentHour).padStart(2, '0')}:00`;

      const alreadySentHourly = await NotificationLog.findOne({
        entityType: 'event',
        entityId: ev._id,
        notificationType: 'event_reminder',
        reminderType: reminderSlot,
        scheduledFor: slotScheduleDate
      });

      if (!alreadySentHourly) {
        const msRemaining = eventDateTime.getTime() - now.getTime();
        const hoursRemaining = Math.max(0, Math.floor(msRemaining / (1000 * 60 * 60)));
        const minsRemaining = Math.max(0, Math.round((msRemaining % (1000 * 60 * 60)) / (1000 * 60)));

        let timeRemainingText = '';
        if (hoursRemaining > 0 && minsRemaining > 0) {
          timeRemainingText = `starts in ${hoursRemaining} hr ${minsRemaining} min`;
        } else if (hoursRemaining > 0) {
          timeRemainingText = `starts in ${hoursRemaining} ${hoursRemaining === 1 ? 'hour' : 'hours'}`;
        } else if (minsRemaining > 0) {
          timeRemainingText = `starts in ${minsRemaining} minutes`;
        } else {
          timeRemainingText = `starts at ${timeFormatted}`;
        }

        await sendLogicalNotification({
          entityType: 'event',
          entityId: ev._id,
          notificationType: 'event_reminder',
          reminderType: reminderSlot,
          scheduledFor: slotScheduleDate,
          title: `🔔 Event Reminder: ${eventTitle}`,
          message: `${eventTitle} ${timeRemainingText} — ${dateFormatted} at ${timeFormatted} (${venueFormatted}). Click to view details.`,
          badgeText: `STARTS TODAY • ${timeRemainingText.toUpperCase()}`,
          actionUrl: '/events',
          eventDate: dateFormatted,
          eventTime: timeFormatted,
          venue: venueFormatted,
          description: ev.description || ''
        });

        ev.lastReminderSentAt = now;
        ev.reminderCount = (ev.reminderCount || 0) + 1;
        await ev.save().catch(() => {});
      }
    }
  }
}

// ─── ANNOUNCEMENT REMINDERS SCANNER ──────────────────────────────────────────

/**
 * Evaluates active standalone announcements and sends periodic reminders until Expires At.
 * Once expired, halts reminders immediately.
 */
async function processAnnouncementReminders() {
  const now = new Date();
  const kolkataParts = getKolkataDateParts(now);
  if (!kolkataParts) return;

  const publishedAnnouncements = await Announcement.find({
    sourceType: 'announcement',
    eventId: { $exists: false },
    isPublished: true,
    status: 'published'
  });

  for (const ann of publishedAnnouncements) {
    const expiryDate = getAnnouncementExactExpiry(ann);

    // If expired, halt reminders immediately
    if (expiryDate && now >= expiryDate) {
      ann.status = 'expired';
      ann.reminderStatus = 'expired';
      ann.isPublished = false;
      await ann.save().catch(() => {});
      await cleanupExpiredAnnouncements(ann._id);
      continue;
    }

    // Hourly periodic reminder if expiresAt is set
    if (expiryDate && now < expiryDate) {
      const slotScheduleDate = getKolkataSlotDate(kolkataParts.dateString, kolkataParts.hour);
      const reminderSlot = `hourly_ann_${String(kolkataParts.hour).padStart(2, '0')}:00`;

      const alreadySent = await NotificationLog.findOne({
        entityType: 'announcement',
        entityId: ann._id,
        notificationType: 'announcement_reminder',
        reminderType: reminderSlot,
        scheduledFor: slotScheduleDate
      });

      if (!alreadySent) {
        const expiryFormatted = formatExpiryDate(expiryDate);
        const title = `📢 Reminder: ${ann.title}`;
        const cleanContent = ann.content || '';
        const message = `${cleanContent.slice(0, 150)}${cleanContent.length > 150 ? '...' : ''} (Valid until ${expiryFormatted}). Tap to view.`;

        await sendLogicalNotification({
          entityType: 'announcement',
          entityId: ann._id,
          notificationType: 'announcement_reminder',
          reminderType: reminderSlot,
          scheduledFor: slotScheduleDate,
          title,
          message,
          badgeText: ann.priority === 'urgent' ? '🚨 URGENT ANNOUNCEMENT' : '📢 PARISH ANNOUNCEMENT',
          actionUrl: '/announcements',
          description: cleanContent
        });

        ann.lastReminderSentAt = now;
        ann.reminderCount = (ann.reminderCount || 0) + 1;
        await ann.save().catch(() => {});
      }
    }
  }
}

// ─── EMAIL & WHATSAPP FORMATTERS ─────────────────────────────────────────────

function buildEmailHtml({
  entityType,
  title,
  badgeText,
  message,
  eventDate,
  eventTime,
  venue,
  description,
  targetUrl
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', -apple-system, Roboto, sans-serif; }
    .box { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 26px 20px; text-align: center; color: #ffffff; }
    .badge { display: inline-block; background: #fbbf24; color: #0f172a; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; margin-bottom: 12px; letter-spacing: 0.5px; }
    .content { padding: 24px 20px; color: #1e293b; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin: 16px 0; font-size: 13.5px; line-height: 1.6; }
    .btn { display: inline-block; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 14px; text-align: center; }
    .footer { background: #0f172a; padding: 16px; text-align: center; color: #94a3b8; font-size: 11.5px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="header">
      <div style="width: 65px; height: 65px; margin: 0 auto 10px; border-radius: 50%; overflow: hidden; border: 3px solid #fbbf24; background: #ffffff;">
        <img src="cid:sjdb_church_logo" alt="SJDB Church" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <h1 style="color:#fbbf24; margin:0 0 4px; font-size:19px; font-weight:800;">St. John de Britto Church</h1>
      <p style="margin:0; font-size:12px; color:#cbd5e1; font-weight:600;">Kalayarkoil Parish • SJDB Connect</p>
    </div>
    <div class="content">
      ${badgeText ? `<div class="badge">${badgeText}</div>` : ''}
      <h2 style="color:#1e3a8a; margin:0 0 12px; font-size:18px; font-weight:800;">${title}</h2>
      <p style="margin:0 0 14px; color:#475569; font-size:14px; line-height:1.5;">${message}</p>
      ${entityType === 'event' ? `
      <div class="card">
        ${eventDate ? `<p style="margin:0 0 6px;"><strong>📅 Date:</strong> ${eventDate}</p>` : ''}
        ${eventTime ? `<p style="margin:0 0 6px;"><strong>🕒 Time:</strong> ${eventTime}</p>` : ''}
        ${venue ? `<p style="margin:0;"><strong>📍 Venue:</strong> ${venue}</p>` : ''}
      </div>` : ''}
      ${description ? `<p style="margin:12px 0; color:#334155; font-size:13.5px; line-height:1.5;">${description}</p>` : ''}
      <div style="text-align:center; margin:22px 0 10px;">
        <a href="${targetUrl}" class="btn">View on SJDB Connect Website →</a>
      </div>
    </div>
    <div class="footer">
      <p style="margin:0 0 4px; font-weight:700; color:#cbd5e1;">St. John de Britto Church, Kalayarkoil - 630551</p>
      <p style="margin:0; color:#64748b;">Automated Parish Notification System</p>
    </div>
  </div>
</body>
</html>`;
}

function buildWhatsAppMessage({
  entityType,
  title,
  badgeText,
  eventDate,
  eventTime,
  venue,
  description,
  targetUrl
}) {
  if (entityType === 'event') {
    return `🔔 *PARISH EVENT NOTIFICATION*
⛪ *St. John de Britto Church, Kalayarkoil*

*${title}*
${badgeText ? `⏰ *${badgeText}*\n` : ''}
${eventDate ? `📅 *Date:* ${eventDate}\n` : ''}${eventTime ? `🕒 *Time:* ${eventTime}\n` : ''}${venue ? `📍 *Venue:* ${venue}\n` : ''}
${description ? `_${description}_\n\n` : ''}🔗 *View Event Details:*
${targetUrl}

_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_`;
  }

  return `📢 *PARISH ANNOUNCEMENT*
⛪ *St. John de Britto Church, Kalayarkoil*

*${title}*
${badgeText ? `📌 *${badgeText}*\n` : ''}
${description ? `${description}\n\n` : ''}🔗 *View Announcements:*
${targetUrl}

_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_`;
}

// ─── MASTER SCHEDULER TICK ───────────────────────────────────────────────────

let isSchedulerRunning = false;

async function runCentralSchedulerTick() {
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;

  try {
    // 1. Cleanup expired announcements & crossed events
    await cleanupExpiredAnnouncements();
    await cleanupCrossedEventAnnouncements();

    // 2. Scan and dispatch Event reminders
    await processEventReminders();

    // 3. Scan and dispatch Announcement reminders
    await processAnnouncementReminders();
  } catch (err) {
    console.error('[CentralScheduler] Tick error:', err.message);
  } finally {
    isSchedulerRunning = false;
  }
}

// Single central cron: runs every minute
cron.schedule('* * * * *', async () => {
  await runCentralSchedulerTick();
});

console.log('🚀 [CentralScheduler] Central Notification Scheduler initialized (runs every 1 min).');

module.exports = {
  onEventCreated,
  onEventUpdated,
  onEventCancelledOrDeleted,
  onAnnouncementCreated,
  onAnnouncementCancelledOrExpired,
  cleanupCrossedEventAnnouncements,
  cleanupExpiredAnnouncements,
  runCentralSchedulerTick,
  syncEventToAnnouncement,
  getRecipients,
  sendLogicalNotification,
  getEventExactDateTime,
  getAnnouncementExactExpiry
};
