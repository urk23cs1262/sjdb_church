const cron = require('node-cron');
const User = require('../models/User');
const BotSession = require('../models/BotSession');
const Notification = require('../models/Notification');
const DailyNotificationLog = require('../models/DailyNotificationLog');
const { sendMail } = require('../config/mailer');
const { getTodayDailyContent } = require('./dailyContentService');
const { generateDailyNotificationHtml } = require('../templates/dailyNotificationEmail');
const { sendPushBroadcast, sendPushToUser } = require('./webPushService');
const {
  generateDailyVerseCaption,
  generateDailyVerseMessage,
  generateDailyMassReadingsMessage,
  generateDailyReflectionMessage,
  getDailySaintImagePayload,
  generateSaintContentMessage,
  generateReadMoreMessage,
  generateDailyCatholicMessage,
  generateDailyLinksMessage,
  generateSaintInfoMessage
} = require('./whatsappDailyFormatter');
const { getDailyVerseImage } = require('./bibleVerseImageService');
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
 * Contains bilingual Bible verse (English & Tamil) under heading, followed by liturgy highlights
 */
function formatInAppMessage(dailyContent, userLang = 'ta') {
  const lang = userLang || 'ta';
  const isEn = lang === 'en';
  const massTitle = isEn ? dailyContent.massReadings?.english?.title : dailyContent.massReadings?.tamil?.title;
  const reflectionSnippet = isEn ? dailyContent.reflection?.english : dailyContent.reflection?.tamil;
  const saintName = isEn ? dailyContent.saint?.nameEnglish : (dailyContent.saint?.nameTamil || dailyContent.saint?.nameEnglish);

  const verseEn = (dailyContent?.bible?.english || dailyContent?.verse?.english || '').trim();
  const verseTa = (dailyContent?.bible?.tamil || dailyContent?.verse?.tamil || '').trim();
  const rawRef = (dailyContent?.bible?.ref || dailyContent?.verse?.reference || '').trim();

  const { getTamilBibleReference, getEnglishBibleReference } = require('../utils/bibleRefHelper');
  const refEn = getEnglishBibleReference(rawRef);
  const refTa = getTamilBibleReference(rawRef);

  let verseSection = `📖 இன்றைய இறைவார்த்தை / DAILY BIBLE VERSE\n\n`;
  if (verseEn) {
    verseSection += `"${verseEn}"\n— ${refEn}\n\n`;
  }
  if (verseTa) {
    verseSection += `"${verseTa}"\n— ${refTa}`;
  }

  return `${verseSection}

${isEn ? 'Mass Readings' : 'திருப்பலி வாசகங்கள்'}: ${massTitle || 'Daily Liturgy'}
${isEn ? 'Saint of the Day' : 'இன்றைய புனிதர்'}: ${saintName || 'Holy Saint'}
${isEn ? 'Reflection' : 'தியானம்'}: ${(reflectionSnippet || '').slice(0, 150)}...`;
}

/**
 * Format push notification payload for browser and mobile PWA push
 */
