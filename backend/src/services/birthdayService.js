/**
 * SJDB CONNECT — Automated Server-Side Birthday Notification Service
 * 
 * Schedule: 12:00 AM IST (Asia/Kolkata) every midnight via node-cron (0 0 * * *)
 * 
 * Responsibilities:
 *  1. Every midnight at 12:00 AM IST, find active users whose profile DOB matches the current day and month.
 *  2. Follows the user's Bot Language (session.language / user.preferredLanguage) independently of Catholic content language.
 *  3. Generates personalized birthday wishes with the user's name in exact church-approved Tamil or English templates.
 *  4. Dispatches through all user-enabled notification channels:
 *     - WhatsApp (via Baileys WhatsApp bot)
 *     - Email (via Nodemailer with celebratory card)
 *     - In-App Notifications (via Notification collection)
 *     - Web Push Notifications (via webPushService)
 *  5. Respects individual user notification settings and opt-outs.
 *  6. Guarantees idempotency and duplicate prevention via BirthdayDeliveryLog (jobId: birthday_YYYY-MM-DD).
 *  7. Handles leap-day birthdays (29 February) gracefully:
 *     - In leap years: Celebrated on 29 February.
 *     - In non-leap years: Celebrated on 28 February so members receive their annual blessing.
 */

const cron = require('node-cron');
const User = require('../models/User');
const BotSession = require('../models/BotSession');
const Notification = require('../models/Notification');
const BirthdayDeliveryLog = require('../models/BirthdayDeliveryLog');
const { sendMail } = require('../config/mailer');
const { sendPushToUser } = require('./webPushService');
const { getBaseClientUrl } = require('../config/siteRoutes');

// Lazy-load WhatsApp bot to avoid circular dependencies and startup race conditions
function getWhatsApp() {
  try {
    return require('../bot/whatsapp');
  } catch (err) {
    console.warn('[Birthday Service] WhatsApp module not available:', err.message);
    return null;
  }
}

/**
 * Check if a given year is a leap year
 */
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Get date parts (year, month 1-12, day 1-31, dateKey YYYY-MM-DD) in Asia/Kolkata (IST)
 */
function getISTDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  const parts = formatter.formatToParts(date);
  let day = 0, month = 0, year = 0;
  for (const part of parts) {
    if (part.type === 'day') day = parseInt(part.value, 10);
    if (part.type === 'month') month = parseInt(part.value, 10);
    if (part.type === 'year') year = parseInt(part.value, 10);
  }
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, dateKey };
}

/**
 * Check if a user's Date of Birth matches today's date in Asia/Kolkata.
 * 
 * Rules:
 *  - Matches day and month; ignores birth year.
 *  - Invalid or missing DOB safely returns false.
 *  - February 29 (Leap Day):
 *      • In leap years: Matches on 29 February.
 *      • In non-leap years: Matches on 28 February so users receive their birthday blessings.
 */
function isUserBirthdayToday(userDob, todayIST) {
  if (!userDob) return false;
  const d = new Date(userDob);
  if (isNaN(d.getTime())) return false;

  // Extract day and month from both UTC and IST to account for database storage formats
  const utcDay = d.getUTCDate();
  const utcMonth = d.getUTCMonth() + 1;

  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    month: 'numeric',
    day: 'numeric'
  });
  const istParts = istFormatter.formatToParts(d);
  let istDay = 0, istMonth = 0;
  for (const part of istParts) {
    if (part.type === 'day') istDay = parseInt(part.value, 10);
    if (part.type === 'month') istMonth = parseInt(part.value, 10);
  }

  // Check direct day/month match
  const matchesDirect = (utcDay === todayIST.day && utcMonth === todayIST.month) ||
                        (istDay === todayIST.day && istMonth === todayIST.month);

  if (matchesDirect) return true;

  // Feb 29 policy in non-leap year:
  // If user was born on Feb 29, and current year is non-leap, celebrate on Feb 28
  const isFeb29Birth = (utcMonth === 2 && utcDay === 29) || (istMonth === 2 && istDay === 29);
  if (isFeb29Birth && !isLeapYear(todayIST.year) && todayIST.month === 2 && todayIST.day === 28) {
    return true;
  }

  return false;
}

/**
 * Resolve user's Birthday Language.
 * Strictly follows Bot Language (session.language or user.preferredLanguage).
 * Independent of Daily Catholic Content Language (session.catholicLanguage).
 */
