/**
 * Hourly Announcement Reminder Service — SJDB Connect
 * St. John de Britto Church, Kalayarkoil
 *
 * Implements the server-side Hourly Announcement Reminder & Auto-Expiry System:
 * 1. Admin creates announcement with "Expires At" date.
 * 2. While active, the announcement is visible on both Public website & Admin pages.
 * 3. Reminder notifications are sent periodically (every 1 hour) across all channels:
 *    - Website in-app notifications
 *    - Browser / web push notifications
 *    - Email
 *    - WhatsApp bot (SJDB Connect / Baileys)
 *    - WhatsApp Official Channel
 *    - With announcements page link: /announcements
 * 4. Pre-send safety: checks database immediately before EVERY send:
 *    - If deleted -> STOP
 *    - If unpublished -> STOP
 *    - If expired / currentTime >= expiresAt -> mark EXPIRED & STOP
 * 5. At/after expiration:
 *    - Status becomes "expired"
 *    - Halts all future reminders immediately (0 further messages sent)
 *    - Completely removed from Public and Admin announcement listings & searches
 * 6. Runs 24/7 on Node.js/Express backend; admin does not need to keep website open.
 */

const cron = require('node-cron');
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
  const wa = getWA();
  if (wa && typeof wa.sendWhatsAppMessage === 'function') {
    return wa.sendWhatsAppMessage(phone, text).catch(() => {});
  }
  return Promise.resolve(false);
}

// ─── DATE & TIME HELPERS (Asia/Kolkata UTC+5:30) ─────────────────────────────

/**
 * Returns YYYY-MM-DD in Asia/Kolkata timezone
 */
function getKolkataDateString(dateInput = new Date()) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

/**
 * Calculates the exact Date object for an announcement expiration in Asia/Kolkata.
 * If only a calendar date is specified (midnight UTC), expiration is end-of-day (23:59:59.999 IST).
 * If a specific time is included, uses that exact timestamp.
 */
function getAnnouncementExactExpiry(announcement) {
  if (!announcement || !announcement.expiresAt) return null;
  const d = new Date(announcement.expiresAt);
  if (isNaN(d.getTime())) return null;

  // Check if date was stored without specific time (00:00:00.000 UTC)
  const iso = d.toISOString();
  if (iso.endsWith('T00:00:00.000Z')) {
    // Treat as end of that calendar day in IST (23:59:59.999 IST = 18:29:59.999 UTC)
    const kolkataDateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const [yearStr, monthStr, dayStr] = kolkataDateStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);

    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const utcEpochMs = Date.UTC(year, month, day, 23, 59, 59, 999) - istOffsetMs;
    return new Date(utcEpochMs);
  }

  return d;
}

/**
 * Formats user-friendly date in Asia/Kolkata
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

async function getAnnouncementRecipients() {
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
      if (prefs.includes('announcements') || prefs.length === 0) {
        phoneSet.add(clean);
      }
    }
  });

  return { emails: Array.from(emailSet), phones: Array.from(phoneSet) };
}

// ─── DISPATCH HOURLY ANNOUNCEMENT REMINDER ───────────────────────────────────

/**
 * Dispatches an hourly reminder for an announcement across all channels.
 * Performs immediate pre-send verification.
 */
