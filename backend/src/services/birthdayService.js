/**
 * Fully Automatic 24/7 Birthday Wishes Service — SJDB Connect
 * St. John de Britto Church, Kalayarkoil
 *
 * Requirements:
 * - Server-side cron job running at 12:00:00 AM (midnight) IST ('0 0 * * *', Asia/Kolkata).
 * - Detects all active registered users whose birthday is today (comparing month & day).
 * - Multi-channel delivery: WhatsApp (with language preference), Email, In-App Notification & Web Push.
 * - Strict duplicate protection per user per calendar year via BirthdayLog.
 * - Timezone-safe date matching avoiding UTC shift / off-by-one errors.
 * - Channel isolation: failure in one channel does not abort remaining channels.
 * - Admin monitoring & health status tracking.
 */

const cron = require('node-cron');
const User = require('../models/User');
const BirthdayLog = require('../models/BirthdayLog');
const NotificationJobLog = require('../models/NotificationJobLog');
const { sendMail } = require('../config/mailer');
const { createNotification } = require('./notificationService');
const { generateBirthdayEmailHtml } = require('../templates/birthdayEmailTemplate');
const { isPhoneBlocked } = require('./userModerationService');

// In-memory monitoring cache for server health & admin telemetry
const executionMetrics = {
  lastExecution: null,
  birthdaysDetected: 0,
  notificationsSent: 0,
  successful: 0,
  failed: 0,
  lastStatus: 'idle',
  error: null
};

// ─── HELPER: DATE CALCULATION & TIMEZONE SAFETY ─────────────────────────────

/**
 * Returns current date parts in Asia/Kolkata (IST) timezone
 */
function getTodayISTParts(baseDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [yearStr, monthStr, dayStr] = formatter.format(baseDate).split('-');
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
    day: parseInt(dayStr, 10),
    monthDayStr: `${monthStr}-${dayStr}`,
    dateKey: `${yearStr}-${monthStr}-${dayStr}`
  };
}

/**
 * Robustly checks if user's DOB matches targetMonth and targetDay,
 * guarding against UTC shift, string date formats, and timezone discrepancies.
 */
function isUserBirthdayToday(userDob, targetMonth, targetDay) {
  if (!userDob) return false;

  // 1. Direct string format parsing (e.g. "2005-09-27", "2005-09-27T00:00:00.000Z")
  if (typeof userDob === 'string') {
    const trimmed = userDob.trim();
    // Match ISO YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const m = parseInt(isoMatch[2], 10);
      const d = parseInt(isoMatch[3], 10);
      if (m === targetMonth && d === targetDay) return true;
    }
    // Match DD-MM-YYYY
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (ddmmyyyyMatch) {
      const d = parseInt(ddmmyyyyMatch[1], 10);
      const m = parseInt(ddmmyyyyMatch[2], 10);
      if (m === targetMonth && d === targetDay) return true;
    }
  }

  // 2. Parseable Date evaluation
  const d = new Date(userDob);
  if (isNaN(d.getTime())) return false;

  // Evaluation in Asia/Kolkata (IST) timezone
  try {
    const istParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      month: '2-digit',
      day: '2-digit'
    }).format(d).split('-');
    const istM = parseInt(istParts[0], 10);
    const istD = parseInt(istParts[1], 10);
    if (istM === targetMonth && istD === targetDay) return true;
  } catch (e) { }

  // Evaluation in UTC
  const utcM = d.getUTCMonth() + 1;
  const utcD = d.getUTCDate();
  if (utcM === targetMonth && utcD === targetDay) return true;

  // Local fallback
  const localM = d.getMonth() + 1;
  const localD = d.getDate();
  if (localM === targetMonth && localD === targetDay) return true;

  return false;
}

/**
 * Calculates next scheduled execution timestamp at 12:00:00 AM IST
 */
