/**
 * Centralized Multi-Channel Broadcast Notification Service for Admin-Published Content
 * 
 * Channels Supported:
 * 1. WhatsApp Bot (Baileys socket with Twilio fallback)
 * 2. User Email (Rich branded HTML status cards)
 * 3. In-App / Website Notification Center (isBroadcast: true in MongoDB)
 * 4. Web Push Notification (sendPushBroadcast)
 * 
 * Rules:
 * - Respects user notification settings (email, whatsappOptIn, eventReminders, botPreferences)
 * - Immediate in-memory cache invalidation on content change
 * - Handles Created, Updated, and Cancelled/Restored lifecycles
 */

const User = require('../models/User');
const BotSession = require('../models/BotSession');
const Notification = require('../models/Notification');
const { sendMail } = require('../config/mailer');
const { sendPushBroadcast } = require('./webPushService');
const { invalidateCache } = require('../bot/churchDataCache');

const { getSiteUrl } = require('../config/siteRoutes');

function getWA() {
  return require('../bot/whatsapp');
}

function getClientUrl() {
  return getSiteUrl('');
}

/**
 * Formats standard Catholic parish date: e.g. "Sunday, 20 September 2026"
 */
function formatEventDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Collect eligible WhatsApp recipients respecting user opt-ins and preferences.
 */
async function getEligibleWhatsAppRecipients(preferenceType = 'events') {
  try {
    const [activeUsers, activeSessions] = await Promise.all([
      User.find({
        phone: { $exists: true, $ne: '' },
        whatsappOptIn: { $ne: false },
        isActive: { $ne: false }
      }).select('phone botPreferences settings').lean(),
      BotSession.find({
        step: { $ne: 'stopped' },
        phoneNumber: { $exists: true, $ne: '' }
      }).select('phoneNumber preferences').lean()
    ]);

    const recipientSet = new Set();

    activeUsers.forEach(u => {
      // Check botPreferences if specified
      if (u.botPreferences && u.botPreferences.length > 0 && preferenceType) {
        if (!u.botPreferences.includes(preferenceType) && !u.botPreferences.includes('all')) {
          return;
        }
      }
      const clean = (u.phone || '').replace(/\D/g, '');
      if (clean && clean.length >= 10) recipientSet.add(clean);
    });

    activeSessions.forEach(s => {
      if (s.preferences && s.preferences.length > 0 && preferenceType) {
        if (!s.preferences.includes(preferenceType) && !s.preferences.includes('all')) {
          return;
        }
      }
      const clean = (s.phoneNumber || '').replace(/\D/g, '');
      if (clean && clean.length >= 10) recipientSet.add(clean);
      else if (s.phoneNumber && s.phoneNumber.includes('@')) recipientSet.add(s.phoneNumber);
    });

    return Array.from(recipientSet);
  } catch (err) {
    console.error('[BroadcastNotificationService] Error collecting WhatsApp recipients:', err.message);
    return [];
  }
}

/**
 * Collect eligible Email recipients respecting user opt-ins and notification settings.
 */
