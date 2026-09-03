const cron = require('node-cron');
const User = require('../models/User');
const BotSession = require('../models/BotSession');
const Notification = require('../models/Notification');
const DailyNotificationLog = require('../models/DailyNotificationLog');
const { sendMail } = require('../config/mailer');
const { getTodayDailyContent } = require('./dailyContentService');
const { generateDailyNotificationHtml } = require('../templates/dailyNotificationEmail');
const { sendPushBroadcast, sendPushToUser } = require('./webPushService');
const { generateDailyCatholicMessage, generateDailyLinksMessage, generateSaintInfoMessage } = require('./whatsappDailyFormatter');
const { SITE_ROUTES, EXTERNAL_LINKS, getSiteUrl, getBaseClientUrl } = require('../config/siteRoutes');

// Lazy-load WhatsApp bot to avoid startup race conditions
function getWhatsApp() {
  try {
    return require('../bot/whatsapp');
  } catch (err) {
    console.warn('[Daily Notification Service] WhatsApp module not available:', err.message);
    return null;
  }
}

const CLIENT_URL = getBaseClientUrl();

let isBroadcasting = false;

/**
 * Resolve user language preference with strict fallback to Tamil ('ta')
 */
function resolveUserLanguage(user) {
  if (!user) return 'ta';
  const rawLang = String(
    user.mass_reflection_language ||
    user.settings?.notifications?.mass_reflection_language ||
    user.preferredLanguage ||
    user.language ||
    'ta'
  ).trim().toLowerCase();

  if (rawLang === 'en' || rawLang.startsWith('en')) return 'en';
  if (rawLang === 'ml' || rawLang.startsWith('ml') || rawLang.includes('malayalam')) return 'ml';
  if (rawLang === 'both' || rawLang.includes('ta-en') || (rawLang.includes('ta') && rawLang.includes('en'))) return 'both';
  return 'ta'; // Default to Tamil
}

/**
 * Format In-App notification text based on user language preference
 */
function formatInAppMessage(dailyContent, userLang = 'ta') {
  const lang = userLang || 'ta';
  const isEn = lang === 'en';
  const massTitle = isEn ? dailyContent.massReadings?.english?.title : dailyContent.massReadings?.tamil?.title;
  const reflectionSnippet = isEn ? dailyContent.reflection?.english : dailyContent.reflection?.tamil;
  const saintName = isEn ? dailyContent.saint?.nameEnglish : (dailyContent.saint?.nameTamil || dailyContent.saint?.nameEnglish);

  return `${isEn ? 'Daily Verse' : 'இன்றைய இறைவார்த்தை'} (${dailyContent.bible.ref}): "${isEn ? dailyContent.bible.english : dailyContent.bible.tamil}"

${isEn ? 'Mass Readings' : 'திருப்பலி வாசகங்கள்'}: ${massTitle || 'Daily Liturgy'}
${isEn ? 'Saint of the Day' : 'இன்றைய புனிதர்'}: ${saintName || 'Holy Saint'}
${isEn ? 'Reflection' : 'தியானம்'}: ${(reflectionSnippet || '').slice(0, 150)}...`;
}

/**
 * Format push notification payload for browser and mobile PWA push
 */