function formatPushPayload(dailyContent, lang = 'ta') {
  const isEn = lang === 'en';
  const verseEn = (dailyContent?.bible?.english || dailyContent?.verse?.english || '').trim();
  const verseTa = (dailyContent?.bible?.tamil || dailyContent?.verse?.tamil || '').trim();
  const rawRef = (dailyContent?.bible?.ref || dailyContent?.verse?.reference || '').trim();

  const { getTamilBibleReference, getEnglishBibleReference } = require('../utils/bibleRefHelper');
  const refEn = getEnglishBibleReference(rawRef);
  const refTa = getTamilBibleReference(rawRef);

  const bibleUrl = getSiteUrl(SITE_ROUTES.BIBLE_VERSE);
  return {
    title: `📖 இன்றைய இறைவார்த்தை / DAILY BIBLE VERSE`,
    body: `"${verseEn.slice(0, 80)}..." — ${refEn}\n"${verseTa.slice(0, 80)}..." — ${refTa}`,
    url: bibleUrl,
    image: `/api/settings/daily-verses/today/image`,
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
 * Strict 6-Stage Sequential Delivery of Daily Catholic Content:
 * 1. 📖 Bible Verse (Image message)
 * 2. ✝️ Daily Mass Readings (Text message)
 * 3. 🕊️ இன்றைய தியானம் (DAILY REFLECTION) (Text message)
 * 4. 🖼️ Saint of the Day Image (Image message)
 * 5. ✨ Saint of the Day Content (Text message)
 * 6. 🌐 Read More (Website link message)
 *
 * Messages are sent sequentially using await with an inter-message delay
 * to ensure WhatsApp renders them in the exact specified order.
 */
async function sendDailyWhatsAppSequence({
  waService,
  phone,
  dailyContent,
  userLang = 'ta',
  readingPreference = 'full',
  sendLinks = true,
  alreadySentStages = []
}) {
  const messagesSent = [...alreadySentStages];
  const stageErrors = [];
  const STAGE_DELAY_MS = 650;

  if (!waService || typeof waService.sendWhatsAppMessage !== 'function') {
    return {
      success: false,
      messagesSent,
      stageErrors: [{ stage: 'init', error: 'WhatsApp service unavailable' }]
    };
  }

  // ── 1. 📖 Bible Verse Image message ───────────────────────────────────────
  if (!messagesSent.includes('verse_image') && !messagesSent.includes('verse')) {
    let verseSent = false;
    try {
      const verseImg = await getDailyVerseImage({ dailyContent, dateKey: dailyContent.dateKey });
      if (verseImg?.buffer && typeof waService.sendWhatsAppMedia === 'function') {
        const verseCaption = generateDailyVerseCaption({ dailyContent });
        verseSent = await waService.sendWhatsAppMedia(phone, {
          buffer: verseImg.buffer,
          mimetype: 'image/png',
          caption: verseCaption
        });
        if (verseSent) {
          messagesSent.push('verse_image');
          console.log(`[DELIVERY 1/6] 📖 Bible Verse Image with bilingual text caption sent to ${phone}`);
        }
      }
    } catch (imgErr) {
      console.warn(`[DELIVERY 1/6] Verse image render/send error: ${imgErr.message}. Falling back to formatted text.`);
    }

    // Fallback: If image generation failed, send formatted text so the recipient never misses the verse
    if (!verseSent && !messagesSent.includes('verse_image')) {
      try {
        const verseMsg = generateDailyVerseMessage({ dailyContent, language: userLang });
        const ok = await waService.sendWhatsAppMessage(phone, verseMsg);
        if (ok) {
          messagesSent.push('verse');
          console.log(`[DELIVERY 1/6 fallback] 📖 Bible Verse text sent to ${phone}`);
        } else {
          stageErrors.push({ stage: 'verse_image', error: 'Socket send returned false' });
          console.error(`❌ [DELIVERY FAILED 1/6] Bible Verse failed for ${phone}`);
        }
      } catch (err) {
        stageErrors.push({ stage: 'verse_image', error: err.message });
        console.error(`❌ [DELIVERY FAILED 1/6] Bible Verse text error for ${phone}:`, err.message);
      }
    }
  }

  await new Promise(r => setTimeout(r, STAGE_DELAY_MS));

  // ── 2. ✝️ Daily Mass Readings message ─────────────────────────────────────
  if (!messagesSent.includes('readings')) {
    try {
      const readingsMsg = generateDailyMassReadingsMessage({
        dailyContent,
        language: userLang,
        readingPreference
      });
      const ok = await waService.sendWhatsAppMessage(phone, readingsMsg);
      if (ok) {
        messagesSent.push('readings');
        console.log(`[DELIVERY 2/6] ✝️ Mass Readings sent to ${phone}`);
      } else {
        stageErrors.push({ stage: 'readings', error: 'Socket send returned false' });
        console.error(`❌ [DELIVERY FAILED 2/6] Mass Readings failed for ${phone}`);
      }
    } catch (err) {
      stageErrors.push({ stage: 'readings', error: err.message });
      console.error(`❌ [DELIVERY FAILED 2/6] Mass Readings error for ${phone}:`, err.message);
    }
  }

  await new Promise(r => setTimeout(r, STAGE_DELAY_MS));

  // ── 3. 🕊️ இன்றைய தியானம் (DAILY REFLECTION) message ────────────────────────
  if (!messagesSent.includes('reflection')) {
    try {
      const reflectionMsg = generateDailyReflectionMessage({
        dailyContent,
        language: userLang
      });
      const ok = await waService.sendWhatsAppMessage(phone, reflectionMsg);
      if (ok) {
        messagesSent.push('reflection');
        console.log(`[DELIVERY 3/6] 🕊️ Daily Reflection sent to ${phone}`);
      } else {
        stageErrors.push({ stage: 'reflection', error: 'Socket send returned false' });
        console.error(`❌ [DELIVERY FAILED 3/6] Daily Reflection failed for ${phone}`);
      }
    } catch (err) {
      stageErrors.push({ stage: 'reflection', error: err.message });
      console.error(`❌ [DELIVERY FAILED 3/6] Daily Reflection error for ${phone}:`, err.message);
    }
  }

  await new Promise(r => setTimeout(r, STAGE_DELAY_MS));

  // ── 4. 🖼️ Saint of the Day image message ──────────────────────────────────
  if (!messagesSent.includes('saint_image')) {
    const saintImagePayload = getDailySaintImagePayload({ dailyContent });
    if (saintImagePayload && typeof waService.sendWhatsAppMedia === 'function') {
      try {
        const imgOk = await waService.sendWhatsAppMedia(phone, saintImagePayload);
        if (imgOk) {
          messagesSent.push('saint_image');
          console.log(`[DELIVERY 4/6] 🖼️ Saint image sent to ${phone}`);
        } else {
          console.warn(`⚠️ [DELIVERY 4/6] Saint image send returned false for ${phone}`);
        }
      } catch (mediaErr) {
        console.warn(`⚠️ [DELIVERY 4/6] Saint image error for ${phone}:`, mediaErr.message);
      }
    } else {
      console.log(`[DELIVERY 4/6] Saint image skipped (no image payload available) for ${phone}`);
    }
  }

  await new Promise(r => setTimeout(r, STAGE_DELAY_MS));

  // ── 5. ✨ Saint of the Day Content message ────────────────────────────────
  if (!messagesSent.includes('saint_content')) {
    try {
      const saintContentMsg = generateSaintContentMessage({ dailyContent, language: userLang });
      const ok = await waService.sendWhatsAppMessage(phone, saintContentMsg);
      if (ok) {
        messagesSent.push('saint_content');
        console.log(`[DELIVERY 5/6] ✨ Saint content sent to ${phone}`);
      } else {
        stageErrors.push({ stage: 'saint_content', error: 'Socket send returned false' });
        console.error(`❌ [DELIVERY FAILED 5/6] Saint content failed for ${phone}`);
      }
    } catch (err) {
      stageErrors.push({ stage: 'saint_content', error: err.message });
      console.error(`❌ [DELIVERY FAILED 5/6] Saint content error for ${phone}:`, err.message);
    }
  }

  await new Promise(r => setTimeout(r, STAGE_DELAY_MS));

  // ── 6. 🌐 Read More (Website link) message ────────────────────────────────
  if (sendLinks && !messagesSent.includes('read_more')) {
    try {
      const readMoreMsg = generateReadMoreMessage({ dailyContent, language: userLang });
      const ok = await waService.sendWhatsAppMessage(phone, readMoreMsg);
      if (ok) {
        messagesSent.push('read_more');
        console.log(`[DELIVERY 6/6] 🌐 Read More link sent to ${phone}`);
      } else {
        stageErrors.push({ stage: 'read_more', error: 'Socket send returned false' });
        console.warn(`⚠️ [DELIVERY 6/6] Read More link failed for ${phone}`);
      }
    } catch (err) {
      stageErrors.push({ stage: 'read_more', error: err.message });
      console.warn(`⚠️ [DELIVERY 6/6] Read More link error for ${phone}:`, err.message);
    }
  } else if (!sendLinks) {
    messagesSent.push('read_more_skipped_by_pref');
  }

  const hasRequiredContent = (messagesSent.includes('verse_image') || messagesSent.includes('verse')) &&
                             messagesSent.includes('readings') &&
                             messagesSent.includes('reflection') &&
                             messagesSent.includes('saint_content');

  return {
    success: hasRequiredContent,
    messagesSent,
    stageErrors
  };
}

/**
 * Dispatch daily church notification across all enabled channels:
 * - WhatsApp Bot (6 Separate Messages in Strict Sequence)
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
    let dailyContent = await getTodayDailyContent(today);

    // ── VERIFY DAILY SAINT SYNCHRONIZATION FOR TODAY (Asia/Kolkata) ─────────
    const { getISTDateParts, fetchDailySaint } = require('./saintService');
    const { dateKey: currentIstDate } = getISTDateParts(today);

    // Verify today's Saint of the Day is synchronized
    if (!dailyContent || !dailyContent.saint || dailyContent.saint.date !== currentIstDate) {
      console.log(`[Daily Notification Service] Saint of the Day not yet synchronized for today (${currentIstDate}). Synchronizing from Vatican News...`);
      try {
        await fetchDailySaint(today);
        dailyContent = await getTodayDailyContent(today);
      } catch (syncErr) {
        console.warn(`[Daily Notification Service] Vatican News sync attempt notice:`, syncErr.message);
      }
    }

    // Safety guard: Verify daily content is complete and for today before sending
    if (!dailyContent || !dailyContent.dateKey || dailyContent.dateKey !== currentIstDate || !dailyContent.saint || !dailyContent.saint.nameEnglish) {
      console.error(`[Daily Notification Service] Content verification failed for ${currentIstDate}. Daily content is incomplete or outdated. Broadcast aborted to protect parishioners.`);
      return { success: false, skipped: true, reason: 'Daily content incomplete or outdated for today' };
    }

    const manualTest = isTest || isManualTest;
    const toEmail = testEmail || targetEmail;
    const toPhone = testPhone || targetPhone;

    // Prepare email attachments (Saint portrait & Bible verse card)
    const emailAttachments = [];
    if (dailyContent.saint.imageAttachment) {
      emailAttachments.push(dailyContent.saint.imageAttachment);
    }
    const hasSaintImage = Boolean(dailyContent.saint.imageAttachment);

    let hasVerseImage = false;
    try {
      const verseImg = await getDailyVerseImage({ dailyContent, dateKey: dailyContent.dateKey });
      if (verseImg?.buffer) {
        emailAttachments.push({
          filename: 'daily_bible_verse.png',
          content: verseImg.buffer,
          cid: 'daily_bible_verse_img'
        });
        hasVerseImage = true;
      }
    } catch (vErr) {
      console.warn('[Daily Notification Service] Email verse image attachment error:', vErr.message);
    }

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
          hasSaintImageAttachment: hasSaintImage,
          hasBibleImageAttachment: hasVerseImage
        });

        const subject = testLang === 'en'
          ? `Good Morning - Your Daily Catholic Reading - ${dailyContent.formattedDate}`
          : `காலை வணக்கம் - இன்றைய கத்தோலிக்க திருப்பலி வாசகங்கள் - ${dailyContent.formattedDateTa || dailyContent.formattedDate}`;

        const emailRes = await sendMail({
          to: toEmail,
          subject,
          html,
          attachments: emailAttachments
        });
        testResults.email = emailRes;
      }

      // WhatsApp Test (Strict 5-message sequence)
      if (targetPhone) {
        const waService = getWhatsApp();
        if (waService && typeof waService.sendWhatsAppMessage === 'function') {
          const waResult = await sendDailyWhatsAppSequence({
            waService,
            phone: targetPhone,
            dailyContent,
            userLang: testLang,
            readingPreference: 'full',
            sendLinks: true
          });
          testResults.whatsapp = waResult;
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

    // ── DISTRIBUTED DATABASE JOB LOCK (Zero Duplicate Sends Across Reboots) ────
    const lockKey = `daily_broadcast_lock_${dailyContent.dateKey}`;
    const SiteSettings = require('../models/SiteSettings');

    if (!force && !manualTest) {
      try {
        const existingLock = await SiteSettings.findOne({ key: lockKey }).lean();
        if (existingLock && existingLock.value) {
          const lockData = JSON.parse(existingLock.value);
          if (lockData.status === 'completed') {
            console.log(`[Daily Notification Service] Broadcast for ${dailyContent.dateKey} is already COMPLETED in database lock. Skipping duplicate broadcast.`);
            return { success: true, skipped: true, reason: 'Already completed for today', dateKey: dailyContent.dateKey };
          }
          if (lockData.status === 'in_progress' && (Date.now() - new Date(lockData.startedAt).getTime()) < 30 * 60 * 1000) {
            console.log(`[Daily Notification Service] Broadcast for ${dailyContent.dateKey} is currently IN_PROGRESS by another worker. Skipping.`);
            return { success: false, skipped: true, reason: 'In progress by another worker' };
          }
        }

        await SiteSettings.findOneAndUpdate(
          { key: lockKey },
          {
            value: JSON.stringify({ status: 'in_progress', startedAt: new Date() }),
            label: `Daily Broadcast Lock for ${dailyContent.dateKey}`,
            type: 'text'
          },
          { upsert: true }
        );
      } catch (lockErr) {
        console.warn('[Daily Notification Service] Lock check notice:', lockErr.message);
      }
    }

    console.log(`[Daily Notification Service] 4:00 AM IST Multi-Channel Daily Broadcast started for ${dailyContent.dateKey}...`);

    // Fetch all currently blocked phone numbers and user IDs to strictly exclude restricted users
    const UserModeration = require('../models/UserModeration');
    const blockedRecords = await UserModeration.find({ status: 'blocked' }).lean();
    const blockedPhone10s = new Set(
      blockedRecords
        .map(r => (r.phoneNumber || '').replace(/\D/g, '').slice(-10))
        .filter(Boolean)
    );
    const blockedUserIds = new Set(
      blockedRecords
        .map(r => r.userId ? r.userId.toString() : null)
        .filter(Boolean)
    );

    // Active website users only (strictly excluding deactivated/restricted accounts)
    const rawUsers = await User.find({ isActive: { $ne: false } }).lean();
    const users = rawUsers.filter(u => {
      if (blockedUserIds.has(u._id.toString())) return false;
      const phone10 = (u.phone || '').replace(/\D/g, '').slice(-10);
      if (phone10 && blockedPhone10s.has(phone10)) return false;
      return true;
    });

    // WhatsApp bot sessions that have not stopped AND are NOT restricted/blocked
    const rawBotSessions = await BotSession.find({ step: { $ne: 'stopped' } }).lean();
    const botSessions = rawBotSessions.filter(session => {
      const phone10 = (session.phoneNumber || '').replace(/\D/g, '').slice(-10);
      if (!phone10) return false;
      if (blockedPhone10s.has(phone10)) {
        console.log(`[Daily Notification Service] Skipping restricted user phone ${phone10} from 4 AM broadcast.`);
        return false;
      }
      return true;
    });

    // ── UNIFIED DEDUPLICATED RECIPIENT PIPELINE (Zero Duplicate Deliveries) ──
    const recipientMap = new Map();

    // 1. Ingest registered website users
    for (const user of users) {
      const phone10 = (user.phone || '').replace(/\D/g, '').slice(-10);
      const userSettings = user.settings?.notifications || {};
      const userLang = resolveUserLanguage(user);
      const userName = user.name || 'Parishioner';
      const userEmail = (user.email || '').trim().toLowerCase();

      const isEmailEnabled = userSettings.email !== false && Boolean(userEmail && userEmail.includes('@'));
      const isInAppEnabled = userSettings.inApp !== false;
      const isPushEnabled = userSettings.push !== false;
      const isWhatsAppEnabled = userSettings.whatsapp !== false && Boolean(user.phone) && user.whatsappOptIn !== false;

      const recipientKey = phone10 || `user_${user._id}`;
      recipientMap.set(recipientKey, {
        recipientKey,
        phone10: phone10 || null,
        userId: user._id,
        userName,
        userEmail: userEmail || null,
        userPhone: user.phone || null,
        userLang,
        readingPreference: user.readingPreference || 'full',
        sendLinks: user.sendLinks !== false,
        isEmailEnabled,
        isInAppEnabled,
        isPushEnabled,
        isWhatsAppEnabled,
        isBotOnly: false
      });
    }

    // 2. Ingest standalone WhatsApp Bot sessions (merging if phone already exists)
    for (const session of botSessions) {
      const phone10 = (session.phoneNumber || '').replace(/\D/g, '').slice(-10);
      if (!phone10) continue;

      if (recipientMap.has(phone10)) {
        // User already in recipient map! Link session and ensure WhatsApp is active
        const existing = recipientMap.get(phone10);
        if (!existing.userId && session.linkedUserId) {
          existing.userId = session.linkedUserId;
        }
        existing.isWhatsAppEnabled = true;
        if (!existing.userPhone) existing.userPhone = session.phoneNumber;
        continue;
      }

      // Standalone bot-only subscriber
      const sessionLang = resolveUserLanguage(session);
      recipientMap.set(phone10, {
        recipientKey: phone10,
        phone10,
        userId: session.linkedUserId || null,
        userName: session.pushName || 'WhatsApp Parishioner',
        userEmail: null,
        userPhone: session.phoneNumber,
        userLang: sessionLang,
        readingPreference: session.readingPreference || 'full',
        sendLinks: session.sendLinks !== false,
        isEmailEnabled: false,
        isInAppEnabled: false,
        isPushEnabled: false,
        isWhatsAppEnabled: true,
        isBotOnly: true
      });
    }

    console.log(`[Daily Notification Service] Unified recipient count: ${recipientMap.size} unique recipients (from ${users.length} users and ${botSessions.length} bot sessions).`);

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

    // ── DISPATCH TO EACH UNIQUE RECIPIENT WITH ATOMIC IDEMPOTENCY LOCK ─────
    for (const recipient of recipientMap.values()) {
      const idempotencyKey = recipient.phone10
        ? `daily-catholic:${dailyContent.dateKey}:${recipient.phone10}`
        : `daily-catholic:${dailyContent.dateKey}:user:${recipient.userId}`;

      let alreadySentStages = [];

      // DUPLICATE PROTECTION: Check database before sending
      if (!force) {
        const existingLog = await DailyNotificationLog.findOne({
          $or: [
            { idempotencyKey },
            ...(recipient.userId ? [{ userId: recipient.userId, dateKey: dailyContent.dateKey }] : []),
            ...(recipient.phone10 ? [{ recipientPhone10: recipient.phone10, dateKey: dailyContent.dateKey }] : [])
          ]
        }).lean();

        if (existingLog && existingLog.status === 'sent') {
          console.log(`[DEDUPLICATION] Skipped: daily content already sent for this user and date (${idempotencyKey}).`);
          skippedCount++;
          continue;
        }

        if (existingLog && existingLog.status === 'partially_sent') {
          alreadySentStages = existingLog.channels?.whatsapp?.messagesSent || [];
          console.log(`[DEDUPLICATION] Resuming partially sent broadcast for ${idempotencyKey} (completed stages: ${alreadySentStages.join(', ')}).`);
        }

        // Atomic claim to prevent concurrent worker execution
        try {
          const claim = await DailyNotificationLog.findOneAndUpdate(
            { idempotencyKey },
            {
              $setOnInsert: {
                idempotencyKey,
                recipientPhone10: recipient.phone10,
                userId: recipient.userId || null,
                userEmail: recipient.userEmail || null,
                userName: recipient.userName,
                userPhone: recipient.userPhone,
                dateKey: dailyContent.dateKey,
                language: recipient.userLang,
                status: 'claiming',
                channels: {
                  email: { status: recipient.isEmailEnabled ? 'pending' : 'disabled' },
                  inApp: { status: recipient.isInAppEnabled ? 'pending' : 'disabled' },
                  push: { status: recipient.isPushEnabled ? 'pending' : 'disabled' },
                  whatsapp: { status: recipient.isWhatsAppEnabled ? 'pending' : 'disabled' }
                },
                summary: {
                  bibleRef: dailyContent.bible?.ref,
                  saintName: dailyContent.saint?.nameEnglish,
                  massTitle: dailyContent.massReadings?.[recipient.userLang === 'en' ? 'english' : 'tamil']?.title || 'Daily Mass Readings'
                },
                sentAt: new Date()
              }
            },
            { upsert: true, new: false }
          );

          if (claim && claim.status === 'claiming' && (Date.now() - new Date(claim.updatedAt || claim.sentAt).getTime()) < 10 * 60 * 1000) {
            console.log(`[DEDUPLICATION] Claim active for ${idempotencyKey} by another worker. Skipping.`);
            skippedCount++;
            continue;
          }
        } catch (claimErr) {
          if (claimErr.code === 11000 || claimErr.message?.includes('duplicate key')) {
            console.log(`[DEDUPLICATION] Skipped duplicate concurrent claim for ${idempotencyKey}.`);
            skippedCount++;
            continue;
          }
        }
      }

      const logChannels = {
        email: { status: recipient.isEmailEnabled ? 'pending' : 'disabled' },
        inApp: { status: recipient.isInAppEnabled ? 'pending' : 'disabled' },
        push: { status: recipient.isPushEnabled ? 'pending' : 'disabled' },
        whatsapp: { status: recipient.isWhatsAppEnabled ? 'pending' : 'disabled' }
      };

      let userHadAtLeastOneSuccess = false;
      let userHadAnyAttempt = false;

      // ── CHANNEL 1: EMAIL (If enabled) ─────────────────────────────────────
      if (recipient.isEmailEnabled && recipient.userEmail) {
        userHadAnyAttempt = true;
        try {
          const html = generateDailyNotificationHtml({
            userName: recipient.userName,
            dailyContent,
            userLanguage: recipient.userLang,
            hasSaintImageAttachment: hasSaintImage,
            hasBibleImageAttachment: hasVerseImage
          });

          const subject = recipient.userLang === 'en'
            ? `Good Morning - Your Daily Catholic Reading - ${dailyContent.formattedDate}`
            : `காலை வணக்கம் - இன்றைய கத்தோலிக்க திருப்பலி வாசகங்கள் - ${dailyContent.formattedDateTa || dailyContent.formattedDate}`;

          const mailRes = await sendMail({
            to: recipient.userEmail,
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

      // ── CHANNEL 2 & 3: IN-APP & MOBILE/WEB PUSH (Registered users only) ───
      if (recipient.userId && (recipient.isInAppEnabled || recipient.isPushEnabled)) {
        userHadAnyAttempt = true;
        try {
          const { createNotification } = require('./notificationService');
          const inAppMsg = formatInAppMessage(dailyContent, recipient.userLang);

          const notif = await createNotification({
            userId: recipient.userId,
            isBroadcast: false,
            title: recipient.userLang === 'en'
              ? `Daily Catholic Word & Readings — ${dailyContent.formattedDate}`
              : `இன்றைய கத்தோலிக்க வாசகங்கள் — ${dailyContent.formattedDateTa || dailyContent.formattedDate}`,
            message: inAppMsg,
            type: 'daily_spiritual',
            category: 'daily_spiritual',
            priority: 'normal',
            recipient: 'user',
            fileUrl: '/api/settings/daily-verses/today/image',
            actionUrl: `/notifications`,
            channels: [
              ...(recipient.isInAppEnabled ? ['inApp'] : []),
              ...(recipient.isPushEnabled ? ['push'] : [])
            ]
          });

          if (notif) {
            if (recipient.isInAppEnabled) {
              logChannels.inApp = { status: 'sent', notificationId: notif._id, error: null, sentAt: new Date() };
              channelStats.inApp.sent++;
            }
            if (recipient.isPushEnabled) {
              logChannels.push = { status: 'sent', error: null, sentAt: new Date() };
              channelStats.push.sent++;
            }
            userHadAtLeastOneSuccess = true;
          }
        } catch (err) {
          if (recipient.isInAppEnabled) {
            logChannels.inApp = { status: 'failed', notificationId: null, error: err.message, sentAt: new Date() };
            channelStats.inApp.failed++;
          }
          if (recipient.isPushEnabled) {
            logChannels.push = { status: 'failed', error: err.message, sentAt: new Date() };
            channelStats.push.failed++;
          }
        }
      } else {
        channelStats.inApp.disabled++;
        channelStats.push.disabled++;
      }

      // ── CHANNEL 4: WHATSAPP BOT (Strict 5-Stage Ordered Delivery) ──
      if (recipient.isWhatsAppEnabled && recipient.userPhone) {
        userHadAnyAttempt = true;
        try {
          if (waService && typeof waService.sendWhatsAppMessage === 'function') {
            const waSeqResult = await sendDailyWhatsAppSequence({
              waService,
              phone: recipient.userPhone,
              dailyContent,
              userLang: recipient.userLang,
              readingPreference: recipient.readingPreference,
              sendLinks: recipient.sendLinks,
              alreadySentStages
            });

            if (waSeqResult.success) {
              logChannels.whatsapp = {
                status: 'sent',
                phone: recipient.userPhone,
                error: null,
                messagesSent: waSeqResult.messagesSent,
                stepsCompleted: waSeqResult.messagesSent.length,
                sentAt: new Date()
              };
              channelStats.whatsapp.sent++;
              userHadAtLeastOneSuccess = true;
              console.log(`[DELIVERY COMPLETE] All 6 Catholic content stages delivered to ${recipient.userPhone}`);
            } else if (waSeqResult.messagesSent.length > 0) {
              const errStr = waSeqResult.stageErrors.map(e => `${e.stage}: ${e.error}`).join('; ');
              logChannels.whatsapp = {
                status: 'partially_sent',
                phone: recipient.userPhone,
                error: errStr || 'Partial delivery',
                messagesSent: waSeqResult.messagesSent,
                stepsCompleted: waSeqResult.messagesSent.length,
                sentAt: new Date()
              };
              channelStats.whatsapp.failed++;
              console.warn(`⚠️ [DELIVERY PARTIAL] Some stages failed for ${recipient.userPhone}: ${errStr}`);
            } else {
              const errStr = waSeqResult.stageErrors[0]?.error || 'Socket unreachable';
              logChannels.whatsapp = {
                status: 'failed',
                phone: recipient.userPhone,
                error: errStr,
                messagesSent: [],
                stepsCompleted: 0,
                sentAt: new Date()
              };
              channelStats.whatsapp.failed++;
            }
          } else {
            logChannels.whatsapp = { status: 'failed', phone: recipient.userPhone, error: 'WhatsApp service offline', sentAt: new Date() };
            channelStats.whatsapp.failed++;
          }
        } catch (err) {
          logChannels.whatsapp = { status: 'failed', phone: recipient.userPhone, error: err.message, sentAt: new Date() };
          channelStats.whatsapp.failed++;
        }
      } else {
        channelStats.whatsapp.disabled++;
      }

      // Determine overall user delivery status:
      // If WhatsApp was enabled for this user, do not mark as 'sent' if required messages failed
      let overallStatus = 'skipped';
      if (recipient.isWhatsAppEnabled && logChannels.whatsapp.status === 'partially_sent') {
        overallStatus = 'partially_sent';
      } else if (userHadAtLeastOneSuccess) {
        overallStatus = 'sent';
      } else if (userHadAnyAttempt) {
        overallStatus = 'failed';
      }

      if (overallStatus === 'sent') sentCount++;
      else if (overallStatus === 'failed') failedCount++;
      else if (overallStatus === 'partially_sent') failedCount++;
      else skippedCount++;

      // Save / Upsert final result to DailyNotificationLog
      await DailyNotificationLog.findOneAndUpdate(
        { idempotencyKey },
        {
          $set: {
            idempotencyKey,
            recipientPhone10: recipient.phone10,
            userId: recipient.userId || null,
            userEmail: recipient.userEmail || null,
            userName: recipient.userName,
            userPhone: recipient.userPhone || null,
            dateKey: dailyContent.dateKey,
            language: recipient.userLang,
            status: overallStatus,
            channels: logChannels,
            summary: {
              bibleRef: dailyContent.bible?.ref,
              saintName: dailyContent.saint?.nameEnglish,
              massTitle: dailyContent.massReadings?.[recipient.userLang === 'en' ? 'english' : 'tamil']?.title || 'Daily Mass Readings'
            },
            sentAt: new Date()
          }
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

    if (!manualTest) {
      try {
        await SiteSettings.findOneAndUpdate(
          { key: lockKey },
          {
            value: JSON.stringify({
              status: 'completed',
              completedAt: new Date(),
              sentCount,
              failedCount,
              skippedCount,
              channelStats
            }),
            label: `Daily Broadcast Lock for ${dailyContent.dateKey}`,
            type: 'text'
          },
          { upsert: true }
        );
      } catch (lockFinErr) {
        console.warn('[Daily Notification Service] Lock finish update notice:', lockFinErr.message);
      }
    }
    isBroadcasting = false;
    console.log(`[Daily Notification Service] 4:00 AM Multi-Channel Broadcast complete for ${dailyContent.dateKey}: Sent=${sentCount}, Skipped=${skippedCount}, Failed=${failedCount}`);
    console.log('[Daily Notification Service] Channel breakdown:', JSON.stringify(channelStats));

    return {
      success: true,
      dateKey: dailyContent.dateKey,
      totalRecipients: recipientMap.size,
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

    const registeredUsers = await User.countDocuments({ isActive: { $ne: false } });
    const botSessionCount = await BotSession.countDocuments({ step: { $ne: 'stopped' } });
    const totalUsers = registeredUsers;
    const totalRecipients = Math.max(registeredUsers, botSessionCount);

    const sentLogs = await DailyNotificationLog.countDocuments({ dateKey, status: { $in: ['sent', 'partially_sent'] } });
    const failedLogs = await DailyNotificationLog.countDocuments({ dateKey, status: 'failed' });
    const recentLogs = await DailyNotificationLog.find({ dateKey }).sort({ sentAt: -1 }).limit(30).lean();

    const isComplete = sentLogs > 0 && (sentLogs + failedLogs) >= totalRecipients;

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
      totalRecipients,
      sentCount: sentLogs,
      failedCount: failedLogs,
      skippedCount: Math.max(0, totalRecipients - (sentLogs + failedLogs)),
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

    console.log(`[Daily Notification Service] Startup/Deployment Trigger: Today's daily notification (${todayDateKey}) has not been sent yet.`);
  } catch (err) {
    console.error('[Daily Notification Service] Startup trigger error:', err.message);
  }
}

// ─── 4:00 AM IST Daily Automated Scheduled Job ────────────────────────────────
cron.schedule('0 4 * * *', async () => {
  console.log('🔔 [CRON 4:00 AM IST] Triggering automated 4-Channel Daily Church Notifications broadcast...');
  await sendDailyChurchNotifications();
}, {
  timezone: 'Asia/Kolkata'
});

console.log('✅ [Daily Notification Service] 4:00 AM IST Cron Scheduler registered (Asia/Kolkata).');

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