async function getEligibleEmailRecipients(preferenceType = 'events') {
  try {
    const users = await User.find({
      email: { $exists: true, $ne: '' },
      isActive: { $ne: false }
    }).select('name email settings').lean();

    return users.filter(u => {
      if (!u.email || !u.email.includes('@')) return false;
      const notifs = u.settings?.notifications;
      if (notifs?.email === false) return false;
      if (preferenceType === 'events' && notifs?.eventReminders === false) return false;
      return true;
    });
  } catch (err) {
    console.error('[BroadcastNotificationService] Error collecting Email recipients:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. EVENT BROADCASTS (Created, Updated, Cancelled)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Broadcasts an Event to all channels on Publish, Update, or Cancellation.
 * @param {Object} params
 * @param {Object} params.event - Event document
 * @param {string} params.action - 'created' | 'updated' | 'cancelled'
 */
async function broadcastEventPublished({ event, action = 'created' }) {
  try {
    if (!event) return;

    // Immediately refresh in-memory cache
    invalidateCache('events');

    const cleanTitle = (event.title || 'Parish Event').trim();
    const eventUrl = `${getClientUrl()}/events`;
    const dateFormatted = event.date ? formatEventDate(event.date) : '';
    const timeVal = (event.time || '').trim();
    const venueVal = (event.venue || event.location || '').trim();
    const organizerVal = (event.organizer || '').trim();
    const desc = (event.description || '').trim();

    const isRegRequired = event.registrationRequired === true || event.registrationRequired === 'true';

    // 1. Format WhatsApp Message
    let waMessage = '';
    let emailSubject = '';
    let notifTitle = '';
    let notifMessage = '';
    let pushTitle = '';
    let pushBody = '';

    if (action === 'cancelled') {
      waMessage =
`⚠️ *Parish Event Cancelled*

⛪ *${cleanTitle}*

Please be informed that the following church event scheduled for ${dateFormatted || 'an upcoming date'} has been *cancelled*.

📅 *Scheduled Date:* ${dateFormatted || 'N/A'}
${venueVal ? `📍 *Venue:* ${venueVal}\n` : ''}
${desc ? `_${desc}_\n\n` : ''}For any questions or further details, please contact the Parish Office.

🌐 *View Church Calendar:*
${eventUrl}

— *St. John de Britto Church, Kalayarkoil*
_SJDB Connect_`;

      emailSubject = `⚠️ Parish Event Cancelled: ${cleanTitle}`;
      notifTitle = `⚠️ Event Cancelled: ${cleanTitle}`;
      notifMessage = `The church event "${cleanTitle}" scheduled for ${dateFormatted || 'upcoming date'} has been cancelled.`;
      pushTitle = `⚠️ Event Cancelled: ${cleanTitle}`;
      pushBody = `Event "${cleanTitle}" has been cancelled. View calendar for updates.`;
    } else if (action === 'updated') {
      const infoLines = [];
      if (dateFormatted) infoLines.push(`📅 *Date:* ${dateFormatted}`);
      if (timeVal) infoLines.push(`🕕 *Time:* ${timeVal}`);
      if (venueVal) infoLines.push(`📍 *Venue:* ${venueVal}`);
      if (organizerVal) infoLines.push(`👤 *Organizer:* ${organizerVal}`);

      waMessage =
`🔄 *Parish Event Details Updated*

⛪ *${cleanTitle}*

Please note the updated details for this upcoming parish event:

${infoLines.join('\n')}

${desc ? `_${desc}_\n\n` : ''}${isRegRequired ? '📝 *Registration is required for this event.*\n\n' : ''}🌐 *View Updated Event:*
${eventUrl}

— *St. John de Britto Church, Kalayarkoil*
_SJDB Connect_`;

      emailSubject = `🔄 Updated Event Details: ${cleanTitle}`;
      notifTitle = `🔄 Event Updated: ${cleanTitle}`;
      notifMessage = `The details for "${cleanTitle}" have been updated. Date: ${dateFormatted || 'TBA'}, Venue: ${venueVal || 'Church'}.`;
      pushTitle = `🔄 Event Updated: ${cleanTitle}`;
      pushBody = `Updated details for "${cleanTitle}". Check the website for changes.`;
    } else {
      // Newly Created / Published
      const infoLines = [];
      if (dateFormatted) infoLines.push(`📅 *Date:* ${dateFormatted}`);
      if (timeVal) infoLines.push(`🕕 *Time:* ${timeVal}`);
      if (venueVal) infoLines.push(`📍 *Venue:* ${venueVal}`);
      if (organizerVal) infoLines.push(`👤 *Organizer:* ${organizerVal}`);

      waMessage =
`📅 *New Parish Event Announced*

⛪ *${cleanTitle}*

${desc ? `${desc}\n\n` : ''}${infoLines.join('\n')}

${isRegRequired ? '📝 *Registration is required.*\n\n' : 'All parishioners and families are welcome to participate.\n\n'}🌐 *View Event Details & Register:*
${eventUrl}

— *St. John de Britto Church, Kalayarkoil*
_SJDB Connect_`;

      emailSubject = `📅 New Parish Event: ${cleanTitle}`;
      notifTitle = `📅 New Event: ${cleanTitle}`;
      notifMessage = `A new church event has been announced: ${cleanTitle}${dateFormatted ? ' on ' + dateFormatted : ''}${venueVal ? ' at ' + venueVal : ''}.`;
      pushTitle = `📅 New Event: ${cleanTitle}`;
      pushBody = `${cleanTitle}${dateFormatted ? ' • ' + dateFormatted : ''}. Click to view details.`;
    }

    // 2. In-App Notification (Broadcast to all users)
    Notification.create({
      isBroadcast: true,
      recipient: 'user',
      title: notifTitle,
      message: notifMessage,
      type: 'event',
      category: 'events',
      priority: action === 'cancelled' ? 'high' : 'medium',
      actionUrl: '/events',
      relatedId: event._id,
      relatedModel: 'Event',
      metadata: {
        eventId: event._id,
        title: cleanTitle,
        date: event.date,
        action
      },
      sentVia: ['whatsapp', 'email', 'push', 'inApp', 'website']
    }).catch(e => console.error('[BroadcastNotificationService] In-app event error:', e.message));

    // 3. Web Push Broadcast
    sendPushBroadcast({
      title: pushTitle,
      body: pushBody,
      url: '/events',
      tag: `event-${event._id}-${action}`,
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: { url: '/events', eventId: event._id }
    }).catch(e => console.warn('[BroadcastNotificationService] Push event broadcast error:', e.message));

    // 4. Email Broadcast to Eligible Users
    const emailRecipients = await getEligibleEmailRecipients('events');
    if (emailRecipients.length > 0) {
      const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', -apple-system, Roboto, Helvetica, Arial, sans-serif; }
    .box { max-width: 620px; margin: 25px auto; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 28px 24px; text-align: center; color: #ffffff; }
    .logo { width: 70px; height: 70px; margin: 0 auto 10px; border-radius: 50%; background: #ffffff; overflow: hidden; border: 3px solid #fbbf24; }
    .content { padding: 28px 24px; color: #1e293b; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin: 16px 0; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .btn { display: inline-block; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 14px; }
    .footer { background: #0f172a; padding: 16px; text-align: center; color: #94a3b8; font-size: 11.5px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="header">
      <div class="logo">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <h1 style="color:#fbbf24; margin:0 0 4px; font-size:20px; font-weight:800;">St. John de Britto Church</h1>
      <p style="margin:0; font-size:12px; color:#cbd5e1; font-weight:600;">PARISH EVENT NOTICE</p>
    </div>
    <div class="content">
      <h2 style="color:#1e3a8a; margin:0 0 10px; font-size:18px; font-weight:800;">${cleanTitle}</h2>
      <p style="margin:0 0 16px; color:#475569; font-size:14px; line-height:1.5;">${desc || 'You are warmly invited to this parish event.'}</p>
      
      <div class="card">
        ${dateFormatted ? `<div class="row"><strong>Date:</strong> <span>${dateFormatted}</span></div>` : ''}
        ${timeVal ? `<div class="row"><strong>Time:</strong> <span>${timeVal}</span></div>` : ''}
        ${venueVal ? `<div class="row"><strong>Venue:</strong> <span>${venueVal}</span></div>` : ''}
        ${organizerVal ? `<div class="row"><strong>Organizer:</strong> <span>${organizerVal}</span></div>` : ''}
        <div class="row"><strong>Status:</strong> <span style="font-weight:700; color:${action === 'cancelled' ? '#dc2626' : '#16a34a'};">${action === 'cancelled' ? 'Cancelled' : action === 'updated' ? 'Updated' : 'Active'}</span></div>
      </div>

      <div style="text-align:center; margin:24px 0 10px;">
        <a href="${eventUrl}" class="btn">👉 View Event Details & Calendar →</a>
      </div>
    </div>
    <div class="footer">
      <p style="margin:0 0 4px; font-weight:700; color:#cbd5e1;">St. John de Britto Church, Kalayarkoil - 630551</p>
      <p style="margin:0; color:#64748b;">Automated Parish Event Notification</p>
    </div>
  </div>
</body>
</html>`;

      // Async chunked email dispatch
      setImmediate(async () => {
        for (const recipient of emailRecipients) {
          sendMail({
            to: recipient.email,
            subject: emailSubject,
            html: emailHtml
          }).catch(() => { });
          await new Promise(r => setTimeout(r, 60));
        }
      });
    }

    // 5. WhatsApp Bot Broadcast to Eligible Subscribers
    const waRecipients = await getEligibleWhatsAppRecipients('events');
    if (waRecipients.length > 0) {
      const wa = getWA();
      setImmediate(async () => {
        console.log(`[BroadcastNotificationService] Broadcasting event "${cleanTitle}" (${action}) to ${waRecipients.length} WhatsApp subscribers...`);
        for (const phone of waRecipients) {
          wa.sendWhatsAppMessage(phone, waMessage).catch(() => { });
          await new Promise(r => setTimeout(r, 70));
        }
      });
    }

    return true;
  } catch (err) {
    console.error('[BroadcastNotificationService] broadcastEventPublished error:', err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ANNOUNCEMENT BROADCASTS (Created, Updated)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Broadcasts an Announcement to all channels on Publish or Update.
 * @param {Object} params
 * @param {Object} params.announcement - Announcement document
 * @param {string} params.action - 'created' | 'updated'
 */
async function broadcastAnnouncementPublished({ announcement, action = 'created' }) {
  try {
    if (!announcement) return;

    // Immediately refresh in-memory cache
    invalidateCache('announcements');

    const cleanTitle = (announcement.title || 'Parish Announcement').trim();
    let content = (announcement.content || announcement.description || '').trim();
    const announcementUrl = `${getClientUrl()}/announcements`;

    if (!content) {
      content = `The Parish Office of St. John de Britto Church wishes to inform all parishioners regarding ${cleanTitle}.`;
    }

    const waMessage = action === 'updated'
      ? `📢 *Parish Announcement Updated*

⛪ *${cleanTitle}*

${content}

🌐 *Read full announcement & notices:*
${announcementUrl}

— *St. John de Britto Church, Kalayarkoil*
_SJDB Connect_`
      : `📢 *Parish Announcement*

⛪ *${cleanTitle}*

${content}

🌐 *Read complete announcement:*
${announcementUrl}

— *St. John de Britto Church, Kalayarkoil*
_SJDB Connect_`;

    const notifTitle = action === 'updated' ? `📢 Updated Announcement: ${cleanTitle}` : `📢 ${cleanTitle}`;
    const notifMessage = content.length > 150 ? content.slice(0, 150) + '...' : content;
    const emailSubject = action === 'updated' ? `📢 Updated Parish Announcement: ${cleanTitle}` : `📢 Parish Announcement: ${cleanTitle}`;

    // 1. In-App Notification (Broadcast to all users)
    Notification.create({
      isBroadcast: true,
      recipient: 'user',
      title: notifTitle,
      message: notifMessage,
      type: 'announcement',
      category: 'announcements',
      priority: announcement.priority === 'urgent' ? 'high' : 'medium',
      actionUrl: '/announcements',
      relatedId: announcement._id,
      relatedModel: 'Announcement',
      metadata: {
        announcementId: announcement._id,
        title: cleanTitle,
        action
      },
      sentVia: ['whatsapp', 'email', 'push', 'inApp', 'website']
    }).catch(e => console.error('[BroadcastNotificationService] In-app announcement error:', e.message));

    // 2. Web Push Broadcast
    sendPushBroadcast({
      title: notifTitle,
      body: notifMessage.slice(0, 120),
      url: '/announcements',
      tag: `announcement-${announcement._id}-${action}`,
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: { url: '/announcements', announcementId: announcement._id }
    }).catch(e => console.warn('[BroadcastNotificationService] Push announcement broadcast error:', e.message));

    // 3. Email Broadcast
    const emailRecipients = await getEligibleEmailRecipients('announcements');
    if (emailRecipients.length > 0) {
      const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', -apple-system, Roboto, Helvetica, Arial, sans-serif; }
    .box { max-width: 620px; margin: 25px auto; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 28px 24px; text-align: center; color: #ffffff; }
    .logo { width: 70px; height: 70px; margin: 0 auto 10px; border-radius: 50%; background: #ffffff; overflow: hidden; border: 3px solid #fbbf24; }
    .content { padding: 28px 24px; color: #1e293b; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0; font-size: 14px; line-height: 1.6; }
    .btn { display: inline-block; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 14px; }
    .footer { background: #0f172a; padding: 16px; text-align: center; color: #94a3b8; font-size: 11.5px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="header">
      <div class="logo">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <h1 style="color:#fbbf24; margin:0 0 4px; font-size:20px; font-weight:800;">St. John de Britto Church</h1>
      <p style="margin:0; font-size:12px; color:#cbd5e1; font-weight:600;">PARISH ANNOUNCEMENT</p>
    </div>
    <div class="content">
      <h2 style="color:#1e3a8a; margin:0 0 12px; font-size:18px; font-weight:800;">${cleanTitle}</h2>
      <div class="card">${content.replace(/\n/g, '<br/>')}</div>

      <div style="text-align:center; margin:24px 0 10px;">
        <a href="${announcementUrl}" class="btn">👉 Read Full Announcement on Website →</a>
      </div>
    </div>
    <div class="footer">
      <p style="margin:0 0 4px; font-weight:700; color:#cbd5e1;">St. John de Britto Church, Kalayarkoil - 630551</p>
      <p style="margin:0; color:#64748b;">Official Parish Communication</p>
    </div>
  </div>
</body>
</html>`;

      setImmediate(async () => {
        for (const recipient of emailRecipients) {
          sendMail({
            to: recipient.email,
            subject: emailSubject,
            html: emailHtml
          }).catch(() => { });
          await new Promise(r => setTimeout(r, 60));
        }
      });
    }

    // 4. WhatsApp Bot Broadcast
    const waRecipients = await getEligibleWhatsAppRecipients('announcements');
    if (waRecipients.length > 0) {
      const wa = getWA();
      setImmediate(async () => {
        console.log(`[BroadcastNotificationService] Broadcasting announcement "${cleanTitle}" (${action}) to ${waRecipients.length} WhatsApp subscribers...`);
        for (const phone of waRecipients) {
          wa.sendWhatsAppMessage(phone, waMessage).catch(() => { });
          await new Promise(r => setTimeout(r, 70));
        }
      });
    }

    return true;
  } catch (err) {
    console.error('[BroadcastNotificationService] broadcastAnnouncementPublished error:', err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MAINTENANCE BROADCASTS (Scheduled, Started, Completed, Updated)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Broadcasts Maintenance updates across all channels.
 * @param {Object} params
 * @param {Object} params.settings - MaintenanceSetting document
 * @param {string} params.action - 'scheduled' | 'started' | 'completed' | 'updated' | 'emergency'
 */
async function broadcastMaintenanceScheduled({ settings, action = 'scheduled' }) {
  try {
    if (!settings) return;

    const maintenanceUrl = `${getClientUrl()}/maintenance`;
    const title = settings.title || settings.noticeBanner?.message || 'Church Website Maintenance';
    const category = settings.category || 'Scheduled Update';
    const messageText = settings.message || settings.noticeBanner?.message || 'System upgrades and improvements are underway.';

    const format12H = (dateVal) => {
      if (!dateVal) return 'TBA';
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'TBA';
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }) + ' IST';
    };

    const startTimeFormatted = format12H(settings.scheduler?.scheduledStart || settings.noticeBanner?.scheduledStartTime || new Date());
    const endTimeFormatted = format12H(settings.scheduler?.scheduledEnd || settings.noticeBanner?.scheduledEndTime || settings.expectedCompletion);

    let waMessage = '';
    let emailSubject = '';
    let notifTitle = '';
    let notifMessage = '';

    if (action === 'completed') {
      waMessage =
`✅ *Church Website Restored & Online*

The scheduled maintenance on our church website has been completed successfully.

All online services (Holy Mass bookings, prayer petitions, certificates, and online offertory) are now fully operational.

🌐 *Visit Church Website:*
${getClientUrl()}

Thank you for your patience and prayers! 🙏
— *St. John de Britto Church, Kalayarkoil*`;

      emailSubject = `✅ Church Website Maintenance Completed — All Services Online`;
      notifTitle = `✅ Maintenance Completed`;
      notifMessage = `The church website maintenance is complete. All services are online.`;
    } else if (action === 'started' || action === 'emergency') {
      waMessage =
`🛠️ *Church Website Maintenance in Progress*

🔧 *${title}*
⚙️ *Category:* ${category}
🕒 *Expected Completion:* ${endTimeFormatted}

_${messageText}_

During this window, online services may be temporarily unavailable.

🌐 *View Maintenance Status:*
${maintenanceUrl}

Thank you for your patience and understanding. 🙏
— *St. John de Britto Church, Kalayarkoil*`;

      emailSubject = `🛠️ Notice: Church Website Maintenance in Progress`;
      notifTitle = `🛠️ Maintenance in Progress`;
      notifMessage = `The church website is currently undergoing maintenance. Expected completion: ${endTimeFormatted}.`;
    } else {
      // 'scheduled' or 'updated'
      waMessage =
`🛠️ *${action === 'updated' ? 'Updated Notice:' : ''} Scheduled Website Maintenance*

🔧 *${title}*
⚙️ *Category:* ${category}
📅 *Start Time:* ${startTimeFormatted}
⏳ *Expected Completion:* ${endTimeFormatted}

_${messageText}_

🌐 *View Maintenance Notice & Updates:*
${maintenanceUrl}

— *St. John de Britto Church, Kalayarkoil*
_SJDB Connect_`;

      emailSubject = `🛠️ Scheduled Website Maintenance Notice — St. John de Britto Church`;
      notifTitle = `🛠️ Scheduled Website Maintenance`;
      notifMessage = `Maintenance scheduled from ${startTimeFormatted} to ${endTimeFormatted}. Details: ${messageText}`;
    }

    // 1. In-App Notification (Broadcast to all users)
    Notification.create({
      isBroadcast: true,
      recipient: 'user',
      title: notifTitle,
      message: notifMessage,
      type: 'system',
      category: 'system',
      priority: action === 'emergency' ? 'high' : 'medium',
      actionUrl: '/maintenance',
      metadata: {
        action,
        startTime: startTimeFormatted,
        endTime: endTimeFormatted
      },
      sentVia: ['whatsapp', 'email', 'push', 'inApp', 'website']
    }).catch(e => console.error('[BroadcastNotificationService] In-app maintenance error:', e.message));

    // 2. Web Push Broadcast
    sendPushBroadcast({
      title: notifTitle,
      body: notifMessage.slice(0, 120),
      url: '/maintenance',
      tag: `maintenance-${action}`,
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: { url: '/maintenance' }
    }).catch(e => console.warn('[BroadcastNotificationService] Push maintenance broadcast error:', e.message));

    // 3. Email Broadcast
    const emailRecipients = await getEligibleEmailRecipients();
    if (emailRecipients.length > 0) {
      const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', -apple-system, Roboto, Helvetica, Arial, sans-serif; }
    .box { max-width: 620px; margin: 25px auto; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 28px 24px; text-align: center; color: #ffffff; }
    .logo { width: 70px; height: 70px; margin: 0 auto 10px; border-radius: 50%; background: #ffffff; overflow: hidden; border: 3px solid #fbbf24; }
    .content { padding: 28px 24px; color: #1e293b; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .btn { display: inline-block; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 14px; }
    .footer { background: #0f172a; padding: 16px; text-align: center; color: #94a3b8; font-size: 11.5px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="header">
      <div class="logo">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <h1 style="color:#fbbf24; margin:0 0 4px; font-size:20px; font-weight:800;">St. John de Britto Church</h1>
      <p style="margin:0; font-size:12px; color:#cbd5e1; font-weight:600;">PORTAL MAINTENANCE NOTICE</p>
    </div>
    <div class="content">
      <h2 style="color:#1e3a8a; margin:0 0 10px; font-size:18px; font-weight:800;">${title}</h2>
      <p style="margin:0 0 16px; color:#475569; font-size:14px; line-height:1.5;">${messageText}</p>
      
      <div class="card">
        <div class="row"><strong>Status:</strong> <span style="font-weight:700; color:${action === 'completed' ? '#16a34a' : '#d97706'};">${action === 'completed' ? 'Completed (Online)' : action === 'started' ? 'In Progress' : 'Scheduled'}</span></div>
        <div class="row"><strong>Category:</strong> <span>${category}</span></div>
        <div class="row"><strong>Window Start:</strong> <span>${startTimeFormatted}</span></div>
        <div class="row"><strong>Expected Completion:</strong> <span>${endTimeFormatted}</span></div>
      </div>

      <div style="text-align:center; margin:24px 0 10px;">
        <a href="${maintenanceUrl}" class="btn">👉 View Maintenance Notice Portal →</a>
      </div>
    </div>
    <div class="footer">
      <p style="margin:0 0 4px; font-weight:700; color:#cbd5e1;">St. John de Britto Church, Kalayarkoil - 630551</p>
      <p style="margin:0; color:#64748b;">Church Technical Administration</p>
    </div>
  </div>
</body>
</html>`;

      setImmediate(async () => {
        for (const recipient of emailRecipients) {
          sendMail({
            to: recipient.email,
            subject: emailSubject,
            html: emailHtml
          }).catch(() => { });
          await new Promise(r => setTimeout(r, 60));
        }
      });
    }

    // 4. WhatsApp Bot Broadcast
    const waRecipients = await getEligibleWhatsAppRecipients();
    if (waRecipients.length > 0) {
      const wa = getWA();
      setImmediate(async () => {
        console.log(`[BroadcastNotificationService] Broadcasting maintenance notice (${action}) to ${waRecipients.length} WhatsApp subscribers...`);
        for (const phone of waRecipients) {
          wa.sendWhatsAppMessage(phone, waMessage).catch(() => { });
          await new Promise(r => setTimeout(r, 70));
        }
      });
    }

    return true;
  } catch (err) {
    console.error('[BroadcastNotificationService] broadcastMaintenanceScheduled error:', err.message);
    return false;
  }
}

module.exports = {
  broadcastEventPublished,
  broadcastAnnouncementPublished,
  broadcastMaintenanceScheduled,
  formatEventDate,
  getEligibleWhatsAppRecipients,
  getEligibleEmailRecipients
};