async function dispatchHourlyAnnouncementReminder(announcementId, { isInitial = false } = {}) {
  const now = new Date();

  // 1. Immediate pre-send check on fresh document
  const freshAnn = await Announcement.findById(announcementId);
  if (!freshAnn) {
    console.log(`[HourlyAnnouncementReminder] Announcement ${announcementId} was deleted. Aborting reminder.`);
    return { skipped: true, reason: 'deleted' };
  }

  // Pre-send check: unpublished or soft-deleted
  if (freshAnn.status === 'unpublished' || freshAnn.status === 'deleted' || freshAnn.isPublished === false) {
    console.log(`[HourlyAnnouncementReminder] Announcement "${freshAnn.title}" is ${freshAnn.status || 'unpublished'}. Aborting reminder.`);
    freshAnn.reminderStatus = 'cancelled';
    await freshAnn.save().catch(() => {});
    return { skipped: true, reason: 'unpublished_or_deleted' };
  }

  // Pre-send check: expiration boundary
  const expiryDate = getAnnouncementExactExpiry(freshAnn);
  if (freshAnn.status === 'expired' || (expiryDate && now >= expiryDate)) {
    console.log(`[HourlyAnnouncementReminder] Announcement "${freshAnn.title}" expired. Marking EXPIRED and halting reminders.`);
    freshAnn.status = 'expired';
    freshAnn.reminderStatus = 'expired';
    freshAnn.isPublished = false;
    await freshAnn.save().catch(() => {});
    await cleanupExpiredAnnouncements(freshAnn._id);
    return { skipped: true, reason: 'expired' };
  }

  // 2. Deduplication check via ReminderLog for the current hour slot
  const kolkataNowStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const kolkataHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
  const reminderSlotKey = `hourly_ann_${freshAnn._id}_${kolkataNowStr}_H${kolkataHour}`;

  const alreadySentInHour = await ReminderLog.findOne({
    itemId: freshAnn._id,
    reminderType: reminderSlotKey
  });

  if (alreadySentInHour) {
    return { skipped: true, reason: 'already_sent_in_hour' };
  }

  // 3. Prepare Multi-Channel Content
  const clientUrl = getSiteUrl('');
  const announcementsPageUrl = `${clientUrl}/announcements`;
  const annTitle = freshAnn.title || 'Parish Announcement';
  const annContent = freshAnn.content || '';
  const annType = freshAnn.type || 'general';
  const annPriority = freshAnn.priority || 'medium';
  const expiryFormatted = formatExpiryDate(expiryDate);

  const priorityBadge = annPriority === 'urgent' ? '🚨 URGENT ANNOUNCEMENT' : '📢 PARISH ANNOUNCEMENT';

  // A. In-App Notification (Broadcast)
  createNotification({
    isBroadcast: true,
    recipient: 'user',
    title: `📢 Announcement: ${annTitle}`,
    message: `${annContent.slice(0, 150)}${annContent.length > 150 ? '...' : ''} (Valid until ${expiryFormatted}). Click to view on website.`,
    type: 'announcement',
    category: 'announcements',
    priority: annPriority === 'urgent' ? 'urgent' : 'high',
    actionUrl: '/announcements',
    relatedId: freshAnn._id,
    relatedModel: 'Announcement',
    channels: ['in_app', 'push', 'email', 'whatsapp']
  }).catch(e => console.warn('[HourlyAnnouncementReminder] In-app notification warning:', e.message));

  // B. Web Push Notification
  sendPushBroadcast({
    title: `📢 ${annTitle}`,
    body: `${annContent.slice(0, 120)}${annContent.length > 120 ? '...' : ''} • Tap to view announcements.`,
    url: '/announcements',
    tag: `sjdb-hourly-ann-${freshAnn._id}`
  }).catch(e => console.warn('[HourlyAnnouncementReminder] Push broadcast warning:', e.message));

  // C. Recipients (Email & WhatsApp)
  const { emails, phones } = await getAnnouncementRecipients();

  // D. Email Template
  const emailHtml = buildAnnouncementReminderEmailHtml({
    annTitle,
    priorityBadge,
    annContent,
    annType,
    expiryFormatted,
    announcementsPageUrl
  });

  for (const em of emails) {
    sendMail({
      to: em,
      subject: `📢 ${annTitle} — ${priorityBadge}`,
      html: emailHtml
    }).catch(e => console.warn(`[HourlyAnnouncementReminder] Email error to ${em}:`, e.message));
  }

  // E. WhatsApp Message via SJDB Connect
  const waMsg =
`📢 *PARISH ANNOUNCEMENT REMINDER*
⛪ *St. John de Britto Church, Kalayarkoil*

*${annTitle}*
📌 *Category:* ${annType.toUpperCase()}
⏰ *Valid Until:* ${expiryFormatted}

${annContent}

🔗 *View Announcements on Website:*
${announcementsPageUrl}

_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_`;

  for (const phone of phones) {
    sendWA(phone, waMsg);
  }

  // F. Publish to WhatsApp Official Channel (if available)
  try {
    const { publishChannelReminder } = require('./whatsappChannelService');
    publishChannelReminder({
      itemId: freshAnn._id,
      itemModel: 'Announcement',
      title: annTitle,
      details: annContent,
      dateText: expiryFormatted,
      timeText: 'Active',
      venueText: 'Church Parish',
      typeLabel: priorityBadge,
      targetUrl: '/announcements'
    }).catch(() => {});
  } catch {}

  // 4. Log to ReminderLog for strict idempotency
  await ReminderLog.create({
    itemId: freshAnn._id,
    itemModel: 'Announcement',
    reminderType: reminderSlotKey,
    title: annTitle,
    sentCount: emails.length + phones.length,
    sentAt: now
  }).catch(() => {});

  // 5. Update Announcement in Database: nextReminderAt = now + 1 hour
  freshAnn.lastReminderSentAt = now;
  freshAnn.nextReminderAt = new Date(now.getTime() + 60 * 60 * 1000); // exactly 1 hour from now
  freshAnn.reminderStatus = 'active';
  freshAnn.status = 'published';
  freshAnn.reminderCount = (freshAnn.reminderCount || 0) + 1;
  freshAnn.reminderHistory = freshAnn.reminderHistory || [];
  freshAnn.reminderHistory.push({
    sentAt: now,
    channels: ['in_app', 'push', 'email', 'whatsapp'],
    recipientCount: emails.length + phones.length
  });
  await freshAnn.save();

  console.log(`✅ [HourlyAnnouncementReminder] Sent reminder #${freshAnn.reminderCount} for "${annTitle}". Next reminder at ${freshAnn.nextReminderAt.toISOString()}`);

  return { success: true, count: emails.length + phones.length, nextReminderAt: freshAnn.nextReminderAt };
}

