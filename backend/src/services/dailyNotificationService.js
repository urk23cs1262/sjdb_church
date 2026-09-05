/**
 * Daily Catholic Notification Service — SJDB Connect
 * 
 * 100% Backend-Automated Daily Catholic Notification Engine.
 * 
 * Schedule: 04:00 AM IST (Asia/Kolkata) every day via node-cron (0 4 * * *)
 * Channels:
 *  1. WhatsApp Bot (Baileys daemon: Devotional message + Saint photo + Saint details + Optional links)
 *  2. Email Broadcast (Nodemailer HTML template with Saint CID image attachment)
 *  3. In-App Notifications (Notification feed)
 *  4. Mobile / Web Push Notifications (WebPush to subscribed devices)
 * 
 * Key Architecture Guarantees:
 *  - Independent of frontend/browser/admin page.
 *  - Distributed locking via DailyNotificationJob.
 *  - Recipient-level idempotency via NotificationDelivery unique indexes.
 *  - Automatic retries with exponential backoff on transient delivery failures.
 *  - Resilient to server restarts without duplicate sends.
 *  - Supports external cron trigger via secure webhook (/scheduler-trigger).
 */

const cron = require('node-cron');
const User = require('../models/User');
const BotSession = require('../models/BotSession');
const Notification = require('../models/Notification');
const DailyNotificationLog = require('../models/DailyNotificationLog');
const DailyNotificationJob = require('../models/DailyNotificationJob');
const NotificationDelivery = require('../models/NotificationDelivery');
const { sendMail } = require('../config/mailer');
const { getTodayDailyContent } = require('./dailyContentService');
const { generateDailyNotificationHtml } = require('../templates/dailyNotificationEmail');
const { sendPushBroadcast } = require('./webPushService');
const {
  generateDailyCatholicMessage,
  generateDailyLinksMessage,
  generateSaintInfoMessage
} = require('./whatsappDailyFormatter');
const { SITE_ROUTES, getSiteUrl, getBaseClientUrl } = require('../config/siteRoutes');

// Lazy-load WhatsApp bot to avoid circular dependencies and startup race conditions
function getWhatsApp() {
  try {
    return require('../bot/whatsapp');
  } catch (err) {
    console.warn('[Daily Notification Service] WhatsApp module not available:', err.message);
    return null;
  }
}

const CLIENT_URL = getBaseClientUrl();

// ─── Language & Formatting Helpers ──────────────────────────────────────────

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
 * Helper: retry an async task with exponential backoff
 */
async function retryOperation(fn, maxRetries = 3, delayBaseMs = 1000) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn(attempt);
      return { success: true, result, attempts: attempt };
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delayBaseMs * attempt));
      }
    }
  }
  return { success: false, error: lastErr?.message || 'Operation failed after retries', attempts: maxRetries };
}

// ─── Core Notification Dispatcher ───────────────────────────────────────────

