const cron = require('node-cron');
const User = require('../models/User');
const Notification = require('../models/Notification');
const DailyNotificationLog = require('../models/DailyNotificationLog');
const { sendMail } = require('../config/mailer');
const { getTodayDailyContent } = require('./dailyContentService');
const { generateDailyNotificationHtml } = require('../templates/dailyNotificationEmail');

// Lazy-load WhatsApp bot to avoid startup race conditions
function getWhatsApp() {
  try {
    return require('../bot/whatsapp');
  } catch (err) {
    console.warn('[Daily Notification Service] WhatsApp module not available:', err.message);
    return null;
  }
}

const CLIENT_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';

let isBroadcasting = false;

/**
 * Format WhatsApp daily spiritual message based on user language preference
 */
function formatWhatsAppDailyMessage(dailyContent, userLang = 'ta') {
  const lang = userLang || 'ta';
  
  // Mass Readings Section
  let massSection = '';
  if (lang === 'ta') {
    massSection = `*${dailyContent.massReadings.tamil.title}*\n${(dailyContent.massReadings.tamil.firstReading || '').slice(0, 280)}${dailyContent.massReadings.tamil.firstReading ? '...' : ''}`;
  } else if (lang === 'en') {
    massSection = `*${dailyContent.massReadings.english.title}*\n${(dailyContent.massReadings.english.firstReading || '').slice(0, 280)}${dailyContent.massReadings.english.firstReading ? '...' : ''}`;
  } else {
    massSection = `*தமிழ்:* ${(dailyContent.massReadings.tamil.firstReading || '').slice(0, 180)}...\n\n*English:* ${(dailyContent.massReadings.english.firstReading || '').slice(0, 180)}...`;
  }

  // Reflection Section
  let reflectionSection = '';
  if (lang === 'ta') {
    reflectionSection = (dailyContent.reflection.tamil || '').slice(0, 250) + (dailyContent.reflection.tamil ? '...' : '');
  } else if (lang === 'en') {
    reflectionSection = (dailyContent.reflection.english || '').slice(0, 250) + (dailyContent.reflection.english ? '...' : '');
  } else {
    reflectionSection = `*தமிழ்:* ${(dailyContent.reflection.tamil || '').slice(0, 150)}...\n\n*English:* ${(dailyContent.reflection.english || '').slice(0, 150)}...`;
  }

  const saintDisplayName = dailyContent.saint.nameTamil && dailyContent.saint.nameTamil !== dailyContent.saint.nameEnglish
    ? `${dailyContent.saint.nameTamil} (${dailyContent.saint.nameEnglish})`
    : dailyContent.saint.nameEnglish;

  return `*St. John de Britto's Church, Kalayarkoil*
*Good Morning! Daily Catholic Reading — ${dailyContent.formattedDate}*
━━━━━━━━━━━━━━━━━━━━

*DAILY BIBLE VERSE / இன்றைய இறைவார்த்தை*
_${dailyContent.bible.tamil}_
_"${dailyContent.bible.english}"_
— *${dailyContent.bible.ref}*

━━━━━━━━━━━━━━━━━━━━

*DAILY MASS READINGS / திருப்பலி வாசகங்கள்*
${massSection}

*TODAY'S LITURGICAL REFLECTION / சிந்தனை*
${reflectionSection}

━━━━━━━━━━━━━━━━━━━━

*SAINT OF THE DAY / இன்றைய புனிதர்*
*${saintDisplayName}*
_Source: Vatican News (${dailyContent.saint.sourceUrl || 'https://www.vaticannews.va'})_

━━━━━━━━━━━━━━━━━━━━

*Read full Mass Readings & Reflection:*
${CLIENT_URL}/bible-verse

_May God's peace and abundant blessings be with you and your family today!_`;
}

/**
 * Format In-App notification text based on user language preference
 */
function formatInAppMessage(dailyContent, userLang = 'ta') {
  const lang = userLang || 'ta';
  let massTitle = lang === 'ta' ? dailyContent.massReadings.tamil.title : dailyContent.massReadings.english.title;
  let reflectionSnippet = lang === 'ta' ? dailyContent.reflection.tamil : dailyContent.reflection.english;

  return `Daily Verse (${dailyContent.bible.ref}): "${dailyContent.bible.english}" / "${dailyContent.bible.tamil}"

Mass Readings: ${massTitle || 'Daily Liturgy'}
Reflection: ${(reflectionSnippet || '').slice(0, 160)}...

Saint of the Day: ${dailyContent.saint.nameEnglish}${dailyContent.saint.nameTamil ? ` (${dailyContent.saint.nameTamil})` : ''} [Vatican News]`;
}

