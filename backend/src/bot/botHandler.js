/**
 * SJDB Connect WhatsApp Bot Handler — Streamlined Daily Catholic Devotions & Parish Services
 * 
 * Capabilities:
 * 1. English & Tamil Full Support (Case-Insensitive: services = Services = SERVICES)
 * 2. Distinct Intent Routing:
 *    - MENU / HOME / 0 / HI / START -> Main Menu
 *    - SERVICES / WHAT SERVICES DO YOU PROVIDE -> 1-14 Services Menu
 *    - READINGS -> Daily Mass Readings
 *    - PREFERENCES -> Preferences
 *    - LANGUAGE -> Language Settings
 *    - VERIFY -> Account Verification
 *    - STOP -> Unsubscribe
 * 3. 1 to 14 Numbered Direct Selection & Natural Language Question Answering
 * 4. First-Time Interaction Hook -> Dispatches detailed Admin Email notification (Registered vs Unregistered)
 * 5. Dynamic Data Integration (Mass Timings, Events, Announcements, Contacts, Church Location & Google Maps)
 * 6. Continuous 24x7 Server-Side Execution
 */

const BotSession = require('../models/BotSession');
const ProcessedMessage = require('../models/ProcessedMessage');
const User = require('../models/User');
const Event = require('../models/Event');
const Announcement = require('../models/Announcement');
const Priest = require('../models/Priest');
const { getTodayDailyContent } = require('../services/dailyContentService');
const { generateDailyCatholicMessage, generateSaintCaption, generateSaintInfoMessage } = require('../services/whatsappDailyFormatter');
const { scanInappropriateContent } = require('./moderation');
const { answerChurchQuestion } = require('./churchRAGService');
const { notifyAdmin } = require('../services/adminNotificationService');
const { SITE_ROUTES, EXTERNAL_LINKS, getSiteUrl } = require('../config/siteRoutes');
const {
  getCachedDailyContent,
  getCachedPriests,
  getCachedEvents,
  getCachedAnnouncements
} = require('./churchDataCache');

function getWA() {
  return require('./whatsapp');
}

// Fast In-Memory LRU / TTL Cache for Processed WhatsApp Message IDs (24 hours retention)
const processedMessageIdsCache = new Map();
// Fast In-Memory Sliding Window for Raw Incoming Message Text (prevents rapid double-taps)
const incomingMsgDeduplication = new Map();
// Concurrency lock set per sessionKey / event to prevent race conditions
const activeSessionLocks = new Set();

function isDuplicateMessageId(messageId) {
  if (!messageId) return false;
  const now = Date.now();
  const cachedTs = processedMessageIdsCache.get(messageId);
  if (cachedTs && (now - cachedTs) < 24 * 60 * 60 * 1000) {
    return true; // Dropped: WhatsApp event already processed
  }
  return false;
}

function markMessageIdProcessed(messageId) {
  if (!messageId) return;
  const now = Date.now();
  processedMessageIdsCache.set(messageId, now);

  if (processedMessageIdsCache.size > 5000) {
    for (const [id, ts] of processedMessageIdsCache.entries()) {
      if (now - ts > 24 * 60 * 60 * 1000) processedMessageIdsCache.delete(id);
    }
  }
}

function isDuplicateMessageText(sessionKey, rawText) {
  const now = Date.now();
  const dedupKey = `${sessionKey}:${rawText}`;
  const lastProcessed = incomingMsgDeduplication.get(dedupKey);
  if (lastProcessed && (now - lastProcessed) < 2500) {
    return true; // Duplicate webhook/event within 2.5 seconds
  }
  incomingMsgDeduplication.set(dedupKey, now);

  // Clean stale keys periodically
  if (incomingMsgDeduplication.size > 2000) {
    for (const [k, ts] of incomingMsgDeduplication.entries()) {
      if (now - ts > 30000) incomingMsgDeduplication.delete(k);
    }
  }
  return false;
}

const UNSUPPORTED_LANGUAGE_MSG = "Currently I'm available in only English and Tamil. In the future I may update to other languages.";

/**
 * Main Menu Message (Quick Commands — English Only UI)
 */
function getMainMenuMessage(userName) {
  return `👋 *Welcome to SJDB Connect!*
⛪ *St. John de Britto's Church, Kalayarkoil*

How can I help you today?

1️⃣ 📖 *Daily Bible*
2️⃣ ⛪ *Mass Timings*
3️⃣ 🕊️ *Services*
4️⃣ 📅 *Events*
5️⃣ 📢 *Announcements*
6️⃣ 📜 *Church Information*
7️⃣ 🌟 *Saint of the Day*
8️⃣ ❓ *Help*

👉 *You can reply with a number or ask your question naturally.*`;
}

/**
 * Dedicated 1-14 Services & Help Desk Message (English Only UI)
 */
function getServicesMenuMessage() {
  return `⛪ *SJDB Connect – Services & Help Desk*
_St. John de Britto's Church, Kalayarkoil_

1️⃣ ⛪ *Mass Timings*
2️⃣ 🕊️ *Confession Timings*
3️⃣ ✝️ *Other Sacrament Timings*
4️⃣ 📖 *Daily Bible Verse*
5️⃣ 📜 *Daily Mass Readings*
6️⃣ 🌟 *Saint of the Day*
7️⃣ 🙏 *Catholic Prayers*
8️⃣ 📅 *Church Events*
9️⃣ 📢 *Parish Announcements*
🔟 📍 *Church Location & Map*
1️⃣1️⃣ 👥 *Parish Ministries & Anbiyams*
1️⃣2️⃣ 👑 *Parish Priest & Clergy*
1️⃣3️⃣ 🏛️ *Church History*
1️⃣4️⃣ 📞 *Contact Church*

👉 *Reply with a number (1-14) or type your question naturally.*
_(e.g., "What time is Mass?", "Where is the church?", "Confession timings")_`;
}