async function resolveBirthdayLanguage(user) {
  let lang = null;

  // 1. Check linked BotSession
  try {
    const searchPhones = [user.phone, `+91${user.phone}`, `91${user.phone}`].filter(Boolean);
    const session = await BotSession.findOne({
      $or: [
        { linkedUserId: user._id },
        { phoneNumber: { $in: searchPhones } }
      ]
    }).select('language step');

    if (session && session.language) {
      lang = session.language;
    }
  } catch (err) {
    console.warn('[Birthday Service] Error resolving bot session language:', err.message);
  }

  // 2. Check user preferredLanguage
  if (!lang && user.preferredLanguage) {
    lang = user.preferredLanguage;
  }

  // 3. Check user settings language
  if (!lang && user.settings?.language) {
    lang = user.settings.language;
  }

  // Standardize: 'ta', 'en'. Defaults to Tamil ('ta')
  const clean = String(lang || 'ta').trim().toLowerCase();
  if (clean === 'en' || clean.startsWith('en')) return 'en';
  return 'ta';
}

/**
 * Generate exact personalized birthday messages for Tamil and English
 */
function getBirthdayMessages(userName, language = 'ta') {
  const name = (userName || '').trim() || (language === 'ta' ? 'அன்பரே' : 'Parishioner');

  if (language === 'en') {
    const text = `🎂🎉 *Happy Birthday, ${name}!* 🎉🎂

Dear *${name}*,
Warm birthday wishes to you from *St. John de Britto Church*. 🙏

✝️ May God bless you abundantly with good health, happiness, peace, and grace throughout the year ahead.

*Have a blessed and joyful birthday! 🎂🎉🙏*

— *SJDB CONNECT*
St. John de Britto Church, Kalayarkoil`;

    const title = `🎂 Happy Birthday, ${name}! 🎉`;
    const emailSubject = `🎂🎉 Happy Birthday, ${name}! — St. John de Britto Church`;

    return { text, title, emailSubject, name, language: 'en' };
  }

  // Default: Tamil
  const text = `🎂🎉 *பிறந்தநாள் வாழ்த்துக்கள், ${name}!* 🎉🎂

அன்புள்ள *${name}*,
உங்கள் பிறந்தநாளில் புனித அருளானந்தர் தேவாலயத்தின் சார்பாக எங்கள் அன்பான வாழ்த்துக்களைத் தெரிவித்துக் கொள்கிறோம். 🙏

✝️ இறைவன் உங்களை ஆசீர்வதித்து, நல்ல ஆரோக்கியம், மகிழ்ச்சி, அமைதி மற்றும் அருளால் உங்கள் வாழ்வை நிறைக்கட்டும்.

*இனிய பிறந்தநாள் வாழ்த்துக்கள்! 🎂🎉🙏*

— *SJDB CONNECT*
புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்`;

  const title = `🎂 பிறந்தநாள் வாழ்த்துக்கள், ${name}! 🎉`;
  const emailSubject = `🎂🎉 பிறந்தநாள் வாழ்த்துக்கள், ${name}! — புனித அருளானந்தர் தேவாலயம்`;

  return { text, title, emailSubject, name, language: 'ta' };
}

/**
 * Generate branded celebratory HTML email for birthday blessings
 */
function generateBirthdayEmailHtml(userName, language = 'ta') {
  const clientUrl = getBaseClientUrl();
  const { text, title, name } = getBirthdayMessages(userName, language);
  const isEn = language === 'en';

  const formattedBlessing = text
    .split('\n\n')
    .map(p => `<p style="margin:0 0 16px 0;line-height:1.7;color:#334155;font-size:16px;">${p.replace(/\*(.*?)\*/g, '<strong>$1</strong>')}</p>`)
    .join('');

  return `
<div style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:35px 15px;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 35px rgba(0,0,0,0.08);border:1px solid #e2e8f0;">
    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,#9333ea 0%,#4f46e5 50%,#1e3a8a 100%);padding:40px 25px;text-align:center;color:#ffffff;">
      <div style="font-size:50px;margin-bottom:10px;">🎂🎉</div>
      <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">
        ${title}
      </h1>
      <p style="margin:0;font-size:14px;color:#e9d5ff;letter-spacing:1px;text-transform:uppercase;">
        ${isEn ? 'St. John de Britto Church, Kalayarkoil' : 'புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்'}
      </p>
    </div>

    <!-- BODY -->
    <div style="padding:35px 30px;background:#ffffff;">
      <div style="background:#faf5ff;border-left:5px solid #a855f7;padding:20px;border-radius:12px;margin-bottom:25px;">
        ${formattedBlessing}
      </div>

      <div style="text-align:center;margin-top:30px;">
        <a href="${clientUrl}" style="display:inline-block;background:linear-gradient(135deg,#7e22ce,#3b82f6);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:30px;font-weight:bold;font-size:15px;box-shadow:0 6px 18px rgba(126,34,206,0.35);">
          ${isEn ? 'Visit Parish Portal' : 'பங்கு இணையதளம் செல்ல'}
        </a>
      </div>
    </div>

    <!-- FOOTER -->
    <div style="background:#f1f5f9;padding:22px;text-align:center;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
      <p style="margin:0 0 6px 0;font-weight:600;">SJDB CONNECT — St. John de Britto Church</p>
      <p style="margin:0;">Kalayarkoil, Sivagangai District, Tamil Nadu — 630551</p>
    </div>
  </div>
</div>`;
}

