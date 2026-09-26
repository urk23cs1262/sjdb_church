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
const {
  generateDailyVerseCaption,
  generateDailyVerseMessage,
  generateDailyMassReadingsMessage,
  generateDailyReflectionMessage,
  getDailySaintImagePayload,
  generateSaintContentMessage,
  generateReadMoreMessage,
  generateDailyCatholicMessage,
  generateSaintCaption,
  generateSaintInfoMessage
} = require('../services/whatsappDailyFormatter');
const { getDailyVerseImage } = require('../services/bibleVerseImageService');
const { processIncomingMessage, isPhoneBlocked } = require('../services/userModerationService');
const { answerChurchQuestion } = require('./churchRAGService');
const { notifyAdmin } = require('../services/adminNotificationService');
const { SITE_ROUTES, EXTERNAL_LINKS, getSiteUrl, getBaseClientUrl } = require('../config/siteRoutes');
const {
  getCachedDailyContent,
  getCachedPriests,
  getCachedEvents,
  getCachedAnnouncements
} = require('./churchDataCache');
const {
  getStep1BotLanguageMessage,
  getStep2PhoneVerificationMessage,
  getStep3OTPVerificationMessage,
  getStep4And5PreferencesMessage,
  getStep6ContentLanguageMessage,
  getStep7AllSetMessage,
  getStep8MainMenuMessage,
  getHowToUseSJDBConnectMessage,
  parseBotLanguage,
  parsePhoneNumber,
  parseOTP,
  parsePreferences,
  parseContentLanguage
} = require('./botOnboardingFlow');

function getWA() {
  return require('./whatsapp');
}

// Fast In-Memory LRU / TTL Cache for Processed WhatsApp Message IDs (24 hours retention)
const processedMessageIdsCache = new Map();
// Fast In-Memory Sliding Window for Raw Incoming Message Text (prevents rapid double-taps)
const incomingMsgDeduplication = new Map();
// Cooldown map for blocked account restriction notices (prevents spamming/duplicate replies)
const blockedNoticeCooldown = new Map();
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
function getMainMenuMessage(userName, isTamil = false) {
  return getStep8MainMenuMessage(userName, isTamil ? 'ta' : 'en');
}

/**
 * Dedicated 1-13 Services & Help Desk Message (English & Tamil)
 */
function getServicesMenuMessage(isTamil = false) {
  if (isTamil) {
    return `⛪ *SJDB Connect – பங்கு சேவைகள் (Parish Services)*
_புனித அருளானந்தர் ஆலயம், காளையார்கோவில்_

1️⃣ ⛪ *திருப்பலி நேரங்கள்* (Mass Timings)
2️⃣ 🕊️ *ஒப்புரவு அருட்சாதனம்* (Confession Timings)
3️⃣ 📖 *தினசரி விவிலிய வசனம்* (Daily Bible Verse)
4️⃣ 📜 *திருப்பலி வாசகங்கள்* (Daily Mass Readings)
5️⃣ 🌟 *இன்றைய புனிதர்* (Saint of the Day)
6️⃣ 🙏 *கத்தோலிக்க செபங்கள்* (Catholic Prayers)
7️⃣ 📅 *பங்கு நிகழ்வுகள்* (Church Events)
8️⃣ 📢 *பங்கு அறிவிப்புகள்* (Parish Announcements)
9️⃣ 📍 *ஆலய அமைவிடம் & வரைபடம்* (Church Location & Map)
1️⃣0️⃣ 👥 *பங்கு அமைப்புகள் & அன்பியங்கள்* (Parish Ministries & Anbiyams)
1️⃣1️⃣ 👑 *பங்குத்தந்தையர்கள்* (Parish Priest & Clergy)
1️⃣2️⃣ 🏛️ *ஆலய வரலாறு* (Church History)
1️⃣3️⃣ 📞 *தொடர்பு விபரம்* (Contact Church)

👉 *1 முதல் 13 வரை உள்ள எண்ணை அழுத்தவும் அல்லது உங்கள் கேள்வியை நேரடியாகக் கேட்கவும்!*
_(எ.கா: "திருப்பலி நேரம்", "ஒப்புரவு நேரம்", "இன்றைய வாசகங்கள்")_`;
  }

  return `⛪ *SJDB Connect – Services & Help Desk*
_St. John de Britto Church, Kalayarkoil_

1️⃣ ⛪ *Mass Timings*
2️⃣ 🕊️ *Confession Timings*
3️⃣ 📖 *Daily Bible Verse*
4️⃣ 📜 *Daily Mass Readings*
5️⃣ 🌟 *Saint of the Day*
6️⃣ 🙏 *Catholic Prayers*
7️⃣ 📅 *Church Events*
8️⃣ 📢 *Parish Announcements*
9️⃣ 📍 *Church Location & Map*
1️⃣0️⃣ 👥 *Parish Ministries & Anbiyams*
1️⃣1️⃣ 👑 *Parish Priest & Clergy*
1️⃣2️⃣ 🏛️ *Church History*
1️⃣3️⃣ 📞 *Contact Church*

👉 *Reply with a number (1-13) or type your question naturally.*
_(e.g., "What time is Mass?", "Where is the church?", "Confession timings")_`;
}

/**
 * Safely and deterministically extracts menu numbers 1 to 13 from raw user inputs.
 * Supports:
 * - Plain digits: "1" to "13", "01" to "09"
 * - Punctuated/prefixed: "1.", "#1", "opt 1", "option 1", "(1)"
 * - WhatsApp Emoji numbers: "1️⃣" to "1️⃣3️⃣", "🔟", "1️⃣0️⃣"
 * - English word numbers: "one" to "thirteen"
 * - Tamil word numbers: "ஒன்று" to "பதின்மூன்று"
 * Strictly avoids matching 10-digit phone numbers, 6-digit OTPs, or numbers > 13.
 */