// ─── SCHEDULER SCANNER ────────────────────────────────────────────────────────

/**
 * Scans all published announcements.
 * 1. Checks if expiresAt has passed; if so, marks status="expired" and stops reminders.
 * 2. If active, dispatches hourly reminder when currentTime >= nextReminderAt.
 */
async function processHourlyAnnouncementReminders() {
  try {
    const now = new Date();

    // 1. Process and mark expired announcements
    await cleanupExpiredAnnouncements();

    // 2. Query published announcements
    const publishedAnnouncements = await Announcement.find({
      isPublished: true,
      status: 'published'
    });

    for (const ann of publishedAnnouncements) {
      const expiryDate = getAnnouncementExactExpiry(ann);

      // Check if expiration reached
      if (expiryDate && now >= expiryDate) {
        ann.status = 'expired';
        ann.reminderStatus = 'expired';
        ann.isPublished = false;
        await ann.save().catch(() => {});
        await cleanupExpiredAnnouncements(ann._id);
        continue;
      }

      // If hourly reminders not yet activated and announcement has future expiry:
      if (ann.reminderStatus !== 'active' && (!expiryDate || now < expiryDate)) {
        console.log(`[HourlyAnnouncementReminder] Activating hourly reminder cycle for announcement "${ann.title}".`);
        await dispatchHourlyAnnouncementReminder(ann._id, { isInitial: true });
        continue;
      }

      // If hourly reminders are active:
      if (ann.reminderStatus === 'active') {
        if (!ann.nextReminderAt || now >= new Date(ann.nextReminderAt)) {
          await dispatchHourlyAnnouncementReminder(ann._id);
        }
      }
    }
  } catch (err) {
    console.error('[HourlyAnnouncementReminder] Scheduler scan error:', err.message);
  }
}

// ─── EXPIRY CLEANUP & PURGE ──────────────────────────────────────────────────

/**
 * Marks expired announcements as status="expired" and removes them from active listings.
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

      await Notification.deleteMany({ relatedId: specificAnnId, category: 'announcements' }).catch(() => {});
      return;
    }

    // 1. Find and mark all announcements where expiresAt <= now as expired
    const expiredAnnouncements = await Announcement.find({
      status: { $ne: 'expired' },
      expiresAt: { $exists: true, $ne: null, $lte: now }
    });

    for (const ann of expiredAnnouncements) {
      ann.status = 'expired';
      ann.reminderStatus = 'expired';
      ann.isPublished = false;
      await ann.save().catch(() => {});
      await Notification.deleteMany({ relatedId: ann._id, category: 'announcements' }).catch(() => {});
      console.log(`🧹 [HourlyAnnouncementReminder] Marked announcement "${ann.title}" as EXPIRED (halted all reminders).`);
    }
  } catch (err) {
    console.warn('[HourlyAnnouncementReminder] cleanupExpiredAnnouncements warning:', err.message);
  }
}

// ─── LIFECYCLE HOOKS ─────────────────────────────────────────────────────────

/**
 * Called immediately when an admin creates a new announcement.
 */
