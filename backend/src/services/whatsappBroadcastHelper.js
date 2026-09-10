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
  const cleanTitle = (announcement.title || 'Parish Announcement').trim();
  let content = (announcement.content || announcement.description || '').trim();

  // Guard against broken or placeholder values
  if (!content || content.toLowerCase() === 'ee' || content.toLowerCase() === 'undefined' || content.toLowerCase() === 'null') {
    content = `The Parish Office of St. John de Britto's Church, Kalayarkoil, wishes to inform all parishioners regarding ${cleanTitle}.\n\nAll parishioners are kindly requested to take note of this information and participate actively in the parish community.\n\nFor further details, please contact the Parish Office.`;
  }

  const announcementUrl = `${getPublicClientUrl()}/announcements`;

  return `📢 *Parish Announcement*

⛪ *${cleanTitle}*

${content}

🌐 *Read the complete announcement:*
${announcementUrl}

— *St. John de Britto's Church, Kalayarkoil*
_SJDB Connect_`;
}

/**
 * Format an Event into the exact WhatsApp message template
 */
function formatEventWhatsApp(event) {
  const cleanTitle = (event.title || 'Parish Event').trim();
  let desc = (event.description || '').trim();
  if (desc.toLowerCase() === 'ee' || desc.toLowerCase() === 'test' || desc.toLowerCase() === 'undefined') {
    desc = `St. John de Britto's Church, Kalayarkoil, warmly invites all parishioners and their families to the ${cleanTitle}.\n\nThe gathering is being organized as an opportunity for parish families to come together in fellowship, strengthen community relationships, and participate in activities prepared by the parish.\n\nFor further information, please contact the Parish Office.`;
  }

  const dateFormatted = event.date ? formatEventDate(event.date) : '';
  const timeVal = (event.time || '').trim();
  const venueVal = (event.venue || event.location || '').trim();
  const organizerVal = (event.organizer || '').trim();

  const isRegRequired = event.registrationRequired === true ||
    event.registrationRequired === 'true' ||
    event.requiresRegistration === true ||
    event.requiresRegistration === 'true';

  // Build field lines cleanly, omitting any missing fields completely
  const infoLines = [];
  if (dateFormatted && dateFormatted !== 'undefined') {
    infoLines.push(`📅 *Date:* ${dateFormatted}`);
  }
  if (timeVal && timeVal !== 'undefined') {
    infoLines.push(`🕕 *Time:* ${timeVal}`);
  }
  if (venueVal && venueVal !== 'undefined') {
    infoLines.push(`📍 *Venue:* ${venueVal}`);
  }
  if (organizerVal && organizerVal !== 'undefined') {
    infoLines.push(`👤 *Organizer:* ${organizerVal}`);
  }

  const infoSection = infoLines.length > 0 ? infoLines.join('\n') : '';

  // Dynamic registration message
  const regMessage = isRegRequired
    ? `All parishioners and families are encouraged to participate and make the gathering a joyful and meaningful occasion.\n\n📝 *Registration is required.*`
    : `All parishioners and families are welcome to participate.`;

  const eventUrl = `${getPublicClientUrl()}/events`;

  return `📅 *Parish Event*

⛪ *${cleanTitle}*

${desc}

${infoSection ? `${infoSection}\n\n` : ''}${regMessage}

🌐 *View event details & register:*
${eventUrl}

— *St. John de Britto's Church, Kalayarkoil*
_SJDB Connect_`;
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
      wa.sendWhatsAppMessage(phone, msg).catch(() => {});
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
      wa.sendWhatsAppMessage(phone, msg).catch(() => {});
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

— *St. John de Britto's Church, Kalayarkoil*
_SJDB Connect_`;

    console.log(`[WhatsApp Broadcast] Auto-broadcasting maintenance update to ${recipients.length} recipients...`);

    for (const phone of recipients) {
      wa.sendWhatsAppMessage(phone, msg).catch(() => {});
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