function extractMenuNumber(rawText) {
  if (!rawText) return null;
  const str = rawText.trim().toLowerCase();

  // 1. Direct emoji mapping (sort descending by length so 1️⃣0️⃣-1️⃣3️⃣ match before 1️⃣)
  const emojiMap = {
    '1️⃣0️⃣': 10, '1️⃣1️⃣': 11, '1️⃣2️⃣': 12, '1️⃣3️⃣': 13,
    '🔟': 10,
    '1️⃣': 1, '2️⃣': 2, '3️⃣': 3, '4️⃣': 4, '5️⃣': 5,
    '6️⃣': 6, '7️⃣': 7, '8️⃣': 8, '9️⃣': 9
  };
  const sortedEmojiKeys = Object.keys(emojiMap).sort((a, b) => b.length - a.length);
  for (const emoji of sortedEmojiKeys) {
    if (str === emoji || str.startsWith(emoji)) return emojiMap[emoji];
  }

  // 2. Exact word numbers in English and Tamil
  const wordMap = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13,
    'ஒன்று': 1, 'ஒன்னு': 1, 'இரண்டு': 2, 'ரெண்டு': 2, 'மூன்று': 3,
    'நான்கு': 4, 'நாலு': 4, 'ஐந்து': 5, 'அஞ்சு': 5, 'ஆறு': 6,
    'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10,
    'பதினொன்று': 11, 'பன்னிரண்டு': 12, 'பதின்மூன்று': 13
  };
  if (wordMap[str]) return wordMap[str];

  // 3. Regex for single/double digits: e.g. "1", "01", "1.", "#1", "opt 1", "option 1", "(1)"
  const digitMatch = str.match(/^(?:option\s*|opt\s*|choice\s*|#)?\(?(\d{1,2})\)?\.?$/i);
  if (digitMatch) {
    const n = parseInt(digitMatch[1], 10);
    if (n >= 1 && n <= 13) return n;
  }

  return null;
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
⏰ Daily Catholic broadcast is delivered sharply at *4:00 AM IST*.

May God bless you and your family! 🙏❤️
— *SJDB Connect*
_St. John de Britto Church, Kalayarkoil_

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

/**
 * Daily Catholic Content Menu (Options 1 to 6)
 */
function getDailyCatholicContentMenu(isTamil = false) {
  if (isTamil) {
    return `✝️ *SJDB Connect – Daily Catholic Content*
_புனித அருளானந்தர் ஆலயம், காளையார்கோவில்_

1. 📖 *Today's Bible Verse* (இன்றைய இறைவார்த்தை)
2. ✝️ *Daily Mass Readings* (திருப்பலி வாசகங்கள்)
3. 🕊️ *இன்றைய தியானம் (Daily Reflection)*
4. ✨ *Saint of the Day* (இன்றைய புனிதர்)
5. 🙏 *Daily Prayer* (இன்றைய செபம்)
6. 🌐 *Church Website* (ஆலய இணையதளம்)

👉 *1 முதல் 6 வரை உள்ள எண்ணை அழுத்தவும் அல்லது உங்கள் விருப்பத்தை நேரடியாகக் கேட்கவும்!*
_(எ.கா: "Today's Bible Verse", "இன்றைய தியானம்", "Saint of the Day")_`;
  }

  return `✝️ *SJDB Connect – Daily Catholic Content*
_St. John de Britto Church, Kalayarkoil_

1. 📖 *Today's Bible Verse*
2. ✝️ *Daily Mass Readings*
3. 🕊️ *இன்றைய தியானம் (Daily Reflection)*
4. ✨ *Saint of the Day*
5. 🙏 *Daily Prayer*
6. 🌐 *Church Website*

👉 *Reply with 1 to 6 or ask your question directly!*
_(e.g., "Today's Bible Verse", "Daily Reflection", "Today's Saint")_`;
}

function formatDailyPrayerMessage(dailyContent, isTamil = false) {
  const reflObj = isTamil ? dailyContent?.massReadings?.tamil?.reflection : dailyContent?.massReadings?.english?.reflection;
  const prayerText = reflObj?.prayer?.trim();
  if (prayerText) {
    return isTamil
      ? `🙏 *இன்றைய செபம் (Daily Prayer)*\n_புனித அருளானந்தர் ஆலயம், காளையார்கோவில்_\n\n${prayerText}\n\n✨ ஆமென்.`
      : `🙏 *Today's Prayer*\n_St. John de Britto Church, Kalayarkoil_\n\n${prayerText}\n\n✨ Amen.`;
  }
  return formatCatholicPrayersMessage(isTamil);
}

function formatSingleVerseMessage(dailyContent, isTamil) {
  const vEn = dailyContent?.bible?.english || '';
  const vTa = dailyContent?.bible?.tamil || '';
  const ref = dailyContent?.bible?.ref || 'Holy Bible';
  const verseText = isTamil ? (vTa || vEn) : (vEn || vTa);

  return isTamil
    ? `📖 *இன்றைய இறைவார்த்தை*\n\n"${verseText}"\n— _${ref}_\n\n🌐 *இணையத்தில் வாசிக்க:* ${getSiteUrl(SITE_ROUTES.DAILY_VERSE)}`
    : `📖 *Daily Bible Verse*\n\n"${verseText}"\n— _${ref}_\n\n🌐 *Read online:* ${getSiteUrl(SITE_ROUTES.DAILY_VERSE)}`;
}

function formatSingleReadingsMessage(dailyContent, isTamil) {
  const taReadings = dailyContent?.massReadings?.tamil || {};
  const enReadings = dailyContent?.massReadings?.english || {};

  const firstR = isTamil ? (taReadings.firstReading || enReadings.firstReading) : (enReadings.firstReading || taReadings.firstReading);
  const psalmR = isTamil ? (taReadings.psalm || enReadings.psalm) : (enReadings.psalm || taReadings.psalm);
  const secondR = isTamil ? (taReadings.secondReading || enReadings.secondReading) : (enReadings.secondReading || taReadings.secondReading);
  const gospelR = isTamil ? (taReadings.gospel || enReadings.gospel) : (enReadings.gospel || taReadings.gospel);

  const dateStr = isTamil
    ? new Date().toLocaleDateString('ta-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  let body = `📜 *${isTamil ? 'இன்றைய திருப்பலி வாசகங்கள்' : 'Daily Mass Readings'}*\n📅 ${dateStr}\n\n`;
  body += `*${isTamil ? 'முதல் வாசகம்' : 'First Reading'}:*\n${firstR || (isTamil ? 'வாசகம் கிடைக்கவில்லை.' : 'Not available')}\n\n`;
  body += `*${isTamil ? 'திருப்பாடல்' : 'Responsorial Psalm'}:*\n${psalmR || (isTamil ? 'திருப்பாடல் கிடைக்கவில்லை.' : 'Not available')}\n\n`;
  if (secondR) {
    body += `*${isTamil ? 'இரண்டாம் வாசகம்' : 'Second Reading'}:*\n${secondR}\n\n`;
  }
  body += `✝️ *${isTamil ? 'நற்செய்தி வாசகம்' : 'Holy Gospel'}:*\n${gospelR || (isTamil ? 'நற்செய்தி கிடைக்கவில்லை.' : 'Not available')}\n\n`;
  body += `🌐 *${isTamil ? 'முழு வாசகங்கள் இணையத்தில்' : 'Read Full Readings Online'}:* ${getSiteUrl(SITE_ROUTES.DAILY_READINGS)}`;

  return body;
}

function formatSingleReflectionMessage(dailyContent, isTamil) {
  const reflEn = dailyContent?.reflection?.english || '';
  const reflTa = dailyContent?.reflection?.tamil || '';
  const reflectionText = isTamil ? (reflTa || reflEn) : (reflEn || reflTa);

  return isTamil
    ? `🕊️ *இன்றைய தியானம் (Daily Reflection)*\n\n${reflectionText || 'இறைவனின் வார்த்தை நம் வாழ்வின் வெளிச்சம்.'}\n\n🌐 *இணையத்தில் வாசிக்க:* ${getSiteUrl(SITE_ROUTES.DAILY_REFLECTION)}`
    : `🕊️ *Daily Reflection*\n\n${reflectionText || 'The word of God is a light unto our path.'}\n\n🌐 *Read online:* ${getSiteUrl(SITE_ROUTES.DAILY_REFLECTION)}`;
}

function formatCatholicPrayersMessage(isTamil = false) {
  if (isTamil) {
    return `🙏 *அடிப்படை கத்தோலிக்க செபங்கள் (Catholic Prayers)*
_புனித அருளானந்தர் ஆலயம், காளையார்கோவில்_

✝️ *சிலுவை அடையாளம்:*
தந்தை, மகன், தூய ஆவியாரின் பெயராலே. ஆமென்.

🕊️ *கர்த்தர் கற்பித்த செபம் (பரலோக மந்திரம்):*
விண்ணுலகில் இருக்கிற எங்கள் தந்தையே,உமது பெயர் தூயது எனப் போற்றப்பெறுக!உமது ஆட்சி வருக!உமது திருவுளம் விண்ணுலகில் நிறைவேறுவது போல மண்ணுலகிலும் நிறைவேறுக!எங்கள் அன்றாட உணவை இன்று எங்களுக்குத் தாரும்.எங்களுக்கு எதிராகக் குற்றம் செய்வோரை நாங்கள் மன்னிப்பது போல,எங்கள் குற்றங்களை மன்னியும்.எங்களைச் சோதனைக்கு உட்படுத்தாதேயும்,தீமையிலிருந்து எங்களை விடுவித்தருளும். — ஆமென்

🌹 *மங்கள வார்த்தை செபம்:*
அருள் நிறைந்த மரியே வாழ்க! கர்த்தர் உம்முடனே. பெண்களுள் ஆசீர்வதிக்கப்பட்டவர் நீரே, உம்முடைய திருவயிற்றின் கனியாகிய இயேசுவும் ஆசீர்வதிக்கப்பட்டவரே.
புனித மரியே, இறைவனின் தாயே, பாவிகளாய் இருக்கிற எங்களுக்காக இப்பொழுதும் எங்கள் இறப்பின் வேளையிலும் வேண்டிக்கொள்ளும். ஆமென்.

✨ *திரித்துவப் புகழ்:*
தந்தைக்கும் மகனுக்கும் தூய ஆவியாருக்கும் ஆட்சிமை உண்டாவதாக. தொடக்கத்தில் இருந்தது போல இப்பொழுதும் எப்பொழுதும் என்றென்றும் இருப்பதாக. ஆமென்.

📿 *புனித ஜெபமாலை தேவ இரகசியங்கள்:*
• *மகிழ்ச்சி நிறை இரகசியங்கள்* (திங்கள் & சனி)
• *துயரம் நிறை இரகசியங்கள்* (செவ்வாய் & வெள்ளி)
• *ஒளி நிறை இரகசியங்கள்* (வியாழன்)
• *மகிமை நிறை இரகசியங்கள்* (புதன் & ஞாயிறு)

🌐 *ஜெபமாலை செபிக்க & பாடல்கள் கேட்க:* ${getSiteUrl(SITE_ROUTES.ROSARY)}`;
  }

  return `🙏 *Catholic Prayers & Holy Rosary*
_St. John de Britto Church, Kalayarkoil_

✝️ *The Sign of the Cross:*
In the name of the Father, and of the Son, and of the Holy Spirit. Amen.

🕊️ *The Lord's Prayer (Our Father):*
Our Father, who art in heaven, hallowed be Thy name; Thy kingdom come; Thy will be done on earth as it is in heaven.
Give us this day our daily bread; and forgive us our trespasses as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen.

🌹 *Hail Mary:*
Hail Mary, full of grace, the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus.
Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

✨ *Glory Be:*
Glory be to the Father, and to the Son, and to the Holy Spirit. As it was in the beginning, is now, and ever shall be, world without end. Amen.

📿 *Mysteries of the Holy Rosary:*
• *Joyful Mysteries* (Monday & Saturday)
• *Sorrowful Mysteries* (Tuesday & Friday)
• *Luminous Mysteries* (Thursday)
• *Glorious Mysteries* (Wednesday & Sunday)

🌐 *Pray the Rosary & Devotional Songs:* ${getSiteUrl(SITE_ROUTES.ROSARY)}`;
}

/**
 * Individual Dispatcher: Send Today's Bible Verse as an Image ONLY
 */
async function sendTodayBibleVerse(replyTarget, session, wa, isTamilQuery = false) {
  try {
    const dailyContent = await getCachedDailyContent();
    session.invalidInputStreak = 0;
    session.lastBotReplyType = 'VERSE';
    session.pendingSubmenu = '';
    session.lastSentAt = new Date();
    await session.save();

    let sentImage = false;
    try {
      const verseImg = await getDailyVerseImage({ dailyContent, dateKey: dailyContent?.dateKey });
      if (verseImg?.buffer && typeof wa.sendWhatsAppMedia === 'function') {
        const verseCaption = generateDailyVerseCaption({ dailyContent });
        sentImage = await wa.sendWhatsAppMedia(replyTarget, {
          buffer: verseImg.buffer,
          mimetype: 'image/png',
          caption: verseCaption
        });
      }
    } catch (imgErr) {
      console.warn('[BotHandler] Verse image send error:', imgErr.message);
    }

    if (!sentImage) {
      const userLang = session.language || (isTamilQuery ? 'ta' : 'en');
      const fallbackMsg = generateDailyVerseMessage({ dailyContent, language: userLang });
      await wa.sendWhatsAppMessage(replyTarget, fallbackMsg);
    }
  } catch (err) {
    console.error('[BotHandler] Bible verse error:', err.message);
  }
}

/**
 * Individual Dispatcher: Send Daily Mass Readings Text ONLY
 */
async function sendTodayMassReadings(replyTarget, session, wa, isTamilQuery = false) {
  try {
    const dailyContent = await getCachedDailyContent();
    const userLang = session.language || (isTamilQuery ? 'ta' : 'en');
    session.invalidInputStreak = 0;
    session.lastBotReplyType = 'READINGS';
    session.pendingSubmenu = '';
    session.lastSentAt = new Date();
    await session.save();

    const readingsMsg = generateDailyMassReadingsMessage({
      dailyContent,
      language: userLang,
      readingPreference: session.readingPreference || 'full'
    });
    await wa.sendWhatsAppMessage(replyTarget, readingsMsg);
  } catch (err) {
    console.error('[BotHandler] Mass readings error:', err.message);
  }
}

/**
 * Individual Dispatcher: Send Daily Reflection Text ONLY
 */
async function sendTodayDailyReflection(replyTarget, session, wa, isTamilQuery = false) {
  try {
    const dailyContent = await getCachedDailyContent();
    const userLang = session.language || (isTamilQuery ? 'ta' : 'en');
    session.invalidInputStreak = 0;
    session.lastBotReplyType = 'REFLECTION';
    session.pendingSubmenu = '';
    session.lastSentAt = new Date();
    await session.save();

    const reflMsg = generateDailyReflectionMessage({
      dailyContent,
      language: userLang
    });
    await wa.sendWhatsAppMessage(replyTarget, reflMsg);
  } catch (err) {
    console.error('[BotHandler] Daily reflection error:', err.message);
  }
}

/**
 * Individual Dispatcher: Send Saint of the Day (1. Saint Image -> 2. Saint Content)
 */
async function sendTodaySaint(replyTarget, session, wa, isTamilQuery = false) {
  try {
    const dailyContent = await getCachedDailyContent();
    const userLang = session.language || (isTamilQuery ? 'ta' : 'en');
    session.invalidInputStreak = 0;
    session.lastBotReplyType = 'SAINT';
    session.pendingSubmenu = '';
    session.lastSentAt = new Date();
    await session.save();

    // 1. Saint of the Day Image (separate message)
    const saintImagePayload = getDailySaintImagePayload({ dailyContent });
    if (saintImagePayload && typeof wa.sendWhatsAppMedia === 'function') {
      try {
        await wa.sendWhatsAppMedia(replyTarget, saintImagePayload);
        await new Promise(r => setTimeout(r, 650));
      } catch (mediaErr) {
        console.warn('[BotHandler] Saint media send error:', mediaErr.message);
      }
    }

    // 2. Saint of the Day Content (separate message)
    const saintContentMsg = generateSaintContentMessage({
      dailyContent,
      language: userLang
    });
    await wa.sendWhatsAppMessage(replyTarget, saintContentMsg);
  } catch (err) {
    console.error('[BotHandler] Saint of the day error:', err.message);
  }
}

/**
 * Individual Dispatcher: Send Daily Prayer
 */
async function sendTodayPrayer(replyTarget, session, wa, isTamilQuery = false) {
  try {
    const dailyContent = await getCachedDailyContent();
    const userLang = session.language || (isTamilQuery ? 'ta' : 'en');
    session.invalidInputStreak = 0;
    session.lastBotReplyType = 'PRAYERS';
    session.pendingSubmenu = '';
    session.lastSentAt = new Date();
    await session.save();

    const isTa = userLang === 'ta' || isTamilQuery;
    const prayerMsg = formatDailyPrayerMessage(dailyContent, isTa);
    await wa.sendWhatsAppMessage(replyTarget, prayerMsg);
  } catch (err) {
    console.error('[BotHandler] Daily prayer error:', err.message);
  }
}

/**
 * Individual Dispatcher: Send Church Website Link
 */
async function sendChurchWebsite(replyTarget, session, wa, isTamilQuery = false) {
  try {
    session.invalidInputStreak = 0;
    session.lastBotReplyType = 'WEBSITE';
    session.pendingSubmenu = '';
    session.lastSentAt = new Date();
    await session.save();

    const churchUrl = getBaseClientUrl();
    const websiteMsg = isTamilQuery
      ? `🌐 *புனித ஜான் டி பிரிட்டோ திருத்தலம் — இணையதளம்*\n\nஎமது ஆலய நிகழ்வுகள், திருப்பலி நேரங்கள், வாசகங்கள் மற்றும் ஆன்மீக தகவல்களை அறிய:\n${churchUrl}`
      : `🌐 *St. John de Britto Church — Official Website*\n\nExplore our parish events, Mass timings, daily readings and Catholic devotions online:\n${churchUrl}`;
    await wa.sendWhatsAppMessage(replyTarget, websiteMsg);
  } catch (err) {
    console.error('[BotHandler] Church website error:', err.message);
  }
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
    await wa.sendWhatsAppMessage(replyTarget, `📖 *Daily Vatican News & Devotions*\n\nView today's Mass readings, verse and reflection online:\n${getSiteUrl(SITE_ROUTES.DAILY_READINGS)}`);
  }
}

async function handleIncomingMessage(fromNumber, body, rawJid, pushName, messageId = null, messageTimestamp = null) {
  const rawText = (body || '').trim();
  if (!rawText) return;

  const replyTarget = rawJid || fromNumber;
  const phone = (fromNumber || '').replace('whatsapp:', '').replace(/\D/g, '');
  const sessionKey = (fromNumber && fromNumber.includes('@lid')) ? fromNumber : (phone || fromNumber);
  const wa = getWA();

  // 1. EARLY ATOMIC INCOMING MESSAGE DEDUPLICATION (Drops duplicate Baileys webhooks/reconnect retries)
  if (messageId) {
    if (isDuplicateMessageId(messageId)) {
      console.log(`[INCOMING] Skipped duplicate WhatsApp message ID (cache): ${messageId}`);
      return;
    }

    try {
      await ProcessedMessage.create({ messageId, from: sessionKey, bodyPreview: rawText.slice(0, 100) });
      markMessageIdProcessed(messageId);
    } catch (pmErr) {
      if (pmErr.code === 11000 || pmErr.message?.includes('duplicate key')) {
        console.log(`[INCOMING] Skipped duplicate WhatsApp message ID (DB constraint): ${messageId}`);
        markMessageIdProcessed(messageId);
        return;
      }
    }
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

    // Record messageId in session for session-level audit trail
    if (messageId) {
      if (!session.processedMessageIds) session.processedMessageIds = [];
      if (!session.processedMessageIds.includes(messageId)) {
        session.processedMessageIds.push(messageId);
        if (session.processedMessageIds.length > 50) {
          session.processedMessageIds.shift();
        }
      }
      session.lastProcessedMessageId = messageId;
    }

    // 4. AUTO-LINK REGISTERED PARISHIONER
    // Link user ID for database context, but NEVER hijack an active onboarding step (bot_language, phone_verification, otp_verification, preferences, language)
    const phone10 = (session.providedPhone || phone || sessionKey || '').replace(/\D/g, '').slice(-10);
    if (!session.linkedUserId && phone10 && phone10.length >= 10) {
      const registeredUser = await User.findOne({
        phone: { $regex: phone10 + '$' },
        isActive: { $ne: false }
      }).lean();

      if (registeredUser) {
        console.log(`[BotHandler] Linking registered parishioner ${registeredUser.name} (${phone10}) to WhatsApp session.`);
        session.linkedUserId = registeredUser._id;
        if (!session.providedPhone) session.providedPhone = registeredUser.phone || phone10;
        await session.save();
      }
    }

    // 5. SELF-HEALING / STATE REPAIR:
    // If user's session was prematurely marked 'done' without completing preferences or Catholic content language,
    // restore them back to 'preferences' so their reply (e.g. '7' for all preferences) is correctly processed.
    const hasPreferences = Array.isArray(session.preferences) && session.preferences.length > 0;
    if (session.step === 'done' && !hasPreferences && session.isVerified) {
      console.log(`[BotHandler] 🔄 Self-healing corrupted session for ${session.phoneNumber} back to 'preferences' step.`);
      session.step = 'preferences';
      session.isOnboarded = false;
      await session.save();
    }

    session.lastMessage = new Date();

    // ── Centralized Abuse & Moderation Gate ─────────────────────────────────────
    const senderIdentity = (session && session.providedPhone) ? session.providedPhone : (phone || fromNumber);
    const modResult = await processIncomingMessage({
      phoneNumber: senderIdentity,
      displayName: pushName || sessionKey,
      messageText: rawText,
      messageId,
      userId: session?.linkedUserId || null
    });

    if (modResult.isBlocked || modResult.isViolation) {
      if (modResult.replyMessage) {
        // Apply cooldown only when user is already blocked and sending non-violation chatter,
        // NEVER suppress a fresh strike warning or fresh block notification!
        if (modResult.isBlocked && !modResult.isViolation) {
          const clean10 = (senderIdentity || sessionKey || '').replace(/\D/g, '').slice(-10);
          const lastNotice = blockedNoticeCooldown.get(clean10);
          const now = Date.now();
          if (lastNotice && (now - lastNotice) < 30000) {
            console.log(`⚡ [BotHandler] Dropping duplicate restricted account reply to ${clean10} (within 30s cooldown)`);
            return;
          }
          blockedNoticeCooldown.set(clean10, now);
        }
        await wa.sendWhatsAppMessage(replyTarget, modResult.replyMessage);
      }
      return;
    }

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

    const isStopCommand = rawText.toUpperCase() === 'STOP' || rawText.toUpperCase() === 'UNSUBSCRIBE';
    if (isStopCommand) {
      session.step = 'stopped';
      session.isOnboarded = false;
      session.preferences = [];
      await session.save();

      if (session.linkedUserId) {
        try {
          await User.findByIdAndUpdate(session.linkedUserId, { whatsappOptIn: false, botPreferences: [] });
        } catch (e) { }
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

— *St. John de Britto Church, Kalayarkoil*
_SJDB Connect_`;
          await wa.sendWhatsAppMessage(replyTarget, emergencyMsg);
          return;
        }

        const maintMsg = `🔧 *SJDB Connect is Temporarily Unavailable*

Our church digital services are currently under maintenance.
The WhatsApp Bot is temporarily unavailable while we carry out scheduled maintenance and improvements.

Please try again later. Thank you for your patience.

— *St. John de Britto Church, Kalayarkoil*
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

    const normalizedText = rawText.toLowerCase().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    const isTamilQuery = /[\u0B80-\u0BFF]/.test(rawText) || session.language === 'ta' || session.botLanguage === 'ta';
    const menuNum = extractMenuNumber(rawText);

    // ── Re-Verification Command ────────────────────────────────────────────────
    const isVerifyCommand = /^(verify|reverify|reset|restart|சரிபார்|மீண்டும் சரிபார்)$/i.test(normalizedText);
    if (isVerifyCommand) {
      session.isVerified = false;
      session.isOnboarded = false;
      session.step = 'bot_language';
      session.pendingOtp = '';
      session.otpAttempts = 0;
      await session.save();

      await wa.sendWhatsAppMessage(replyTarget, getStep1BotLanguageMessage());
      return;
    }

    // ── Single Authoritative Onboarding & Preference Flow ────────────────
    if (!session.isOnboarded || session.step === 'preferences' || session.step === 'language') {
      // 1️⃣ Step 1: Bot Language
      if (!session.step || session.step === 'welcome' || session.step === 'bot_language') {
        if (session.step === 'bot_language') {
          const chosenBotLang = parseBotLanguage(rawText);
          if (chosenBotLang) {
            session.botLanguage = chosenBotLang;
            session.step = 'phone_verification';
            await session.save();
            await wa.sendWhatsAppMessage(replyTarget, getStep2PhoneVerificationMessage(session.botLanguage));
            return;
          }
          // Invalid choice for bot language
          const invalidMsg = session.botLanguage === 'ta'
            ? `⚠️ தயவுசெய்து *1* (English) அல்லது *2* (தமிழ்) என பதிலளிக்கவும்.\n\n` + getStep1BotLanguageMessage()
            : `⚠️ Please reply with *1* for English or *2* for தமிழ் (Tamil).\n\n` + getStep1BotLanguageMessage();
          await wa.sendWhatsAppMessage(replyTarget, invalidMsg);
          return;
        }

        // Fresh user or 'welcome': Send Step 1 Bot Language prompt
        session.step = 'bot_language';
        await session.save();
        await wa.sendWhatsAppMessage(replyTarget, getStep1BotLanguageMessage());
        return;
      }

      // 2️⃣ Step 2: Phone Number Verification
      if (session.step === 'phone_verification' || session.step === 'ask_phone') {
        const clean10 = parsePhoneNumber(rawText);
        if (!clean10) {
          const phoneRetryMsg = session.botLanguage === 'ta'
            ? `⚠️ தவறான எண். தயவுசெய்து சரியான **10 இலக்க மொபைல் எண்ணை** உள்ளிடவும் (எ.கா: *9876543210*):`
            : `⚠️ Invalid number. Please enter a valid **10-digit mobile phone number** (e.g., *9876543210*):`;
          await wa.sendWhatsAppMessage(replyTarget, phoneRetryMsg);
          return;
        }

        if (await isPhoneBlocked(clean10)) {
          const restrictedMsg = `🚫 *SJDB Connect — Account Restricted*\n\nYour account is currently restricted due to policy violations. All bot services, messages, and parish notifications have been suspended.\n\n• To restore your account and resume services, please contact the church administrator.`;
          await wa.sendWhatsAppMessage(replyTarget, restrictedMsg);
          return;
        }

        // 3️⃣ Generate OTP and transition to OTP Verification
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        session.pendingPhone = clean10;
        session.pendingOtp = otp;
        session.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
        session.otpAttempts = 0;
        session.step = 'otp_verification';
        await session.save();

        await wa.sendWhatsAppMessage(replyTarget, getStep3OTPVerificationMessage(clean10, otp, session.botLanguage));
        return;
      }

      // 3️⃣ Step 3: OTP Verification
      if (session.step === 'otp_verification') {
        if (/^(change|back|மாற்று|திரும்பு)$/i.test(normalizedText)) {
          session.step = 'phone_verification';
          await session.save();
          await wa.sendWhatsAppMessage(replyTarget, getStep2PhoneVerificationMessage(session.botLanguage));
          return;
        }

        if (/^(resend|resend otp|மீண்டும் அனுப்பு)$/i.test(normalizedText)) {
          const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
          session.pendingOtp = newOtp;
          session.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
          session.otpAttempts = 0;
          await session.save();
          const resendPrefix = session.botLanguage === 'ta' ? `🔄 புதிய OTP குறியீடு!\n\n` : `🔄 Fresh OTP code issued!\n\n`;
          await wa.sendWhatsAppMessage(replyTarget, resendPrefix + getStep3OTPVerificationMessage(session.pendingPhone, newOtp, session.botLanguage));
          return;
        }

        if (session.otpExpiresAt && Date.now() > new Date(session.otpExpiresAt).getTime()) {
          const expiredMsg = session.botLanguage === 'ta'
            ? `⌛ OTP காலாவதியாகிவிட்டது. புதிய குறியீட்டைப் பெற *RESEND* என தட்டச்சு செய்யவும்.`
            : `⌛ This OTP has expired. Please reply with *RESEND* to receive a new code.`;
          await wa.sendWhatsAppMessage(replyTarget, expiredMsg);
          return;
        }

        const inputOtp = parseOTP(rawText);
        if (inputOtp && inputOtp === session.pendingOtp) {
          // 4️⃣ Phone Number Verified!
          session.isVerified = true;
          session.providedPhone = session.pendingPhone;
          session.pendingOtp = '';
          session.otpAttempts = 0;
          session.step = 'preferences';

          const cleanPhone = (session.providedPhone || '').replace(/\D/g, '').slice(-10);
          const parishUser = (cleanPhone && cleanPhone.length >= 10)
            ? await User.findOne({ phone: { $regex: cleanPhone + '$' }, isActive: { $ne: false } }).lean()
            : null;
          if (parishUser) {
            session.linkedUserId = parishUser._id;
          } else {
            session.linkedUserId = null;
          }
          await session.save();

          // Send 4️⃣ Phone Number Verified + 5️⃣ SJDB Connect Preferences
          const step4And5Msg = getStep4And5PreferencesMessage(session.providedPhone, parishUser, session.botLanguage);
          await wa.sendWhatsAppMessage(replyTarget, step4And5Msg);
          return;
        }

        session.otpAttempts = (session.otpAttempts || 0) + 1;
        if (session.otpAttempts >= 5) {
          session.step = 'phone_verification';
          session.pendingOtp = '';
          session.otpAttempts = 0;
          await session.save();
          const maxAttemptsMsg = session.botLanguage === 'ta'
            ? `❌ தவறான OTP அதிக முறை உள்ளிடப்பட்டது. தயவுசெய்து உங்கள் 10 இலக்க மொபைல் எண்ணை மீண்டும் உள்ளிடவும்:`
            : `❌ Too many incorrect attempts. Please re-enter your 10-digit mobile phone number to request a new code:`;
          await wa.sendWhatsAppMessage(replyTarget, maxAttemptsMsg);
          return;
        }

        await session.save();
        const remaining = 5 - session.otpAttempts;
        const wrongOtpMsg = session.botLanguage === 'ta'
          ? `❌ தவறான OTP குறியீடு. மேலும் ${remaining} வாய்ப்புகள் உள்ளன.\nதயவுசெய்து சரியான 6 இலக்க OTP குறியீட்டை உள்ளிடவும் (அல்லது புதிய குறியீட்டிற்கு *RESEND* என அனுப்பவும்):`
          : `❌ Incorrect OTP code. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.\nPlease enter the 6-digit OTP code (or reply *RESEND* for a new code):`;
        await wa.sendWhatsAppMessage(replyTarget, wrongOtpMsg);
        return;
      }

      // 5️⃣ Step 5: Preferences Selection
      if (session.step === 'preferences') {
        const selectedPrefs = parsePreferences(rawText);
        if (selectedPrefs) {
          session.preferences = selectedPrefs;
          session.step = 'language';
          await session.save();

          if (session.linkedUserId) {
            try {
              await User.findByIdAndUpdate(session.linkedUserId, {
                botPreferences: selectedPrefs,
                whatsappOptIn: true
              });
            } catch (e) { }
          }

          // 6️⃣ Daily Catholic Content Language
          await wa.sendWhatsAppMessage(replyTarget, getStep6ContentLanguageMessage(session.botLanguage));
          return;
        }

        const retryMsg = session.botLanguage === 'ta'
          ? `⚠️ தவறான தேர்வு. எண்களை காற்புள்ளியுடன் அனுப்பவும் (எ.கா: *1,2,3*) அல்லது அனைத்திற்கும் *7* என அனுப்பவும்.\n\n` + getStep4And5PreferencesMessage(session.providedPhone, null, session.botLanguage)
          : `⚠️ Invalid selection. Please reply with numbers separated by commas (e.g., *1,2,3*) or reply *7* for *ALL*.\n\n` + getStep4And5PreferencesMessage(session.providedPhone, null, session.botLanguage);
        await wa.sendWhatsAppMessage(replyTarget, retryMsg);
        return;
      }

      // 6️⃣ Step 6: Daily Catholic Content Language
      if (session.step === 'language') {
        const chosenLang = parseContentLanguage(rawText);
        if (chosenLang) {
          session.language = chosenLang;
          session.step = 'done';
          session.isOnboarded = true;
          await session.save();

          // Search the provided number whether present in the website database or not
          let parishUser = null;
          if (session.linkedUserId) {
            try {
              parishUser = await User.findById(session.linkedUserId).lean();
            } catch (e) { }
          }
          if (!parishUser && (session.providedPhone || session.phoneNumber)) {
            const rawPhone = session.providedPhone || session.phoneNumber;
            const clean10 = rawPhone.replace(/\D/g, '').slice(-10);
            if (clean10 && clean10.length >= 10) {
              try {
                parishUser = await User.findOne({
                  phone: { $regex: clean10 + '$' },
                  isActive: { $ne: false }
                }).lean();
                if (parishUser) {
                  session.linkedUserId = parishUser._id;
                  await session.save();
                }
              } catch (e) { }
            }
          }

          if (session.linkedUserId) {
            try {
              await User.findByIdAndUpdate(session.linkedUserId, {
                language: chosenLang,
                mass_reflection_language: chosenLang,
                preferredLanguage: chosenLang,
                botPreferences: session.preferences,
                whatsappOptIn: true
              });
            } catch (lErr) { }
          }

          const hasWebsiteAccount = Boolean(parishUser);

          // 7️⃣ Step 7: You're All Set!
          const allSetMsg = getStep7AllSetMessage(session.preferences, session.language, session.botLanguage, hasWebsiteAccount);
          await wa.sendWhatsAppMessage(replyTarget, allSetMsg);

          // 📖 "How to use SJDB Connect" (sent in a separate message immediately after You're All Set)
          await new Promise(r => setTimeout(r, 450));
          const howToUseMsg = getHowToUseSJDBConnectMessage(session.botLanguage);
          await wa.sendWhatsAppMessage(replyTarget, howToUseMsg);
          return;
        }

        const langRetryMsg = session.botLanguage === 'ta'
          ? `⚠️ தயவுசெய்து *1*, *2*, அல்லது *3* என பதிலளிக்கவும்:\n\n1️⃣ தமிழ் (Tamil)\n2️⃣ English\n3️⃣ Both (Tamil + English)`
          : `⚠️ Please reply with *1*, *2*, or *3* to choose your Daily Catholic Content language:\n\n1️⃣ Tamil (Tamil)\n2️⃣ English\n3️⃣ Both (Tamil + English)`;
        await wa.sendWhatsAppMessage(replyTarget, langRetryMsg);
        return;
      }
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
      session.invalidInputStreak = 0;
      session.lastBotReplyType = 'SERVICES';
      session.lastSentAt = new Date();
      await session.save();
      const servicesMsg = getServicesMenuMessage();
      await wa.sendWhatsAppMessage(replyTarget, servicesMsg);
      return;
    }

    // ── 2A. CASUAL GREETINGS & PRAISES (Hi, Hello, Hey, வணக்கம், Praise the Lord) ─────
    const isGreeting = /^(hi|hello|hey|hai|hlo|வணக்கம்|vanakkam|good morning|good evening|good afternoon|praise the lord|praised be jesus|இயேசுவுக்கே புகழ்|கிறிஸ்துவுக்கே புகழ்|பிரைஸ் தி லார்ட்|ave maria|halleluiah|அல்லேலூயா)$/i.test(normalizedText) ||
      /\b(praise the lord|praised be jesus|இயேசுவுக்கே புகழ்|கிறிஸ்துவுக்கே புகழ்)\b/i.test(normalizedText);

    if (isGreeting) {
      let linkedUser = null;
      if (session.linkedUserId) {
        linkedUser = await User.findById(session.linkedUserId);
      } else if (session.providedPhone || phone) {
        const searchPhone = (session.providedPhone || phone).slice(-10);
        linkedUser = await User.findOne({ phone: { $regex: searchPhone + '$' } });
      }

      const userName = linkedUser ? linkedUser.name : (pushName || '');
      session.invalidInputStreak = 0;

      // Check if user recently received a greeting reply (within 60s) to avoid repeating identical text
      if (session.lastBotReplyType === 'GREETING' && session.lastSentAt && (Date.now() - new Date(session.lastSentAt).getTime()) < 60000) {
        const conciseAck = isTamilQuery
          ? `வணக்கம்! இன்று நான் உங்களுக்கு எவ்வாறு உதவ முடியும்? (கட்டளைகளுக்கு *Menu* என தட்டச்சு செய்யவும்)`
          : `Hello! How can I assist you right now? (Type *Menu* for quick commands or ask your question.)`;
        await wa.sendWhatsAppMessage(replyTarget, conciseAck);
        return;
      }

      session.lastBotReplyType = 'GREETING';
      session.lastSentAt = new Date();
      await session.save();

      const isPraise = /\b(praise the lord|இயேசுவுக்கே புகழ்|கிறிஸ்துவுக்கே புகழ்|பிரைஸ் தி லார்ட்)\b/i.test(normalizedText);
      const greetingHeader = isPraise
        ? (isTamilQuery ? `✝️ *இயேசுவுக்கே புகழ்! (Praise the Lord!)*` : `✝️ *Praise the Lord!*`)
        : (isTamilQuery ? `👋 *வணக்கம் ${userName ? `${userName}! ` : ''}*` : `👋 *Hello ${userName ? `${userName}! ` : ''}*`);

      const greetingMsg = isTamilQuery
        ? `${greetingHeader}\nபுனித அருளானந்தர் ஆலயம் உங்களை அன்புடன் வரவேற்கிறது. இன்று நான் உங்களுக்கு எவ்வாறு உதவ முடியும்? 🙏\n\n• முக்கிய கட்டளைகளைக் காண *Menu* என தட்டச்சு செய்யவும்\n• பங்கு சேவைகளைப் பார்க்க *Services* என தட்டச்சு செய்யவும்\n• அல்லது விவிலியம், திருப்பலி நேரங்கள் குறித்து நேரடியாகக் கேட்கவும்.`
        : `${greetingHeader}\nWelcome to St. John de Britto Church, Kalayarkoil. How can I help you today? 🙏\n\n• Type *Menu* to view quick commands\n• Type *Services* for the 13-service help desk\n• Or ask any church question naturally.`;

      await wa.sendWhatsAppMessage(replyTarget, greetingMsg);
      return;
    }

    // ── 2A-1. GRATITUDE & THANKS (Thank you, Thanks, நன்றி, God bless) ───────────────────────
    const isThanks = /^(thanks?|thank you|thank u|thx|நன்றி|மிக்க நன்றி|ரொம்ப நன்றி|god bless|god bless you|ஆண்டவர் ஆசீர்வதிப்பாராக|ஆசீர்வாதம்)$/i.test(normalizedText) ||
      /\b(thank you|thanks a lot|மிக்க நன்றி)\b/i.test(normalizedText);

    if (isThanks) {
      session.invalidInputStreak = 0;
      session.lastBotReplyType = 'THANKS';
      session.lastSentAt = new Date();
      await session.save();

      const thanksMsg = isTamilQuery
        ? `🙏 *மகிழ்ச்சி! (You're welcome!)*\n\nஎல்லாம் வல்ல இறைவன் உங்களுக்கும் உங்கள் குடும்பத்திற்கும் நிறைவான அமைதியையும் ஆசீர்மையும் தந்தருள்வாராக! ❤️\n\n📌 எப்போது வேண்டுமானாலும் *Menu* என தட்டச்சு செய்து பங்கு சேவைகளைப் பெறலாம்.`
        : `🙏 *You are most welcome! (மகிழ்ச்சி!)*\n\nMay Almighty God bless you and your family with peace and grace! ❤️\n\n📌 Feel free to ask anytime or type *Menu* for parish options.`;

      await wa.sendWhatsAppMessage(replyTarget, thanksMsg);
      return;
    }

    // ── 2A-2. MASS INTENTIONS & BOOKING (திருப்பலி கருத்து & முன்பதிவு) ─────────────────────────
    const isMassBooking = /\b(mass booking|book mass|mass intention|mass intentions|offer mass|request mass)\b/i.test(normalizedText) ||
      normalizedText.includes('mass booking') ||
      normalizedText.includes('book mass') ||
      /(திருப்பலி கருத்து|பூசை கருத்து|திருப்பலி வைக்க|பூசை வைக்க|திருப்பலி முன்பதிவு)/.test(rawText);

    if (isMassBooking) {
      session.invalidInputStreak = 0;
      session.lastBotReplyType = 'MASS_BOOKING';
      session.lastSentAt = new Date();
      await session.save();

      const massBookingMsg = isTamilQuery
        ? `⛪ *திருப்பலி கருத்து & முன்பதிவு (Holy Mass Intentions)*
_புனித அருளானந்தர் ஆலயம், காளையார்கோவில்_

உங்கள் குடும்பத்தினரின் பிறந்தநாள், திருமண நாள், நன்றியறிதல் அல்லது மரித்தோர் ஆன்ம இளைப்பாற்றிக்காக திருப்பலி நிறைவேற்ற விரும்பினால்:

🌐 *இணையதளத்தில் முன்பதிவு செய்ய:*
${getSiteUrl(SITE_ROUTES.MASS_TIMINGS)}

📞 *பங்கு அலுவலகத்தை அழைக்க:* +91 96556 39144
🕒 *அலுவலக நேரம்:* காலை 9:00 – 12:30 & மாலை 4:00 – 8:00

நேரிலும் பங்கு அலுவலகத்திற்கு வந்து திருப்பலி கருத்துக்களைப் பதிவு செய்யலாம். இறை ஆசீர்! 🙏`
        : `⛪ *Holy Mass Intentions & Booking*
_St. John de Britto Church, Kalayarkoil_

To offer Holy Mass for birthdays, wedding anniversaries, thanksgiving, or the repose of departed souls:

🌐 *Book Online via Website:*
${getSiteUrl(SITE_ROUTES.MASS_TIMINGS)}

📞 *Parish Office Contact:* +91 96556 39144
🕒 *Office Hours:* 9:00 AM – 12:30 PM & 4:00 PM – 8:00 PM

You are also welcome to visit the parish office directly during office hours. God bless! 🙏`;

      await wa.sendWhatsAppMessage(replyTarget, massBookingMsg);
      return;
    }

    // ── 2A-3. PRAYER PETITIONS & REQUESTS (செப விண்ணப்பம்) ───────────────────────────
    const isPrayerRequest = /\b(prayer request|prayer petition|pray for me|pray for my|need prayer|family prayer)\b/i.test(normalizedText) ||
      normalizedText.includes('prayer request') ||
      normalizedText.includes('pray for me') ||
      /(செப விண்ணப்பம்|பிரார்த்தனை விண்ணப்பம்|செபியுங்கள்|பிரார்த்தியுங்கள்|குடும்பத்திற்காக செபியுங்கள்)/.test(rawText);

    if (isPrayerRequest) {
      session.invalidInputStreak = 0;
      session.lastBotReplyType = 'PRAYER_PETITION';
      session.lastSentAt = new Date();
      await session.save();

      const petitionMsg = isTamilQuery
        ? `🙏 *செப விண்ணப்பம் (Prayer Petitions)*
_புனித அருளானந்தர் ஆலயம், காளையார்கோவில்_

"கேளுங்கள், உங்களுக்குக் கொடுக்கப்படும்; தேடுங்கள், நீங்கள் கண்டடைவீர்கள்; தட்டுங்கள், உங்களுக்குத் திறக்கப்படும்." — மத்தேயு 7:7

எமது பங்கு சமூகம் மற்றும் குருக்கள் உங்கள் தேவைகளுக்காக நாள்தோறும் திருப்பலியில் விசேஷமாக செபிக்கின்றனர்.

🌐 *உங்கள் செப விண்ணப்பத்தை சமர்ப்பிக்க:*
${getSiteUrl(SITE_ROUTES.PETITIONS)}

எல்லாம் வல்ல இறைவன் உங்கள் செபங்களைக் கேட்டு உங்களுக்கு மன அமைதியையும் உடல் நலத்தையும் தந்தருள்வாராக! ஆமென். 🙏`
        : `🙏 *Prayer Petitions & Intercessions*
_St. John de Britto Church, Kalayarkoil_

"Ask, and it will be given to you; seek, and you will find; knock, and it will be opened to you." — Matthew 7:7

Our parish community and priests intercede daily during Holy Mass for all parishioners and their special intentions.

🌐 *Submit Your Prayer Request Online:*
${getSiteUrl(SITE_ROUTES.PETITIONS)}

May the Lord Jesus hear your prayers and grant you peace, comfort, and divine healing! Amen. 🙏`;

      await wa.sendWhatsAppMessage(replyTarget, petitionMsg);
      return;
    }

    // ── 2A-4. DONATIONS & OFFERINGS (நன்கொடை & காணிக்கை) ──────────────────────────
    const isDonationQuery = /\b(donation|donate|offertory|tithe|offerings|contribute)\b/i.test(normalizedText) ||
      normalizedText.includes('how to donate') ||
      normalizedText.includes('online donation') ||
      /(நன்கொடை|காணிக்கை|பங்கு நிதி|ஆலய நன்கொடை)/.test(rawText);

    if (isDonationQuery) {
      session.invalidInputStreak = 0;
      session.lastBotReplyType = 'DONATION';
      session.lastSentAt = new Date();
      await session.save();

      const donateMsg = isTamilQuery
        ? `❤️ *ஆலய காணிக்கை & நன்கொடை (Online Donation & Offertory)*
_புனித அருளானந்தர் ஆலயம், காளையார்கோவில்_

"மகிழ்ச்சியோடு கொடுப்பவரையே கடவுள் அன்பு செய்கிறார்." — 2 கொரிந்தியர் 9:7

ஆலய திருப்பணி, நற்பணிகள் மற்றும் ஏழை எளியோர் உதவிக்காக உங்கள் காணிக்கைகளை இணையவழியாகப் பாதுகாப்பாகச் செலுத்தலாம்:

🌐 *நன்கொடை செலுத்த:* ${getSiteUrl(SITE_ROUTES.DONATE)}

UPI, Debit/Credit Card, Net Banking மூலமாகப் பாதுகாப்பாகச் செலுத்தலாம். அதிகாரப்பூர்வ ரசீதும் உடனடியாகப் பெற்றுக்கொள்ளலாம். உங்கள் தாராள மனத்திற்கு நன்றி! இறை ஆசீர்! 🙏`
        : `❤️ *Online Donation & Offertory*
_St. John de Britto Church, Kalayarkoil_

"Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver." — 2 Corinthians 9:7

You can securely offer your tithes, festival contributions, and donations online for parish development and charitable outreach:

🌐 *Donate Online:* ${getSiteUrl(SITE_ROUTES.DONATE)}

Instant receipts are issued via UPI, Net Banking, and Cards. Thank you for your generous support of our church! God bless! 🙏`;

      await wa.sendWhatsAppMessage(replyTarget, donateMsg);
      return;
    }

    // ── 2A-5. CERTIFICATES & RECORDS (சான்றிதழ்கள்) ──────────────────────────────
    const isCertQuery = /\b(certificate|certificates|baptism certificate|marriage certificate|communion certificate)\b/i.test(normalizedText) ||
      normalizedText.includes('certificate') ||
      /(சான்றிதழ்|ஞானஸ்நான சான்றிதழ்|திருமண சான்றிதழ்)/.test(rawText);

    if (isCertQuery) {
      session.invalidInputStreak = 0;
      session.lastBotReplyType = 'CERTIFICATES';
      session.lastSentAt = new Date();
      await session.save();

      const certMsg = isTamilQuery
        ? `📜 *ஆலய சான்றிதழ்கள் (Church Certificates)*
_புனித அருளானந்தர் ஆலயம், காளையார்கோவில்_

ஞானஸ்நானம், முதல் நற்கருணை மற்றும் திருமண சான்றிதழ்களைப் பெற:

🌐 *இணையதளத்தில் விண்ணப்பிக்க:* ${getSiteUrl(SITE_ROUTES.CERTIFICATES)}
📞 *பங்கு அலுவலகம்:* +91 96556 39144
🕒 *அலுவலக நேரம்:* காலை 9:00 – 12:30 & மாலை 4:00 – 8:00

அலுவலகத்தில் சான்றிதழ்களைப் பெற குடும்ப அட்டை / பழைய பதிவேடு விபரங்களை உடன் கொண்டுவரவும். 🙏`
        : `📜 *Parish Certificates & Records*
_St. John de Britto Church, Kalayarkoil_

To apply for Baptism, First Holy Communion, Confirmation, or Marriage Certificates:

🌐 *Apply Online via Website:* ${getSiteUrl(SITE_ROUTES.CERTIFICATES)}
📞 *Parish Office:* +91 96556 39144
🕒 *Office Hours:* 9:00 AM – 12:30 PM & 4:00 PM – 8:00 PM

Please bring parish family ID or relevant record dates when collecting certificates in person. God bless! 🙏`;

      await wa.sendWhatsAppMessage(replyTarget, certMsg);
      return;
    }

    // ── 2B. MAIN MENU / QUICK COMMANDS (Menu, 0, Home, Start, Quick Commands) ──────────
    const isMenuTrigger = /^(menu|0|home|start|quick commands|மெனு|முதன்மை மெனு)$/i.test(normalizedText) ||
      normalizedText === 'main menu' ||
      normalizedText.includes('sjdb connect');

    if (isMenuTrigger) {
      let linkedUser = null;
      if (session.linkedUserId) {
        linkedUser = await User.findById(session.linkedUserId);
      } else if (session.providedPhone || phone) {
        const searchPhone = (session.providedPhone || phone).slice(-10);
        linkedUser = await User.findOne({ phone: { $regex: searchPhone + '$' } });
      }

      const userName = linkedUser ? linkedUser.name : (pushName || '');
      session.invalidInputStreak = 0;

      // Deduplication: If menu was sent in the immediately preceding response within 2 mins, don't flood chat
      if (session.lastBotReplyType === 'MENU' && session.lastMenuSentAt && (Date.now() - new Date(session.lastMenuSentAt).getTime()) < 120000) {
        const menuReminder = isTamilQuery
          ? `📌 முதன்மை மெனு மேலே காட்டப்பட்டுள்ளது. தயவுசெய்து ஒரு விருப்ப எண்ணை (1-13) தேர்ந்தெடுக்கவும் அல்லது உங்கள் கேள்வியைத் தட்டச்சு செய்யவும்.`
          : `📌 The Main Menu is displayed right above. Please reply with an option number (1-13) or type your question.`;
        await wa.sendWhatsAppMessage(replyTarget, menuReminder);
        return;
      }

      session.lastBotReplyType = 'MENU';
      session.lastMenuSentAt = new Date();
      session.lastSentAt = new Date();
      await session.save();

      const menuMsg = getMainMenuMessage(userName, isTamilQuery);
      await wa.sendWhatsAppMessage(replyTarget, menuMsg);
      return;
    }

    // ── Direct Comma-Separated Preferences Update (e.g. 1,2,3 or 1,2,3,4,5,6) ───
    const isPreferenceList = /^[1-7](\s*,\s*[1-7])+$/.test(normalizedText);
    if (isPreferenceList) {
      const selectedPrefs = parsePreferences(rawText);
      if (selectedPrefs) {
        session.preferences = selectedPrefs;
        await session.save();
        if (session.linkedUserId) {
          try {
            await User.findByIdAndUpdate(session.linkedUserId, {
              botPreferences: selectedPrefs,
              whatsappOptIn: true
            });
          } catch (_) {}
        }
        const prefUpdateMsg = isTamilQuery
          ? `✅ *உங்கள் விருப்பங்கள் வெற்றிகரமாகப் புதுப்பிக்கப்பட்டன!*\n\nதேர்ந்தெடுக்கப்பட்ட சேவைகள்:\n${selectedPrefs.map(p => `• ${p}`).join('\n')}\n\n📌 முதன்மை மெனுவிற்கு *Menu* என தட்டச்சு செய்யவும்.`
          : `✅ *Your SJDB Connect preferences have been updated!*\n\nSubscribed Services:\n${selectedPrefs.map(p => `• ${p}`).join('\n')}\n\n📌 Type *Menu* for Main Menu or *Services* for Help Desk.`;
        await wa.sendWhatsAppMessage(replyTarget, prefUpdateMsg);
        return;
      }
    }

    // ── Preferences Command (Trigger preferences update anytime) ───────────────
    if (/^(preferences|prefs|விருப்பங்கள்)$/i.test(normalizedText)) {
      session.invalidInputStreak = 0;
      session.step = 'preferences';
      await session.save();
      await wa.sendWhatsAppMessage(replyTarget, getPreferencesMenuMessage());
      return;
    }

    // ── Language Command (Trigger Catholic content language update anytime) ─────
    if (/^(language|lang|மொழி)$/i.test(normalizedText)) {
      session.invalidInputStreak = 0;
      session.step = 'language';
      await session.save();
      await wa.sendWhatsAppMessage(replyTarget, getDailyContentLanguagePrompt());
      return;
    }

    // ── Language Switching Commands (Case-Insensitive) ─────────────────────────
    if (/^(tamil|தமிழ்|ta)$/i.test(normalizedText) || normalizedText === 'change to tamil' || normalizedText === 'switch to tamil') {
      session.invalidInputStreak = 0;
      session.language = 'ta';
      await session.save();
      const taAck = `✅ *Daily Catholic Content Language set to Tamil (தமிழ்) successfully!*\nBible Verse, Mass Readings, Reflection & Saint of the Day will be delivered in Tamil.\n\n📌 Type *MENU* for Quick Commands or *SERVICES* for Help Desk.`;
      await wa.sendWhatsAppMessage(replyTarget, taAck);
      return;
    }

    if (/^(english|eng|en)$/i.test(normalizedText) || normalizedText === 'change to english' || normalizedText === 'switch to english') {
      session.invalidInputStreak = 0;
      session.language = 'en';
      await session.save();
      const enAck = `✅ *Daily Catholic Content Language set to English successfully!*\nBible Verse, Mass Readings, Reflection & Saint of the Day will be delivered in English.\n\n📌 Type *MENU* for Quick Commands or *SERVICES* for Help Desk.`;
      await wa.sendWhatsAppMessage(replyTarget, enAck);
      return;
    }

    // ── Daily Catholic Content Submenu & Quick Handlers ─────────────────────
    if (session.pendingSubmenu === 'daily_catholic') {
      if (menuNum === 1 || /\b(verse|bible|இறைவார்த்தை|வசனம்)\b/i.test(normalizedText)) {
        await sendTodayBibleVerse(replyTarget, session, wa, isTamilQuery);
        return;
      }
      if (menuNum === 2 || /\b(readings?|mass readings?|வாசகம்|வாசகங்கள்|திருப்பலி வாசகங்கள்)\b/i.test(normalizedText)) {
        await sendTodayMassReadings(replyTarget, session, wa, isTamilQuery);
        return;
      }
      if (menuNum === 3 || /\b(reflection|தியானம்|சிந்தனை)\b/i.test(normalizedText)) {
        await sendTodayDailyReflection(replyTarget, session, wa, isTamilQuery);
        return;
      }
      if (menuNum === 4 || /\b(saint|புனிதர்)\b/i.test(normalizedText)) {
        await sendTodaySaint(replyTarget, session, wa, isTamilQuery);
        return;
      }
      if (menuNum === 5 || /\b(prayer|prayers?|செபம்|ஜெபம்)\b/i.test(normalizedText)) {
        await sendTodayPrayer(replyTarget, session, wa, isTamilQuery);
        return;
      }
      if (menuNum === 6 || /\b(website|site|இணையதளம்)\b/i.test(normalizedText)) {
        await sendChurchWebsite(replyTarget, session, wa, isTamilQuery);
        return;
      }
      // If user typed something else, clear submenu and proceed
      session.pendingSubmenu = '';
      await session.save();
    }

    // ── Daily Catholic Content Self-Service Menu Trigger ─────────────────────
    const isDailyCatholicMenuQuery = /^(daily catholic content|daily catholic|catholic content|daily devotions|devotions|தினசரி பக்தி|ஆன்மீக உள்ளடக்கம்|catholic menu|daily menu)$/i.test(normalizedText) ||
      normalizedText === 'daily devotions' ||
      normalizedText === 'daily catholic' ||
      normalizedText === 'daily catholic content';

    if (isDailyCatholicMenuQuery) {
      session.invalidInputStreak = 0;
      session.lastBotReplyType = 'DAILY_CATHOLIC_MENU';
      session.pendingSubmenu = 'daily_catholic';
      session.lastSentAt = new Date();
      await session.save();

      const menuMsg = getDailyCatholicContentMenu(isTamilQuery);
      await wa.sendWhatsAppMessage(replyTarget, menuMsg);
      return;
    }

    // ── Individual Daily Catholic Content Requests (Natural Language) ────────
    // 3️⃣ 🕊️ Daily Reflection (இன்றைய தியானம்)
    const isSpecificReflectionQuery = /^(today'?s reflection|today reflection|daily reflection|reflection|இன்றைய தியானம்|தியானம்|இன்றைய சிந்தனை|சிந்தனை)$/i.test(normalizedText) ||
      normalizedText.includes("daily reflection") ||
      normalizedText.includes("today's reflection") ||
      normalizedText.includes("today reflection") ||
      /(இன்றைய தியானம்|இன்றைய சிந்தனை)/.test(rawText);

    if (isSpecificReflectionQuery) {
      await sendTodayDailyReflection(replyTarget, session, wa, isTamilQuery);
      return;
    }

    // 1️⃣ 📖 Bible Verse (இன்றைய இறைவார்த்தை)
    const isSpecificVerseQuery = (menuNum === 3 && session.pendingSubmenu !== 'daily_catholic') ||
      /^(today'?s bible verse|today bible verse|bible verse|today'?s verse|today verse|daily verse|daily bible verse|scripture|இன்றைய இறைவார்த்தை|வேத வசனம்|இறைவார்த்தை|வசனம்)$/i.test(normalizedText) ||
      normalizedText.includes("bible verse") ||
      normalizedText.includes("today's verse") ||
      normalizedText.includes("today verse") ||
      /(இன்றைய இறைவார்த்தை|வேத வசனம்|இறைவார்த்தை)/.test(rawText);

    if (isSpecificVerseQuery) {
      await sendTodayBibleVerse(replyTarget, session, wa, isTamilQuery);
      return;
    }

    // 2️⃣ 📜 Daily Mass Readings (இன்றைய திருப்பலி வாசகங்கள்)
    const isSpecificReadingsQuery = (menuNum === 4 && session.pendingSubmenu !== 'daily_catholic') ||
      /^(today'?s mass readings?|today mass readings?|mass readings?|today'?s readings?|today readings?|daily readings?|daily mass readings?|readings?|gospel|இன்றைய திருப்பலி வாசகங்கள்|திருப்பலி வாசகங்கள்|வாசகங்கள்|வாசகம்|இன்றைய வாசகங்கள்)$/i.test(normalizedText) ||
      normalizedText.includes("mass readings") ||
      normalizedText.includes("today's readings") ||
      normalizedText.includes("today readings") ||
      normalizedText.includes("readings again") ||
      /(இன்றைய திருப்பலி வாசகங்கள்|திருப்பலி வாசகங்கள்|இன்றைய வாசகங்கள்)/.test(rawText);

    if (isSpecificReadingsQuery) {
      await sendTodayMassReadings(replyTarget, session, wa, isTamilQuery);
      return;
    }

    // 4️⃣ ✨ Saint of the Day (இன்றைய புனிதர்)
    const isSaintChoice = (menuNum === 5 && session.pendingSubmenu !== 'daily_catholic') ||
      /^(today'?s saint|today saint|saint of the day|saint|saints|who is today saint|who is the saint today|இன்றைய புனிதர்|புனிதர் யார்|புனிதர்)$/i.test(normalizedText) ||
      normalizedText.includes("saint of the day") ||
      normalizedText.includes("today's saint") ||
      normalizedText.includes("today saint") ||
      /(இன்றைய புனிதர்|புனிதர் யார்)/.test(rawText);

    if (isSaintChoice) {
      await sendTodaySaint(replyTarget, session, wa, isTamilQuery);
      return;
    }

    // 5️⃣ 🙏 Daily Prayer / Catholic Prayers (இன்றைய செபம்)
    const isPrayersChoice = (menuNum === 6 && session.pendingSubmenu !== 'daily_catholic') ||
      /^(today'?s prayer|today prayer|daily prayer|prayer|prayers|catholic prayers?|common prayers?|our father|hail mary|holy rosary|rosary|litany|இன்றைய செபம்|செபம்|ஜெபம்|கத்தோலிக்க செபங்கள்)$/i.test(normalizedText) ||
      normalizedText.includes("today's prayer") ||
      normalizedText.includes("daily prayer") ||
      normalizedText.includes("catholic prayer") ||
      normalizedText.includes("rosary prayer") ||
      /(இன்றைய செபம்|கத்தோலிக்க செபங்கள்|பரலோக மந்திரம்|மங்கள வார்த்தை)/.test(rawText);

    if (isPrayersChoice) {
      await sendTodayPrayer(replyTarget, session, wa, isTamilQuery);
      return;
    }

    // 6️⃣ 🌐 Church Website
    const isWebsiteChoice = /^(church website|website|ஆலய இணையதளம்|இணையதளம்)$/i.test(normalizedText) ||
      normalizedText === 'website' ||
      normalizedText === 'site';

    if (isWebsiteChoice) {
      await sendChurchWebsite(replyTarget, session, wa, isTamilQuery);
      return;
    }

    // ── 13-SERVICE UNIFIED PARISH MENU & NUMERIC ROUTING (Options 1 to 13) ────

    // 1️⃣ ⛪ Option 1: Mass Timings
    const isMassTimingsQuery = menuNum === 1 ||
      /\b(mass timings?|mass times?|mass schedule|when is mass|what time is mass|morning mass|evening mass|sunday mass|today mass)\b/i.test(normalizedText) ||
      /(திருப்பலி நேரம்|பூசை நேரம்|திருப்பலி நேரங்கள்|ஞாயிறு திருப்பலி)/.test(rawText);

    if (isMassTimingsQuery) {
      session.invalidInputStreak = 0;
      session.lastBotReplyType = 'MASS_TIMINGS';
      session.lastSentAt = new Date();
      await session.save();

      const massMsg = isTamilQuery
        ? `⛪ *புனித அருளானந்தர் ஆலயம் — திருப்பலி நேரங்கள்*
_காளையார்கோவில், சிவகங்கை மறைமாவட்டம்_

📅 *வார நாட்கள் (புதன் – சனி):*
• மாலை 5:30 மணி — மாலைத் திருப்பலி

🌟 *ஞாயிறு திருப்பலிகள்:*
• காலை 6:30 மணி — அதிகாலைத் திருப்பலி
• காலை 8:30 மணி — பங்குப் பெருவிழாத் திருப்பலி

🕯️ *புதன்கிழமை நவநாள்:*
• மாலை 5:30 மணி — புனித அருளானந்தர் நவநாள் & திருப்பலி

🕯️ *சனிக்கிழமை நவநாள்:*
• மாலை 5:30 மணி — நித்திய சகாய மாதா நவநாள் & திருப்பலி

🕊️ *ஒப்புரவு அருட்சாதனம் (பாவசங்கீர்த்தனம்):*
• புதன் – சனி: மாலை 5:00 – 5:30 மணி (திருப்பலிக்கு முன்) & திருப்பலிக்கு பின்

🌐 *முழு விபரம் & திருப்பலி கருத்துக்கள்:* ${getSiteUrl(SITE_ROUTES.MASS_TIMINGS)}`
        : `⛪ *St. John de Britto Church — Holy Mass Timings*
_Kalayarkoil, Sivagangai Diocese_

📅 *Weekdays (Wednesday – Saturday):*
• 5:30 PM — Evening Holy Mass

🌟 *Sunday Holy Masses:*
• 6:30 AM — Early Morning Mass
• 8:30 AM — Parish High Mass

🕯️ *Wednesday Novena:*
• 5:30 PM — Novena to St. John de Britto & Holy Mass

🕯️ *Saturday Novena:*
• 5:30 PM — Novena to Our Lady of Perpetual Succour (Sahaya Madha) & Holy Mass

🕊️ *Confessions (Reconciliation):*
• Wed – Sat: 5:00 PM – 5:30 PM (before Evening Mass) & after Mass

🌐 *Full Schedule & Intentions:* ${getSiteUrl(SITE_ROUTES.MASS_TIMINGS)}`;

      await wa.sendWhatsAppMessage(replyTarget, massMsg);
      return;
    }

    // 2️⃣ 🕊️ Option 2: Confession Timings
    const isConfessionQuery = menuNum === 2 ||
      /\b(confessions?|confession timings?|confession times?|reconciliation|sacrament of reconciliation|penance)\b/i.test(normalizedText) ||
      normalizedText.includes('confession') ||
      normalizedText.includes('reconciliation') ||
      /(ஒப்புரவு|பாவசங்கீர்த்தனம்|ஒப்புரவு நேரம்|பாவமன்னிப்பு)/.test(rawText);

    if (isConfessionQuery) {
      session.invalidInputStreak = 0;
      session.lastBotReplyType = 'CONFESSION';
      session.lastSentAt = new Date();
      await session.save();

      const confMsg = isTamilQuery
        ? `🕊️ *ஒப்புரவு அருட்சாதனம் (பாவசங்கீர்த்தன நேரங்கள்)*
_புனித அருளானந்தர் ஆலயம், காளையார்கோவில்_

"உங்கள் பாவங்கள் கருஞ்சிவப்பாய் இருந்தாலும், உறைந்த பனிபோல் வெண்மையாகும்." — எசாயா 1:18

⏰ *வழக்கமான ஒப்புரவு நேரங்கள்:*
• *புதன் முதல் சனி வரை:* மாலை 5:00 – 5:30 மணி (மாலை திருப்பலிக்கு முன்)
• *ஞாயிற்றுக்கிழமைகளில்:* காலை 6:00 – 6:30 & காலை 8:00 – 8:30 மணி (திருப்பலிக்கு முன்)
• *திருப்பலி முடிந்த பின்:* பங்குத்தந்தையிடம் தனிப்பட்ட முறையில் கேட்டுப் பெறலாம்.

✝️ *சிறப்பு ஒப்புரவு வழிபாடுகள்:*
• மாதத்தின் முதல் வெள்ளிக்கிழமை ஆராதனையின் போது (மாலை 5:00 மணி முதல்)
• தவக்காலம் மற்றும் திருவருகைக் கால சிறப்பு ஒப்புரவு வழிபாடுகள்
• அவசர மற்றும் தனிப்பட்ட தேவைகளுக்கு பங்குத்தந்தையை எந்நேரமும் அணுகலாம்.

📞 *அருட்தந்தையரைத் தொடர்பு கொள்ள:* +91 96556 39144

🌐 *திருவருட்சாதன விபரம்:* ${getSiteUrl(SITE_ROUTES.ABOUT)}`
        : `🕊️ *Sacrament of Reconciliation (Confession Timings)*
_St. John de Britto Church, Kalayarkoil_

"Come now, let us settle the matter, says the LORD. Though your sins are like scarlet, they shall be as white as snow." — Isaiah 1:18

⏰ *Regular Confession Schedule:*
• *Wednesdays – Saturdays:* 5:00 PM – 5:30 PM (before Evening Mass)
• *Sundays:* 6:00 AM – 6:30 AM & 8:00 AM – 8:30 AM (before Sunday Masses)
• *After Every Mass:* Priests are available upon request near the confessional / sacristy.

✝️ *Special Confession Services:*
• First Friday Eucharistic Adoration (from 5:00 PM)
• Season of Lent & Advent Penitential Services
• Anytime by appointment with the Parish Priest.

📞 *Need to meet a priest?*
Call Parish Office: +91 96556 39144

🌐 *Sacraments Info:* ${getSiteUrl(SITE_ROUTES.ABOUT)}`;

      await wa.sendWhatsAppMessage(replyTarget, confMsg);
      return;
    }

    // 3️⃣ 📖 Option 3: Daily Bible Verse
    if (menuNum === 3) {
      await sendTodayBibleVerse(replyTarget, session, wa, isTamilQuery);
      return;
    }

    // 4️⃣ 📜 Option 4: Daily Mass Readings
    if (menuNum === 4) {
      await sendTodayMassReadings(replyTarget, session, wa, isTamilQuery);
      return;
    }

    // 5️⃣ 🌟 Option 5: Saint of the Day
    if (menuNum === 5) {
      await sendTodaySaint(replyTarget, session, wa, isTamilQuery);
      return;
    }

    // 6️⃣ 🙏 Option 6: Catholic Prayers
    if (menuNum === 6) {
      await sendTodayPrayer(replyTarget, session, wa, isTamilQuery);
      return;
    }

    // 7️⃣ 📅 Option 7: Church Events
    const isEventsChoice = menuNum === 7 ||
      /\b(events?|upcoming events?|church events?|parish events?|show events?|list events?|what are the events|any events|what events|events this week)\b/i.test(normalizedText) ||
      normalizedText.includes('what are the events') ||
      normalizedText.includes('upcoming events') ||
      normalizedText.includes('any events this week') ||
      normalizedText.includes('show church events') ||
      normalizedText.includes('show events') ||
      /(நிகழ்வுகள்|நிகழ்ச்சிகள்|அடுத்த நிகழ்வு|பங்கு நிகழ்வுகள்)/.test(rawText);

    if (isEventsChoice) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const events = await Event.find({
          isPublished: { $ne: false },
          date: { $gte: today }
        })
          .sort({ date: 1 })
          .limit(5)
          .lean();

        const eventsUrl = `${getSiteUrl(SITE_ROUTES.EVENTS)}`;

        let eventsMsg = '';
        if (events && events.length > 0) {
          const items = events.map((ev, idx) => {
            const dt = isTamilQuery
              ? new Date(ev.date).toLocaleDateString('ta-IN', { day: 'numeric', month: 'long', year: 'numeric' })
              : new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
            return isTamilQuery
              ? `${idx + 1}. *${ev.title}*\n   📅 ${dt}\n   🕐 ${ev.time || 'நேரம் பின்னர் அறிவிக்கப்படும்'}\n   📍 ${ev.venue || 'ஆலய வளாகம்'}\n   🔗 விபரம்: ${eventsUrl}`
              : `${idx + 1}. *${ev.title}*\n   📅 ${dt}\n   🕐 ${ev.time || 'Schedule TBA'}\n   📍 ${ev.venue || 'Church Grounds'}\n   🔗 View Event: ${eventsUrl}`;
          }).join('\n\n');

          eventsMsg = isTamilQuery
            ? `📅 *வரவிருக்கும் பங்கு நிகழ்வுகள் (Church Events)*\n\n${items}\n\n🌐 *நிகழ்வுகள் நாள்காட்டி:* ${eventsUrl}`
            : `📅 *Upcoming Church Events*\n\n${items}\n\n🌐 *Complete Calendar:* ${eventsUrl}`;
        } else {
          eventsMsg = isTamilQuery
            ? `📅 *பங்கு நிகழ்வுகள்*\n\nதற்போது புதிய நிகழ்வுகள் எதுவும் திட்டமிடப்படவில்லை. எமது இணையதள நாள்காட்டியில் புதிய தகவல்களைப் பார்க்கலாம்.\n\n🌐 *நிகழ்வுகள் நாள்காட்டி:* ${eventsUrl}`
            : `📅 *Upcoming Church Events*\n\nNo upcoming church events are scheduled at the moment. Please check back soon or visit our website calendar.\n\n🌐 *View Events Calendar:* ${eventsUrl}`;
        }

        await wa.sendWhatsAppMessage(replyTarget, eventsMsg);
        return;
      } catch (eErr) {
        console.error('[BotHandler] Events error:', eErr.message);
      }
    }

    // 8️⃣ 📢 Option 8: Parish Announcements
    const isAnnouncementsChoice = menuNum === 8 ||
      /\b(announcements?|notices?|parish announcements?|what is new|what\'?s new|latest announcements?|show announcements?|any announcements?)\b/i.test(normalizedText) ||
      normalizedText.includes('any announcements') ||
      normalizedText.includes('latest announcement') ||
      normalizedText.includes('what is new') ||
      normalizedText.includes('show announcements') ||
      /(அறிவிப்புகள்|பங்கு அறிவிப்பு|புதிய அறிவிப்பு)/.test(rawText);

    if (isAnnouncementsChoice) {
      try {
        const nowDate = new Date();
        const announcements = await Announcement.find({
          isPublished: { $ne: false },
          $or: [
            { expiresAt: { $gt: nowDate } },
            { expiresAt: null },
            { expiresAt: { $exists: false } }
          ]
        })
          .sort({ priority: -1, createdAt: -1 })
          .limit(5)
          .lean();

        const annUrl = `${getSiteUrl(SITE_ROUTES.ANNOUNCEMENTS)}`;

        let annMsg = '';
        if (announcements && announcements.length > 0) {
          const items = announcements.map((a, idx) => {
            const dt = a.createdAt ? new Date(a.createdAt).toLocaleDateString(isTamilQuery ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short' }) : '';
            const snippet = (a.content || a.description || '').replace(/\s+/g, ' ').slice(0, 110);
            return `${idx + 1}. *${a.title}*${dt ? ` (${dt})` : ''}\n   📝 ${snippet}${snippet.length >= 110 ? '...' : ''}\n   🔗 ${isTamilQuery ? 'முழு அறிவிப்பு' : 'Read Announcement'}: ${annUrl}`;
          }).join('\n\n');

          annMsg = isTamilQuery
            ? `📢 *சமீபத்திய பங்கு அறிவிப்புகள் (Parish Announcements)*\n\n${items}\n\n🌐 *அனைத்து அறிவிப்புகள்:* ${annUrl}`
            : `📢 *Latest Parish Announcements*\n\n${items}\n\n🌐 *All Announcements:* ${annUrl}`;
        } else {
          annMsg = isTamilQuery
            ? `📢 *பங்கு அறிவிப்புகள்*\n\nதற்போது புதிய அறிவிப்புகள் ஏதுமில்லை. எமது இணையதளத்தில் புதிய விபரங்களைப் பார்க்கலாம்.\n\n🌐 *அறிவிப்புகள் பக்கம்:* ${annUrl}`
            : `📢 *Parish Announcements*\n\nThere are no new announcements at this moment. You can check our website for updates.\n\n🌐 *View Announcements:* ${annUrl}`;
        }

        await wa.sendWhatsAppMessage(replyTarget, annMsg);
        return;
      } catch (aErr) {
        console.error('[BotHandler] Announcements error:', aErr.message);
      }
    }

    // ── Maintenance Query ("Is there any maintenance?", "Website maintenance", "Any downtime?", "When will maintenance finish?") ──
    const isMaintenanceQuery =
      /\b(maintenance|downtime|server status|website status|site down|down time|system maintenance)\b/i.test(normalizedText) ||
      normalizedText.includes('is there any maintenance') ||
      normalizedText.includes('website maintenance') ||
      normalizedText.includes('any downtime') ||
      normalizedText.includes('when will maintenance finish') ||
      normalizedText.includes('maintenance status') ||
      normalizedText.includes('is the site down') ||
      normalizedText.includes('is website down') ||
      /(பராமரிப்பு|வலைத்தள பராமரிப்பு|தடை|இணையதள பராமரிப்பு)/.test(rawText);

    if (isMaintenanceQuery) {
      try {
        const { getSystemState } = require('../services/systemStateService');
        const systemState = await getSystemState(true);
        const MaintenanceSetting = require('../models/MaintenanceSetting');
        const settings = await MaintenanceSetting.findOne({ key: 'site_maintenance' }).lean();

        const maintenanceUrl = `${getSiteUrl('/maintenance')}`;
        const siteUrl = `${getSiteUrl('/')}`;

        const format12H = (dateVal) => {
          if (!dateVal) return 'TBA';
          const d = new Date(dateVal);
          if (isNaN(d.getTime())) return 'TBA';
          return d.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }) + ' IST';
        };

        const isUnderMaintenance = systemState && (systemState.status === 'maintenance' || systemState.status === 'emergency');
        const hasUpcomingNotice = settings && (settings.noticeBanner?.isEnabled || settings.scheduler?.isEnabled);

        let maintMsg = '';
        if (isUnderMaintenance) {
          const expectedEnd = format12H(systemState.expectedCompletion || settings?.expectedCompletion);
          const category = systemState.category || settings?.category || 'General Maintenance';
          const details = systemState.message || settings?.message || 'Scheduled system maintenance and performance upgrades.';

          maintMsg = `🛠️ *Church Website Maintenance Status*

⚠️ *Status:* Active System Maintenance
🔧 *Category:* ${category}
📝 *Details:* ${details}
🕒 *Expected Completion:* ${expectedEnd}

🌐 *View Maintenance Notice:*
${maintenanceUrl}

Our technical team is working to restore services as quickly as possible. Thank you for your patience and prayers! 🙏`;
        } else if (hasUpcomingNotice && (settings.scheduler?.scheduledStart || settings.noticeBanner?.scheduledStartTime)) {
          const startTime = format12H(settings.scheduler?.scheduledStart || settings.noticeBanner?.scheduledStartTime);
          const endTime = format12H(settings.scheduler?.scheduledEnd || settings.noticeBanner?.scheduledEndTime || settings.expectedCompletion);
          const category = settings.category || 'Scheduled Update';
          const details = settings.noticeBanner?.message || settings.message || 'Scheduled system maintenance.';

          maintMsg = `🛠️ *Scheduled Church Website Maintenance*

⚠️ *Status:* Upcoming Maintenance Notice
🔧 *Category:* ${category}
📝 *Details:* ${details}
📅 *Start Time:* ${startTime}
⏳ *Expected End:* ${endTime}

🌐 *View Maintenance Notice:*
${maintenanceUrl}

The church website is currently live and operational. Please note the scheduled window above for planned updates.`;
        } else {
          maintMsg = `✅ *Church Website Status: All Systems Operational*

There is currently no maintenance or downtime scheduled for the church website. All online services (Holy Mass bookings, prayer petitions, certificate requests, and online offertory) are active 24x7.

🌐 *Visit Church Website:*
${siteUrl}

— *St. John de Britto Church, Kalayarkoil*`;
        }

        await wa.sendWhatsAppMessage(replyTarget, maintMsg);
        return;
      } catch (mErr) {
        console.error('[BotHandler] Maintenance query error:', mErr.message);
      }
    }

    // 9️⃣ 📍 Option 9: Church Location & Map
    const isLocationChoice = menuNum === 9 ||
      /\b(where is the church|where is church|church location|location|church map|maps?|how to reach|directions?)\b/i.test(normalizedText) ||
      normalizedText.includes('church location') ||
      normalizedText.includes('where is the church') ||
      /(அமைவிடம்|கோவில் எங்கு|ஆலயம் எங்கு|வரைபடம்|முகவரி)/.test(rawText);

    if (isLocationChoice) {
      session.invalidInputStreak = 0;
      session.lastBotReplyType = 'LOCATION';
      session.lastSentAt = new Date();
      await session.save();

      const locMsg = isTamilQuery
        ? `🏛️ *புனித அருளானந்தர் ஆலயம் — அமைவிடம் & வரைபடம்*
ஆலய சாலை, காளையார்கோவில் — 630551, சிவகங்கை மாவட்டம், தமிழ்நாடு, இந்தியா.

🕒 *பார்வையாளர் நேரம்:*
• திங்கள் – சனி: காலை 9:00 – 12:30 & மாலை 4:00 – 8:00
• ஞாயிறு: காலை 10:00 – 12:00 & மாலை 5:00 – 8:00

📍 *கூகுள் மேப் (Google Maps) இணைப்பு:*
${EXTERNAL_LINKS.GOOGLE_MAPS}

🚌 *போக்குவரத்து வசதி:* காளையார்கோவில் பேருந்து நிலையத்திலிருந்து 500 மீட்டர் தொலைவில் ஆலயம் அமைந்துள்ளது.

🌐 *தொடர்பு பக்கம்:* ${getSiteUrl(SITE_ROUTES.CONTACT)}`
        : `🏛️ *St. John de Britto Church — Church Location & Map*
Church Road, Kalayarkoil — 630551, Sivagangai District, Tamil Nadu, India.

🕒 *Visiting Hours:*
• Monday – Saturday: 9:00 AM – 12:30 PM & 4:00 PM – 8:00 PM
• Sunday: 10:00 AM – 12:00 PM & 5:00 PM – 8:00 PM

📍 *Google Maps Location Link:*
${EXTERNAL_LINKS.GOOGLE_MAPS}

🚌 *How to Reach:* Located just 500 meters from Kalayarkoil Bus Stand.

🌐 *Contact & Directions:* ${getSiteUrl(SITE_ROUTES.CONTACT)}`;

      await wa.sendWhatsAppMessage(replyTarget, locMsg);
      return;
    }

    // 1️⃣0️⃣ 👥 Option 10: Parish Ministries & Anbiyams
    const isMinistriesChoice = menuNum === 10 ||
      /\b(ministr(y|ies)|anbiyams?|parish ministries|ward|council|choir|youth group|catechism|altar servers?)\b/i.test(normalizedText) ||
      normalizedText.includes('ministries') ||
      normalizedText.includes('anbiyam') ||
      /(அன்பியம்|அன்பியங்கள்|பங்கு அமைப்புகள்|பாடகர் குழு|இளைஞர் இயக்கம்|பீடப் பணியாளர்கள்)/.test(rawText);

    if (isMinistriesChoice) {
      session.invalidInputStreak = 0;
      session.lastBotReplyType = 'MINISTRIES';
      session.lastSentAt = new Date();
      await session.save();

      const minMsg = isTamilQuery
        ? `👥 *பங்கு அமைப்புகள் & அன்பியங்கள் (Ministries & Anbiyams)*
_புனித அருளானந்தர் ஆலயம், காளையார்கோவில்_

• 👥 *12 அன்பியங்கள்:* பங்கு குடும்பங்களை இணைக்கும் வார்டு செபக் கூட்டமைப்புகள்
• 🏛️ *பங்கு அருள்பணிப் பேரவை:* பங்கு வளர்ச்சி மற்றும் மேய்ப்புப் பணி ஆலோசனைக் குழு
• 🎶 *பங்கு பாடகர் குழு:* திருப்பலி வழிபாட்டுப் பாடல்கள்
• 🕯️ *பீடப் பணியாளர்கள் சங்கம் (Altar Servers):* பலிபீடப் பணி
• 🌟 *இளைஞர் இயக்கம் (ICYM):* பங்கு இளைஞர் நற்பணி மன்றம்
• 📖 *ஞாயிறு மறைக் கல்வி:* சிறார்களுக்கான விசுவாசக் கல்வி வகுப்புகள்
• ❤️ *புனித வின்சென்ட் தே பவுல் சபை (SVP):* ஏழை எளியோருக்கான உதவி

🌐 *மேலும் அறிய:* ${getSiteUrl(SITE_ROUTES.ANBIYAMS)}`
        : `👥 *Parish Ministries & Anbiyams*
_St. John de Britto Church, Kalayarkoil_

• 👥 *12 Active Anbiyams:* Ward-level Christian family prayer cells
• 🏛️ *Parish Pastoral Council:* Parish governance & pastoral leadership
• 🎶 *Parish Choir:* Liturgical worship & sacred choral music
• 🕯️ *Altar Servers Guild:* Reverent altar service during Masses
• 🌟 *Youth Movement (ICYM):* Vibrant parish youth community
• 📖 *Sunday Catechism:* Faith formation & Sunday school for children
• ❤️ *Society of St. Vincent de Paul:* Loving charity & outreach to the needy

🌐 *Read More:* ${getSiteUrl(SITE_ROUTES.ANBIYAMS)}`;

      await wa.sendWhatsAppMessage(replyTarget, minMsg);
      return;
    }

    // 1️⃣1️⃣ 👑 Option 11: Parish Priest & Clergy
    const isPriestsChoice = menuNum === 11 ||
      /\b(priests?|parish priest|clergy|pastor|fathers?)\b/i.test(normalizedText) ||
      normalizedText.includes('parish priest') ||
      normalizedText.includes('clergy') ||
      /(பங்குத்தந்தை|அருட்தந்தை|குருக்கள்|குரு)/.test(rawText);

    if (isPriestsChoice) {
      try {
        session.invalidInputStreak = 0;
        session.lastBotReplyType = 'PRIESTS';
        session.lastSentAt = new Date();
        await session.save();

        const priests = await getCachedPriests();
        let pList = '';
        if (priests && priests.length > 0) {
          pList = priests.map(p => `• *${p.designation || (isTamilQuery ? 'அருட்பணியாளர்' : 'Priest')}:* Rev. Fr. ${p.name} ${p.phone ? `(Ph: ${p.phone})` : ''}`).join('\n');
        } else {
          pList = isTamilQuery
            ? `• *பங்குத்தந்தை:* Rev. Fr. Parish Priest (Ph: +91 96556 39144)`
            : `• *Parish Priest:* Rev. Fr. Parish Priest (Ph: +91 96556 39144)`;
        }

        const pMsg = isTamilQuery
          ? `👑 *பங்குத்தந்தையர்கள் & அருட்பணியாளர்கள் (Parish Clergy)*
_புனித அருளானந்தர் ஆலயம், காளையார்கோவில்_

${pList}

🕒 *சந்திப்பு நேரம்:* காலை 9:00 – 1:00 & மாலை 4:00 – 7:00

🌐 *குருக்கள் விபரம்:* ${getSiteUrl(SITE_ROUTES.PRIESTS)}`
          : `👑 *Parish Priests & Clergy*
_St. John de Britto Church, Kalayarkoil_

${pList}

🕒 *Office Meeting Hours:* 9:00 AM – 1:00 PM & 4:00 PM – 7:00 PM

🌐 *View Priests Online:* ${getSiteUrl(SITE_ROUTES.PRIESTS)}`;

        await wa.sendWhatsAppMessage(replyTarget, pMsg);
        return;
      } catch (pErr) {
        console.error('[BotHandler] Priests error:', pErr.message);
      }
    }

    // 1️⃣2️⃣ 🏛️ Option 12: Church History & Patron Saint
    const isHistoryChoice = menuNum === 12 ||
      /\b(church history|saint history|about church|history|patron saint|britto history)\b/i.test(normalizedText) ||
      normalizedText.includes('church history') ||
      normalizedText.includes('history') ||
      /(ஆலய வரலாறு|பங்கு வரலாறு|புனிதர் வரலாறு|வரலாறு)/.test(rawText);

    if (isHistoryChoice) {
      session.invalidInputStreak = 0;
      session.lastBotReplyType = 'HISTORY';
      session.lastSentAt = new Date();
      await session.save();

      const histMsg = isTamilQuery
        ? `🏛️ *புனித அருளானந்தர் ஆலயம் — ஆலய வரலாறு*
_காளையார்கோவில், சிவகங்கை மறைமாவட்டம்_

👑 *பங்குப் பாதுகாவலர்:* புனித யோவான் தே பிரிட்டோ (அருளானந்தர்)
🎉 *பாதுகாவலர் பெருவிழா:* பிப்ரவரி 4

போர்ச்சுகல் நாட்டில் பிரபுக்கள் குடும்பத்தில் பிறந்த புனித ஜான் டி பிரிட்டோ (அருளானந்தர்), இயேசு சபைத் துறவியாக இந்தியா வந்து, இந்திய சந்நியாசி வேடமேற்று மறவர் சீமையில் நற்செய்தி அறிவித்தார். பிப்ரவரி 4, 1693 அன்று ஓரியூரில் விசுவாசத்திற்காக இரத்தசாட்சியாக உயிர்த்தியாகம் செய்தார்.

காளையார்கோவிலில் அமைந்துள்ள எமது ஆலயம், விசுவாசப் பாரம்பரியமிக்க வரலாற்றுச் சிறப்புமிக்க புனிதத் தலமாகத் திகழ்கிறது.

🌐 *முழுமையான வரலாறு வாசிக்க:* ${getSiteUrl(SITE_ROUTES.ABOUT)}`
        : `🏛️ *St. John de Britto Church — Church History*
_Kalayarkoil, Sivagangai Diocese_

👑 *Patron Saint:* St. John de Britto (Arulanandar)
🎉 *Patronal Feast Day:* February 4

St. John de Britto was a Portuguese Jesuit missionary who adopted the ascetic lifestyle, dress, and customs of an Indian sannyasi to proclaim the Gospel across Marava country. He embraced martyrdom for the Catholic faith at Oriyur on February 4, 1693.

Our parish in Kalayarkoil stands as a historic sanctuary of deep faith, active Anbiyams, and spiritual devotion.

🌐 *Read Complete History:* ${getSiteUrl(SITE_ROUTES.ABOUT)}`;

      await wa.sendWhatsAppMessage(replyTarget, histMsg);
      return;
    }

    // 1️⃣3️⃣ 📞 Option 13: Contact Church & Office Hours
    const isContactChoice = menuNum === 13 ||
      /\b(contact|contact church|office hours|phone number|email|phone|office)\b/i.test(normalizedText) ||
      normalizedText.includes('contact church') ||
      normalizedText.includes('contact') ||
      /(தொடர்பு|அலுவலக நேரம்|தொலைபேசி|அலுவலகம்)/.test(rawText);

    if (isContactChoice) {
      session.invalidInputStreak = 0;
      session.lastBotReplyType = 'CONTACT';
      session.lastSentAt = new Date();
      await session.save();

      const contactMsg = isTamilQuery
        ? `📞 *ஆலய தொடர்பு விபரம் & அலுவலக நேரம்*
_புனித அருளானந்தர் ஆலயம், காளையார்கோவில்_

🏛️ *முகவரி:*
புனித அருளானந்தர் ஆலயம்,
ஆலய சாலை, காளையார்கோவில் — 630551,
சிவகங்கை மாவட்டம், தமிழ்நாடு, இந்தியா.

📱 *தொலைபேசி:* +91 96556 39144
📧 *மின்னஞ்சல்:* stjdbchurch@gmail.com
🕒 *அலுவலக நேரம்:* Monday – Saturday: 9:00 AM – 12:30 PM & 4.00 PM - 8.00 PM\n Sunday: 10.00 AM - 12.00 PM & 5.00 PM - 8.00 PM

📍 *கூகுள் மேப் (Google Maps) இணைப்பு:*
${EXTERNAL_LINKS.GOOGLE_MAPS}

🌐 *இணையதள தொடர்பு பக்கம்:* ${getSiteUrl(SITE_ROUTES.CONTACT)}`
        : `📞 *Parish Contact & Office Hours*
_St. John de Britto Church, Kalayarkoil_

🏛️ *Address:*
St. John de Britto Church,
Church Road, Kalayarkoil — 630551,
Sivagangai District, Tamil Nadu, India.

📱 *Phone:* +91 96556 39144
📧 *Email:* stjdbchurch@gmail.com
🕒 *Office Hours:* Monday – Saturday: 9:00 AM – 12:30 PM & 4.00 PM - 8.00 PM\n Sunday: 10.00 AM - 12.00 PM & 5.00 PM - 8.00 PM

📍 *Google Maps Location Link:*
${EXTERNAL_LINKS.GOOGLE_MAPS}

🌐 *Contact Page:* ${getSiteUrl(SITE_ROUTES.CONTACT)}`;

      await wa.sendWhatsAppMessage(replyTarget, contactMsg);
      return;
    }

    // ── Help Command ──────────────────────────────────────────────────────────
    const isHelpChoice =
      /\b(help|commands|how to use|guide|options)\b/i.test(normalizedText) ||
      /(உதவி|வழிகாட்டி)/.test(rawText);

    if (isHelpChoice) {
      const helpMsg = isTamilQuery
        ? `❓ *SJDB Connect — உதவி & வழிகாட்டி*
_புனித அருளானந்தர் ஆலயம், காளையார்கோவில்_

📌 *பயன்படுத்தக்கூடிய முக்கிய கட்டளைகள்:*
• *MENU* — முதன்மை மெனு
• *SERVICES* — 13 பங்கு சேவைகளின் விபரம்
• *PREFERENCES* — உங்கள் அறிவிப்பு விருப்பங்களை மாற்ற
• *LANGUAGE* — தமிழ் அல்லது ஆங்கில மொழியைத் தேர்ந்தெடுக்க
• *TAMIL* — தமிழ் மொழிக்கு மாற்ற
• *ENGLISH* — ஆங்கில மொழிக்கு மாற்ற
• *STOP* — தினசரி செய்திகளிலிருந்து விலக

💡 நீங்கள் 1 முதல் 13 வரை உள்ள எண்களை அனுப்பலாம் அல்லது உங்கள் கேள்வியை நேரடியாக தமிழ் அல்லது ஆங்கிலத்தில் தட்டச்சு செய்யலாம்!`
        : `❓ *SJDB Connect — Help & Guidance*
_St. John de Britto Church, Kalayarkoil_

📌 *Key Commands You Can Type Anytime:*
• *MENU* — Main Navigation Menu
• *SERVICES* — 13-Option Parish Services Directory
• *PREFERENCES* — Update your subscribed services
• *LANGUAGE* — Choose Tamil or English for Daily Catholic Devotions
• *TAMIL* — Set Vatican News to Tamil
• *ENGLISH* — Set Vatican News to English
• *STOP* — Unsubscribe from daily broadcasts

💡 You can reply with numbers 1 to 13 or type your questions naturally in English or Tamil!`;

      await wa.sendWhatsAppMessage(replyTarget, helpMsg);
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
      const userLang = isTamilQuery ? 'ta' : (session.botLanguage || session.language || 'en');
      const ragResult = await answerChurchQuestion(rawText, userLang, userAuthContext);

      if (ragResult && ragResult.isChurchRelated && ragResult.reply) {
        session.invalidInputStreak = 0;
        session.lastBotReplyType = 'RAG';
        session.lastSentAt = new Date();
        await session.save();

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

    // ── Smart Invalid-Input & Streak Protection Policy (NO INFINITE MENUS) ──
    session.invalidInputStreak = (session.invalidInputStreak || 0) + 1;
    session.lastBotReplyType = 'INVALID_INPUT';
    session.lastSentAt = new Date();
    await session.save();

    let invalidReply = '';
    if (session.invalidInputStreak === 1) {
      invalidReply = isTamilQuery
        ? `❓ மன்னிக்கவும், உங்கள் விருப்பத்தை அடையாளம் காண முடியவில்லை.\n\nதயவுசெய்து சரியான எண்ணை (1-13) உள்ளிடவும் அல்லது உங்கள் கேள்வியை நேரடியாகத் தட்டச்சு செய்யவும்.\n(முக்கிய கட்டளைகளுக்கு *Menu* அல்லது உதவி மையத்திற்கு *Services* என அனுப்பவும்)`
        : `❓ I didn't quite recognize that option.\n\nPlease reply with a valid number (1-13) or ask your church question naturally.\n(Type *Menu* for quick commands or *Services* for help desk)`;
    } else if (session.invalidInputStreak === 2) {
      invalidReply = isTamilQuery
        ? `💡 வழிகாட்டல்: 1 முதல் 13 வரையிலான எண்ணைத் தேர்ந்தெடுக்கவும் (எ.கா: *1* திருப்பலி நேரம், *3* விவிலிய வசனம்), அல்லது முதன்மை மெனுவைக் காண *Menu* என தட்டச்சு செய்யவும்.`
        : `💡 Guidance: Please reply with a number from 1 to 13 (e.g. *1* for Mass Timings, *3* for Bible Verse), or type *Menu* to see available options.`;
    } else {
      invalidReply = isTamilQuery
        ? `ℹ️ உதவி வேண்டுமா? அனைத்து கட்டளைகளையும் காண *Help* என அனுப்பவும், அல்லது எங்கள் பங்கு அலுவலகத்தை +91 96556 39144 இல் தொடர்பு கொள்ளவும்.`
        : `ℹ️ Need assistance? Type *Help* for available commands, or contact our parish office at +91 96556 39144.`;
    }

    await wa.sendWhatsAppMessage(replyTarget, invalidReply);
  } finally {
    activeSessionLocks.delete(lockKey);
  }
}

module.exports = {
  handleIncomingMessage,
  extractMenuNumber,
  getServicesMenuMessage,
  getDailyCatholicContentMenu,
  formatCatholicPrayersMessage,
  sendTodayBibleVerse,
  sendTodayMassReadings,
  sendTodayDailyReflection,
  sendTodaySaint,
  sendTodayPrayer,
  sendChurchWebsite,
  resetBotCachesAndSessions: async () => {
    processedMessageIdsCache.clear();
    incomingMsgDeduplication.clear();
    blockedNoticeCooldown.clear();
    activeSessionLocks.clear();
    try {
      if (require('mongoose').connection.readyState === 1) {
        await ProcessedMessage.deleteMany({});
        await BotSession.deleteMany({});
      }
    } catch (e) { }
  },
  _clearDedupCacheForTesting: async () => {
    processedMessageIdsCache.clear();
    incomingMsgDeduplication.clear();
    blockedNoticeCooldown.clear();
    activeSessionLocks.clear();
    try {
      if (require('mongoose').connection.readyState === 1) {
        await ProcessedMessage.deleteMany({});
      }
    } catch (e) { }
  }
};