function formatPushPayload(dailyContent, lang = 'ta') {
  const isEn = lang === 'en';
  const saintName = isEn ? dailyContent.saint?.nameEnglish : (dailyContent.saint?.nameTamil || dailyContent.saint?.nameEnglish);
  const verseText = isEn ? dailyContent.bible?.english : dailyContent.bible?.tamil;

  const bibleUrl = getSiteUrl(SITE_ROUTES.BIBLE_VERSE);
  return {
    title: isEn
      ? `✝️ Daily Catholic Word — ${dailyContent.bible.ref}`
      : `✝️ இன்றைய இறைவார்த்தை — ${dailyContent.bible.ref}`,
    body: `"${(verseText || '').slice(0, 90)}..." • ${isEn ? 'Saint' : 'புனிதர்'}: ${saintName || 'Holy Saint'}`,
    url: bibleUrl,
    tag: `sjdb-daily-${dailyContent.dateKey}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: {
      url: bibleUrl,
      dateKey: dailyContent.dateKey
    }
  };
}

/**
 * Dispatch daily church notification across all enabled channels:
 * - WhatsApp Bot (Message 1 Devotional + Message 2 Links)
 * - Mobile / Web Push Notifications (WebPush to all subscribers even when closed)
 * - Email Broadcast (HTML template + Saint portrait)
 * - In-App Notifications (Notification feed)
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

        const subject = testLang === 'en'
          ? `✝️ Good Morning — Daily Catholic Readings & Living Word — ${dailyContent.formattedDate}`
          : `✝️ காலை வணக்கம் — இன்றைய கத்தோலிக்க திருப்பலி வாசகங்கள் — ${dailyContent.formattedDateTa || dailyContent.formattedDate}`;

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
          // 1. Message 1: Clean Catholic Daily Message (No URLs)
          const waMsg1 = generateDailyCatholicMessage({
            dailyContent,
            language: testLang,
            readingPreference: 'full'
          });
          const waRes1 = await waService.sendWhatsAppMessage(targetPhone, waMsg1);

          const saintImageUrl = dailyContent?.saintImage || dailyContent?.saint?.image || dailyContent?.saintOfTheDay?.english?.imageUrl;

          // 2. Message 2: Saint of the Day Image (Image only)
          if (saintImageUrl && typeof waService.sendWhatsAppMedia === 'function') {
            try {
              await new Promise(r => setTimeout(r, 450));
              await waService.sendWhatsAppMedia(targetPhone, { url: saintImageUrl, mimetype: 'image/jpeg' });
            } catch (mediaErr) {
              console.warn('[Daily Notification] Test Saint media send warning:', mediaErr.message);
            }
          }

          // 3. Message 3: Saint of the Day Information
          try {
            await new Promise(r => setTimeout(r, 450));
            const saintInfoMsg = generateSaintInfoMessage({ dailyContent, language: testLang });
            await waService.sendWhatsAppMessage(targetPhone, saintInfoMsg);
          } catch (saintInfoErr) {
            console.warn('[Daily Notification] Test Saint info send warning:', saintInfoErr.message);
          }

          // 4. Message 4: Separate Links Message (Only valid URLs)
          try {
            await new Promise(r => setTimeout(r, 450));
            const linksMsg = generateDailyLinksMessage({ dailyContent, language: testLang });
            if (linksMsg) {
              await waService.sendWhatsAppMessage(targetPhone, linksMsg);
            }
          } catch (e) {
            console.warn('[Daily Notification] Test links send warning:', e.message);
          }

          testResults.whatsapp = { success: Boolean(waRes1) };
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

    // ── 2. AUTOMATIC 4:00 AM IST BROADCAST TO ALL REGISTERED PARISHIONERS ────
    const { getSystemState } = require('./systemStateService');
    const systemState = await getSystemState();
    if (systemState && systemState.status !== 'live') {
      console.log(`[Daily Notification Service] Skipping automatic broadcast because system is in ${systemState.status.toUpperCase()} mode.`);
      return { success: false, skipped: true, reason: `System is in ${systemState.status.toUpperCase()} mode` };
    }

    if (isBroadcasting) {
      console.warn('[Daily Notification Service] Broadcast is already in progress, skipping duplicate invocation.');
      return { success: false, message: 'Broadcast already in progress' };
    }

    isBroadcasting = true;
    console.log(`[Daily Notification Service] 12:00 AM IST Multi-Channel Daily Broadcast started for ${dailyContent.dateKey}...`);

    // Ensure mass readings, English translations, saint, and verse are synchronized before broadcasting
    try {
      const { fetchAndStoreTamilReading, getOrGenerateEnglishTranslation } = require('./dailyMassReadingService');
      const { fetchDailySaint } = require('./saintService');
      const { syncDailyVerse } = require('./bibleVerseService');
      await Promise.allSettled([
        fetchAndStoreTamilReading(dailyContent.dateKey),
        getOrGenerateEnglishTranslation(dailyContent.dateKey),
        fetchDailySaint(today),
        syncDailyVerse()
      ]);
    } catch (syncErr) {
      console.warn('[Daily Notification Service] Pre-broadcast sync notice:', syncErr.message);
    }

    const users = await User.find({
      isActive: { $ne: false }
    }).lean();

    const botSessions = await BotSession.find({ step: 'done' }).lean();

    console.log(`[Daily Notification Service] Found ${users.length} active parishioners and ${botSessions.length} bot sessions.`);

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

    // ── 2A. PROCESS WEBSITE USERS ───────────────────────────────────────────
    for (const user of users) {
      const userSettings = user.settings?.notifications || {};
      const userLang = resolveUserLanguage(user);
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

      // ── CHANNEL 1: EMAIL ──────────────────────────────────────────────────
      if (isEmailEnabled) {
        userHadAnyAttempt = true;
        try {
          const html = generateDailyNotificationHtml({
            userName,
            dailyContent,
            userLanguage: userLang,
            hasSaintImageAttachment: hasSaintImage
          });

          const subject = userLang === 'en'
            ? `✝️ Good Morning — Daily Catholic Readings & Living Word — ${dailyContent.formattedDate}`
            : `✝️ காலை வணக்கம் — இன்றைய கத்தோலிக்க திருப்பலி வாசகங்கள் — ${dailyContent.formattedDateTa || dailyContent.formattedDate}`;

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

      // ── CHANNEL 2 & 3: IN-APP & MOBILE/WEB PUSH ──────────────────────────
      if (isInAppEnabled || isPushEnabled) {
        userHadAnyAttempt = true;
        try {
          const { createNotification } = require('./notificationService');
          const inAppMsg = formatInAppMessage(dailyContent, userLang);

          const notif = await createNotification({
            userId: user._id,
            isBroadcast: false,
            title: userLang === 'en'
              ? `Daily Catholic Word & Readings — ${dailyContent.formattedDate}`
              : `இன்றைய கத்தோலிக்க வாசகங்கள் — ${dailyContent.formattedDateTa || dailyContent.formattedDate}`,
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

      // ── CHANNEL 4: WHATSAPP BOT ──────────────────────────────────────────
      if (isWhatsAppEnabled) {
        userHadAnyAttempt = true;
        try {
          if (waService && typeof waService.sendWhatsAppMessage === 'function') {
            const userReadingPref = user.readingPreference || 'full';
            const userSendLinks = user.sendLinks !== false;

            // 1. Message 1: Clean devotional/reading message (0 URLs)
            const waMsg = generateDailyCatholicMessage({
              dailyContent,
              language: userLang,
              readingPreference: userReadingPref
            });
            const waOk = await waService.sendWhatsAppMessage(userPhone, waMsg);

            if (waOk) {
              logChannels.whatsapp = { status: 'sent', phone: userPhone, error: null, sentAt: new Date() };
              channelStats.whatsapp.sent++;
              userHadAtLeastOneSuccess = true;

              // 2. Message 2: Saint of the Day Separate WhatsApp Photo Message (Image only)
              try {
                const saintImageUrl = dailyContent?.saintImage || dailyContent?.saint?.image || dailyContent?.saintOfTheDay?.english?.imageUrl;

                if (saintImageUrl && typeof waService.sendWhatsAppMedia === 'function') {
                  await new Promise(r => setTimeout(r, 450));
                  await waService.sendWhatsAppMedia(userPhone, { url: saintImageUrl, mimetype: 'image/jpeg' });
                }
              } catch (saintMediaErr) {
                console.warn(`[Daily Notification] Failed to send Saint photo message to ${userPhone}:`, saintMediaErr.message);
              }

              // 3. Message 3: Saint of the Day Information
              try {
                await new Promise(r => setTimeout(r, 450));
                const saintInfoMsg = generateSaintInfoMessage({ dailyContent, language: userLang });
                await waService.sendWhatsAppMessage(userPhone, saintInfoMsg);
              } catch (saintInfoErr) {
                console.warn(`[Daily Notification] Failed to send Saint info to ${userPhone}:`, saintInfoErr.message);
              }

              // 4. Message 4: Separate Clickable Links Message (if user preference enabled)
              if (userSendLinks) {
                try {
                  await new Promise(r => setTimeout(r, 450));
                  const linksMsg = generateDailyLinksMessage({ dailyContent, language: userLang });
                  if (linksMsg) {
                    await waService.sendWhatsAppMessage(userPhone, linksMsg);
                  }
                } catch (linkErr) {
                  console.warn(`[Daily Notification] Failed to send links message to ${userPhone}:`, linkErr.message);
                }
              }
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

      // Save / Upsert to DailyNotificationLog
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
            massTitle: dailyContent.massReadings[userLang === 'en' ? 'english' : 'tamil']?.title || 'Daily Mass Readings'
          },
          sentAt: new Date()
        },
        { upsert: true, new: true }
      );

      // Polite throttle between users
      await new Promise(r => setTimeout(r, 120));
    }

    // ── 2B. BROADCAST WEB/MOBILE PUSH TO ALL ACTIVE BROWSER SUBSCRIBERS ──────
    try {
      const pushPayload = formatPushPayload(dailyContent, 'ta');
      const pushBroadcastRes = await sendPushBroadcast(pushPayload);
      console.log(`[Daily Notification Service] Global Push Broadcast delivered to ${pushBroadcastRes.sentCount || 0} browser/mobile subscribers.`);
    } catch (pushErr) {
      console.warn('[Daily Notification Service] Global push broadcast error:', pushErr.message);
    }

    // ── 2C. PROCESS STANDALONE WHATSAPP BOT SESSIONS ─────────────────────────
    if (waService && typeof waService.sendWhatsAppMessage === 'function') {
      const processedPhones = new Set(users.map(u => (u.phone || '').replace(/\D/g, '')).filter(Boolean));

      for (const session of botSessions) {
        const phone = session.phoneNumber;
        const cleanPhone = (phone || '').replace(/\D/g, '');
        if (!phone || (cleanPhone && processedPhones.has(cleanPhone))) continue;

        processedPhones.add(cleanPhone || phone);
        const sessionLang = resolveUserLanguage(session);
        const sessionReadingPref = session.readingPreference || 'full';
        const sessionSendLinks = session.sendLinks !== false;

        try {
          await new Promise(r => setTimeout(r, 500));
          const waMsg = generateDailyCatholicMessage({
            dailyContent,
            language: sessionLang,
            readingPreference: sessionReadingPref
          });

          const ok = await waService.sendWhatsAppMessage(phone, waMsg);
          if (ok) {
            channelStats.whatsapp.sent++;

            // 2. Message 2: Saint of the Day Separate WhatsApp Photo Message (Image only)
            try {
              const saintImageUrl = dailyContent?.saintImage || dailyContent?.saint?.image || dailyContent?.saintOfTheDay?.english?.imageUrl;

              if (saintImageUrl && typeof waService.sendWhatsAppMedia === 'function') {
                await new Promise(r => setTimeout(r, 450));
                await waService.sendWhatsAppMedia(phone, { url: saintImageUrl, mimetype: 'image/jpeg' });
              }
            } catch (saintMediaErr) {
              console.warn(`[Daily Notification] Session Saint photo send error for ${phone}:`, saintMediaErr.message);
            }

            // 3. Message 3: Saint of the Day Information
            try {
              await new Promise(r => setTimeout(r, 450));
              const saintInfoMsg = generateSaintInfoMessage({ dailyContent, language: sessionLang });
              await waService.sendWhatsAppMessage(phone, saintInfoMsg);
            } catch (saintInfoErr) {
              console.warn(`[Daily Notification] Session Saint info send error for ${phone}:`, saintInfoErr.message);
            }

            // 4. Message 4: Separate Clickable Links Message (if sessionSendLinks enabled)
            if (sessionSendLinks) {
              try {
                await new Promise(r => setTimeout(r, 450));
                const linksMsg = generateDailyLinksMessage({ dailyContent, language: sessionLang });
                if (linksMsg) {
                  await waService.sendWhatsAppMessage(phone, linksMsg);
                }
              } catch (linkErr) {
                console.warn(`[Daily Notification] Session links send error for ${phone}:`, linkErr.message);
              }
            }
          }
        } catch (sessErr) {
          console.warn(`[Daily Notification] Session send error for ${phone}:`, sessErr.message);
        }
      }
    }

    isBroadcasting = false;
    console.log(`[Daily Notification Service] 12:00 AM Multi-Channel Broadcast complete for ${dailyContent.dateKey}: Sent=${sentCount}, Skipped=${skippedCount}, Failed=${failedCount}`);
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
 */
async function checkAndSendOnStartup() {
  try {
    const dailyContent = await getTodayDailyContent();
    const todayDateKey = dailyContent.dateKey;

    const sentCountToday = await DailyNotificationLog.countDocuments({
      dateKey: todayDateKey,
      status: { $in: ['sent', 'partially_sent'] }
    });

    if (sentCountToday > 0) {
      console.log(`[Daily Notification Service] Startup Check: Today's notifications (${todayDateKey}) have already been delivered (${sentCountToday} logs). Skipping duplicate send.`);
      return { skipped: true, dateKey: todayDateKey, sentCountToday };
    }

    console.log(`[Daily Notification Service] Startup Check: Today's daily notification (${todayDateKey}) has not been sent yet. Automatically triggering 12:00 AM broadcast for all users...`);
    await sendDailyChurchNotifications();
  } catch (err) {
    console.error('[Daily Notification Service] Startup trigger error:', err.message);
  }
}

// ─── 12:00 AM IST Daily Automated Scheduled Job (Midnight) ───────────────────
cron.schedule('0 0 * * *', async () => {
  console.log('🔔 [CRON 12:00 AM IST] Triggering automated Daily Catholic Readings & 4-Channel broadcast...');
  await sendDailyChurchNotifications();
}, {
  timezone: 'Asia/Kolkata'
});

console.log('✅ [Daily Notification Service] 12:00 AM IST Cron Scheduler registered (Asia/Kolkata).');

// Run startup check 5 seconds after server boot
setTimeout(() => {
  checkAndSendOnStartup().catch(err => console.error('[Daily Notification Service] Startup execution error:', err.message));
}, 5000);

module.exports = {
  sendDailyChurchNotifications,
  getDailyNotificationStatus,
  getUserNotificationHistory,
  checkAndSendOnStartup
};
