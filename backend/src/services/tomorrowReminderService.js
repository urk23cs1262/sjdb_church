/**
 * Tomorrow Content Reminder Scheduler Service
 * St. John de Britto Church
 * 
 * Automatically sends consolidated morning reminders for tomorrow's events
 * and announcements to all active parishioners at 6:00 AM IST daily.
 * 
 * Key Features:
 * 1. Strictly runs at 6:00 AM IST (Asia/Kolkata: "0 6 * * *") via node-cron
 * 2. Compares dates in Asia/Kolkata calendar (never raw UTC drift)
 * 3. Consolidates multiple events & announcements into ONE morning message per user
 * 4. Multi-channel delivery: WhatsApp (Baileys), Email, In-App, Web Push, SMS
 * 5. Channel resilience: if WhatsApp or Email fails, other channels still proceed
 * 6. Idempotent: protected by NotificationJobLog & ReminderLog against duplicates
 * 7. Bilingual: respects English, Tamil, and bilingual user preferences
 * 8. Admin test execution endpoint support
 */

const cron = require('node-cron');
const Event = require('../models/Event');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const NotificationJobLog = require('../models/NotificationJobLog');
const { createNotification } = require('./notificationService');
const { sendMail } = require('../config/mailer');
const { sendSMS } = require('../config/twilio');
const { sendPushToUser, sendPushBroadcast } = require('./webPushService');
const { getPublicFrontendUrl } = require('./eventRegistrationService');

function sendWA(phone, text) {
  try {
    const wa = require('../bot/whatsapp');
    if (wa && typeof wa.sendWhatsAppMessage === 'function') {
      return wa.sendWhatsAppMessage(phone, text).catch(err => {
        console.warn('[TomorrowReminder] WhatsApp error:', err.message);
        return false;
      });
    }
  } catch (err) {
    console.warn('[TomorrowReminder] WhatsApp module error:', err.message);
  }
  return Promise.resolve(false);
}

/**
 * Returns YYYY-MM-DD string in Asia/Kolkata timezone with day offset
 * @param {number} dayOffset 0 for today, 1 for tomorrow, etc.
 */