/**
 * Exact Preferences Menu Message (Displayed immediately after phone verification)
 */
function getPreferencesMenuMessage() {
  return `📋 *SJDB Connect Preferences*

Please select the services you would like to receive:

1️⃣ Daily Bible Verse
2️⃣ Saint of the Day
3️⃣ Daily Mass Readings & Reflection
4️⃣ Church Events
5️⃣ Parish Announcements
6️⃣ Birthday Wishes
7️⃣ All of the above

👉 Reply with numbers separated by commas (e.g. 1,2,3) or reply *7 / ALL* for all services.

➡️ Type *Menu* for Quick Commands
➡️ Type *Services* for Help Desk`;
}

/**
 * Daily Catholic Content Language Selection Prompt
 */
function getDailyContentLanguagePrompt() {
  return `🌐 *Daily Catholic Content Language*

Select your preferred language for Daily Bible Verse, Mass Readings, Reflection & Saint of the Day:

1️⃣ Tamil (தமிழ்)
2️⃣ English
3️⃣ Both (Tamil + English)

👉 Reply with *1*, *2*, or *3*.`;
}

/**
 * Preferences & Language Saved Confirmation Message
 */
function getPreferencesConfirmationMessage(preferences, language) {
  const prefLabels = {
    verse: '📖 Daily Bible Verse',
    saint: '🕊️ Saint of the Day',
    mass: '⛪ Daily Mass Readings & Reflection',
    events: '📅 Church Events',
    announcements: '📢 Parish Announcements',
    birthday: '🎂 Birthday Wishes'
  };

  const prefList = (preferences || []).map(p => `• ${prefLabels[p] || p}`).join('\n');
  const langLabel = language === 'ta' ? 'Tamil (தமிழ்)' : language === 'both' ? 'Both (Tamil + English)' : 'English';

  return `✅ *You're all set!*

📋 *Your Subscribed Services:*
${prefList || '• 📖 Daily Bible Verse\n• ⛪ Daily Mass Readings & Reflection\n• 🕊️ Saint of the Day'}

🌐 Daily Catholic Content Language: *${langLabel}*
⏰ Daily Catholic broadcast is delivered sharply at *12:00 AM IST*.

May God bless you and your family! 🙏❤️
— *SJDB Connect*
_St. John de Britto's Church, Kalayarkoil_

➡️ Type *Menu* for Quick Commands
➡️ Type *Services* for Help Desk`;
}

/**
 * SJDB Connect Assistance Onboarding Message (Sent once right after confirmation)
 */
function getAssistanceWelcomeMessage() {
  return `🙏 *SJDB Connect Assistance*

I can help with *church-related information, Catholic faith, and SJDB Connect services*.

📌 *You can ask me about:*

• ⛪ Mass, Confession & other Sacrament timings
• 📖 Bible verses, Bible questions & Catholic teachings
• 🕊️ Daily Mass Readings, Reflection & Saint of the Day
• 🙏 Catholic prayers & prayer guidance
• ✝️ Sacraments & Catholic spiritual guidance
• 📜 St. John de Britto Church history & parish details
• 📅 Church events, programs & announcements
• 👥 Parish Priest, clergy & Anbiyam information
• 🏛️ Parish ministries, groups & services
• 📍 Church location, contact & visiting information
• 🗓️ Liturgical calendar, feast days & important Catholic days
• 🎉 Parish celebrations & special occasions
• 📝 Event registration & parish-related forms
• 📱 SJDB Connect & Parish web portal assistance
• 🔔 Notifications, Daily Catholic content & preferences
• 🌐 Help finding information on the church website

_Please ask a church, Catholic faith, parish, or SJDB Connect-related question._ 🙏`;
}

/**
 * Check if the input message contains non-English / non-Tamil scripts
 */
function isUnsupportedLanguage(text) {
  if (!text) return false;
  const foreignScriptsRegex = /[\u0600-\u06FF\u0750-\u077F\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u1200-\u137F\u1780-\u17FF\u1800-\u18AF\u1900-\u194F\u2C00-\u2C5F\u2D30-\u2D7F\u3040-\u30FF\u3100-\u312F\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\u0400-\u04FF\u0370-\u03FF]/;
  return foreignScriptsRegex.test(text);
}

async function sendTodayDevotionsToUser(replyTarget, session, wa) {
  try {
    const dailyContent = await getCachedDailyContent();
    const userLang = session.language || 'en';

    const msg1 = generateDailyCatholicMessage({
      dailyContent,
      language: userLang,
      readingPreference: 'full'
    });
    const readingsLink = `\n\n🌐 *Read complete Mass Readings online:* ${getSiteUrl(SITE_ROUTES.DAILY_READINGS)}`;
    await wa.sendWhatsAppMessage(replyTarget, `${msg1}${readingsLink}`);
  } catch (err) {
    console.error('[BotHandler] Error delivering devotions:', err.message);
    await wa.sendWhatsAppMessage(replyTarget, `📖 *Daily Catholic Readings & Devotions*\n\nView today's Mass readings, verse and reflection online:\n${getSiteUrl(SITE_ROUTES.DAILY_READINGS)}`);
  }
}

