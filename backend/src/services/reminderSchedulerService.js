/**
 * Automated Reminder Scheduler Service
 * Sends scheduled email & WhatsApp bot reminders to all registered users:
 * - 2 Days before event/announcement
 * - 1 Day before event/announcement
 * - On event/announcement day at 5:00 AM IST
 * - On event/announcement day at 12:00 PM IST (if event/announcement is after 12:00 PM)
 */

const cron = require('node-cron');
const Event = require('../models/Event');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const ReminderLog = require('../models/ReminderLog');
const { sendMail } = require('../config/mailer');
const { createNotification } = require('./notificationService');

function sendWA(phone, text) {
  return require('../bot/whatsapp').sendWhatsAppMessage(phone, text).catch(() => {});
}

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

function getDateOnlyStr(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysDifference(targetDate, baseDate = new Date()) {
  const tStr = getDateOnlyStr(targetDate);
  const bStr = getDateOnlyStr(baseDate);
  if (!tStr || !bStr) return null;

  const t = new Date(tStr + 'T00:00:00Z');
  const b = new Date(bStr + 'T00:00:00Z');
  const diffTime = t.getTime() - b.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function isAfterNoon(timeStr) {
  if (!timeStr) return true; // Default to true so afternoon reminder is included for flexible time
  const str = String(timeStr).trim().toLowerCase();

  if (str.includes('pm')) {
    // e.g. "12:00 pm", "2:30 pm", "5:00 pm"
    return true;
  }
  if (str.includes('am')) {
    // 10:00 am, 11:30 am are before noon
    return false;
  }
  // 24-hour clock check
  const parts = str.split(':');
  if (parts.length >= 1) {
    const hour = parseInt(parts[0], 10);
    if (!isNaN(hour)) {
      return hour >= 12;
    }
  }
  return true;
}

// ─── REMINDER DISPATCHER ──────────────────────────────────────────────────────

async function sendReminderToAllUsers({
  itemId,
  itemModel,
  title,
  details,
  dateText,
  timeText,
  venueText,
  category,
  typeLabel,
  targetUrl,
  reminderType
}) {
  try {
    // Check duplicate log
    const exists = await ReminderLog.findOne({ itemId, reminderType });
    if (exists) return 0;

    const users = await User.find({ isVerified: true }).select('name email phone');
    if (!users || users.length === 0) return 0;

    const clientUrl = process.env.CLIENT_URL?.replace('http://localhost:5173', 'https://st-jb-church.vercel.app') || 'https://st-jb-church.vercel.app';
    const fullLink = `${clientUrl}${targetUrl}`;

    // Email Subject & Body
    const emailSubject = `Reminder: ${title} — ${typeLabel}`;
    const htmlContent = `
      <div style="background: #f1f5f9; padding: 20px 10px; width: 100%; box-sizing: border-box; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;">
        <div style="max-width: 580px; width: 100%; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 14px rgba(0,0,0,0.06); box-sizing: border-box;">
          <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 28px 20px; text-align: center; color: #ffffff;">
            <div style="width: 75px; height: 75px; margin: 0 auto 12px; border-radius: 50%; overflow: hidden; border: 3px solid #fbbf24; background: #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.25);">
              <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
            </div>
            <h2 style="margin: 0; color: #fbbf24; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">St. John de Britto's Church</h2>
            <p style="margin: 4px 0 0; color: #e2e8f0; font-size: 12.5px; font-weight: 500;">Kalayarkoil Parish Event & Announcement Reminder</p>
          </div>
          <div style="padding: 22px 18px; color: #334155; line-height: 1.6;">
            <div style="display: inline-block; background: #fef3c7; color: #92400e; font-weight: 800; font-size: 11px; padding: 4px 12px; border-radius: 6px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
              ${typeLabel.toUpperCase()}
            </div>
            <h3 style="margin: 0 0 12px; font-size: 19px; font-weight: 800; color: #0f172a;">${title}</h3>
            
            <div style="background: #f8fafc; border-left: 4px solid #d4a017; padding: 14px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; font-size: 13.5px;">
              ${dateText ? `<p style="margin: 0 0 6px;"><strong>Date:</strong> ${dateText}</p>` : ''}
              ${timeText ? `<p style="margin: 0 0 6px;"><strong>Time:</strong> ${timeText}</p>` : ''}
              ${venueText ? `<p style="margin: 0 0 6px;"><strong>Venue:</strong> ${venueText}</p>` : ''}
            </div>

            ${details ? `<p style="margin: 16px 0; color: #475569; font-size: 13.5px; line-height: 1.6; word-break: break-word;">${details}</p>` : ''}

            <div style="text-align: center; margin-top: 20px;">
              <a href="${fullLink}" style="background: #d4a017; color: #ffffff; text-decoration: none; padding: 12px 26px; font-weight: 800; font-size: 13.5px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(212,160,23,0.3); max-width: 100%; box-sizing: border-box; text-align: center;">
                View Full Details on Website →
              </a>
            </div>
          </div>
          <div style="background: #0f172a; padding: 16px 18px; text-align: center; color: #94a3b8; font-size: 11px;">
            <p style="margin: 0;">© ${new Date().getFullYear()} St. John de Britto's Church, Kalayarkoil. All rights reserved.</p>
          </div>
        </div>
      </div>
    `;

    // WhatsApp Message
    const waMsg = ` *REMINDER: ${title}* (${typeLabel})
${dateText ? ` *Date:* ${dateText}\n` : ''}${timeText ? ` *Time:* ${timeText}\n` : ''}${venueText ? ` *Venue:* ${venueText}\n` : ''}
${details ? `_${details.slice(0, 160)}..._\n\n` : ''} *View Details:*
${fullLink}

 _St. John de Britto's Church, Kalayarkoil_`;

    let count = 0;
    for (const u of users) {
      if (u.email) {
        sendMail({
          to: u.email,
          subject: emailSubject,
          html: htmlContent
        }).catch(err => console.warn(`Reminder email error for ${u.email}:`, err.message));
      }
      if (u.phone) {
        sendWA(u.phone, waMsg);
      }
      count++;
    }

    // In-app Broadcast Notification
    createNotification({
      isBroadcast: true,
      recipient: 'user',
      title: ` Reminder: ${title}`,
      message: `${typeLabel} — ${dateText || ''} ${timeText ? 'at ' + timeText : ''}`,
      type: category || 'announcement',
      category: category || 'announcements',
      priority: 'high',
      actionUrl: targetUrl,
      relatedId: itemId,
      relatedModel: itemModel,
      channels: []
    }).catch(e => console.warn('Reminder in-app notification error:', e.message));

    // Save Log to MongoDB
    await ReminderLog.create({
      itemId,
      itemModel,
      reminderType,
      title,
      sentCount: count,
      sentAt: new Date()
    }).catch(() => {});

    console.log(` [Reminder Sent] ${itemModel} "${title}" (${reminderType}) sent to ${count} users`);
    return count;
  } catch (err) {
    console.error(` [Reminder Error] for ${itemModel} "${title}":`, err.message);
    return 0;
  }
}

// ─── MAIN SCHEDULER PROCESSOR ───────────────────────────────────────────────

async function checkAndSendReminders(triggerSource = 'cron') {
  try {
    const now = new Date();
    const currentHour = now.getHours(); // 0 - 23

    // 1. Process EVENTS
    const events = await Event.find({ isPublished: true, date: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2) } });

    for (const ev of events) {
      const diffDays = getDaysDifference(ev.date, now);
      const dateText = new Date(ev.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const timeText = ev.time || '';
      const venueText = ev.venue || 'Church Premises';

      // 2 Days Before
      if (diffDays === 2) {
        await sendReminderToAllUsers({
          itemId: ev._id,
          itemModel: 'Event',
          title: ev.title,
          details: ev.description,
          dateText,
          timeText,
          venueText,
          category: 'events',
          typeLabel: '2 Days to Go',
          targetUrl: '/events',
          reminderType: '2_days_before'
        });
      }

      // 1 Day Before
      if (diffDays === 1) {
        await sendReminderToAllUsers({
          itemId: ev._id,
          itemModel: 'Event',
          title: ev.title,
          details: ev.description,
          dateText,
          timeText,
          venueText,
          category: 'events',
          typeLabel: 'Tomorrow',
          targetUrl: '/events',
          reminderType: '1_day_before'
        });
      }

      // Day of Event (5:00 AM & 12:00 PM)
      if (diffDays === 0) {
        // 5:00 AM Reminder (sent if currentHour >= 5)
        if (currentHour >= 5) {
          await sendReminderToAllUsers({
            itemId: ev._id,
            itemModel: 'Event',
            title: ev.title,
            details: ev.description,
            dateText,
            timeText,
            venueText,
            category: 'events',
            typeLabel: 'Today (Morning Alert)',
            targetUrl: '/events',
            reminderType: 'day_of_5am'
          });
        }

        // 12:00 PM Afternoon Reminder (sent if currentHour >= 12 and event is after noon)
        if (currentHour >= 12 && isAfterNoon(ev.time)) {
          await sendReminderToAllUsers({
            itemId: ev._id,
            itemModel: 'Event',
            title: ev.title,
            details: ev.description,
            dateText,
            timeText,
            venueText,
            category: 'events',
            typeLabel: 'Today (Afternoon Reminder)',
            targetUrl: '/events',
            reminderType: 'day_of_12pm'
          });
        }
      }
    }

    // 2. Process ANNOUNCEMENTS
    const announcements = await Announcement.find({
      isPublished: true,
      $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }]
    });

    for (const ann of announcements) {
      const targetDate = ann.expiresAt || ann.createdAt;
      const diffDays = getDaysDifference(targetDate, now);
      const dateText = new Date(targetDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      // 2 Days Before / Active Notice
      if (diffDays === 2) {
        await sendReminderToAllUsers({
          itemId: ann._id,
          itemModel: 'Announcement',
          title: ann.title,
          details: ann.content,
          dateText,
          timeText: '',
          venueText: '',
          category: 'announcements',
          typeLabel: '2 Days Away Notice',
          targetUrl: '/announcements',
          reminderType: '2_days_before'
        });
      }

      // 1 Day Before
      if (diffDays === 1) {
        await sendReminderToAllUsers({
          itemId: ann._id,
          itemModel: 'Announcement',
          title: ann.title,
          details: ann.content,
          dateText,
          timeText: '',
          venueText: '',
          category: 'announcements',
          typeLabel: 'Tomorrow Notice',
          targetUrl: '/announcements',
          reminderType: '1_day_before'
        });
      }

      // Day of Announcement (5:00 AM & 12:00 PM)
      if (diffDays === 0) {
        if (currentHour >= 5) {
          await sendReminderToAllUsers({
            itemId: ann._id,
            itemModel: 'Announcement',
            title: ann.title,
            details: ann.content,
            dateText,
            timeText: '',
            venueText: '',
            category: 'announcements',
            typeLabel: 'Today Notice (Morning)',
            targetUrl: '/announcements',
            reminderType: 'day_of_5am'
          });
        }

        if (currentHour >= 12) {
          await sendReminderToAllUsers({
            itemId: ann._id,
            itemModel: 'Announcement',
            title: ann.title,
            details: ann.content,
            dateText,
            timeText: '',
            venueText: '',
            category: 'announcements',
            typeLabel: 'Today Notice (Afternoon)',
            targetUrl: '/announcements',
            reminderType: 'day_of_12pm'
          });
        }
      }
    }
  } catch (err) {
    console.error(' [Reminder Scheduler Error]:', err.message);
  }
}

// ─── CRON SCHEDULES ─────────────────────────────────────────────────────────

// 1. 5:00 AM IST daily cron (0 5 * * *)
cron.schedule('0 5 * * *', () => {
  console.log(' Running 5:00 AM IST Event & Announcement Reminder Cron...');
  checkAndSendReminders('cron_5am');
}, { timezone: 'Asia/Kolkata' });

// 2. 12:00 PM IST daily cron (0 12 * * *)
cron.schedule('0 12 * * *', () => {
  console.log(' Running 12:00 PM IST Afternoon Event & Announcement Reminder Cron...');
  checkAndSendReminders('cron_12pm');
}, { timezone: 'Asia/Kolkata' });

// 3. Hourly fallback check (0 * * * *) to ensure no missed reminders
cron.schedule('0 * * * *', () => {
  checkAndSendReminders('cron_hourly');
}, { timezone: 'Asia/Kolkata' });

// Run initial check 10 seconds after server startup
setTimeout(() => {
  console.log(' Initializing Event & Announcement Reminder Scheduler...');
  checkAndSendReminders('startup');
}, 10000);

module.exports = {
  checkAndSendReminders
};