/**
 * Dispatch daily church notification across all enabled channels.
 * Uses DailyNotificationJob for atomic distributed locking and
 * NotificationDelivery for recipient-level idempotency and retries.
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
  force = false,
  triggerType = 'cron_scheduler'
} = {}) {
  const manualTest = isTest || isManualTest;
  const toEmail = testEmail || targetEmail;
  const toPhone = testPhone || targetPhone;

  try {
    const today = new Date();
    const dailyContent = await getTodayDailyContent(today);
    const dateKey = dailyContent.dateKey; // YYYY-MM-DD in Asia/Kolkata

    // Prepare email attachments (Saint portrait)
    const emailAttachments = [];
    if (dailyContent.saint.imageAttachment) {
      emailAttachments.push(dailyContent.saint.imageAttachment);
    }
    const hasSaintImage = Boolean(dailyContent.saint.imageAttachment);

    // ── 1. SINGLE MANUAL TEST SEND (Non-Job) ──────────────────────────────────
    if (manualTest && (toEmail || toPhone)) {
      console.log(`[Daily Notification Service] Sending single manual test notification (Lang: ${testLang})...`);
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
      if (toPhone) {
        const waService = getWhatsApp();
        if (waService && typeof waService.sendWhatsAppMessage === 'function') {
          const cleanPhone = toPhone.replace(/\D/g, '');
          const waMsg1 = generateDailyCatholicMessage({
            dailyContent,
            language: testLang,
            readingPreference: 'full'
          });
          const waRes1 = await waService.sendWhatsAppMessage(cleanPhone, waMsg1);

          const saintImageUrl = dailyContent?.saintImage || dailyContent?.saint?.image || dailyContent?.saintOfTheDay?.english?.imageUrl;
          if (saintImageUrl && typeof waService.sendWhatsAppMedia === 'function') {
            try {
              await new Promise(r => setTimeout(r, 450));
              await waService.sendWhatsAppMedia(cleanPhone, { url: saintImageUrl, mimetype: 'image/jpeg' });
            } catch (mediaErr) {
              console.warn('[Daily Notification] Test Saint media send warning:', mediaErr.message);
            }
          }

          try {
            await new Promise(r => setTimeout(r, 450));
            const saintInfoMsg = generateSaintInfoMessage({ dailyContent, language: testLang });
            await waService.sendWhatsAppMessage(cleanPhone, saintInfoMsg);
          } catch (saintInfoErr) {
            console.warn('[Daily Notification] Test Saint info send warning:', saintInfoErr.message);
          }

          try {
            await new Promise(r => setTimeout(r, 450));
            const linksMsg = generateDailyLinksMessage({ dailyContent, language: testLang });
            if (linksMsg) {
              await waService.sendWhatsAppMessage(cleanPhone, linksMsg);
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
        dateKey,
        results: testResults
      };
    }

    // ── 2. FULL AUTOMATED BROADCAST JOB ─────────────────────────────────────
    const jobId = `daily_catholic_job_${dateKey.replace(/-/g, '_')}`;
    const workerId = `worker-${process.pid}-${Date.now()}`;

    // A. Distributed Lock & Atomic Job Check
    let job = await DailyNotificationJob.findOne({ notificationDate: dateKey });

    if (job && job.status === 'completed' && !force) {
      console.log(`[DAILY-CATHOLIC] ✅ Job ${job.jobId} for ${dateKey} is already COMPLETED. Skipping duplicate execution.`);
      return {
        success: true,
        skipped: true,
        reason: 'already_completed',
        jobId: job.jobId,
        dateKey
      };
    }

    if (job && job.status === 'running' && !force) {
      const lockAgeMs = Date.now() - new Date(job.lockedAt || job.startedAt || job.createdAt).getTime();
      // If locked less than 30 minutes ago, consider it actively running on another instance
      if (lockAgeMs < 30 * 60 * 1000) {
        console.warn(`[DAILY-CATHOLIC] ⚠️ Job ${job.jobId} currently RUNNING on another worker (lock age: ${Math.round(lockAgeMs / 1000)}s). Aborting duplicate run.`);
        return {
          success: true,
          skipped: true,
          reason: 'already_running',
          jobId: job.jobId,
          dateKey
        };
      }
      console.warn(`[DAILY-CATHOLIC] ⚠️ Stale lock detected for ${job.jobId} (age: ${Math.round(lockAgeMs / 1000)}s). Re-acquiring lock...`);
    }

    if (!job) {
      try {
        job = await DailyNotificationJob.create({
          jobId,
          notificationDate: dateKey,
          scheduledAt: new Date(),
          startedAt: new Date(),
          status: 'running',
          triggerType,
          lockedBy: workerId,
          lockedAt: new Date(),
          summary: {
            bibleRef: dailyContent.bible.ref,
            saintName: dailyContent.saint.nameEnglish,
            massTitle: dailyContent.massReadings?.tamil?.title || dailyContent.massReadings?.english?.title || 'Daily Mass Readings',
            saintImageUrl: dailyContent?.saintImage || dailyContent?.saint?.image || null
          },
          logs: [
            { timestamp: new Date(), message: `Job ${jobId} initiated at 04:00 AM IST via ${triggerType} (Worker: ${workerId})` }
          ]
        });
      } catch (createErr) {
        if (createErr.code === 11000) {
          // Concurrency race: another worker created the job milliseconds ago
          job = await DailyNotificationJob.findOne({ notificationDate: dateKey });
          if (job.status === 'completed' || (job.status === 'running' && !force)) {
            console.log(`[DAILY-CATHOLIC] Concurrent job creation detected. Already handled by another instance.`);
            return { success: true, skipped: true, reason: 'concurrency_race_resolved', jobId, dateKey };
          }
        } else {
          throw createErr;
        }
      }
    } else {
      job.status = 'running';
      job.startedAt = job.startedAt || new Date();
      job.lockedBy = workerId;
      job.lockedAt = new Date();
      job.logs.push({ timestamp: new Date(), message: `Job resumed / re-locked by ${workerId}` });
      await job.save();
    }

    console.log(`\n================================================================`);
    console.log(`[DAILY-CATHOLIC] 🚀 04:00 AM IST Daily Catholic Job Started: ${jobId}`);
    console.log(`[DAILY-CATHOLIC] Date: ${dateKey} | Timezone: Asia/Kolkata`);
    console.log(`================================================================\n`);

    // B. Pre-broadcast sync: ensure readings, translation, saint, verse are loaded
    try {
      const { fetchAndStoreTamilReading, getOrGenerateEnglishTranslation } = require('./dailyMassReadingService');
      const { fetchDailySaint } = require('./saintService');
      const { syncDailyVerse } = require('./bibleVerseService');
      await Promise.allSettled([
        fetchAndStoreTamilReading(dateKey),
        getOrGenerateEnglishTranslation(dateKey),
        fetchDailySaint(today),
        syncDailyVerse()
      ]);
      job.logs.push({ timestamp: new Date(), message: "Daily liturgical content and translations synchronized" });
    } catch (syncErr) {
      console.warn('[Daily Notification Service] Pre-broadcast sync notice:', syncErr.message);
    }

    // C. Load eligible website users and WhatsApp bot sessions
    const users = await User.find({ isActive: { $ne: false } }).lean();
    const botSessions = await BotSession.find({ step: 'done' }).lean();

    job.logs.push({
      timestamp: new Date(),
      message: `Eligible recipients loaded: ${users.length} registered users, ${botSessions.length} bot sessions`
    });

    const waService = getWhatsApp();
    if (waService && typeof waService.waitForWhatsAppReady === 'function') {
      try {
        console.log('[Daily Notification] Verifying WhatsApp socket readiness before dispatch...');
        const waReady = await waService.waitForWhatsAppReady(25000);
        job.logs.push({
          timestamp: new Date(),
          message: waReady
            ? 'WhatsApp Baileys socket verified connected & ready for broadcast'
            : 'WhatsApp socket offline or awaiting QR scan; proceeding with available channels'
        });
      } catch (waCheckErr) {
        console.warn('[Daily Notification] WhatsApp readiness check warning:', waCheckErr.message);
      }
    }

    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    const channelStats = {
      email: { sent: 0, failed: 0, disabled: 0, skipped: 0 },
      inApp: { sent: 0, failed: 0, disabled: 0, skipped: 0 },
      push: { sent: 0, failed: 0, disabled: 0, skipped: 0 },
      whatsapp: { sent: 0, failed: 0, disabled: 0, skipped: 0 }
    };

    // D. Process Registered Website Users
    for (const user of users) {
      const userSettings = user.settings?.notifications || {};
      const userLang = resolveUserLanguage(user);
      const userName = user.name || 'Parishioner';
      const userEmail = (user.email || '').trim().toLowerCase();
      const rawPhone = (user.phone || '').trim();
      const userPhone = rawPhone.replace(/\D/g, '');

      const isEmailEnabled = userSettings.email !== false && Boolean(userEmail && userEmail.includes('@'));
      const isInAppEnabled = userSettings.inApp !== false;
      const isPushEnabled = userSettings.push !== false;
      const isWhatsAppEnabled = userSettings.whatsapp !== false && Boolean(userPhone) && user.whatsappOptIn !== false;

      let userHadAtLeastOneSuccess = false;
      let userHadAnyAttempt = false;

      const logChannels = {
        email: { status: isEmailEnabled ? 'pending' : 'disabled' },
        inApp: { status: isInAppEnabled ? 'pending' : 'disabled' },
        push: { status: isPushEnabled ? 'pending' : 'disabled' },
        whatsapp: { status: isWhatsAppEnabled ? 'pending' : 'disabled' }
      };

      // 1. EMAIL CHANNEL with Retry & Idempotency
      if (isEmailEnabled) {
        userHadAnyAttempt = true;
        // Check existing delivery record
        const existingEmailDelivery = await NotificationDelivery.findOne({
          notificationDate: dateKey,
          recipient: userEmail,
          channel: 'email'
        });

        if (existingEmailDelivery && existingEmailDelivery.status === 'sent' && !force) {
          channelStats.email.skipped++;
          userHadAtLeastOneSuccess = true;
          logChannels.email = {
            status: 'sent',
            messageId: existingEmailDelivery.providerMessageId,
            sentAt: existingEmailDelivery.sentAt
          };
        } else {
          // Attempt email send with retry
          const emailHtml = generateDailyNotificationHtml({
            userName,
            dailyContent,
            userLanguage: userLang,
            hasSaintImageAttachment: hasSaintImage
          });

          const emailSubject = userLang === 'en'
            ? `✝️ Good Morning — Daily Catholic Readings & Living Word — ${dailyContent.formattedDate}`
            : `✝️ காலை வணக்கம் — இன்றைய கத்தோலிக்க திருப்பலி வாசகங்கள் — ${dailyContent.formattedDateTa || dailyContent.formattedDate}`;

          const emailSendResult = await retryOperation(async () => {
            const res = await sendMail({
              to: userEmail,
              subject: emailSubject,
              html: emailHtml,
              attachments: emailAttachments
            });
            if (!res || !res.success) throw new Error(res?.error || 'SMTP delivery error');
            return res;
          }, 3, 1500);

          if (emailSendResult.success) {
            channelStats.email.sent++;
            userHadAtLeastOneSuccess = true;
            logChannels.email = {
              status: 'sent',
              messageId: emailSendResult.result.messageId,
              sentAt: new Date()
            };

            await NotificationDelivery.findOneAndUpdate(
              { notificationDate: dateKey, recipient: userEmail, channel: 'email' },
              {
                jobId,
                userId: user._id,
                recipient: userEmail,
                channel: 'email',
                notificationDate: dateKey,
                language: userLang,
                status: 'sent',
                attemptCount: emailSendResult.attempts,
                attemptedAt: new Date(),
                sentAt: new Date(),
                providerMessageId: emailSendResult.result.messageId,
                error: null
              },
              { upsert: true, new: true }
            );
          } else {
            channelStats.email.failed++;
            logChannels.email = {
              status: 'failed',
              error: emailSendResult.error,
              sentAt: new Date()
            };

            await NotificationDelivery.findOneAndUpdate(
              { notificationDate: dateKey, recipient: userEmail, channel: 'email' },
              {
                jobId,
                userId: user._id,
                recipient: userEmail,
                channel: 'email',
                notificationDate: dateKey,
                language: userLang,
                status: 'failed',
                attemptCount: emailSendResult.attempts,
                attemptedAt: new Date(),
                error: emailSendResult.error
              },
              { upsert: true, new: true }
            );
          }
        }
      } else {
        channelStats.email.disabled++;
      }

      // 2. WHATSAPP CHANNEL with Retry & Idempotency
      if (isWhatsAppEnabled) {
        userHadAnyAttempt = true;
        const existingWADelivery = await NotificationDelivery.findOne({
          notificationDate: dateKey,
          recipient: userPhone,
          channel: 'whatsapp'
        });

        if (existingWADelivery && existingWADelivery.status === 'sent' && !force) {
          channelStats.whatsapp.skipped++;
          userHadAtLeastOneSuccess = true;
          logChannels.whatsapp = {
            status: 'sent',
            phone: userPhone,
            sentAt: existingWADelivery.sentAt
          };
        } else {
          if (waService && typeof waService.sendWhatsAppMessage === 'function') {
            const userReadingPref = user.readingPreference || 'full';
            const userSendLinks = user.sendLinks !== false;

            const waResult = await retryOperation(async () => {
              // 1. Devotional text message
              const waMsg = generateDailyCatholicMessage({
                dailyContent,
                language: userLang,
                readingPreference: userReadingPref
              });
              const sentOk = await waService.sendWhatsAppMessage(userPhone, waMsg);
              if (!sentOk) throw new Error('WhatsApp message delivery unacknowledged');

              // 2. Saint photo media message (Image only)
              try {
                const saintImageUrl = dailyContent?.saintImage || dailyContent?.saint?.image || dailyContent?.saintOfTheDay?.english?.imageUrl;
                if (saintImageUrl && typeof waService.sendWhatsAppMedia === 'function') {
                  await new Promise(r => setTimeout(r, 450));
                  await waService.sendWhatsAppMedia(userPhone, { url: saintImageUrl, mimetype: 'image/jpeg' });
                }
              } catch (mediaErr) {
                console.warn(`[Daily Notification] Saint photo warning for ${userPhone}:`, mediaErr.message);
              }

              // 3. Saint details message
              try {
                await new Promise(r => setTimeout(r, 450));
                const saintInfoMsg = generateSaintInfoMessage({ dailyContent, language: userLang });
                await waService.sendWhatsAppMessage(userPhone, saintInfoMsg);
              } catch (infoErr) {
                console.warn(`[Daily Notification] Saint info warning for ${userPhone}:`, infoErr.message);
              }

              // 4. Clickable links message (if preferred)
              if (userSendLinks) {
                try {
                  await new Promise(r => setTimeout(r, 450));
                  const linksMsg = generateDailyLinksMessage({ dailyContent, language: userLang });
                  if (linksMsg) {
                    await waService.sendWhatsAppMessage(userPhone, linksMsg);
                  }
                } catch (linkErr) {
                  console.warn(`[Daily Notification] Links warning for ${userPhone}:`, linkErr.message);
                }
              }

              return { delivered: true };
            }, 3, 2000);

            if (waResult.success) {
              channelStats.whatsapp.sent++;
              userHadAtLeastOneSuccess = true;
              logChannels.whatsapp = {
                status: 'sent',
                phone: userPhone,
                sentAt: new Date()
              };

              await NotificationDelivery.findOneAndUpdate(
                { notificationDate: dateKey, recipient: userPhone, channel: 'whatsapp' },
                {
                  jobId,
                  userId: user._id,
                  recipient: userPhone,
                  channel: 'whatsapp',
                  notificationDate: dateKey,
                  language: userLang,
                  status: 'sent',
                  attemptCount: waResult.attempts,
                  attemptedAt: new Date(),
                  sentAt: new Date(),
                  error: null
                },
                { upsert: true, new: true }
              );
            } else {
              channelStats.whatsapp.failed++;
              logChannels.whatsapp = {
                status: 'failed',
                phone: userPhone,
                error: waResult.error,
                sentAt: new Date()
              };

              await NotificationDelivery.findOneAndUpdate(
                { notificationDate: dateKey, recipient: userPhone, channel: 'whatsapp' },
                {
                  jobId,
                  userId: user._id,
                  recipient: userPhone,
                  channel: 'whatsapp',
                  notificationDate: dateKey,
                  language: userLang,
                  status: 'failed',
                  attemptCount: waResult.attempts,
                  attemptedAt: new Date(),
                  error: waResult.error
                },
                { upsert: true, new: true }
              );
            }
          } else {
            channelStats.whatsapp.failed++;
            logChannels.whatsapp = {
              status: 'failed',
              phone: userPhone,
              error: 'WhatsApp Baileys socket offline',
              sentAt: new Date()
            };
          }
        }
      } else {
        channelStats.whatsapp.disabled++;
      }

      // 3. IN-APP & PUSH CHANNELS
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
              logChannels.inApp = { status: 'sent', notificationId: notif._id, sentAt: new Date() };
              channelStats.inApp.sent++;
            }
            if (isPushEnabled) {
              logChannels.push = { status: 'sent', sentAt: new Date() };
              channelStats.push.sent++;
            }
            userHadAtLeastOneSuccess = true;
          }
        } catch (notifErr) {
          if (isInAppEnabled) channelStats.inApp.failed++;
          if (isPushEnabled) channelStats.push.failed++;
        }
      } else {
        channelStats.inApp.disabled++;
        channelStats.push.disabled++;
      }

      // Overall recipient status calculation
      const overallStatus = userHadAtLeastOneSuccess
        ? 'sent'
        : (userHadAnyAttempt ? 'failed' : 'skipped');

      if (overallStatus === 'sent') sentCount++;
      else if (overallStatus === 'failed') failedCount++;
      else skippedCount++;

      // Synchronize with DailyNotificationLog for backward compatibility
      await DailyNotificationLog.findOneAndUpdate(
        { userId: user._id, dateKey },
        {
          userId: user._id,
          userEmail: userEmail || 'no-email@sjdb.church',
          userName,
          userPhone: userPhone || null,
          dateKey,
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

      // Polite throttle between users to prevent rate limiting
      await new Promise(r => setTimeout(r, 100));
    }

    // E. Broadcast Global Web / Mobile Push
    try {
      const pushPayload = formatPushPayload(dailyContent, 'ta');
      const pushRes = await sendPushBroadcast(pushPayload);
      if (pushRes?.sentCount) {
        job.logs.push({ timestamp: new Date(), message: `Web Push broadcast delivered to ${pushRes.sentCount} devices` });
      }
    } catch (pushErr) {
      console.warn('[Daily Notification Service] Push broadcast notice:', pushErr.message);
    }

    // F. Process WhatsApp Bot Sessions (Members who interacted via WhatsApp bot only)
    if (waService && typeof waService.sendWhatsAppMessage === 'function') {
      const processedPhones = new Set(
        users.map(u => (u.phone || '').replace(/\D/g, '')).filter(Boolean)
      );

      for (const session of botSessions) {
        const rawSessPhone = (session.phoneNumber || '').trim();
        const cleanSessPhone = rawSessPhone.replace(/\D/g, '');
        if (!cleanSessPhone || processedPhones.has(cleanSessPhone)) continue;

        processedPhones.add(cleanSessPhone);
        const sessionLang = resolveUserLanguage(session);
        const sessionReadingPref = session.readingPreference || 'full';
        const sessionSendLinks = session.sendLinks !== false;

        // Idempotency check for bot session
        const existingSessionDelivery = await NotificationDelivery.findOne({
          notificationDate: dateKey,
          recipient: cleanSessPhone,
          channel: 'whatsapp'
        });

        if (existingSessionDelivery && existingSessionDelivery.status === 'sent' && !force) {
          channelStats.whatsapp.skipped++;
          continue;
        }

        const sessResult = await retryOperation(async () => {
          const waMsg = generateDailyCatholicMessage({
            dailyContent,
            language: sessionLang,
            readingPreference: sessionReadingPref
          });
          const sentOk = await waService.sendWhatsAppMessage(cleanSessPhone, waMsg);
          if (!sentOk) throw new Error('Bot session WhatsApp unacknowledged');

          // Saint photo
          try {
            const saintImageUrl = dailyContent?.saintImage || dailyContent?.saint?.image || dailyContent?.saintOfTheDay?.english?.imageUrl;
            if (saintImageUrl && typeof waService.sendWhatsAppMedia === 'function') {
              await new Promise(r => setTimeout(r, 450));
              await waService.sendWhatsAppMedia(cleanSessPhone, { url: saintImageUrl, mimetype: 'image/jpeg' });
            }
          } catch (e) { }

          // Saint details
          try {
            await new Promise(r => setTimeout(r, 450));
            const saintInfoMsg = generateSaintInfoMessage({ dailyContent, language: sessionLang });
            await waService.sendWhatsAppMessage(cleanSessPhone, saintInfoMsg);
          } catch (e) { }

          // Links
          if (sessionSendLinks) {
            try {
              await new Promise(r => setTimeout(r, 450));
              const linksMsg = generateDailyLinksMessage({ dailyContent, language: sessionLang });
              if (linksMsg) await waService.sendWhatsAppMessage(cleanSessPhone, linksMsg);
            } catch (e) { }
          }

          return { delivered: true };
        }, 3, 2000);

        if (sessResult.success) {
          channelStats.whatsapp.sent++;
          await NotificationDelivery.findOneAndUpdate(
            { notificationDate: dateKey, recipient: cleanSessPhone, channel: 'whatsapp' },
            {
              jobId,
              recipient: cleanSessPhone,
              channel: 'whatsapp',
              notificationDate: dateKey,
              language: sessionLang,
              status: 'sent',
              attemptCount: sessResult.attempts,
              attemptedAt: new Date(),
              sentAt: new Date(),
              error: null
            },
            { upsert: true, new: true }
          );
        } else {
          channelStats.whatsapp.failed++;
          await NotificationDelivery.findOneAndUpdate(
            { notificationDate: dateKey, recipient: cleanSessPhone, channel: 'whatsapp' },
            {
              jobId,
              recipient: cleanSessPhone,
              channel: 'whatsapp',
              notificationDate: dateKey,
              language: sessionLang,
              status: 'failed',
              attemptCount: sessResult.attempts,
              attemptedAt: new Date(),
              error: sessResult.error
            },
            { upsert: true, new: true }
          );
        }

        await new Promise(r => setTimeout(r, 100));
      }
    }

    // G. Finalize DailyNotificationJob
    const finalStatus = failedCount > 0
      ? (sentCount > 0 ? 'partial' : 'failed')
      : 'completed';

    job.status = finalStatus;
    job.completedAt = new Date();
    job.totalRecipients = users.length + botSessions.length;
    job.whatsappTotal = channelStats.whatsapp.sent + channelStats.whatsapp.failed;
    job.whatsappSent = channelStats.whatsapp.sent;
    job.whatsappFailed = channelStats.whatsapp.failed;
    job.emailTotal = channelStats.email.sent + channelStats.email.failed;
    job.emailSent = channelStats.email.sent;
    job.emailFailed = channelStats.email.failed;
    job.inAppTotal = channelStats.inApp.sent + channelStats.inApp.failed;
    job.inAppSent = channelStats.inApp.sent;
    job.pushTotal = channelStats.push.sent + channelStats.push.failed;
    job.pushSent = channelStats.push.sent;

    job.logs.push({
      timestamp: new Date(),
      message: `Job finished: WhatsApp (${job.whatsappSent} sent, ${job.whatsappFailed} failed), Email (${job.emailSent} sent, ${job.emailFailed} failed). Status: ${finalStatus.toUpperCase()}`
    });

    await job.save();

    lastRunTime = new Date();
    lastRunDateKey = dateKey;
    lastRunResult = {
      jobId,
      dateKey,
      sentCount,
      failedCount,
      skippedCount,
      status: finalStatus,
      channelStats
    };

    console.log(`\n================================================================`);
    console.log(`[DAILY-CATHOLIC] ✅ 04:00 AM IST Daily Catholic Job Completed: ${jobId}`);
    console.log(`[DAILY-CATHOLIC] Status: ${finalStatus.toUpperCase()} | WhatsApp: ${channelStats.whatsapp.sent} sent | Email: ${channelStats.email.sent} sent`);
    console.log(`================================================================\n`);

    return {
      success: true,
      jobId,
      dateKey,
      status: finalStatus,
      sentCount,
      failedCount,
      skippedCount,
      channelStats
    };
  } catch (err) {
    console.error('[DAILY-CATHOLIC] ❌ Fatal broadcast error:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

// ─── Scheduler State & Tracking ─────────────────────────────────────────────

let lastRunTime = null;
let lastRunDateKey = null;
let lastRunResult = null;
const schedulerRegisteredAt = new Date();

function computeNext4AmIST() {
  const now = new Date();
  // Get current date in Asia/Kolkata
  const kolkataDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);

  const [y, m, d] = kolkataDate.split('-').map(Number);
  // 04:00 IST = 22:30 UTC of previous calendar day (4 - 5.5 = -1.5h = previous day 22:30 UTC)
  const candidate = new Date(Date.UTC(y, m - 1, d - 1, 22, 30, 0));
  if (candidate <= now) {
    // If today's 04:00 AM IST has already passed, next run is tomorrow at 04:00 AM IST
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}

let nextRunIST = computeNext4AmIST();

// ─── 04:00 AM IST Daily Automated Scheduled Job ──────────────────────────────

const scheduledJob = cron.schedule('0 4 * * *', async () => {
  const istDateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  console.log(`\n[DAILY-CATHOLIC] ⏰ Cron fired at 04:00 AM IST — Starting daily job for ${istDateKey}...`);
  nextRunIST = computeNext4AmIST();
  await sendDailyChurchNotifications({ triggerType: 'cron_scheduler' });
}, {
  timezone: 'Asia/Kolkata',
  scheduled: true
});

console.log('✅ [DAILY-CATHOLIC] Server-side Scheduler initialized');
console.log(`[DAILY-CATHOLIC] Timezone: Asia/Kolkata`);
console.log(`[DAILY-CATHOLIC] Schedule: 0 4 * * * (Every day at 04:00 AM IST)`);
console.log(`[DAILY-CATHOLIC] Next run: ${nextRunIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);

/**
 * Get live scheduler status for health monitoring and admin dashboard
 */