async function handleIncomingMessage(fromNumber, body, rawJid, pushName, messageId = null, messageTimestamp = null) {
  const rawText = (body || '').trim();
  if (!rawText) return;

  const replyTarget = rawJid || fromNumber;
  const phone = (fromNumber || '').replace('whatsapp:', '').replace(/\D/g, '');
  const sessionKey = (fromNumber && fromNumber.includes('@lid')) ? fromNumber : (phone || fromNumber);

  // 1. Fast In-Memory Message ID Idempotency Check (drops webhook retries/duplicates instantly)
  if (messageId && isDuplicateMessageId(messageId)) {
    console.log(`⚡ [BotHandler] Dropping duplicate WhatsApp message event ID: ${messageId}`);
    return;
  }

  // 2. Concurrency lock to prevent simultaneous race conditions for the same user action
  const lockKey = `${sessionKey}:${messageId || rawText}`;
  if (activeSessionLocks.has(lockKey)) {
    console.log(`⚡ [BotHandler] Lock active for ${lockKey}, dropping concurrent webhook retry`);
    return;
  }
  activeSessionLocks.add(lockKey);

  try {
    // 3. Fast In-Memory Text Window Check (for rapid double-taps or absent messageId)
    if (isDuplicateMessageText(sessionKey, rawText)) {
      console.log(`⚡ [BotHandler] Dropping rapid duplicate incoming message from ${sessionKey}`);
      return;
    }

    let session = await BotSession.findOne({
      $or: [
        { phoneNumber: sessionKey },
        { phoneNumber: phone },
        ...(rawJid ? [{ phoneNumber: rawJid }] : [])
      ]
    });

    if (!session) {
      session = new BotSession({ phoneNumber: sessionKey, step: 'welcome' });
      await session.save();
    }

    // 4. Database-level Message ID Idempotency Check & Atomic Multi-Process Lock
    if (messageId) {
      if (session.processedMessageIds && session.processedMessageIds.includes(messageId)) {
        console.log(`⚡ [BotHandler] Message ID ${messageId} already recorded in DB session. Dropping.`);
        markMessageIdProcessed(messageId);
        return;
      }

      try {
        await ProcessedMessage.create({ messageId, from: sessionKey, bodyPreview: rawText.slice(0, 100) });
      } catch (pmErr) {
        if (pmErr.code === 11000 || pmErr.message?.includes('duplicate key')) {
          console.log(`⚡ [BotHandler] Message ID ${messageId} already locked by another process. Dropping.`);
          markMessageIdProcessed(messageId);
          return;
        }
      }

      markMessageIdProcessed(messageId);
      if (!session.processedMessageIds) session.processedMessageIds = [];
      session.processedMessageIds.push(messageId);
      if (session.processedMessageIds.length > 50) {
        session.processedMessageIds.shift();
      }
      session.lastProcessedMessageId = messageId;
    }

    session.lastMessage = new Date();

  // ── First-Time User Admin Email Notification ────────────────────────────────
  if (!session.firstInteractionEmailSent) {
    try {
      const searchPhone = (phone || '').slice(-10);
      let parishUser = null;
      if (session.linkedUserId) {
        parishUser = await User.findById(session.linkedUserId);
      } else if (searchPhone) {
        parishUser = await User.findOne({ phone: { $regex: searchPhone } });
      }

      const isRegistered = Boolean(parishUser);
      const userName = isRegistered ? parishUser.name : (pushName || 'Unregistered WhatsApp User');
      const userEmail = isRegistered ? (parishUser.email || 'None') : 'Unregistered (No Email)';
      const userPhone = isRegistered ? (parishUser.phone || phone) : phone;

      await notifyAdmin({
        type: 'FIRST_BOT_INTERACTION',
        user: parishUser,
        extra: {
          isRegistered,
          name: userName,
          phone: userPhone,
          email: userEmail,
          accountStatus: isRegistered ? `Registered Parishioner (${parishUser.isActive !== false ? 'Active' : 'Pending'})` : 'Unregistered User (No Website Account)',
          memberId: parishUser?.parishMemberId || 'N/A',
          familyId: parishUser?.familyId || 'N/A',
          anbiyam: parishUser?.anbiyam || parishUser?.subStation || 'N/A',
          language: session.language === 'en' ? 'English' : session.language === 'both' ? 'Tamil + English' : 'Tamil (தமிழ்)',
          initialMessage: rawText || 'Hi',
          pushName: pushName || ''
        }
      });

      session.firstInteractionEmailSent = true;
      session.firstInteractionAt = new Date();
      if (pushName) session.pushName = pushName;
      if (parishUser && !session.linkedUserId) session.linkedUserId = parishUser._id;
      await session.save();
    } catch (notifErr) {
      console.error('[BotHandler] Failed to dispatch first-time user admin email:', notifErr.message);
    }
  }

  const wa = getWA();

  const isStopCommand = rawText.toUpperCase() === 'STOP' || rawText.toUpperCase() === 'UNSUBSCRIBE';
  if (isStopCommand) {
    session.step = 'stopped';
    session.isOnboarded = false;
    session.preferences = [];
    await session.save();

    if (session.linkedUserId) {
      try {
        await User.findByIdAndUpdate(session.linkedUserId, { whatsappOptIn: false, botPreferences: [] });
      } catch (e) {}
    }

    const stopMsg = `You have been unsubscribed from SJDB Connect.\n\nReply *HI*, *MENU*, or *SERVICES* anytime to re-subscribe. God bless! 🙏`;
    await wa.sendWhatsAppMessage(replyTarget, stopMsg);
    return;
  }

  // ── Central System State Check (Maintenance / Emergency) ────────────────────
  const { getSystemState } = require('../services/systemStateService');
  const systemState = await getSystemState();

  if (systemState && (systemState.status === 'maintenance' || systemState.status === 'emergency')) {
    let hasBypass = false;
    let linkedUser = null;

    if (session.linkedUserId) {
      linkedUser = await User.findById(session.linkedUserId).select('role isTechnicalTeam isActive');
    } else if (phone) {
      linkedUser = await User.findOne({
        phone: { $in: [phone, `+91${phone}`, `91${phone}`, fromNumber] },
        isActive: { $ne: false }
      }).select('role isTechnicalTeam isActive');
    }

    if (linkedUser && linkedUser.isActive !== false) {
      const userRole = (linkedUser.role || '').toLowerCase();
      const isAdmin = ['admin', 'priest'].includes(userRole);
      const isTech = Boolean(linkedUser.isTechnicalTeam) || ['staff', 'technical_team', 'tech_team', 'technical'].includes(userRole);
      const isContentEditor = ['content_editor', 'editor', 'office'].includes(userRole);

      if (isAdmin && systemState.allowAdminLogin !== false) hasBypass = true;
      if (isTech && systemState.allowTechTeam !== false) hasBypass = true;
      if (isContentEditor && systemState.allowContentEditors) hasBypass = true;
    }

    if (!hasBypass) {
      if (systemState.status === 'emergency') {
        const emergencyMsg = `🚨 *SJDB Connect Emergency Lockdown*

Our church digital services and WhatsApp Bot are temporarily locked due to an emergency system event.

*Reason:* ${systemState.emergencyReason || systemState.message || 'Emergency maintenance in progress'}

We are working swiftly to restore normal operation. Thank you for your patience and prayers.

— *St. John de Britto's Church, Kalayarkoil*
_SJDB Connect_`;
        await wa.sendWhatsAppMessage(replyTarget, emergencyMsg);
        return;
      }

      const maintMsg = `🔧 *SJDB Connect is Temporarily Unavailable*

Our church digital services are currently under maintenance.
The WhatsApp Bot is temporarily unavailable while we carry out scheduled maintenance and improvements.

Please try again later. Thank you for your patience.

— *St. John de Britto's Church, Kalayarkoil*
_SJDB Connect_`;
      await wa.sendWhatsAppMessage(replyTarget, maintMsg);
      return;
    }
  }

  // ── Language Filter (English & Tamil Only) ──────────────────────────────────
  if (isUnsupportedLanguage(rawText)) {
    await wa.sendWhatsAppMessage(replyTarget, UNSUPPORTED_LANGUAGE_MSG);
    return;
  }

  // ── Inappropriate Content Scan ──────────────────────────────────────────────
  const { hasInappropriate, detectedWords } = scanInappropriateContent(rawText);
  if (hasInappropriate) {
    console.warn(`[WhatsApp Moderation] Inappropriate content from ${sessionKey}:`, detectedWords);
    session.moderationFlags.push({
      detectedWords,
      timestamp: new Date(),
      rawText
    });
    await session.save();

    const warningMsg = `⚠️ *Warning*
Inappropriate language or content was detected in your message.

*Your records are stored. Severe action will be taken for misuse of this service.*

Detected words: ${detectedWords.map(w => `\`${w}\``).join(', ')}`;

    await wa.sendWhatsAppMessage(replyTarget, warningMsg);
    return;
  }

  const normalizedText = rawText.toLowerCase().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  const isTamilQuery = /[\u0B80-\u0BFF]/.test(rawText) || session.language === 'ta';

  // ── Phone Number Verification Gate ──────────────────────────────────────────
  const isVerifyCommand = /^(verify|reverify|சரிபார்|மீண்டும் சரிபார்)$/i.test(normalizedText);
  if (isVerifyCommand) {
    session.isVerified = false;
    session.step = 'phone_verification';
    await session.save();

    const verifyPrompt = `🔐 *Phone Number Verification*\n\n📱 Please enter your 10-digit mobile phone number (e.g., *9876543210*) to verify:`;
    await wa.sendWhatsAppMessage(replyTarget, verifyPrompt);
    return;
  }

  // If user is not yet verified, they must verify their phone number first before chatting
  if (!session.isVerified) {
    const rawDigits = rawText.replace(/\D/g, '');
    const isPhoneNumberInput = rawDigits.length >= 10;

    if (isPhoneNumberInput) {
      const clean10Digits = rawDigits.slice(-10);
      session.providedPhone = clean10Digits;
      session.isVerified = true;
      session.step = 'preferences';

      const parishUser = await User.findOne({ phone: { $regex: clean10Digits } });
      if (parishUser) {
        session.linkedUserId = parishUser._id;
      }
      await session.save();

      let ackHeader = '';
      if (parishUser) {
        const zoneOrAnbiyam = parishUser.anbiyam || parishUser.subStation || parishUser.parishZone || 'Parishioner';
        ackHeader = `✅ *Phone Number Verified!*\nWelcome, *${parishUser.name}* (${zoneOrAnbiyam})! 🙏\n\n`;
      } else {
        ackHeader = `✅ *Phone number verified.*\n\nYou can use SJDB Connect and access the available church information and services.\n\nFor faster and more accurate information, please create a *Parish Account*.\n\n📝 *Create Parish Account:*\n${getSiteUrl(SITE_ROUTES.REGISTER)}\n\nYou can continue using the bot without registering.\n\n`;
      }

      // Immediately send the exact Preferences message after successful number verification
      const prefMsg = `${ackHeader}${getPreferencesMenuMessage()}`;
      await wa.sendWhatsAppMessage(replyTarget, prefMsg);
      return;
    }

    // User sent "Hi", "Hello", or any greeting/question without verifying their number yet
    session.step = 'phone_verification';
    await session.save();

    const verifyPrompt = `👋 *Welcome to SJDB Connect!*
⛪ *St. John de Britto's Church, Kalayarkoil*
_Connecting Faith & Community_

🔐 *Phone Number Verification*

To start chatting and access church services, please enter your **10-digit mobile phone number** to verify your account.

📱 *Please reply with your 10-digit mobile number (e.g., 9876543210):*`;

    await wa.sendWhatsAppMessage(replyTarget, verifyPrompt);
    return;
  }

  // ── Step: Preferences Selection ─────────────────────────────────────────────
  if (session.step === 'preferences') {
    // Allow direct navigation commands even during preferences
    if (/^(menu|0|home|quick commands)$/i.test(normalizedText)) {
      const welcomeMenu = getMainMenuMessage();
      await wa.sendWhatsAppMessage(replyTarget, welcomeMenu);
      return;
    }
    if (/^(services|service|help desk)$/i.test(normalizedText)) {
      const servicesMsg = getServicesMenuMessage();
      await wa.sendWhatsAppMessage(replyTarget, servicesMsg);
      return;
    }

    // Parse selections: 7 / ALL / all / All / 1,2,3 / 1, 2, 3 / 1,2
    let selectedPrefs = [];
    if (normalizedText === '7' || /^(all|\*|all of the above)$/i.test(normalizedText)) {
      selectedPrefs = ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday'];
    } else {
      const prefMap = {
        '1': 'verse',
        '2': 'saint',
        '3': 'mass',
        '4': 'events',
        '5': 'announcements',
        '6': 'birthday'
      };
      const parts = rawText.split(/[,\s]+/).map(s => s.trim().replace(/[^0-9]/g, '')).filter(Boolean);
      selectedPrefs = Array.from(new Set(parts.map(p => prefMap[p]).filter(Boolean)));
    }

    if (selectedPrefs.length > 0) {
      session.preferences = selectedPrefs;
      session.step = 'language';
      await session.save();

      if (session.linkedUserId) {
        try {
          await User.findByIdAndUpdate(session.linkedUserId, {
            botPreferences: selectedPrefs,
            whatsappOptIn: true
          });
        } catch (uErr) {
          console.warn('[BotHandler] User preferences update error:', uErr.message);
        }
      }

      // Prompt for Daily Catholic Content Language Selection
      const langPrompt = getDailyContentLanguagePrompt();
      await wa.sendWhatsAppMessage(replyTarget, langPrompt);
      return;
    }

    // Invalid input for preferences
    const retryMsg = `⚠️ Invalid selection. Please reply with numbers separated by commas (e.g., *1,2,3*) or reply *7 / ALL* for all services.\n\n` + getPreferencesMenuMessage();
    await wa.sendWhatsAppMessage(replyTarget, retryMsg);
    return;
  }

  // ── Step: Catholic Content Language Selection ───────────────────────────────
  if (session.step === 'language') {
    // Allow direct navigation commands even during language selection
    if (/^(menu|0|home|quick commands)$/i.test(normalizedText)) {
      const welcomeMenu = getMainMenuMessage();
      await wa.sendWhatsAppMessage(replyTarget, welcomeMenu);
      return;
    }
    if (/^(services|service|help desk)$/i.test(normalizedText)) {
      const servicesMsg = getServicesMenuMessage();
      await wa.sendWhatsAppMessage(replyTarget, servicesMsg);
      return;
    }

    let chosenLang = null;
    if (/^(1|tamil|தமிழ்|ta)$/i.test(normalizedText)) {
      chosenLang = 'ta';
    } else if (/^(2|english|eng|en)$/i.test(normalizedText)) {
      chosenLang = 'en';
    } else if (/^(3|both|tamil \+ english|தமிழ் \+ english|all)$/i.test(normalizedText)) {
      chosenLang = 'both';
    }

    if (chosenLang) {
      session.language = chosenLang;
      session.step = 'done';
      session.isOnboarded = true;
      await session.save();

      if (session.linkedUserId) {
        try {
          await User.findByIdAndUpdate(session.linkedUserId, {
            language: chosenLang,
            mass_reflection_language: chosenLang,
            preferredLanguage: chosenLang
          });
        } catch (lErr) {
          console.warn('[BotHandler] User language update error:', lErr.message);
        }
      }

      const confirmMsg = getPreferencesConfirmationMessage(session.preferences, session.language);
      await wa.sendWhatsAppMessage(replyTarget, confirmMsg);

      // Only after all setup is complete -> Send the SJDB Connect Assistance overview message
      const assistanceMsg = getAssistanceWelcomeMessage();
      await wa.sendWhatsAppMessage(replyTarget, assistanceMsg);
      return;
    }

    const langRetryMsg = `⚠️ Please reply with *1*, *2*, or *3* to choose your Daily Catholic Content language:\n\n1️⃣ Tamil (தமிழ்)\n2️⃣ English\n3️⃣ Both (Tamil + English)`;
    await wa.sendWhatsAppMessage(replyTarget, langRetryMsg);
    return;
  }

  // ── 1. SERVICES / HELP DESK MENU COMMAND (Exact Case-Insensitive or Natural Inquiry) ─────
  const isServicesTrigger = /^(services|service|help desk|சேவைகள்|பங்கு சேவைகள்)$/i.test(normalizedText) ||
    normalizedText.includes('what services do you provide') ||
    normalizedText.includes('what services') ||
    normalizedText.includes('services list') ||
    normalizedText.includes('church services') ||
    normalizedText.includes('parish services') ||
    normalizedText.includes('available services') ||
    normalizedText.includes('என்னென்ன சேவைகள்');

  if (isServicesTrigger) {
    const servicesMsg = getServicesMenuMessage();
    await wa.sendWhatsAppMessage(replyTarget, servicesMsg);
    return;
  }

  // ── 2. MAIN MENU / QUICK COMMANDS (0, Menu, Home, Start, Hi, Quick Commands) ──────────
  const isMenuTrigger = /^(menu|0|home|start|hi|hello|hey|quick commands|வணக்கம்)$/i.test(normalizedText) ||
    normalizedText.includes('main menu') ||
    normalizedText.includes('முதன்மை மெனு') ||
    normalizedText.includes('sjdb connect');

  if (isMenuTrigger) {
    let linkedUser = null;
    if (session.linkedUserId) {
      linkedUser = await User.findById(session.linkedUserId);
    } else if (session.providedPhone || phone) {
      const searchPhone = (session.providedPhone || phone).slice(-10);
      linkedUser = await User.findOne({ phone: { $regex: searchPhone } });
    }

    const userName = linkedUser ? linkedUser.name : (pushName || '');
    const menuMsg = getMainMenuMessage(userName);
    await wa.sendWhatsAppMessage(replyTarget, menuMsg);
    return;
  }

  // ── Preferences Command (Trigger preferences update anytime) ───────────────
  if (/^(preferences|prefs|விருப்பங்கள்)$/i.test(normalizedText)) {
    session.step = 'preferences';
    await session.save();
    await wa.sendWhatsAppMessage(replyTarget, getPreferencesMenuMessage());
    return;
  }

  // ── Language Command (Trigger Catholic content language update anytime) ─────
  if (/^(language|lang|மொழி)$/i.test(normalizedText)) {
    session.step = 'language';
    await session.save();
    await wa.sendWhatsAppMessage(replyTarget, getDailyContentLanguagePrompt());
    return;
  }

  // ── Language Switching Commands (Case-Insensitive) ─────────────────────────
  if (/^(tamil|தமிழ்|ta)$/i.test(normalizedText) || normalizedText === 'change to tamil' || normalizedText === 'switch to tamil') {
    session.language = 'ta';
    await session.save();
    const taAck = `✅ *Daily Catholic Content Language set to Tamil (தமிழ்) successfully!*\nBible Verse, Mass Readings, Reflection & Saint of the Day will be delivered in Tamil.\n\n📌 Type *MENU* for Quick Commands or *SERVICES* for Help Desk.`;
    await wa.sendWhatsAppMessage(replyTarget, taAck);
    return;
  }

  if (/^(english|eng|en)$/i.test(normalizedText) || normalizedText === 'change to english' || normalizedText === 'switch to english') {
    session.language = 'en';
    await session.save();
    const enAck = `✅ *Daily Catholic Content Language set to English successfully!*\nBible Verse, Mass Readings, Reflection & Saint of the Day will be delivered in English.\n\n📌 Type *MENU* for Quick Commands or *SERVICES* for Help Desk.`;
    await wa.sendWhatsAppMessage(replyTarget, enAck);
    return;
  }

  // ── 3. NUMBERED MENU & DIRECT INTENT ROUTING ────────────────────────────────

  // Option 1: Daily Bible (Main Menu 1) OR Mass Timings (Services 1)
  const isDailyBibleQuery = /^(daily bible|bible|today bible|readings|verse)$/i.test(normalizedText) ||
    /(தினசரி விவிலியம்|விவிலியம்|இறைவார்த்தை|தினசரி வாசகம்)/.test(rawText);

  if (normalizedText === '1' || isDailyBibleQuery) {
    await sendTodayDevotionsToUser(replyTarget, session, wa);
    return;
  }

  // Option 2: Mass Timings (Main Menu 2 & Services 1)
  const isMassTimingsQuery = normalizedText === '2' ||
    /\b(mass timings|mass time|mass schedule|when is mass|what time is mass|morning mass|evening mass|sunday mass|today mass)\b/i.test(normalizedText) ||
    /(திருப்பலி நேரம்|பூசை நேரம்|திருப்பலி நேரங்கள்|ஞாயிறு திருப்பலி)/.test(rawText);

  if (isMassTimingsQuery) {
    const massMsg = `⛪ *St. John de Britto's Church — Holy Mass Timings*
_Kalayarkoil, Sivagangai Diocese_

📅 *Weekdays (Mon – Sat):*
• 6:00 AM — Daily Morning Holy Mass

🌟 *Sunday Holy Masses:*
• 6:00 AM — Early Morning Mass
• 8:00 AM — Parish High Mass

🕯️ *Tuesday Novena:*
• 6:00 PM — Novena to St. Antony & Mass

🕊️ *First Friday:*
• 6:00 PM — Eucharistic Adoration & Special Mass

🕊️ *Confessions (Reconciliation):*
• Saturdays: 5:30 PM – 6:30 PM & before daily morning Mass

🌐 *Full Schedule:* ${getSiteUrl(SITE_ROUTES.MASS_TIMINGS)}`;

    await wa.sendWhatsAppMessage(replyTarget, massMsg);
    return;
  }

  // Option 3: Services Menu (Main Menu 3)
  if (normalizedText === '3') {
    const servicesMsg = getServicesMenuMessage();
    await wa.sendWhatsAppMessage(replyTarget, servicesMsg);
    return;
  }

  // Option 4: Church Events (Main Menu 4) OR Verse (Services 4)
  const isEventsChoice = normalizedText === '4' ||
    /\b(events|upcoming events|church events)\b/i.test(normalizedText) ||
    /(நிகழ்வுகள்|நிகழ்ச்சிகள்)/.test(rawText);

  if (isEventsChoice) {
    try {
      const events = await getCachedEvents();

      let eventsMsg = '';
      if (events && events.length > 0) {
        const lines = events.map(ev => {
          const dt = new Date(ev.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
          return `📌 *${ev.title}*\n📅 ${dt} ${ev.time ? `• ⏰ ${ev.time}` : ''}\n📍 ${ev.venue || 'Church Premises'}\n`;
        }).join('\n');
        eventsMsg = `📅 *Upcoming Church Events:*\n\n${lines}\n🔗 ${getSiteUrl(SITE_ROUTES.EVENTS)}`;
      } else {
        eventsMsg = `📅 *Church Events:*\n\nNo special upcoming events scheduled currently.\n\n🌐 ${getSiteUrl(SITE_ROUTES.EVENTS)}`;
      }
      await wa.sendWhatsAppMessage(replyTarget, eventsMsg);
      return;
    } catch (eErr) {
      console.error('[BotHandler] Events error:', eErr.message);
    }
  }

  // Option 5: Parish Announcements (Main Menu 5 & Services 9)
  const isAnnouncementsChoice = normalizedText === '5' || normalizedText === '9' ||
    /\b(announcements?|notices?|parish announcements?)\b/i.test(normalizedText) ||
    /(அறிவிப்புகள்|பங்கு அறிவிப்பு)/.test(rawText);

  if (isAnnouncementsChoice) {
    try {
      const announcements = await getCachedAnnouncements();

      let annMsg = '';
      if (announcements && announcements.length > 0) {
        const lines = announcements.map(a => `📢 *${a.title}*\n${(a.content || a.description || '').slice(0, 120)}...\n`).join('\n');
        annMsg = `📢 *Parish Announcements:*\n\n${lines}\n🌐 ${getSiteUrl(SITE_ROUTES.ANNOUNCEMENTS)}`;
      } else {
        annMsg = `📢 *Parish Announcements:*\n\nThere are no new announcements at this moment.\n\n🌐 ${getSiteUrl(SITE_ROUTES.ANNOUNCEMENTS)}`;
      }
      await wa.sendWhatsAppMessage(replyTarget, annMsg);
      return;
    } catch (aErr) {
      console.error('[BotHandler] Announcements error:', aErr.message);
    }
  }

  // Option 6: Church Information & History (Main Menu 6 & Services 13)
  const isChurchInfoChoice = normalizedText === '6' || normalizedText === '13' ||
    /\b(church information|church info|about church|history|patron saint)\b/i.test(normalizedText) ||
    /(ஆலய விபரம்|பங்கு வரலாறு|புனிதர் வரலாறு|வரலாறு)/.test(rawText);

  if (isChurchInfoChoice) {
    const histMsg = `🏛️ *St. John de Britto's Church — Church Information*
_Kalayarkoil, Sivagangai Diocese_

👑 *Patron Saint:* St. John de Britto (Arulanandar)
🎉 *Patronal Feast Day:* February 4

St. John de Britto was a Portuguese Jesuit missionary who adopted local Indian ascetic customs and attire to proclaim the Gospel across Marava country before his martyrdom at Oriyur on February 4, 1693.

Our parish in Kalayarkoil stands as a historic sanctuary of faith, vibrant Anbiyams, and active pastoral ministries.

🌐 *Read Complete History & Info:* ${getSiteUrl(SITE_ROUTES.ABOUT)}`;

    await wa.sendWhatsAppMessage(replyTarget, histMsg);
    return;
  }

  // Option 7: Saint of the Day (Main Menu 7 & Services 6)
  const isSaintChoice = normalizedText === '7' ||
    /\b(saint|today saint|saint of the day|who is today saint|who is the saint today|today\'?s saint|saints)\b/i.test(normalizedText) ||
    /(இன்றைய புனிதர்|புனிதர் யார்|புனிதர்)/.test(rawText);

  if (isSaintChoice) {
    try {
      const dailyContent = await getCachedDailyContent();
      const saintImageUrl = dailyContent?.saintImage || dailyContent?.saint?.image || dailyContent?.saintOfTheDay?.english?.imageUrl;
      const saintInfoMsg = generateSaintInfoMessage({ dailyContent, language: session.language || 'en' });

      let sentMedia = false;
      if (saintImageUrl && typeof wa.sendWhatsAppMedia === 'function') {
        try {
          sentMedia = await wa.sendWhatsAppMedia(replyTarget, { url: saintImageUrl, caption: saintInfoMsg, mimetype: 'image/jpeg' });
        } catch (mErr) {
          console.warn('[BotHandler] Saint media send fallback:', mErr.message);
          sentMedia = false;
        }
      }

      if (!sentMedia) {
        await wa.sendWhatsAppMessage(replyTarget, saintInfoMsg);
      }
      return;
    } catch (sErr) {
      console.error('[BotHandler] Saint fetch error:', sErr.message);
    }
  }

  // Option 8: Help (Main Menu 8)
  const isHelpChoice = normalizedText === '8' ||
    /\b(help|commands|how to use|guide|options)\b/i.test(normalizedText) ||
    /(உதவி|வழிகாட்டி)/.test(rawText);

  if (isHelpChoice) {
    const helpMsg = `❓ *SJDB Connect — Help & Guidance*
_St. John de Britto's Church, Kalayarkoil_

📌 *Key Commands You Can Type Anytime:*
• *MENU* — Main Navigation Menu
• *SERVICES* — 14-Option Parish Services Directory
• *PREFERENCES* — Update your subscribed services
• *LANGUAGE* — Choose Tamil or English for Daily Catholic Devotions
• *TAMIL* — Set Catholic readings to Tamil
• *ENGLISH* — Set Catholic readings to English
• *STOP* — Unsubscribe from daily broadcasts

💡 You can reply with numbers 1 to 8 or type your questions naturally in English or Tamil!`;

    await wa.sendWhatsAppMessage(replyTarget, helpMsg);
    return;
  }

  // Option 10: Church Location & Google Maps
  const isLocationChoice = normalizedText === '10' ||
    /\b(where is the church|where is church|church location|location|how to reach|maps?)\b/i.test(normalizedText) ||
    /(அமைவிடம்|கோவில் எங்கு|ஆலயம் எங்கு|முகவரி)/.test(rawText);

  if (isLocationChoice) {
    const locMsg = `🏛️ *St. John de Britto's Church — Location*
Church Road, Kalayarkoil — 630551, Sivagangai District, Tamil Nadu, India.

🕒 *Visiting Hours:* Open daily from 5:30 AM to 8:00 PM

📍 *Google Maps Location Link:*
${EXTERNAL_LINKS.GOOGLE_MAPS}

🌐 ${getSiteUrl(SITE_ROUTES.CONTACT)}`;

    await wa.sendWhatsAppMessage(replyTarget, locMsg);
    return;
  }

  // Option 11: Parish Ministries & Anbiyams
  const isMinistriesChoice = normalizedText === '11' ||
    /\b(ministr(y|ies)|anbiyams?|council|choir|youth group|catechism)\b/i.test(normalizedText) ||
    /(அன்பியம்|அன்பியங்கள்|பங்கு அமைப்புகள்|பாடகர் குழு|இளைஞர் இயக்கம்)/.test(rawText);

  if (isMinistriesChoice) {
    const minMsg = `👥 *Parish Ministries & Anbiyams*

• 👥 *12 Active Anbiyams:* Ward family prayer cells
• 🏛️ *Parish Pastoral Council:* Pastoral leadership & guidance
• 🎶 *Parish Choir:* Tamil & English liturgical worship
• 🕯️ *Altar Servers Guild:* Serving at the Holy Altar
• 🌟 *Youth Movement (ICYM):* Active youth community & faith formation
• 📖 *Sunday Catechism:* Faith classes for children
• ❤️ *Society of St. Vincent de Paul:* Charity to the needy

🌐 *Read More:* ${getSiteUrl(SITE_ROUTES.ANBIYAMS)}`;

    await wa.sendWhatsAppMessage(replyTarget, minMsg);
    return;
  }

  // Option 12: Parish Priests & Clergy
  const isPriestsChoice = normalizedText === '12' ||
    /\b(priests?|parish priest|clergy|father)\b/i.test(normalizedText) ||
    /(பங்குத்தந்தை|அருட்தந்தை|குருக்கள்)/.test(rawText);

  if (isPriestsChoice) {
    try {
      const priests = await getCachedPriests();
      let pList = '';
      if (priests && priests.length > 0) {
        pList = priests.map(p => `• *${p.designation || 'Priest'}:* Rev. Fr. ${p.name} ${p.phone ? `(Ph: ${p.phone})` : ''}`).join('\n');
      } else {
        pList = `• *Parish Priest:* Rev. Fr. Parish Priest (Ph: +91 96556 39144)`;
      }

      const pMsg = `👑 *Parish Priests & Clergy*
_St. John de Britto's Church, Kalayarkoil_

${pList}

🌐 ${getSiteUrl(SITE_ROUTES.PRIESTS)}`;

      await wa.sendWhatsAppMessage(replyTarget, pMsg);
      return;
    } catch (pErr) {
      console.error('[BotHandler] Priests error:', pErr.message);
    }
  }

  // Option 13: Church History & Patron Saint
  const isHistoryChoice = normalizedText === '13' ||
    /\b(church history|saint history|about church|history|patron saint)\b/i.test(normalizedText) ||
    /(ஆலய வரலாறு|பங்கு வரலாறு|புனிதர் வரலாறு)/.test(rawText);

  if (isHistoryChoice) {
    const histMsg = `🏛️ *St. John de Britto's Church — History*
_Diocese of Sivagangai_

👑 *Patron Saint:* St. John de Britto (Arulanandar)
🎉 *Patronal Feast Day:* February 4

St. John de Britto was a Portuguese Jesuit missionary who adopted local Indian ascetic customs and attire to proclaim the Gospel across Marava country before his martyrdom at Oriyur on February 4, 1693.

Our parish in Kalayarkoil stands as a historic sanctuary of faith, vibrant Anbiyams, and active pastoral ministries.

🌐 *Read Complete History:* ${getSiteUrl(SITE_ROUTES.ABOUT)}`;

    await wa.sendWhatsAppMessage(replyTarget, histMsg);
    return;
  }

  // Option 14: Contact Church & Office Hours
  const isContactChoice = normalizedText === '14' ||
    /\b(contact|office hours|phone number|email|phone)\b/i.test(normalizedText) ||
    /(தொடர்பு|அலுவலக நேரம்|தொலைபேசி)/.test(rawText);

  if (isContactChoice) {
    const contactMsg = `📞 *Parish Contact & Office Hours*

🏛️ *Address:*
St. John de Britto's Church,
Church Road, Kalayarkoil — 630551,
Sivagangai District, Tamil Nadu, India.

📱 *Phone:* +91 96556 39144
📧 *Email:* arndas777@gmail.com
🕒 *Office Hours:* 9:00 AM – 1:00 PM & 4:00 PM – 7:00 PM

📍 *Google Maps Location Link:*
${EXTERNAL_LINKS.GOOGLE_MAPS}

🌐 ${getSiteUrl(SITE_ROUTES.CONTACT)}`;

    await wa.sendWhatsAppMessage(replyTarget, contactMsg);
    return;
  }

  // ── Natural Language Understanding via Church RAG Engine ────────────────────
  try {
    let linkedUser = null;
    if (session.linkedUserId) {
      linkedUser = await User.findById(session.linkedUserId).lean();
    } else if (session.providedPhone || session.phoneNumber) {
      const searchPhone = (session.providedPhone || session.phoneNumber).replace(/^91/, '').replace(/\D/g, '');
      linkedUser = await User.findOne({ phone: { $regex: new RegExp(searchPhone + '$') } }).lean();
    }

    const userAuthContext = { user: linkedUser, session };
    const ragResult = await answerChurchQuestion(rawText, 'en', userAuthContext);

    if (ragResult && ragResult.reply) {
      let sentMedia = false;
      if (ragResult.isSaintOfDayFlow && ragResult.imageUrl && typeof wa.sendWhatsAppMedia === 'function') {
        try {
          sentMedia = await wa.sendWhatsAppMedia(replyTarget, { url: ragResult.imageUrl, caption: ragResult.reply, mimetype: 'image/jpeg' });
        } catch (mErr) {
          console.warn('[BotHandler] RAG Saint media send fallback:', mErr.message);
          sentMedia = false;
        }
      }
      if (!sentMedia) {
        await wa.sendWhatsAppMessage(replyTarget, ragResult.reply);
      }
      return;
    }
  } catch (ragErr) {
    console.error('[BotHandler] RAG processing error:', ragErr.message);
  }

  // Fallback default helpful reply
  const fallbackMsg = getMainMenuMessage(session.pushName || '', isTamilQuery);
  await wa.sendWhatsAppMessage(replyTarget, fallbackMsg);
  } finally {
    activeSessionLocks.delete(lockKey);
  }
}

module.exports = {
  handleIncomingMessage,
  _clearDedupCacheForTesting: async () => {
    processedMessageIdsCache.clear();
    incomingMsgDeduplication.clear();
    activeSessionLocks.clear();
    try {
      if (require('mongoose').connection.readyState === 1) {
        await ProcessedMessage.deleteMany({});
      }
    } catch (e) {}
  }
};