async function onAnnouncementCreated(announcement) {
  try {
    const now = new Date();
    const expiryDate = getAnnouncementExactExpiry(announcement);

    if (announcement.isPublished !== false && (!expiryDate || now < expiryDate)) {
      console.log(`[HourlyAnnouncementReminder] New announcement "${announcement.title}" created. Initializing hourly reminder cycle!`);
      announcement.status = 'published';
      announcement.isPublished = true;
      announcement.reminderStatus = 'active';
      await announcement.save();

      await dispatchHourlyAnnouncementReminder(announcement._id, { isInitial: true });
    }
  } catch (err) {
    console.error('[HourlyAnnouncementReminder] onAnnouncementCreated error:', err.message);
  }
}

/**
 * Called immediately when an admin deletes or unpublishes an announcement.
 * Halts all pending reminders immediately.
 */
async function onAnnouncementCancelledOrExpired(announcementId, { reason = 'deleted' } = {}) {
  try {
    console.log(`[HourlyAnnouncementReminder] Announcement ${announcementId} ${reason}. Halting reminders immediately.`);
    await Announcement.findByIdAndUpdate(announcementId, {
      status: reason === 'unpublished' ? 'unpublished' : 'deleted',
      isPublished: false,
      reminderStatus: 'cancelled'
    }).catch(() => {});

    await Notification.deleteMany({ relatedId: announcementId, category: 'announcements' }).catch(() => {});
  } catch (err) {
    console.error('[HourlyAnnouncementReminder] onAnnouncementCancelledOrExpired error:', err.message);
  }
}

// ─── EMAIL TEMPLATE BUILDER ──────────────────────────────────────────────────

function buildAnnouncementReminderEmailHtml({
  annTitle,
  priorityBadge,
  annContent,
  annType,
  expiryFormatted,
  announcementsPageUrl
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Parish Announcement: ${escapeHtml(annTitle)}</title>
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
          ${escapeHtml(priorityBadge)}
        </div>
      </div>

      <!-- BODY -->
      <div style="padding: 26px 20px;">
        <h2 style="margin: 0 0 10px; font-size: 19px; font-weight: 800; color: #0f172a;">
          ${escapeHtml(annTitle)}
        </h2>

        <!-- DETAILS CARD -->
        <div style="background-color: #f8fafc; border-left: 4px solid #fbbf24; padding: 14px 16px; border-radius: 0 10px 10px 0; margin-bottom: 20px;">
          <p style="margin: 0 0 6px; font-size: 13.5px; color: #334155;">
            <strong>📌 Category:</strong> ${escapeHtml(annType.toUpperCase())}
          </p>
          <p style="margin: 0; font-size: 13.5px; color: #334155;">
            <strong>⏰ Valid Until:</strong> ${escapeHtml(expiryFormatted)}
          </p>
        </div>

        <div style="margin-bottom: 24px; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-line;">
          ${escapeHtml(annContent)}
        </div>

        <!-- ACTION BUTTON -->
        <div style="text-align: center; margin: 26px 0 10px;">
          <a href="${announcementsPageUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 800; padding: 13px 30px; border-radius: 10px; box-shadow: 0 4px 14px rgba(30, 58, 138, 0.35); text-align: center;">
            View Announcements on Church Website →
          </a>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="background-color: #0f172a; padding: 16px 18px; text-align: center; color: #94a3b8; font-size: 11.5px;">
        <p style="margin: 0; font-weight: 700; color: #f8fafc;">St. John de Britto Church, Kalayarkoil</p>
        <p style="margin: 4px 0 0; color: #64748b;">Automated Parish Announcement • Do not reply</p>
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

// ─── BACKGROUND CRON SCHEDULER (Runs every 1 minute) ─────────────────────────
cron.schedule('* * * * *', async () => {
  await processHourlyAnnouncementReminders();
}, { timezone: 'Asia/Kolkata' });

console.log('✅ [HourlyAnnouncementReminder] 1-Minute Cron Scheduler registered (Asia/Kolkata).');

module.exports = {
  processHourlyAnnouncementReminders,
  dispatchHourlyAnnouncementReminder,
  onAnnouncementCreated,
  onAnnouncementCancelledOrExpired,
  cleanupExpiredAnnouncements,
  getAnnouncementExactExpiry
};