/**
 * Format push notification payload
 */
function formatPushPayload(dailyContent) {
  return {
    title: `Daily Catholic Word — ${dailyContent.bible.ref}`,
    body: `"${dailyContent.bible.english.slice(0, 90)}..." • Saint: ${dailyContent.saint.nameEnglish}`,
    url: `${CLIENT_URL}/bible-verse`,
    tag: `sjdb-daily-${dailyContent.dateKey}`
  };
}

/**
 * Dispatch daily church notification across all 4 channels (Email, In-App, Push, WhatsApp)
 */
async function sendDailyChurchNotifications({
  isTest = false,
  isManualTest = false,
  testEmail = null,
  targetEmail = null,
  testPhone = null,
  targetPhone = null,
  testLang = 'ta',
  testName = 'Parishioner',
  force = false
} = {}) {
  try {
    const today = new Date();
    const dailyContent = await getTodayDailyContent(today);

    const manualTest = isTest || isManualTest;
    const toEmail = testEmail || targetEmail;
    const toPhone = testPhone || targetPhone;

    // Prepare email attachments (Saint portrait)
    const emailAttachments = [];
    if (dailyContent.saint.imageAttachment) {
      emailAttachments.push(dailyContent.saint.imageAttachment);
    }

    const hasSaintImage = Boolean(dailyContent.saint.imageAttachment);

    // ── 1. SINGLE MANUAL TEST SEND ───────────────────────────────────────────
    if (manualTest && (toEmail || toPhone)) {
      console.log(`[Daily Notification Service] Sending manual test notification (Lang: ${testLang})...`);
      const testResults = { email: null, inApp: null, push: null, whatsapp: null };

      // Email Test
      if (toEmail) {
        const html = generateDailyNotificationHtml({
          userName: testName || 'Parishioner',
          dailyContent,
          userLanguage: testLang,
          hasSaintImageAttachment: hasSaintImage
        });

        const subject = `Good Morning - Your Daily Catholic Reading - ${dailyContent.formattedDate}`;
        const emailRes = await sendMail({
          to: toEmail,
          subject,
          html,
          attachments: emailAttachments
        });
        testResults.email = emailRes;
      }

      // WhatsApp Test
      if (targetPhone) {
        const waService = getWhatsApp();
        if (waService && typeof waService.sendWhatsAppMessage === 'function') {
          const waText = formatWhatsAppDailyMessage(dailyContent, testLang);
          const waRes = await waService.sendWhatsAppMessage(targetPhone, waText);
          testResults.whatsapp = { success: Boolean(waRes) };
        } else {
          testResults.whatsapp = { success: false, error: 'WhatsApp socket offline' };
        }
      }

      return {
        success: true,
        message: 'Test notification processed',
        dateKey: dailyContent.dateKey,
        results: testResults
      };
    }

    // ── 2. BROADCAST TO ALL REGISTERED PARISHIONERS ──────────────────────────
    if (isBroadcasting) {
      console.warn('[Daily Notification Service] Broadcast is already in progress, skipping duplicate invocation.');
      return { success: false, message: 'Broadcast already in progress' };
    }

    isBroadcasting = true;
    console.log(`[Daily Notification Service] 12:00 AM IST 4-Channel Broadcast started for ${dailyContent.dateKey}...`);

    const users = await User.find({
      isActive: { $ne: false }
    }).lean();

    console.log(`[Daily Notification Service] Found ${users.length} active parishioners.`);

    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    const channelStats = {
      email: { sent: 0, failed: 0, disabled: 0 },
      inApp: { sent: 0, failed: 0, disabled: 0 },
      push: { sent: 0, failed: 0, disabled: 0 },
      whatsapp: { sent: 0, failed: 0, disabled: 0 }
    };

    const waService = getWhatsApp();

    for (const user of users) {
      const userSettings = user.settings?.notifications || {};
      const rawLang = String(user.mass_reflection_language || userSettings.mass_reflection_language || user.preferredLanguage || 'ta').toLowerCase();
      let userLang = 'ta';
      if (rawLang.includes('both') || rawLang.includes('all') || (rawLang.includes('ta') && rawLang.includes('en'))) {
        userLang = 'both';
      } else if (rawLang.startsWith('en')) {
        userLang = 'en';
      } else {
        userLang = 'ta';
      }
      const userName = user.name || 'Parishioner';
      const userEmail = (user.email || '').trim().toLowerCase();
      const userPhone = (user.phone || '').trim();

      // DUPLICATE PROTECTION: Check if user already has a log for this dateKey (unless force=true)
      if (!force) {
        const existingLog = await DailyNotificationLog.findOne({
          userId: user._id,
          dateKey: dailyContent.dateKey
        }).lean();

        if (existingLog && (existingLog.status === 'sent' || existingLog.status === 'partially_sent')) {
          skippedCount++;
          continue;
        }
      }

      // Channel preference flags
      const isEmailEnabled = userSettings.email !== false && Boolean(userEmail && userEmail.includes('@'));
      const isInAppEnabled = userSettings.inApp !== false;
      const isPushEnabled = userSettings.push !== false;
      const isWhatsAppEnabled = userSettings.whatsapp !== false && Boolean(userPhone) && user.whatsappOptIn !== false;

      const logChannels = {
        email: { status: isEmailEnabled ? 'pending' : 'disabled' },
        inApp: { status: isInAppEnabled ? 'pending' : 'disabled' },
        push: { status: isPushEnabled ? 'pending' : 'disabled' },
        whatsapp: { status: isWhatsAppEnabled ? 'pending' : 'disabled' }
      };

      let userHadAtLeastOneSuccess = false;
      let userHadAnyAttempt = false;

      // ── CHANNEL 1:  EMAIL ───────────────────────────────────────────────
      if (isEmailEnabled) {
        userHadAnyAttempt = true;
        try {
          const html = generateDailyNotificationHtml({
            userName,
            dailyContent,
            userLanguage: userLang,
            hasSaintImageAttachment: hasSaintImage
          });

          const subject = `Good Morning - Your Daily Catholic Reading - ${dailyContent.formattedDate}`;
          const mailRes = await sendMail({
            to: userEmail,
            subject,
            html,
            attachments: emailAttachments
          });

          if (mailRes.success) {
            logChannels.email = { status: 'sent', messageId: mailRes.messageId, error: null, sentAt: new Date() };
            channelStats.email.sent++;
            userHadAtLeastOneSuccess = true;
          } else {
            logChannels.email = { status: 'failed', messageId: null, error: mailRes.error || 'SMTP Failed', sentAt: new Date() };
            channelStats.email.failed++;
          }
        } catch (err) {
          logChannels.email = { status: 'failed', messageId: null, error: err.message, sentAt: new Date() };
          channelStats.email.failed++;
        }
      } else {
        channelStats.email.disabled++;
      }

      // ── CHANNELS 2 & 3: IN-APP & UNIFIED PUSH NOTIFICATION ──────────
      if (isInAppEnabled || isPushEnabled) {
        userHadAnyAttempt = true;
        try {
          const { createNotification } = require('./notificationService');
          const inAppMsg = formatInAppMessage(dailyContent, userLang);
          
          const notif = await createNotification({
            userId: user._id,
            isBroadcast: false,
            title: ` Daily Catholic Word & Readings — ${dailyContent.formattedDate}`,
            message: inAppMsg,
            type: 'daily_spiritual',
            category: 'spiritual',
            priority: 'normal',
            recipient: 'user',
            actionUrl: `/notifications`,
            channels: [
              ...(isInAppEnabled ? ['inApp'] : []),
              ...(isPushEnabled ? ['push'] : [])
            ]
          });

          if (notif) {
            if (isInAppEnabled) {
              logChannels.inApp = { status: 'sent', notificationId: notif._id, error: null, sentAt: new Date() };
              channelStats.inApp.sent++;
            }
            if (isPushEnabled) {
              logChannels.push = { status: 'sent', error: null, sentAt: new Date() };
              channelStats.push.sent++;
            }
            userHadAtLeastOneSuccess = true;
          }
        } catch (err) {
          if (isInAppEnabled) {
            logChannels.inApp = { status: 'failed', notificationId: null, error: err.message, sentAt: new Date() };
            channelStats.inApp.failed++;
          }
          if (isPushEnabled) {
            logChannels.push = { status: 'failed', error: err.message, sentAt: new Date() };
            channelStats.push.failed++;
          }
        }
      } else {
        channelStats.inApp.disabled++;
        channelStats.push.disabled++;
      }

      // ── CHANNEL 4:  WHATSAPP BOT ────────────────────────────────────────
      if (isWhatsAppEnabled) {
        userHadAnyAttempt = true;
        try {
          if (waService && typeof waService.sendWhatsAppMessage === 'function') {
            const waMsg = formatWhatsAppDailyMessage(dailyContent, userLang);
            const waOk = await waService.sendWhatsAppMessage(userPhone, waMsg);

            if (waOk) {
              logChannels.whatsapp = { status: 'sent', phone: userPhone, error: null, sentAt: new Date() };
              channelStats.whatsapp.sent++;
              userHadAtLeastOneSuccess = true;
            } else {
              logChannels.whatsapp = { status: 'failed', phone: userPhone, error: 'Socket unreachable', sentAt: new Date() };
              channelStats.whatsapp.failed++;
            }
          } else {
            logChannels.whatsapp = { status: 'failed', phone: userPhone, error: 'WhatsApp service offline', sentAt: new Date() };
            channelStats.whatsapp.failed++;
          }
        } catch (err) {
          logChannels.whatsapp = { status: 'failed', phone: userPhone, error: err.message, sentAt: new Date() };
          channelStats.whatsapp.failed++;
        }
      } else {
        channelStats.whatsapp.disabled++;
      }

      // Determine overall user delivery status
      const overallStatus = userHadAtLeastOneSuccess
        ? 'sent'
        : (userHadAnyAttempt ? 'failed' : 'skipped');

      if (overallStatus === 'sent') sentCount++;
      else if (overallStatus === 'failed') failedCount++;
      else skippedCount++;

      // Save / Upsert to DailyNotificationLog for complete history tracking
      await DailyNotificationLog.findOneAndUpdate(
        { userId: user._id, dateKey: dailyContent.dateKey },
        {
          userId: user._id,
          userEmail: userEmail || 'no-email@sjdb.church',
          userName,
          userPhone: userPhone || null,
          dateKey: dailyContent.dateKey,
          language: userLang,
          status: overallStatus,
          channels: logChannels,
          summary: {
            bibleRef: dailyContent.bible.ref,
            saintName: dailyContent.saint.nameEnglish,
            massTitle: dailyContent.massReadings[userLang === 'en' ? 'english' : 'tamil'].title || 'Daily Mass Readings'
          },
          sentAt: new Date()
        },
        { upsert: true, new: true }
      );

      // Polite throttle between users to maintain server performance
      await new Promise(r => setTimeout(r, 120));
    }

    isBroadcasting = false;
    console.log(`[Daily Notification Service] 4-Channel Broadcast complete for ${dailyContent.dateKey}: Sent=${sentCount}, Skipped=${skippedCount}, Failed=${failedCount}`);
    console.log('[Daily Notification Service] Channel breakdown:', JSON.stringify(channelStats));

    return {
      success: true,
      dateKey: dailyContent.dateKey,
      totalUsers: users.length,
      sentCount,
      skippedCount,
      failedCount,
      channelStats
    };
  } catch (err) {
    isBroadcasting = false;
    console.error('[Daily Notification Service] Fatal 4-channel broadcast error:', err);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Get daily notification status and monitoring metrics for admin
 */
async function getDailyNotificationStatus() {
  try {
    const today = new Date();
    const dailyContent = await getTodayDailyContent(today);
    const dateKey = dailyContent.dateKey;

    const totalUsers = await User.countDocuments({
      isActive: { $ne: false }
    });

    const sentLogs = await DailyNotificationLog.countDocuments({ dateKey, status: { $in: ['sent', 'partially_sent'] } });
    const failedLogs = await DailyNotificationLog.countDocuments({ dateKey, status: 'failed' });
    const recentLogs = await DailyNotificationLog.find({ dateKey }).sort({ sentAt: -1 }).limit(30).lean();

    const isComplete = sentLogs > 0 && (sentLogs + failedLogs) >= totalUsers;

    // Channel breakdown metrics
    const emailSent = await DailyNotificationLog.countDocuments({ dateKey, 'channels.email.status': 'sent' });
    const inAppSent = await DailyNotificationLog.countDocuments({ dateKey, 'channels.inApp.status': 'sent' });
    const pushSent = await DailyNotificationLog.countDocuments({ dateKey, 'channels.push.status': 'sent' });
    const waSent = await DailyNotificationLog.countDocuments({ dateKey, 'channels.whatsapp.status': 'sent' });

    return {
      success: true,
      dateKey,
      formattedDate: dailyContent.formattedDate,
      status: isComplete ? 'Completed' : (sentLogs > 0 ? 'Partially Sent' : 'Pending'),
      totalUsers,
      sentCount: sentLogs,
      failedCount: failedLogs,
      skippedCount: Math.max(0, totalUsers - (sentLogs + failedLogs)),
      channels: {
        email: emailSent,
        inApp: inAppSent,
        push: pushSent,
        whatsapp: waSent
      },
      contentChecklist: {
        bibleContent: Boolean(dailyContent.bibleVerse?.tamil?.text && dailyContent.bibleVerse?.english?.text),
        massReadings: Boolean(dailyContent.massReadings?.tamil?.title || dailyContent.massReadings?.english?.title),
        reflection: Boolean(dailyContent.reflection?.tamil || dailyContent.reflection?.english),
        saint: Boolean(dailyContent.saintOfTheDay?.tamil?.name || dailyContent.saintOfTheDay?.english?.name),
        bibleImage: Boolean(dailyContent.bibleVerse?.imageBuffer || dailyContent.bibleVerse?.imageUrl),
        saintImage: Boolean(dailyContent.saintOfTheDay?.imageBuffer || dailyContent.saintOfTheDay?.imageUrl)
      },
      saintDetails: {
        name: dailyContent.saintOfTheDay?.english?.name,
        nameTa: dailyContent.saintOfTheDay?.tamil?.name,
        imageSource: dailyContent.saintOfTheDay?.imageSource,
        sourceUrl: dailyContent.saintOfTheDay?.vaticanUrl || dailyContent.saintOfTheDay?.imageUrl
      },
      recentLogs
    };
  } catch (err) {
    console.error('[Daily Notification Service] Status error:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Get notification history for a specific logged-in user
 */
async function getUserNotificationHistory(userId) {
  try {
    const history = await DailyNotificationLog.find({ userId })
      .sort({ sentAt: -1 })
      .limit(60)
      .lean();

    return {
      success: true,
      history
    };
  } catch (err) {
    console.error('[Daily Notification Service] User history error:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Deployment / Startup Trigger with Idempotency Protection
 * Ensures today's notification is sent on server startup/restart if not yet sent today,
 * but skips safely if already delivered on this date.
 */
async function checkAndSendOnStartup() {
  try {
    const dailyContent = await getTodayDailyContent();
    const todayDateKey = dailyContent.dateKey; // e.g. "2026-08-21" in Asia/Kolkata

    // Check if any sent log exists for today
    const sentCountToday = await DailyNotificationLog.countDocuments({
      dateKey: todayDateKey,
      status: { $in: ['sent', 'partially_sent'] }
    });

    if (sentCountToday > 0) {
      console.log(`[Daily Notification Service] Startup Check: Today's notifications (${todayDateKey}) have already been delivered (${sentCountToday} logs). Skipping duplicate send.`);
      return { skipped: true, dateKey: todayDateKey, sentCountToday };
    }

    console.log(`[Daily Notification Service] Startup/Deployment Trigger: Today's daily notification (${todayDateKey}) has not been sent yet. Initiating broadcast now...`);
    const result = await sendDailyChurchNotifications();
    return result;
  } catch (err) {
    console.error('[Daily Notification Service] Startup trigger error:', err.message);
  }
}

// ─── 12:00 AM IST Daily Automated Cron Job ───────────────────────────────────
cron.schedule('0 0 * * *', async () => {
  console.log(' [CRON 12:00 AM IST] Triggering automated 4-Channel Daily Church Notifications broadcast...');
  await sendDailyChurchNotifications();
}, {
  timezone: 'Asia/Kolkata'
});

console.log('[Daily Notification Service] 12:00 AM IST Cron Scheduler registered (Asia/Kolkata).');

// Run startup/deployment check 5 seconds after server boot
setTimeout(() => {
  checkAndSendOnStartup().catch(err => console.error('[Daily Notification Service] Startup execution error:', err.message));
}, 5000);

module.exports = {
  sendDailyChurchNotifications,
  getDailyNotificationStatus,
  getUserNotificationHistory,
  checkAndSendOnStartup
};

