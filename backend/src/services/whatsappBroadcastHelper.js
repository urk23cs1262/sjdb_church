/**
 * Automated WhatsApp Broadcast Helper for Admin-Created Content
 * 
 * Default Behavior:
 * Whenever an admin publishes an Event, Announcement, or Maintenance notice,
 * this helper automatically broadcasts the update to all eligible
 * WhatsApp subscribers and parish users.
 * 
 * Strict formatting rules:
 * 1. Announcement link is ALWAYS https://stjb-church.vercel.app/announcements
 * 2. Event link is ALWAYS https://stjb-church.vercel.app/events
 * 3. Dynamic registration message (Required vs Welcome)
 * 4. Zero "undefined" fields (missing organizer, venue, time, or date lines are cleanly omitted)
 * 5. Full, complete pastoral content without placeholder artifacts
 */

const User = require('../models/User');
const BotSession = require('../models/BotSession');
const { SITE_ROUTES, EXTERNAL_LINKS, getSiteUrl, getBaseClientUrl } = require('../config/siteRoutes');

function getWA() {
  return require('../bot/whatsapp');
}

function getPublicClientUrl() {
  return getBaseClientUrl();
}

/**
 * Format a Date object or string into standard Catholic parish date format:
 * e.g. "Sunday, 30 August 2026"
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
 * Format an Announcement into the exact WhatsApp message template
 */
function formatAnnouncementWhatsApp(announcement) {
  const { formatCanonicalAnnouncement } = require('./canonicalContentService');
  return formatCanonicalAnnouncement({ announcement, language: 'both' });
}

function formatEventWhatsApp(event) {
  const { formatCanonicalEvent } = require('./canonicalContentService');
  return formatCanonicalEvent({ event, language: 'both' });
}


/**
 * Fetch all unique, active WhatsApp recipient phone numbers (excluding STOP opt-outs)
 */
async function getEligibleWhatsAppRecipients() {
  try {
    const [activeUsers, activeSessions] = await Promise.all([
      User.find({
        phone: { $exists: true, $ne: '' },
        whatsappOptIn: { $ne: false },
        isActive: { $ne: false }
      }).select('phone').lean(),
      BotSession.find({
        step: { $ne: 'stopped' },
        phoneNumber: { $exists: true, $ne: '' }
      }).select('phoneNumber').lean()
    ]);

    const recipientSet = new Set();

    activeUsers.forEach(u => {
      const clean = (u.phone || '').replace(/\D/g, '');
      if (clean && clean.length >= 10) recipientSet.add(clean);
    });

    activeSessions.forEach(s => {
      const clean = (s.phoneNumber || '').replace(/\D/g, '');
      if (clean && clean.length >= 10) recipientSet.add(clean);
      else if (s.phoneNumber && s.phoneNumber.includes('@')) recipientSet.add(s.phoneNumber);
    });

    return Array.from(recipientSet);
  } catch (err) {
    console.error('[WhatsApp Broadcast Helper] Error collecting recipients:', err.message);
    return [];
  }
}

/**
 * Automatically broadcast a newly published Event to all WhatsApp subscribers
 */
async function broadcastEventCreated(event) {
  try {
    if (!event || event.isPublished === false) return;

    const wa = getWA();
    const recipients = await getEligibleWhatsAppRecipients();
    if (!recipients.length) return;

    const msg = formatEventWhatsApp(event);

    console.log(`[WhatsApp Broadcast] Auto-broadcasting new event "${event.title}" to ${recipients.length} recipients...`);

    for (const phone of recipients) {
      wa.sendWhatsAppMessage(phone, msg).catch(() => { });
      await new Promise(r => setTimeout(r, 70));
    }
  } catch (err) {
    console.error('[WhatsApp Broadcast] Event broadcast error:', err.message);
  }
}

/**
 * Automatically broadcast a newly published Announcement to all WhatsApp subscribers
 */
async function broadcastAnnouncementCreated(announcement) {
  try {
    if (!announcement || announcement.isPublished === false) return;

    const wa = getWA();
    const recipients = await getEligibleWhatsAppRecipients();
    if (!recipients.length) return;

    const msg = formatAnnouncementWhatsApp(announcement);

    console.log(`[WhatsApp Broadcast] Auto-broadcasting new announcement "${announcement.title}" to ${recipients.length} recipients...`);

    for (const phone of recipients) {
      wa.sendWhatsAppMessage(phone, msg).catch(() => { });
      await new Promise(r => setTimeout(r, 70));
    }
  } catch (err) {
    console.error('[WhatsApp Broadcast] Announcement broadcast error:', err.message);
  }
}

/**
 * Automatically broadcast a Maintenance notice to all WhatsApp subscribers
 */
async function broadcastMaintenanceCreated(maintenance) {
  try {
    const wa = getWA();
    const recipients = await getEligibleWhatsAppRecipients();
    if (!recipients.length) return;

    const title = maintenance.title || maintenance.noticeBanner?.message || 'Scheduled Church Maintenance';
    const schedule = maintenance.schedule || maintenance.expectedCompletion || 'Upcoming Days';
    const location = maintenance.location || "Parish Grounds & Facilities";

    const msg = `🛠️ *Church Maintenance Update*

🔧 *${title}*
🗓️ *Schedule:* ${schedule}
📍 *Location:* ${location}

${maintenance.description ? `_${maintenance.description}_\n\n` : ''}Thank you for your cooperation and continued prayers. 🙏

— *St. John de Britto Church, Kalayarkoil*
_SJDB Connect_`;

    console.log(`[WhatsApp Broadcast] Auto-broadcasting maintenance update to ${recipients.length} recipients...`);

    for (const phone of recipients) {
      wa.sendWhatsAppMessage(phone, msg).catch(() => { });
      await new Promise(r => setTimeout(r, 70));
    }
  } catch (err) {
    console.error('[WhatsApp Broadcast] Maintenance broadcast error:', err.message);
  }
}

module.exports = {
  formatAnnouncementWhatsApp,
  formatEventWhatsApp,
  getEligibleWhatsAppRecipients,
  broadcastEventCreated,
  broadcastAnnouncementCreated,
  broadcastMaintenanceCreated
};