function getSchedulerStatus() {
  return {
    schedulerRegistered: true,
    registeredAt: schedulerRegisteredAt.toISOString(),
    timezone: 'Asia/Kolkata',
    cronExpression: '0 4 * * *',
    scheduleTime: '04:00 AM IST',
    lastRunTime: lastRunTime?.toISOString() || null,
    lastRunDateKey: lastRunDateKey || null,
    lastRunResult: lastRunResult || null,
    nextRunIST: nextRunIST
      ? nextRunIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      : null,
    nextRunUTC: nextRunIST?.toISOString() || null,
    autonomousRecovery: {
      enabled: true,
      window: '04:05 AM – 08:00 PM IST',
      watchdogCron: '0 5,6,7,8,9,10,11,12 * * * (Asia/Kolkata)',
      bootAvailabilityCheck: 'Active (25s post-boot)'
    }
  };
}

/**
 * Get daily notification status and monitoring metrics for admin
 */
async function getDailyNotificationStatus() {
  try {
    const today = new Date();
    const dailyContent = await getTodayDailyContent(today);
    const dateKey = dailyContent.dateKey;

    const totalUsers = await User.countDocuments({ isActive: { $ne: false } });
    const botSessions = await BotSession.countDocuments({ step: 'done' });
    const totalEligible = totalUsers + botSessions;

    // Fetch today's DailyNotificationJob
    const job = await DailyNotificationJob.findOne({ notificationDate: dateKey }).lean();

    // Delivery stats from NotificationDelivery
    const emailSent = await NotificationDelivery.countDocuments({ notificationDate: dateKey, channel: 'email', status: 'sent' });
    const emailFailed = await NotificationDelivery.countDocuments({ notificationDate: dateKey, channel: 'email', status: 'failed' });
    const waSent = await NotificationDelivery.countDocuments({ notificationDate: dateKey, channel: 'whatsapp', status: 'sent' });
    const waFailed = await NotificationDelivery.countDocuments({ notificationDate: dateKey, channel: 'whatsapp', status: 'failed' });
    const inAppSent = await DailyNotificationLog.countDocuments({ dateKey, 'channels.inApp.status': 'sent' });
    const pushSent = await DailyNotificationLog.countDocuments({ dateKey, 'channels.push.status': 'sent' });

    const recentDeliveries = await NotificationDelivery.find({ notificationDate: dateKey })
      .sort({ updatedAt: -1 })
      .limit(30)
      .lean();

    const recentLogs = await DailyNotificationLog.find({ dateKey })
      .sort({ sentAt: -1 })
      .limit(30)
      .lean();

    return {
      success: true,
      dateKey,
      formattedDate: dailyContent.formattedDate,
      job: job ? {
        jobId: job.jobId,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        triggerType: job.triggerType,
        totalRecipients: job.totalRecipients,
        whatsappSent: job.whatsappSent,
        whatsappFailed: job.whatsappFailed,
        emailSent: job.emailSent,
        emailFailed: job.emailFailed,
        logs: job.logs || []
      } : {
        status: 'pending',
        message: 'Job has not run yet today'
      },
      status: job ? (job.status === 'completed' ? 'Completed' : job.status.toUpperCase()) : 'Pending',
      totalUsers: totalEligible,
      sentCount: waSent + emailSent,
      failedCount: waFailed + emailFailed,
      channels: {
        email: emailSent,
        emailFailed,
        inApp: inAppSent,
        push: pushSent,
        whatsapp: waSent,
        whatsappFailed: waFailed
      },
      scheduler: getSchedulerStatus(),
      recentDeliveries,
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
 * Autonomous Missed Job Recovery Detector
 * 
 * Automatically detects if today's 04:00 AM IST daily Catholic job was missed
 * due to temporary infrastructure downtime, network outage, or cloud host reboot.
 * 
 * Guarantees:
 *  - Runs automatically on the backend/cloud (zero administrator action).
 *  - Does NOT depend on anyone opening the website or admin dashboard.
 *  - Only triggers between 04:05 AM IST and 20:00 (8:00 PM) IST.
 *  - If today's job is already 'completed', exits in milliseconds with ZERO side effects.
 *  - Skips any already-delivered recipients via NotificationDelivery unique indexes.
 */
async function checkAndRecoverMissedJobAutonomous(context = 'periodic_watchdog', forcedNow = null) {
  try {
    const now = forcedNow || new Date();

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(now);
    const dateParts = {};
    for (const p of parts) {
      dateParts[p.type] = p.value;
    }

    const todayDateKey = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
    const istHour = parseInt(dateParts.hour, 10);
    const istMinute = parseInt(dateParts.minute, 10);

    // If before 04:05 AM IST, wait for the scheduled 04:00 AM cron
    if (istHour < 4 || (istHour === 4 && istMinute < 5)) {
      return { checked: true, action: 'before_scheduled_time', dateKey: todayDateKey };
    }

    // If after 20:00 (8:00 PM) IST, outside daily morning/day devotional delivery window
    if (istHour >= 20) {
      return { checked: true, action: 'past_devotional_window', dateKey: todayDateKey };
    }

    const existingJob = await DailyNotificationJob.findOne({ notificationDate: todayDateKey });

    // Case 1: Already completed today — zero action needed
    if (existingJob && existingJob.status === 'completed') {
      return { checked: true, action: 'already_completed', jobId: existingJob.jobId, dateKey: todayDateKey };
    }

    // Case 2: Currently running on another active worker (lock age < 20 min)
    if (existingJob && existingJob.status === 'running') {
      const lockAgeMs = Date.now() - new Date(existingJob.lockedAt || existingJob.startedAt).getTime();
      if (lockAgeMs < 20 * 60 * 1000) {
        return { checked: true, action: 'currently_running', jobId: existingJob.jobId, dateKey: todayDateKey };
      }
      console.warn(`[DAILY-CATHOLIC] ⚠️ Autonomous Recovery: Stale running job detected for ${todayDateKey} (age: ${Math.round(lockAgeMs / 1000)}s). Resuming...`);
    }

    const triggerType = !existingJob
      ? 'downtime_recovery'
      : (existingJob.status === 'running' ? 'crash_recovery' : 'failure_recovery');

    console.log(`\n================================================================`);
    console.log(`[DAILY-CATHOLIC] 🚨 AUTONOMOUS DOWNTIME RECOVERY DETECTED`);
    console.log(`[DAILY-CATHOLIC] Context: ${context} | Current IST: ${istHour}:${String(istMinute).padStart(2, '0')}`);
    console.log(`[DAILY-CATHOLIC] 04:00 AM IST job was missed or incomplete (${existingJob?.status || 'NOT_STARTED'}).`);
    console.log(`[DAILY-CATHOLIC] Executing autonomous catch-up for ${todayDateKey}...`);
    console.log(`================================================================\n`);

    const result = await sendDailyChurchNotifications({
      triggerType,
      force: false
    });

    return {
      checked: true,
      action: 'recovered',
      triggerType,
      dateKey: todayDateKey,
      result
    };
  } catch (err) {
    console.error('[DAILY-CATHOLIC] Autonomous recovery detector error:', err.message);
    return { checked: false, error: err.message };
  }
}

// ─── Autonomous Missed-Job Morning Watchdog (05:00 AM – 12:00 PM IST) ────────
// Runs once every hour during the morning window to catch any downtime misses
const watchdogJob = cron.schedule('0 5,6,7,8,9,10,11,12 * * *', async () => {
  console.log('[DAILY-CATHOLIC] 🔍 Running autonomous morning missed-job watchdog check...');
  await checkAndRecoverMissedJobAutonomous('hourly_watchdog');
}, {
  timezone: 'Asia/Kolkata',
  scheduled: true
});

// ─── Server Boot Availability Catch-up ───────────────────────────────────────
// When the server boots up after maintenance, deployment, or crash recovery,
// checks if today's 04:00 AM job was missed.
// A 25-second delay allows MongoDB connection and Baileys socket to initialize first.
setTimeout(() => {
  checkAndRecoverMissedJobAutonomous('server_boot_availability').catch(err =>
    console.error('[DAILY-CATHOLIC] Startup availability check error:', err.message)
  );
}, 25 * 1000);

/**
 * Admin manual recovery wrapper (backward compatibility)
 */
async function recoverMissedRun() {
  return checkAndRecoverMissedJobAutonomous('manual_admin_recovery');
}

module.exports = {
  sendDailyChurchNotifications,
  getDailyNotificationStatus,
  getUserNotificationHistory,
  getSchedulerStatus,
  recoverMissedRun,
  checkAndRecoverMissedJobAutonomous
};