function getKolkataDateString(dayOffset = 0) {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istMs = utcMs + (5.5 * 3600000) + (dayOffset * 86400000);
  const istDate = new Date(istMs);

  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a date or string into YYYY-MM-DD in Asia/Kolkata
 */
function toKolkataDateString(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // en-CA gives YYYY-MM-DD
}

/**
 * Finds all active, published events and announcements scheduled for a target date
 */
async function getTomorrowContent(targetDateStr) {
  // Query all published, non-cancelled events
  const allEvents = await Event.find({
    isPublished: { $ne: false },
    status: { $nin: ['cancelled', 'completed'] }
  }).lean();

  const matchingEvents = allEvents.filter(ev => {
    const evDateStr = toKolkataDateString(ev.date);
    return evDateStr === targetDateStr;
  });

  // Query all published, non-expired announcements
  const allAnnouncements = await Announcement.find({
    isPublished: { $ne: false }
  }).lean();

  const matchingAnnouncements = allAnnouncements.filter(ann => {
    // Check explicit date, or expiresAt
    const annDateStr = toKolkataDateString(ann.date || ann.expiresAt);
    return annDateStr === targetDateStr;
  });

  return {
    events: matchingEvents,
    announcements: matchingAnnouncements
  };
}

/**
 * Build consolidated text and HTML message for a user based on language
 */
function buildReminderContent({ events, announcements, targetDateStr, lang = 'en' }) {
  const publicBase = getPublicFrontendUrl();
  const eventsUrl = `${publicBase}/events`;
  const announcementsUrl = `${publicBase}/announcements`;

  const d = new Date(targetDateStr + 'T00:00:00+05:30');
  const formattedDateEn = d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedDateTa = d.toLocaleDateString('ta-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const isTamil = lang === 'ta';
  const isBoth = lang === 'both';

  // 1. WhatsApp Text
  let waText = '';
  if (isTamil) {
    waText = `*நாளை புனித அருளானந்தர் தேவாலய நிகழ்வுகள்* ⛪\n\n`;
    waText += `வணக்கம், நாளை (${formattedDateTa}) நமது பங்குத்தளத்தில் நடைபெறும் முக்கிய நிகழ்வுகள் மற்றும் அறிவிப்புகள்:\n\n`;

    if (events.length > 0) {
      waText += `*📅 நிகழ்வுகள் (EVENTS):*\n`;
      events.forEach((ev, idx) => {
        const title = ev.titleTa || ev.title;
        waText += `${idx + 1}. *${title}*\n`;
        if (ev.time) waText += `   ⏰ நேரம்: ${ev.time}\n`;
        if (ev.venue) waText += `   📍 இடம்: ${ev.venue}\n`;
      });
      waText += `👉 நிகழ்வுகளைப் பார்க்க: ${eventsUrl}\n\n`;
    }

    if (announcements.length > 0) {
      waText += `*📢 அறிவிப்புகள் (ANNOUNCEMENTS):*\n`;
      announcements.forEach((ann, idx) => {
        const title = ann.titleTa || ann.title;
        waText += `${idx + 1}. *${title}*\n`;
      });
      waText += `👉 அறிவிப்புகளைப் பார்க்க: ${announcementsUrl}\n\n`;
    }

    waText += `*புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்*`;
  } else if (isBoth) {
    waText = `*Tomorrow at St. John de Britto Church* ⛪\n*நாளை நமது தேவாலயத்தில்*\n\n`;
    waText += `Good Morning / வணக்கம்,\nHere are tomorrow's scheduled events and announcements (${formattedDateEn}):\n\n`;

    if (events.length > 0) {
      waText += `*📅 EVENTS / நிகழ்வுகள்:*\n`;
      events.forEach((ev, idx) => {
        waText += `${idx + 1}. *${ev.title}* ${ev.titleTa ? `(${ev.titleTa})` : ''}\n`;
        if (ev.time) waText += `   ⏰ Time: ${ev.time}\n`;
        if (ev.venue) waText += `   📍 Venue: ${ev.venue}\n`;
      });
      waText += `👉 View Events: ${eventsUrl}\n\n`;
    }

    if (announcements.length > 0) {
      waText += `*📢 ANNOUNCEMENTS / அறிவிப்புகள்:*\n`;
      announcements.forEach((ann, idx) => {
        waText += `${idx + 1}. *${ann.title}* ${ann.titleTa ? `(${ann.titleTa})` : ''}\n`;
      });
      waText += `👉 View Announcements: ${announcementsUrl}\n\n`;
    }

    waText += `*St. John de Britto Church, Kalayarkoil*`;
  } else {
    // English default
    waText = `*Tomorrow at St. John de Britto Church* ⛪\n\n`;
    waText += `Good Morning,\nHere are the events and announcements scheduled for tomorrow (${formattedDateEn}):\n\n`;

    if (events.length > 0) {
      waText += `*📅 EVENTS:*\n`;
      events.forEach((ev, idx) => {
        waText += `${idx + 1}. *${ev.title}*\n`;
        if (ev.time) waText += `   ⏰ Time: ${ev.time}\n`;
        if (ev.venue) waText += `   📍 Venue: ${ev.venue}\n`;
      });
      waText += `👉 View Events: ${eventsUrl}\n\n`;
    }

    if (announcements.length > 0) {
      waText += `*📢 ANNOUNCEMENTS:*\n`;
      announcements.forEach((ann, idx) => {
        waText += `${idx + 1}. *${ann.title}*\n`;
      });
      waText += `👉 View Announcements: ${announcementsUrl}\n\n`;
    }

    waText += `*St. John de Britto Church, Kalayarkoil*`;
  }

  // 2. In-App Notification Content
  const inAppTitle = isTamil
    ? 'நாளை நமது தேவாலயத்தில்'
    : 'Tomorrow at St. John de Britto Church';

  let inAppBody = isTamil
    ? `நாளை (${formattedDateTa}) நமது பங்குத்தளத்தில் நிகழ்வுகள் உள்ளன:\n`
    : `Upcoming events and announcements for tomorrow (${formattedDateEn}):\n`;

  if (events.length > 0) {
    inAppBody += `\nEvents: ` + events.map(e => isTamil && e.titleTa ? e.titleTa : e.title).join(', ');
  }
  if (announcements.length > 0) {
    inAppBody += `\nAnnouncements: ` + announcements.map(a => isTamil && a.titleTa ? a.titleTa : a.title).join(', ');
  }

  // 3. Email HTML
  const emailSubject = isTamil
    ? `நாளை நமது தேவாலயத்தில் — ${formattedDateTa}`
    : `Tomorrow at St. John de Britto Church — ${formattedDateEn}`;

  let emailHtml = `
<div style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f7fb;padding:35px 20px;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08);border:1px solid #e5e7eb;">
    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%);padding:30px 25px;text-align:center;">
      <h1 style="color:#fbbf24;margin:0;font-size:24px;font-weight:800;">St. John de Britto Church</h1>
      <p style="color:#ffffff;margin:5px 0 0;font-size:13px;opacity:0.9;">புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்</p>
    </div>
    <div style="padding:35px 30px;color:#374151;line-height:1.7;">
      <h2 style="color:#1e3a8a;margin-top:0;font-size:20px;">${isTamil ? 'நாளைய நிகழ்வுகள் மற்றும் அறிவிப்புகள்' : "Tomorrow's Scheduled Reminders"}</h2>
      <p style="color:#6b7280;font-size:14px;margin-top:-5px;">${isTamil ? formattedDateTa : formattedDateEn}</p>
      
      ${events.length > 0 ? `
        <div style="margin:25px 0;">
          <h3 style="color:#1e3a8a;font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:12px;">
            📅 ${isTamil ? 'நிகழ்வுகள் (Events)' : 'Scheduled Events'}
          </h3>
          ${events.map(ev => `
            <div style="background:#f9fafb;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:8px;margin-bottom:10px;">
              <strong style="color:#111827;font-size:15px;">${isTamil && ev.titleTa ? ev.titleTa : ev.title}</strong>
              <div style="font-size:13px;color:#6b7280;margin-top:4px;">
                ${ev.time ? `⏰ ${ev.time}` : ''} ${ev.venue ? ` | 📍 ${ev.venue}` : ''}
              </div>
            </div>
          `).join('')}
          <div style="text-align:left;margin-top:10px;">
            <a href="${eventsUrl}" style="color:#1e3a8a;font-weight:600;font-size:13px;text-decoration:none;">View All Events →</a>
          </div>
        </div>
      ` : ''}

      ${announcements.length > 0 ? `
        <div style="margin:25px 0;">
          <h3 style="color:#1e3a8a;font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:12px;">
            📢 ${isTamil ? 'அறிவிப்புகள் (Announcements)' : 'Parish Announcements'}
          </h3>
          ${announcements.map(ann => `
            <div style="background:#f9fafb;border-left:4px solid #3b82f6;padding:14px 18px;border-radius:8px;margin-bottom:10px;">
              <strong style="color:#111827;font-size:15px;">${isTamil && ann.titleTa ? ann.titleTa : ann.title}</strong>
              ${ann.content ? `<p style="margin:4px 0 0;font-size:13px;color:#4b5563;">${ann.content.slice(0, 150)}...</p>` : ''}
            </div>
          `).join('')}
          <div style="text-align:left;margin-top:10px;">
            <a href="${announcementsUrl}" style="color:#1e3a8a;font-weight:600;font-size:13px;text-decoration:none;">View All Announcements →</a>
          </div>
        </div>
      ` : ''}

      <div style="text-align:center;margin:30px 0 10px;">
        <a href="${events.length > 0 ? eventsUrl : announcementsUrl}" style="background:#1e3a8a;color:#ffffff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
          Open Church Website →
        </a>
      </div>
    </div>
    <div style="background:#111827;padding:20px;text-align:center;color:#9ca3af;font-size:12px;">
      <p style="margin:0;">St. John de Britto Church, Kalayarkoil — Tamil Nadu - 630551</p>
    </div>
  </div>
</div>`;

  return {
    waText,
    inAppTitle,
    inAppBody,
    emailSubject,
    emailHtml,
    actionUrl: events.length > 0 ? '/events' : '/announcements'
  };
}

/**
 * Runs the consolidated tomorrow reminder job
 */
async function runTomorrowReminder(options = {}) {
  const targetDateStr = options.targetDate || getKolkataDateString(1); // Tomorrow's date
  const isDryRun = Boolean(options.dryRun);
  const testPhone = options.testPhone;
  const testEmail = options.testEmail;
  const testUser = options.testUser;

  console.log(`\n🔔 [TOMORROW REMINDER] Initiating reminder job for date: ${targetDateStr} (IST)...`);

  // 1. Check idempotency: check if job already executed today for this targetDate
  if (!options.force && !isDryRun && !testUser && !testPhone) {
    const existingJob = await NotificationJobLog.findOne({
      jobName: 'tomorrow_content_reminder',
      executionDate: targetDateStr,
      status: 'completed'
    });
    if (existingJob) {
      console.log(`ℹ️ [TOMORROW REMINDER] Job for ${targetDateStr} already completed. Skipping.`);
      return {
        success: true,
        alreadyExecuted: true,
        executionDate: targetDateStr,
        message: 'Reminder already dispatched for this date'
      };
    }
  }

  // 2. Fetch tomorrow's events and announcements
  const { events, announcements } = await getTomorrowContent(targetDateStr);
  console.log(`[TOMORROW REMINDER] Found ${events.length} event(s) and ${announcements.length} announcement(s) for ${targetDateStr}`);

  if (events.length === 0 && announcements.length === 0) {
    console.log(`[TOMORROW REMINDER] No content scheduled for ${targetDateStr}. Nothing to dispatch.`);
    return {
      success: true,
      executionDate: targetDateStr,
      eventsCount: 0,
      announcementsCount: 0,
      message: 'No events or announcements scheduled for tomorrow'
    };
  }

  // 3. Create running job record
  let jobRecord = null;
  if (!isDryRun && !testPhone && !testUser) {
    jobRecord = await NotificationJobLog.create({
      jobName: 'tomorrow_content_reminder',
      executionDate: targetDateStr,
      status: 'running',
      startedAt: new Date()
    }).catch(e => {
      console.warn('[TomorrowReminder] Job log creation warning:', e.message);
      return null;
    });
  }

  // 4. Query eligible active users
  let usersToNotify = [];
  if (testUser) {
    usersToNotify = [testUser];
  } else if (testPhone || testEmail) {
    usersToNotify = [{
      _id: 'test_recipient',
      name: 'Test Administrator',
      phone: testPhone || '',
      email: testEmail || '',
      preferredLanguage: 'en',
      settings: { notifications: { whatsapp: true, email: true, inApp: true, push: true } }
    }];
  } else {
    usersToNotify = await User.find({
      isActive: { $ne: false },
      isSuspended: { $ne: true }
    }).select('name phone email preferredLanguage settings').lean();
  }

  const stats = {
    date: targetDateStr,
    eventsCount: events.length,
    announcementsCount: announcements.length,
    eligibleUsers: usersToNotify.length,
    whatsappSent: 0,
    whatsappFailed: 0,
    emailSent: 0,
    emailFailed: 0,
    pushSent: 0,
    pushSkipped: 0,
    inAppCreated: 0,
    smsSent: 0,
    smsSkipped: 0
  };

  // 5. Dispatch consolidated reminder to each user
  for (const user of usersToNotify) {
    const lang = user.preferredLanguage || user.settings?.language || 'en';
    const content = buildReminderContent({ events, announcements, targetDateStr, lang });

    // Check user preferences
    const notifSettings = user.settings?.notifications || {};
    const wantsEmail = notifSettings.email !== false && Boolean(user.email);
    const wantsWA = notifSettings.whatsapp !== false && Boolean(user.phone);
    const wantsInApp = notifSettings.inApp !== false && user._id !== 'test_recipient';
    const wantsPush = notifSettings.push !== false && user._id !== 'test_recipient';

    // A. WhatsApp
    if (wantsWA) {
      try {
        const ok = await sendWA(user.phone, content.waText);
        if (ok !== false) stats.whatsappSent++;
        else stats.whatsappFailed++;
      } catch {
        stats.whatsappFailed++;
      }
    }

    // B. Email
    if (wantsEmail) {
      try {
        await sendMail({
          to: user.email,
          subject: content.emailSubject,
          html: content.emailHtml
        });
        stats.emailSent++;
      } catch (err) {
        stats.emailFailed++;
      }
    }

    // C. In-App Notification
    if (wantsInApp) {
      try {
        await createNotification({
          userId: user._id,
          recipient: 'user',
          title: content.inAppTitle,
          message: content.inAppBody,
          type: 'event',
          category: 'events',
          priority: 'medium',
          actionUrl: content.actionUrl,
          channels: ['inApp']
        });
        stats.inAppCreated++;
      } catch { }
    }

    // D. Web Push
    if (wantsPush) {
      try {
        await sendPushToUser(user._id, {
          title: content.inAppTitle,
          body: content.inAppBody.slice(0, 140),
          url: content.actionUrl,
          tag: `tomorrow-rem-${targetDateStr}`
        });
        stats.pushSent++;
      } catch {
        stats.pushSkipped++;
      }
    }

    // E. SMS (optional, if configured)
    if (user.phone && process.env.TWILIO_ACCOUNT_SID) {
      try {
        let phone = user.phone.trim();
        if (phone.length === 10 && !phone.startsWith('+')) phone = `+91${phone}`;
        const shortMsg = `St. John de Britto Church: Upcoming reminders for tomorrow (${targetDateStr}). Check: ${content.actionUrl}`;
        await sendSMS(phone, shortMsg);
        stats.smsSent++;
      } catch {
        stats.smsSkipped++;
      }
    }
  }

  // 6. Complete job record
  if (jobRecord) {
    await NotificationJobLog.findByIdAndUpdate(jobRecord._id, {
      status: 'completed',
      completedAt: new Date(),
      processedUsers: usersToNotify.length,
      notifiedUsers: stats.whatsappSent + stats.emailSent + stats.inAppCreated,
      failedUsers: stats.whatsappFailed + stats.emailFailed,
      details: stats
    }).catch(() => { });
  }

  console.log(`\n================================================================`);
  console.log(`[TOMORROW REMINDER COMPLETED]`);
  console.log(`Date: ${stats.date}`);
  console.log(`Events: ${stats.eventsCount}, Announcements: ${stats.announcementsCount}`);
  console.log(`Eligible Users: ${stats.eligibleUsers}`);
  console.log(`WhatsApp: ${stats.whatsappSent} sent, ${stats.whatsappFailed} failed`);
  console.log(`Email: ${stats.emailSent} sent, ${stats.emailFailed} failed`);
  console.log(`In-App: ${stats.inAppCreated} created`);
  console.log(`Push: ${stats.pushSent} sent, ${stats.pushSkipped} skipped`);
  console.log(`================================================================\n`);

  return {
    success: true,
    stats
  };
}

// ─── CRON SCHEDULER: 6:00 AM IST DAILY ("0 6 * * *") ────────────────────────
cron.schedule('0 6 * * *', () => {
  console.log('⏰ [CRON 6:00 AM IST] Executing automated Tomorrow Content Reminder (Events & Announcements)...');
  runTomorrowReminder().catch(err => {
    console.error('❌ [CRON 6:00 AM IST] Tomorrow reminder error:', err.message);
  });
}, {
  timezone: 'Asia/Kolkata'
});

console.log('✅ [Tomorrow Reminder Service] 6:00 AM IST Cron Scheduler registered (Asia/Kolkata: 0 6 * * *).');

module.exports = {
  runTomorrowReminder,
  getTomorrowContent,
  buildReminderContent,
  getKolkataDateString
};