/**
 * Main Birthday Wishes Dispatcher Engine.
 * 
 * Can be called automatically by the midnight cron, or manually for testing/admin trigger.
 * 
 * @param {Object} options
 * @param {Date} [options.targetDate] Optional custom date to check (defaults to current date)
 * @param {boolean} [options.dryRun] If true, identifies recipients without sending
 * @returns {Promise<Object>} Execution summary
 */
async function sendBirthdayWishes(options = {}) {
  const { targetDate = new Date(), dryRun = false } = options;
  const todayIST = getISTDateParts(targetDate);
  const jobId = `birthday_${todayIST.dateKey}`;

  console.log(`🎂 [Birthday Service] Checking birthdays for date: ${todayIST.dateKey} (IST: ${todayIST.year}-${todayIST.month}-${todayIST.day}) | Job ID: ${jobId}`);

  const summary = {
    jobId,
    dateKey: todayIST.dateKey,
    totalFound: 0,
    sentWhatsApp: 0,
    sentEmail: 0,
    sentInApp: 0,
    sentPush: 0,
    skippedDuplicate: 0,
    skippedOptOut: 0,
    errors: [],
    recipients: []
  };

  try {
    // 1. Find all active users with a non-null DOB
    const activeUsers = await User.find({
      isActive: { $ne: false },
      dob: { $exists: true, $ne: null }
    }).select('name phone email dob preferredLanguage settings whatsappOptIn isSuspended');

    // 2. Filter users whose DOB day and month match today in Asia/Kolkata
    const birthdayUsers = activeUsers.filter(u => isUserBirthdayToday(u.dob, todayIST));
    summary.totalFound = birthdayUsers.length;

    console.log(`🎂 [Birthday Service] Found ${birthdayUsers.length} birthday celebrants today.`);

    if (birthdayUsers.length === 0 || dryRun) {
      if (dryRun) {
        summary.recipients = birthdayUsers.map(u => ({ id: u._id, name: u.name, phone: u.phone, email: u.email }));
      }
      return summary;
    }

    const wa = getWhatsApp();

    // 3. Process each birthday celebrant
    for (const user of birthdayUsers) {
      // Skip suspended accounts
      if (user.isSuspended) {
        summary.skippedOptOut++;
        continue;
      }

      // Check global birthday notification preference
      const notifSettings = user.settings?.notifications || {};
      if (notifSettings.birthdayWishes === false) {
        console.log(`[Birthday Service] User ${user.name} (${user._id}) opted out of birthday wishes. Skipping.`);
        summary.skippedOptOut++;
        continue;
      }

      // Resolve Language strictly according to Bot Language
      const birthdayLang = await resolveBirthdayLanguage(user);
      const messages = getBirthdayMessages(user.name, birthdayLang);
      const userRecipientInfo = { userId: user._id, name: user.name, language: birthdayLang, channels: [] };

      // ── Channel 1: WhatsApp ──────────────────────────────────────────────
      const canSendWhatsApp = notifSettings.whatsapp !== false &&
                              user.whatsappOptIn !== false &&
                              Boolean(user.phone);

      if (canSendWhatsApp) {
        const cleanPhone = String(user.phone).replace(/\D/g, '');
        const recipientKey = cleanPhone.slice(-10);

        // Find linked WhatsApp BotSession to resolve exact WhatsApp target JID / phone
        let targetWhatsAppRecipient = cleanPhone;
        let isStopped = false;
        try {
          const session = await BotSession.findOne({
            $or: [
              { linkedUserId: user._id },
              { providedPhone: recipientKey },
              { phoneNumber: { $regex: recipientKey } }
            ]
          });
          if (session) {
            if (session.step === 'stopped') isStopped = true;
            if (session.phoneNumber) targetWhatsAppRecipient = session.phoneNumber;
            if (!session.linkedUserId) {
              session.linkedUserId = user._id;
              await session.save().catch(() => {});
            }
          }
        } catch (sErr) {}

        if (isStopped) {
          console.log(`[Birthday Service] User ${user.name} has stopped WhatsApp bot session. Skipping WhatsApp.`);
        } else {
          // Check idempotency: Has WhatsApp birthday already been sent today?
          const existingLog = await BirthdayDeliveryLog.findOne({
            birthdayDate: todayIST.dateKey,
            userId: user._id,
            channel: 'whatsapp',
            status: 'sent'
          });

          if (existingLog) {
            summary.skippedDuplicate++;
          } else {
            try {
              let sentOk = false;
              if (wa && typeof wa.sendWhatsAppMessage === 'function') {
                sentOk = await wa.sendWhatsAppMessage(targetWhatsAppRecipient, messages.text);
              }

              await BirthdayDeliveryLog.findOneAndUpdate(
                { birthdayDate: todayIST.dateKey, userId: user._id, channel: 'whatsapp' },
                {
                  jobId,
                  birthdayDate: todayIST.dateKey,
                  userId: user._id,
                  userName: user.name,
                  recipient: cleanPhone,
                  channel: 'whatsapp',
                  language: birthdayLang,
                  status: sentOk !== false ? 'sent' : 'failed',
                  error: sentOk === false ? 'WhatsApp transport reported delivery failure' : null,
                  sentAt: new Date()
                },
                { upsert: true, new: true }
              );

              if (sentOk !== false) {
                summary.sentWhatsApp++;
                userRecipientInfo.channels.push('whatsapp');
                console.log(`✉️ [Birthday Service] WhatsApp blessing sent to ${user.name} (${targetWhatsAppRecipient}) in ${birthdayLang.toUpperCase()}`);
              }
            } catch (waErr) {
              console.error(`❌ [Birthday Service] Failed WhatsApp to ${user.name}:`, waErr.message);
              summary.errors.push({ user: user.name, channel: 'whatsapp', error: waErr.message });
              await BirthdayDeliveryLog.findOneAndUpdate(
                { birthdayDate: todayIST.dateKey, userId: user._id, channel: 'whatsapp' },
                {
                  jobId,
                  birthdayDate: todayIST.dateKey,
                  userId: user._id,
                  userName: user.name,
                  recipient: cleanPhone,
                  channel: 'whatsapp',
                  language: birthdayLang,
                  status: 'failed',
                  error: waErr.message,
                  sentAt: new Date()
                },
                { upsert: true, new: true }
              ).catch(() => {});
            }
          }
        }
      }

      // ── Channel 2: Email ────────────────────────────────────────────────
      const canSendEmail = notifSettings.email !== false && Boolean(user.email);
      if (canSendEmail) {
        const existingEmailLog = await BirthdayDeliveryLog.findOne({
          birthdayDate: todayIST.dateKey,
          userId: user._id,
          channel: 'email',
          status: 'sent'
        });

        if (existingEmailLog) {
          summary.skippedDuplicate++;
        } else {
          try {
            const html = generateBirthdayEmailHtml(user.name, birthdayLang);
            await sendMail({
              to: user.email,
              subject: messages.emailSubject,
              html
            });

            await BirthdayDeliveryLog.findOneAndUpdate(
              { birthdayDate: todayIST.dateKey, userId: user._id, channel: 'email' },
              {
                jobId,
                birthdayDate: todayIST.dateKey,
                userId: user._id,
                userName: user.name,
                recipient: user.email,
                channel: 'email',
                language: birthdayLang,
                status: 'sent',
                sentAt: new Date()
              },
              { upsert: true, new: true }
            );

            summary.sentEmail++;
            userRecipientInfo.channels.push('email');
            console.log(`📧 [Birthday Service] Email blessing sent to ${user.name} (${user.email}) in ${birthdayLang.toUpperCase()}`);
          } catch (emailErr) {
            console.error(`❌ [Birthday Service] Failed Email to ${user.name}:`, emailErr.message);
            summary.errors.push({ user: user.name, channel: 'email', error: emailErr.message });
            await BirthdayDeliveryLog.findOneAndUpdate(
              { birthdayDate: todayIST.dateKey, userId: user._id, channel: 'email' },
              {
                jobId,
                birthdayDate: todayIST.dateKey,
                userId: user._id,
                userName: user.name,
                recipient: user.email,
                channel: 'email',
                language: birthdayLang,
                status: 'failed',
                error: emailErr.message,
                sentAt: new Date()
              },
              { upsert: true, new: true }
            ).catch(() => {});
          }
        }
      }

      // ── Channel 3: In-App Notification ──────────────────────────────────
      const canSendInApp = notifSettings.inApp !== false;
      if (canSendInApp) {
        const existingInAppLog = await BirthdayDeliveryLog.findOne({
          birthdayDate: todayIST.dateKey,
          userId: user._id,
          channel: 'inApp',
          status: 'sent'
        });

        if (existingInAppLog) {
          summary.skippedDuplicate++;
        } else {
          try {
            await Notification.create({
              userId: user._id,
              isBroadcast: false,
              title: messages.title,
              message: messages.text,
              type: 'birthday',
              category: 'birthday',
              priority: 'normal',
              recipient: 'user',
              actionUrl: '/dashboard',
              sentVia: ['inApp']
            });

            await BirthdayDeliveryLog.findOneAndUpdate(
              { birthdayDate: todayIST.dateKey, userId: user._id, channel: 'inApp' },
              {
                jobId,
                birthdayDate: todayIST.dateKey,
                userId: user._id,
                userName: user.name,
                recipient: user._id.toString(),
                channel: 'inApp',
                language: birthdayLang,
                status: 'sent',
                sentAt: new Date()
              },
              { upsert: true, new: true }
            );

            summary.sentInApp++;
            userRecipientInfo.channels.push('inApp');
          } catch (inAppErr) {
            console.error(`❌ [Birthday Service] Failed In-App to ${user.name}:`, inAppErr.message);
            summary.errors.push({ user: user.name, channel: 'inApp', error: inAppErr.message });
          }
        }
      }

      // ── Channel 4: Web Push Notification ─────────────────────────────────
      const canSendPush = notifSettings.push !== false;
      if (canSendPush) {
        const existingPushLog = await BirthdayDeliveryLog.findOne({
          birthdayDate: todayIST.dateKey,
          userId: user._id,
          channel: 'push',
          status: 'sent'
        });

        if (existingPushLog) {
          summary.skippedDuplicate++;
        } else {
          try {
            const pushPayload = {
              title: messages.title,
              body: messages.text.slice(0, 140),
              url: '/dashboard',
              icon: '/favicon.png',
              badge: '/favicon.png',
              tag: `sjdb-birthday-${todayIST.dateKey}`
            };

            await sendPushToUser(user._id, pushPayload).catch(err => {
              console.warn('[Birthday Service] WebPush user send notice:', err.message);
            });

            await BirthdayDeliveryLog.findOneAndUpdate(
              { birthdayDate: todayIST.dateKey, userId: user._id, channel: 'push' },
              {
                jobId,
                birthdayDate: todayIST.dateKey,
                userId: user._id,
                userName: user.name,
                recipient: user._id.toString(),
                channel: 'push',
                language: birthdayLang,
                status: 'sent',
                sentAt: new Date()
              },
              { upsert: true, new: true }
            );

            summary.sentPush++;
            userRecipientInfo.channels.push('push');
          } catch (pushErr) {
            console.warn(`[Birthday Service] Push notice for ${user.name}:`, pushErr.message);
          }
        }
      }

      summary.recipients.push(userRecipientInfo);
    }

    console.log(`🎂 [Birthday Service] Completed job ${jobId}. Dispatched: WA=${summary.sentWhatsApp}, Email=${summary.sentEmail}, InApp=${summary.sentInApp}, Push=${summary.sentPush}, Skipped Dupes=${summary.skippedDuplicate}`);
    return summary;
  } catch (err) {
    console.error('❌ [Birthday Service] Fatal error executing birthday job:', err);
    summary.errors.push({ fatal: err.message });
    return summary;
  }
}

// ── Schedule: Sharply at 12:00 AM (midnight) IST every day ──────────────────
// '0 0 * * *' in Asia/Kolkata timezone executes at 00:00:00 midnight IST.
const birthdayCronTask = cron.schedule('0 0 * * *', () => {
  console.log('🎂 [Birthday Service] Triggering midnight 12:00 AM IST birthday wishes job...');
  sendBirthdayWishes();
}, { timezone: 'Asia/Kolkata' });

module.exports = {
  sendBirthdayWishes,
  executeBirthdayJob: sendBirthdayWishes,
  getBirthdayMessages,
  generateBirthdayEmailHtml,
  getISTDateParts,
  isUserBirthdayToday,
  resolveBirthdayLanguage,
  isLeapYear,
  birthdayCronTask
};