function getNextScheduledExecution() {
  const now = new Date();
  // Get today's IST date components
  const ist = getTodayISTParts(now);
  // Construct tomorrow midnight IST (IST is UTC+5:30)
  // Tomorrow's date in IST
  const tomorrowMidnightIST = new Date(Date.UTC(ist.year, ist.month - 1, ist.day + 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
  return tomorrowMidnightIST;
}

// ─── HELPER: LANGUAGE RESOLUTION ────────────────────────────────────────────

function resolveUserLanguage(user) {
  const raw = String(user?.preferredLanguage || user?.settings?.language || user?.mass_reflection_language || 'ta').toLowerCase();
  if (raw === 'en' || raw.startsWith('en')) return 'en';
  if (raw === 'both' || (raw.includes('ta') && raw.includes('en'))) return 'both';
  return 'ta'; // Default to Tamil for the parish community
}

// ─── HELPER: WHATSAPP MESSAGE FORMATTING ────────────────────────────────────

function formatBirthdayWhatsAppMessage(user, language = 'ta') {
  const name = user.name?.trim() || 'Parishioner';

  if (language === 'en') {
    return `🎂 *Happy Birthday, ${name}!* 🎉

May God bless you abundantly on your special day and fill your life with peace, joy, good health, and grace.

May St. John de Britto pray for you and may the Lord guide you throughout the coming year.

✨ *"May the Lord bless you and keep you;
May the Lord make his face shine on you
and be gracious to you."*
— Numbers 6:24-25

💐 *Wishing you a blessed and joyful birthday!*

— *St. John de Britto Church, Kalayarkoil*
_SJDB Connect_`;
  }

  if (language === 'both') {
    return `🎂 *Happy Birthday / இனிய பிறந்தநாள் நல்வாழ்த்துகள், ${name}!* 🎉

May God bless you abundantly on your special day and fill your life with peace, joy, good health, and grace.
இந்த இனிய பிறந்தநாளில் இறைவன் உங்களை நிறைவாக ஆசீர்வதித்து, உங்கள் வாழ்வில் அமைதி, மகிழ்ச்சி, நல்வாழ்வு மற்றும் அருளை நிறைக்க வேண்டுகிறோம்.

May St. John de Britto pray for you and may the Lord guide you throughout the coming year.
புனித ஜான் டி பிரிட்டோ உங்களுக்காக பரிந்து பேசவும், ஆண்டவர் இந்த புதிய ஆண்டில் உங்களை வழிநடத்தவும் வாழ்த்துகிறோம்.

✨ *"The Lord bless you and keep you; The Lord make His face shine upon you."*
*"ஆண்டவர் உனக்கு ஆசி வழங்கி, உன்னைக் காப்பாராக!"*
— Numbers / எண்ணாகமம் 6:24-25

💐 *Wishing you a blessed and joyful birthday!*
*இறை ஆசீருடன் கூடிய இனிய பிறந்தநாள் வாழ்த்துகள்!*

— *புனித ஜான் டி பிரிட்டோ திருத்தலம், காளையார்கோவில்*
— *St. John de Britto Church, Kalayarkoil*
_SJDB Connect_`;
  }

  // Tamil (default)
  return `🎂 *இனிய பிறந்தநாள் நல்வாழ்த்துகள், ${name}!* 🎉

இந்த இனிய பிறந்தநாளில் இறைவன் உங்களை நிறைவாக ஆசீர்வதித்து, உங்கள் வாழ்வில் அமைதி, மகிழ்ச்சி, நல்வாழ்வு மற்றும் அருளை நிறைக்க வேண்டுகிறோம்.

புனித ஜான் டி பிரிட்டோ உங்களுக்காக பரிந்து பேசவும், ஆண்டவர் இந்த புதிய ஆண்டில் உங்களை வழிநடத்தவும் வாழ்த்துகிறோம்.

✨ *"ஆண்டவர் உனக்கு ஆசி வழங்கி, உன்னைக் காப்பாராக!
ஆண்டவர் தம் திருமுகத்தை உன்மீது ஒளிரச்செய்து,
உன்மீது கருணைகாட்டுவாராக!"*
— எண்ணாகமம் 6:24-25

💐 *இறை ஆசீருடன் கூடிய இனிய பிறந்தநாள் வாழ்த்துகள்!*

— *புனித ஜான் டி பிரிட்டோ திருத்தலம், காளையார்கோவில்*
_SJDB Connect_`;
}

// ─── CORE DISPATCHER: SINGLE USER PROCESSING ────────────────────────────────

async function processUserBirthday({ user, istInfo, isManualTest = false }) {
  const userId = user._id;
  const currentYear = istInfo.year;
  const birthdayDate = istInfo.monthDayStr;
  const executionDate = istInfo.dateKey;
  const userLang = resolveUserLanguage(user);

  // 1. Duplicate Protection: Check or initialize BirthdayLog for this user and calendar year
  let birthdayLog = await BirthdayLog.findOne({ userId, year: currentYear });
  if (!birthdayLog) {
    try {
      birthdayLog = await BirthdayLog.create({
        userId,
        year: currentYear,
        birthdayDate,
        executionDate,
        userName: user.name,
        userEmail: user.email || null,
        userPhone: user.phone || null,
        preferredLanguage: userLang,
        channels: {
          whatsapp: { status: 'pending' },
          email: { status: 'pending' },
          inApp: { status: 'pending' },
          push: { status: 'pending' }
        },
        overallStatus: 'sent',
        sentAt: new Date()
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        birthdayLog = await BirthdayLog.findOne({ userId, year: currentYear });
      } else {
        throw createErr;
      }
    }
  }

  let channelSuccessCount = 0;
  let channelAttemptCount = 0;
  const channelResults = {};

  // Check user notification preferences
  const notifSettings = user.settings?.notifications || {};
  const allowBirthdayWishes = notifSettings.birthdayWishes !== false;

  if (!allowBirthdayWishes && !isManualTest) {
    console.log(`[Birthday Service] User ${user.name} has opted out of birthday wishes.`);
    birthdayLog.overallStatus = 'skipped';
    await birthdayLog.save();
    return { success: true, skipped: true, reason: 'user_opted_out' };
  }

  // ── CHANNEL 1: WHATSAPP ──────────────────────────────────────────────────
  const cleanPhone = (user.phone || '').replace(/\D/g, '');
  const allowWhatsApp = notifSettings.whatsapp !== false &&
                        user.whatsappOptIn !== false &&
                        (!user.botPreferences?.length || user.botPreferences.includes('birthday'));

  if (birthdayLog.channels.whatsapp.status === 'sent' && !isManualTest) {
    channelResults.whatsapp = { status: 'already_sent' };
  } else if (!cleanPhone || !allowWhatsApp) {
    birthdayLog.channels.whatsapp = {
      status: 'disabled',
      target: cleanPhone || null,
      sentAt: null,
      error: !cleanPhone ? 'Missing phone number' : 'WhatsApp notification disabled by user preference'
    };
    channelResults.whatsapp = { status: 'disabled' };
  } else {
    channelAttemptCount++;
    const isBlocked = await isPhoneBlocked(cleanPhone);
    if (isBlocked) {
      console.log(`[Birthday Service] Skipping restricted phone ${cleanPhone} for user ${user.name}`);
      birthdayLog.channels.whatsapp = {
        status: 'skipped',
        target: cleanPhone,
        sentAt: null,
        error: 'Phone is restricted or suspended'
      };
      channelResults.whatsapp = { status: 'skipped', reason: 'restricted' };
    } else {
      try {
        const waText = formatBirthdayWhatsAppMessage(user, userLang);
        const { sendWhatsAppNotification } = require('./whatsAppNotificationService');
        const res = await sendWhatsAppNotification(user || cleanPhone, waText);
        const sent = res && res.success !== false;
        
        if (sent !== false) {
          birthdayLog.channels.whatsapp = {
            status: 'sent',
            target: cleanPhone,
            sentAt: new Date(),
            error: null
          };
          channelSuccessCount++;
          channelResults.whatsapp = { status: 'sent' };
          console.log(`🎂 [Birthday Service] WhatsApp wish sent to ${user.name} (${cleanPhone}) [Lang: ${userLang}]`);
        } else {
          birthdayLog.channels.whatsapp = {
            status: 'failed',
            target: cleanPhone,
            sentAt: null,
            error: 'WhatsApp daemon returned false'
          };
          channelResults.whatsapp = { status: 'failed', error: 'WhatsApp daemon returned false' };
        }
      } catch (waErr) {
        birthdayLog.channels.whatsapp = {
          status: 'failed',
          target: cleanPhone,
          sentAt: null,
          error: waErr.message
        };
        channelResults.whatsapp = { status: 'failed', error: waErr.message };
        console.error(`❌ [Birthday Service] WhatsApp failed for ${user.name}:`, waErr.message);
      }
    }
  }

  // ── CHANNEL 2: EMAIL ─────────────────────────────────────────────────────
  const allowEmail = notifSettings.email !== false && Boolean(user.email);

  if (birthdayLog.channels.email.status === 'sent' && !isManualTest) {
    channelResults.email = { status: 'already_sent' };
  } else if (!user.email || !allowEmail) {
    birthdayLog.channels.email = {
      status: 'disabled',
      target: user.email || null,
      sentAt: null,
      error: !user.email ? 'Missing email' : 'Email notifications disabled by user preference'
    };
    channelResults.email = { status: 'disabled' };
  } else {
    channelAttemptCount++;
    try {
      const emailContent = generateBirthdayEmailHtml({ user, language: userLang });
      const mailRes = await sendMail({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html
      });

      if (mailRes && mailRes.success !== false) {
        birthdayLog.channels.email = {
          status: 'sent',
          target: user.email,
          sentAt: new Date(),
          error: null
        };
        channelSuccessCount++;
        channelResults.email = { status: 'sent' };
        console.log(`🎂 [Birthday Service] Email wish sent to ${user.name} (${user.email})`);
      } else {
        birthdayLog.channels.email = {
          status: 'failed',
          target: user.email,
          sentAt: null,
          error: mailRes?.error || 'Email sending failed'
        };
        channelResults.email = { status: 'failed', error: mailRes?.error || 'Email sending failed' };
        console.warn(`⚠️ [Birthday Service] Email failed for ${user.name}:`, mailRes?.error);
      }
    } catch (mailErr) {
      birthdayLog.channels.email = {
        status: 'failed',
        target: user.email,
        sentAt: null,
        error: mailErr.message
      };
      channelResults.email = { status: 'failed', error: mailErr.message };
      console.error(`❌ [Birthday Service] Email failed for ${user.name}:`, mailErr.message);
    }
  }

  // ── CHANNEL 3: IN-APP & WEB PUSH NOTIFICATION ───────────────────────────
  const allowInApp = notifSettings.inApp !== false;

  if (birthdayLog.channels.inApp.status === 'sent' && !isManualTest) {
    channelResults.inApp = { status: 'already_sent' };
  } else if (!allowInApp) {
    birthdayLog.channels.inApp = {
      status: 'disabled',
      sentAt: null,
      error: 'In-app notifications disabled by user preference'
    };
    channelResults.inApp = { status: 'disabled' };
  } else {
    channelAttemptCount++;
    try {
      const inAppTitle = userLang === 'ta'
        ? `🎂 இனிய பிறந்தநாள் நல்வாழ்த்துகள், ${user.name}!`
        : `🎂 Happy Birthday, ${user.name}!`;

      const inAppMsg = userLang === 'ta'
        ? `இந்த இனிய பிறந்தநாளில் இறைவன் உங்களை நிறைவாக ஆசீர்வதித்து, அமைதி, மகிழ்ச்சி, நல்வாழ்வு மற்றும் அருளை நிறைக்க வேண்டுகிறோம். புனித அருளானந்தர் உங்களுக்காக பரிந்து பேசட்டும்!`
        : `May God bless you abundantly on your special day with peace, joy, good health, and grace. May St. John de Britto pray for you and guide you in the year ahead!`;

      const notifDoc = await createNotification({
        userId,
        isBroadcast: false,
        title: inAppTitle,
        message: inAppMsg,
        type: 'birthday',
        category: 'birthday',
        priority: 'high',
        recipient: 'user',
        actionUrl: '/dashboard',
        channels: ['inApp', 'push']
      });

      if (notifDoc) {
        birthdayLog.channels.inApp = {
          status: 'sent',
          notificationId: notifDoc._id,
          sentAt: new Date(),
          error: null
        };
        birthdayLog.channels.push = {
          status: 'sent',
          sentAt: new Date(),
          error: null
        };
        channelSuccessCount++;
        channelResults.inApp = { status: 'sent', notificationId: notifDoc._id };
        channelResults.push = { status: 'sent' };
        console.log(`🎂 [Birthday Service] In-app & push notification created for ${user.name}`);
      } else {
        birthdayLog.channels.inApp = {
          status: 'failed',
          sentAt: null,
          error: 'Failed to create in-app notification record'
        };
        channelResults.inApp = { status: 'failed', error: 'Failed to create in-app notification record' };
      }
    } catch (notifErr) {
      birthdayLog.channels.inApp = {
        status: 'failed',
        sentAt: null,
        error: notifErr.message
      };
      channelResults.inApp = { status: 'failed', error: notifErr.message };
      console.error(`❌ [Birthday Service] In-app notification failed for ${user.name}:`, notifErr.message);
    }
  }

  // 4. Update overall status
  if (channelSuccessCount === channelAttemptCount && channelAttemptCount > 0) {
    birthdayLog.overallStatus = 'sent';
  } else if (channelSuccessCount > 0) {
    birthdayLog.overallStatus = 'partially_sent';
  } else if (channelAttemptCount > 0) {
    birthdayLog.overallStatus = 'failed';
  } else {
    birthdayLog.overallStatus = 'skipped';
  }

  await birthdayLog.save();

  return {
    success: channelSuccessCount > 0,
    userName: user.name,
    userId: user._id,
    channelSuccessCount,
    channelAttemptCount,
    channels: channelResults
  };
}

// ─── MAIN SCHEDULER EXECUTION: SEND BIRTHDAY WISHES ─────────────────────────

/**
 * Runs the daily birthday wishes pipeline.
 *
 * @param {Object} options
 * @param {Boolean} [options.isManualTest=false] - If true, bypasses duplicate check for testing
 * @param {String} [options.targetUserId=null] - Specific user to send to
 * @param {Date|String} [options.forceDate=null] - Override date for testing or simulation
 */
async function sendBirthdayWishes({ isManualTest = false, targetUserId = null, forceDate = null } = {}) {
  const executionStart = new Date();
  const istInfo = getTodayISTParts(forceDate ? new Date(forceDate) : executionStart);
  const executionDate = istInfo.dateKey;

  console.log(`\n=============================================================`);
  console.log(`🎂 [Birthday Service] Execution started for ${istInfo.dateKey} (IST Midnight)`);
  console.log(`=============================================================`);

  // Distributed Job Lock to prevent duplicate concurrent runs
  let jobLog = null;
  if (!isManualTest && !targetUserId) {
    try {
      jobLog = await NotificationJobLog.create({
        jobName: 'daily_birthday_wishes_12am',
        executionDate,
        status: 'running',
        startedAt: executionStart
      });
    } catch (lockErr) {
      if (lockErr.code === 11000) {
        console.log(`[Birthday Service] Job already executed or currently running for ${executionDate}. Skipping duplicate run.`);
        return {
          success: true,
          skipped: true,
          reason: `Job already executed for ${executionDate}`
        };
      }
      console.warn('[Birthday Service] Job lock error:', lockErr.message);
    }
  }

  try {
    let candidateUsers = [];

    if (targetUserId) {
      const singleUser = await User.findById(targetUserId);
      if (singleUser) candidateUsers = [singleUser];
    } else {
      // Find all active, non-suspended users with a DOB entered
      candidateUsers = await User.find({
        dob: { $exists: true, $ne: null },
        isActive: { $ne: false },
        isSuspended: { $ne: true }
      });
    }

    // Filter candidate users whose DOB month & day match today's IST month & day
    const birthdayUsers = candidateUsers.filter(u =>
      isManualTest || isUserBirthdayToday(u.dob, istInfo.month, istInfo.day)
    );

    console.log(`[Birthday Service] Scanned ${candidateUsers.length} users with DOB -> Found ${birthdayUsers.length} birthdays today.`);

    let successfulCount = 0;
    let failedCount = 0;
    let totalNotificationsSent = 0;
    const userResults = [];

    for (const user of birthdayUsers) {
      try {
        const result = await processUserBirthday({ user, istInfo, isManualTest });
        userResults.push(result);
        if (result.success) {
          successfulCount++;
          totalNotificationsSent += (result.channelSuccessCount || 0);
        } else {
          failedCount++;
        }
      } catch (userErr) {
        failedCount++;
        console.error(`[Birthday Service] Error processing birthday for ${user.name}:`, userErr.message);
      }
    }

    // Update telemetry metrics
    executionMetrics.lastExecution = executionStart;
    executionMetrics.birthdaysDetected = birthdayUsers.length;
    executionMetrics.notificationsSent = totalNotificationsSent;
    executionMetrics.successful = successfulCount;
    executionMetrics.failed = failedCount;
    executionMetrics.lastStatus = failedCount === 0 ? 'success' : (successfulCount > 0 ? 'partial' : 'failed');
    executionMetrics.error = null;

    // Update job log if created
    if (jobLog) {
      jobLog.status = failedCount === 0 ? 'completed' : 'failed';
      jobLog.completedAt = new Date();
      jobLog.processedUsers = birthdayUsers.length;
      jobLog.notifiedUsers = successfulCount;
      jobLog.failedUsers = failedCount;
      jobLog.details = { totalNotificationsSent, userResults };
      await jobLog.save().catch(e => console.warn('[Birthday Service] Error saving jobLog:', e.message));
    }

    console.log(`🎂 [Birthday Service] Completed: ${successfulCount} successful, ${failedCount} failed (${totalNotificationsSent} total messages dispatched).`);

    return {
      success: true,
      executionDate,
      birthdaysDetected: birthdayUsers.length,
      successful: successfulCount,
      failed: failedCount,
      notificationsSent: totalNotificationsSent,
      results: userResults
    };
  } catch (err) {
    executionMetrics.lastExecution = executionStart;
    executionMetrics.lastStatus = 'failed';
    executionMetrics.error = err.message;

    if (jobLog) {
      jobLog.status = 'failed';
      jobLog.completedAt = new Date();
      jobLog.error = err.message;
      await jobLog.save().catch(() => {});
    }

    console.error('❌ [Birthday Service] Fatal Error:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

// ─── ADMIN MONITORING STATUS API ────────────────────────────────────────────

/**
 * Returns detailed health and execution statistics for the Birthday Scheduler
 */
async function getBirthdayStatus() {
  try {
    const istInfo = getTodayISTParts();
    const todayLogs = await BirthdayLog.find({ executionDate: istInfo.dateKey }).lean();

    const currentYear = istInfo.year;
    const yearTotal = await BirthdayLog.countDocuments({ year: currentYear });
    const yearSent = await BirthdayLog.countDocuments({ year: currentYear, overallStatus: 'sent' });

    const recentLogs = await BirthdayLog.find()
      .sort({ sentAt: -1 })
      .limit(30)
      .lean();

    return {
      success: true,
      scheduler: {
        cronExpression: '0 0 * * *',
        timezone: 'Asia/Kolkata',
        scheduleDescription: 'Daily at 12:00:00 AM IST (Midnight)',
        nextScheduledExecution: getNextScheduledExecution()
      },
      lastExecution: executionMetrics.lastExecution,
      birthdaysDetected: executionMetrics.birthdaysDetected,
      notificationsSent: executionMetrics.notificationsSent,
      successful: executionMetrics.successful,
      failed: executionMetrics.failed,
      lastStatus: executionMetrics.lastStatus,
      today: {
        dateKey: istInfo.dateKey,
        monthDay: istInfo.monthDayStr,
        birthdaysToday: todayLogs.length,
        logs: todayLogs
      },
      currentYearStats: {
        year: currentYear,
        totalBirthdaysCelebrated: yearTotal,
        fullySent: yearSent
      },
      recentLogs
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

// ─── CRON INITIALIZATION ────────────────────────────────────────────────────

/**
 * Schedule the Birthday Wishes system sharply at 12:00:00 AM IST every day.
 * Cron expression: 0 0 * * *
 * Timezone: Asia/Kolkata
 */
cron.schedule('0 0 * * *', () => {
  console.log('\n⏰ [CRON 12:00 AM IST] Executing automated daily birthday wishes...');
  sendBirthdayWishes();
}, {
  timezone: 'Asia/Kolkata'
});

console.log('✅ [Birthday Service] 12:00 AM IST Cron Scheduler registered (Asia/Kolkata: 0 0 * * *).');

module.exports = {
  sendBirthdayWishes,
  getBirthdayStatus,
  isUserBirthdayToday,
  getTodayISTParts,
  formatBirthdayWhatsAppMessage,
  getNextScheduledExecution,
  processUserBirthday
};
