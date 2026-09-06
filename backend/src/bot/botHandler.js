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
const {
  generateDailyCatholicMessage,
  generateSaintCaption,
  generateSaintInfoMessage,
  generateVerseMessage,
  generateReadingsMessage,
  generateReflectionMessage
} = require('../services/whatsappDailyFormatter');
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
/**
 * Exact Bilingual Language Selection Prompt for Step 1
 */
function getBilingualLanguageSelectionPrompt() {
  return `🙏 Welcome to *SJDB CONNECT!*

வணக்கம்! *SJDB CONNECT*-க்கு உங்களை அன்புடன் வரவேற்கிறோம்! 🙏

*How would you like to continue with SJDB CONNECT?*
*SJDB CONNECT-ஐ எந்த மொழியில் தொடர விரும்புகிறீர்கள்?*

1️⃣ *Tamil / தமிழ்*
2️⃣ *English / ஆங்கிலம்*

👉 Please reply with *1 or 2*.
👉 *1 அல்லது 2* என்று மட்டும் பதிலளிக்கவும்.`;
}

/**
 * Main Menu Message (Quick Commands — Tamil / English)
 */
function getMainMenuMessage(userName, isTamil = false) {
  if (isTamil) {
    const greeting = userName ? `வணக்கம், *${userName}*! 🙏` : `🙏 *வணக்கம்!*`;
    return `${greeting}
⛪ *புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்*
_SJDB CONNECT_

இன்று உங்களுக்கு எவ்வாறு உதவ முடியும்?

1️⃣ 📖 *தினசரி விவிலியம்*
2️⃣ ⛪ *திருப்பலி நேரங்கள்*
3️⃣ 🕊️ *பங்கு சேவைகள்*
4️⃣ 📅 *நிகழ்வுகள்*
5️⃣ 📢 *அறிவிப்புகள்*
6️⃣ 📜 *ஆலய விபரம்*
7️⃣ 🌟 *இன்றைய புனிதர்*
8️⃣ ❓ *உதவி*

👉 *எண்களை அனுப்பலாம் அல்லது உங்கள் கேள்விகளைத் தட்டச்சு செய்யலாம்.*`;
  }

  const greeting = userName ? `👋 *Welcome, ${userName}!*` : `👋 *Welcome to SJDB Connect!*`;
  return `${greeting}
⛪ *St. John de britto Church, Kalayarkoil*

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
 * Dedicated 1-14 Services & Help Desk Message (Tamil / English)
 */
function getServicesMenuMessage(isTamil = false) {
  if (isTamil) {
    return `⛪ *SJDB Connect – பங்கு சேவைகள் & உதவி மையம்*
_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_

1️⃣ ⛪ *திருப்பலி நேரங்கள்*
2️⃣ 🕊️ *பாவசங்கீர்த்தன நேரங்கள்*
3️⃣ ✝️ *மற்ற திருவருட்சாதனங்கள்*
4️⃣ 📖 *தினசரி இறைவார்த்தை*
5️⃣ 📜 *திருப்பலி வாசகங்கள்*
6️⃣ 🌟 *இன்றைய புனிதர்*
7️⃣ 🙏 *கத்தோலிக்க ஜெபங்கள்*
8️⃣ 📅 *ஆலய நிகழ்வுகள்*
9️⃣ 📢 *பங்கு அறிவிப்புகள்*
🔟 📍 *ஆலய அமைவிடம் & வரைபடம்*
1️⃣1️⃣ 👥 *அன்பியங்கள் & பங்கு அமைப்புகள்*
1️⃣2️⃣ 👑 *பங்குத்தந்தை & குருக்கள்*
1️⃣3️⃣ 🏛️ *ஆலய வரலாறு*
1️⃣4️⃣ 📞 *தொடர்பு & அலுவலக நேரம்*

👉 *எண் (1-14) அனுப்பலாம் அல்லது உங்கள் கேள்விகளை நேரடியாகக் கேட்கலாம்.*`;
  }

  return `⛪ *SJDB Connect – Services & Help Desk*
_St. John de britto Church, Kalayarkoil_

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
 * Step 2: Phone Number Verification Prompt (Tamil / English)
 */
function getPhoneVerificationPrompt(formattedPhoneOrIsTamil, maybeIsTamil = false) {
  const isTamil = typeof formattedPhoneOrIsTamil === 'boolean' ? formattedPhoneOrIsTamil : Boolean(maybeIsTamil);
  if (isTamil) {
    return `🙏 வணக்கம்! *SJDB CONNECT*-க்கு உங்களை அன்புடன் வரவேற்கிறோம்!
⛪ *புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்*

🔐 *தொலைபேசி எண் சரிபார்ப்பு*

தொடர்ந்து பங்கு சேவைகளைப் பயன்படுத்த, உங்கள் **10-இலக்க மொபைல் எண்ணை** உள்ளிடவும்:
📱 (எ.கா: *9876543210*)`;
  }
  return `🙏 Welcome to *SJDB CONNECT*!
⛪ *St. John de britto Church, Kalayarkoil*

🔐 *Phone Number Verification*

To continue accessing parish services, please enter your **10-digit mobile number**:
📱 (e.g., *9876543210*)`;
}

/**
 * Step 2 Alternative: Enter Manual 10-digit Mobile Phone Number
 */
function getManualPhonePrompt(isTamil = false) {
  if (isTamil) {
    return `📱 *மொபைல் எண்ணை உள்ளிடவும்*

தயவுசெய்து உங்கள் 10-இலக்க மொபைல் எண்ணை உள்ளிடவும் (எ.கா: *9876543210*):`;
  }
  return `📱 *Enter Mobile Number*

Please reply with your 10-digit mobile phone number (e.g., *9876543210*):`;
}

/**
 * Step 3: 6-Digit OTP Dispatch Prompt
 */
function getOtpPrompt(otp, isTamil = false) {
  if (isTamil) {
    return `🔐 *OTP சரிபார்ப்பு*

உங்கள் 6-இலக்க சரிபார்ப்புக் குறியீடு (OTP):
👉 *${otp}*

⏳ இது *5 நிமிடங்கள்* மட்டுமே செல்லுபடியாகும்.

👉 தொடர உங்கள் *6-இலக்க OTP குறியீட்டை* உள்ளிடவும்:`;
  }
  return `🔐 *OTP Verification*

Your 6-digit verification code (OTP) is:
👉 *${otp}*

⏳ Valid for *5 minutes*.

👉 Please reply with your *6-digit OTP code* to verify:`;
}

/**
 * Step 4 & 5: Phone Number Verified + Preferences Menu (Displayed immediately after successful OTP)
 */
function getVerifiedAndPreferencesPrompt(isTamil = false) {
  if (isTamil) {
    return `✅ *தொலைபேசி எண் சரிபார்க்கப்பட்டது!*
*SJDB CONNECT*-க்கு உங்களை அன்புடன் வரவேற்கிறோம்! 🙏

⚙️ *SJDB Connect விருப்பங்கள்*

நீங்கள் பெற விரும்பும் சேவைகளைத் தேர்ந்தெடுக்கவும்:

1️⃣ 📖 தினசரி விவிலியம்
2️⃣ 🌟 இன்றைய புனிதர்
3️⃣ 📜 திருப்பலி வாசகங்கள் & தியானம்
4️⃣ 📅 ஆலய நிகழ்வுகள்
5️⃣ 📢 பங்கு அறிவிப்புகள்
6️⃣ 🌟 மேற்கண்ட அனைத்தும்

👉 எண்களை காற்புள்ளியுடன் (எ.கா: *1,2,3*) அல்லது அனைத்திற்கும் *6* என்று பதிலளிக்கவும்.`;
  }
  return `✅ *Phone Number Verified!*
Welcome to *SJDB CONNECT*! 🙏

⚙️ *SJDB Connect Preferences*

Please select the services you would like to receive:

1️⃣ 📖 Daily Bible Verse
2️⃣ 🌟 Saint of the Day
3️⃣ 📜 Daily Mass Readings & Reflection
4️⃣ 📅 Church Events
5️⃣ 📢 Parish Announcements
6️⃣ 🌟 All of the above

👉 Reply with numbers separated by commas (e.g. *1,2,3*) or reply *6* for all services.`;
}

/**
 * Step 6: Daily Catholic Content Language Selection Prompt
 */
function getCatholicLanguagePrompt(isTamil = false) {
  if (isTamil) {
    return `🌐 *Daily Catholic Content Language*

தினசரி கத்தோலிக்க உள்ளடக்கத்தை எந்த மொழியில் பெற விரும்புகிறீர்கள்?

1️⃣ *Tamil / தமிழ்*
2️⃣ *English / ஆங்கிலம்*
3️⃣ Both *Tamil / தமிழ்* & *English / ஆங்கிலம்*

👉 *1, 2 அல்லது 3* என்று பதிலளிக்கவும்.`;
  }
  return `🌐 *Daily Catholic Content Language*

Which language would you like to receive your Daily Catholic Content in?

1️⃣ *Tamil / தமிழ்*
2️⃣ *English / ஆங்கிலம்*
3️⃣ Both *Tamil / தமிழ்* & *English / ஆங்கிலம்*

👉 Please reply with *1, 2, or 3*.`;
}

/**
 * Format Subscribed Services list based on user's chosen preferences
 */
function formatSubscribedServices(preferences = [], isTamil = false) {
  const prefMapEn = {
    verse: '• 📖 Daily Bible Verse',
    saint: '• 🕊️ Saint of the Day',
    mass: '• ⛪ Daily Mass Readings & Reflection',
    events: '• 📅 Church Events',
    announcements: '• 📢 Parish Announcements',
    birthday: '• 🎂 Birthday Wishes'
  };

  const prefMapTa = {
    verse: '• 📖 தினசரி விவிலியம்',
    saint: '• 🕊️ இன்றைய புனிதர்',
    mass: '• ⛪ தினசரி திருப்பலி வாசகங்கள் & தியானம்',
    events: '• 📅 ஆலய நிகழ்வுகள்',
    announcements: '• 📢 பங்கு அறிவிப்புகள்',
    birthday: '• 🎂 பிறந்தநாள் வாழ்த்துக்கள்'
  };

  const map = isTamil ? prefMapTa : prefMapEn;
  const userPrefs = Array.isArray(preferences) && preferences.length > 0
    ? preferences
    : ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday'];

  const order = ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday'];
  const lines = [];

  for (const key of order) {
    if (userPrefs.includes(key) || key === 'birthday') {
      lines.push(map[key]);
    }
  }

  return lines.join('\n');
}

/**
 * Step 7: Setup Complete Confirmation Message with Subscribed Services
 */
function getSetupCompleteMessage(preferences = [], catholicLang = 'both', isTamil = false) {
  let userPrefs = preferences;
  if (typeof preferences === 'string') {
    userPrefs = ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday'];
  }

  const servicesList = formatSubscribedServices(userPrefs, isTamil);

  let catLangLabel = 'Both (Tamil + English)';
  if (catholicLang === 'ta') {
    catLangLabel = isTamil ? 'தமிழ்' : 'Tamil';
  } else if (catholicLang === 'en') {
    catLangLabel = isTamil ? 'ஆங்கிலம்' : 'English';
  } else {
    catLangLabel = isTamil ? 'இரண்டும் (தமிழ் + ஆங்கிலம்)' : 'Both (Tamil + English)';
  }

  if (isTamil) {
    return `✅ *அனைத்தும் தயார்!*

📋 *நீங்கள் பதிவு செய்த சேவைகள்:*
${servicesList}

🌐 தினசரி கத்தோலிக்க உள்ளடக்க மொழி: *${catLangLabel}*
⏰ தினசரி கத்தோலிக்க வழிபாட்டுச் செய்திகள் தினமும் காலையில் சரியாய் *4:00 AM IST* வழங்கப்படும்.

இறைவன் உங்களையும் உங்கள் குடும்பத்தினரையும் ஆசீர்வதிப்பாராக! 🙏❤️
— *SJDB Connect*
_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_

➡️ விரைவு கட்டளைகளுக்கு *Menu* என தட்டச்சு செய்யவும்
➡️ பங்கு உதவி மையத்திற்கு *Services* என தட்டச்சு செய்யவும்`;
  }

  return `✅ *You're all set!*

📋 *Your Subscribed Services:*
${servicesList}

🌐 Daily Catholic Content Language: *${catLangLabel}*
⏰ Daily Catholic broadcast is delivered sharply at *4:00 AM IST*.

May God bless you and your family! 🙏❤️
— *SJDB Connect*
_St. John de Britto's Church, Kalayarkoil_

➡️ Type *Menu* for Quick Commands
➡️ Type *Services* for Help Desk`;
}

/**
 * SJDB Connect Assistance Message (sent in another message after setup completion)
 */
function getAssistanceMessage(isTamil = false) {
  if (isTamil) {
    return `🙏 *SJDB Connect வழிகாட்டி & உதவி*

*ஆலயத் தகவல்கள், கத்தோலிக்க விசுவாசம் மற்றும் SJDB Connect சேவைகள்* குறித்து நான் உங்களுக்கு உதவ முடியும்.

📌 *நீங்கள் என்னிடம் கேட்கக்கூடியவை:*

• ⛪ திருப்பலி, ஒப்புரவு & பிற திருவருட்சாதன நேரங்கள்
• 📖 விவிலிய வசனங்கள், விவிலியக் கேள்விகள் & கத்தோலிக்க போதனைகள்
• 🕊️ தினசரி திருப்பலி வாசகங்கள், தியானம் & இன்றைய புனிதர்
• 🙏 கத்தோலிக்க ஜெபங்கள் & ஜெப வழிகாட்டல்கள்
• ✝️ திருவருட்சாதனங்கள் & ஆன்மீக வழிகாட்டல்கள்
• 📜 புனித அருளானந்தர் ஆலய வரலாறு & பங்கு விபரங்கள்
• 📅 ஆலய நிகழ்வுகள், நிகழ்ச்சிகள் & பங்கு அறிவிப்புகள்
• 👥 பங்குத்தந்தை, குருக்கள் & அன்பிய விபரங்கள்
• 🏛️ பங்கு அமைப்புகள், பக்த சபைகள் & சேவைகள்
• 📍 ஆலய அமைவிடம், தொடர்பு & வருகை தகவல்கள்
• 🗓️ வழிபாட்டு நாட்காட்டி, திருவிழாக்கள் & முக்கிய கத்தோலிக்க நாட்கள்
• 🎉 பங்கு பெருவிழாக்கள் & சிறப்பு நிகழ்வுகள்
• 📝 நிகழ்வு முன்பதிவு & பங்கு விண்ணப்பப் படிவங்கள்
• 📱 SJDB Connect & பங்கு இணையதள வழிகாட்டுதல்
• 🔔 அறிவிப்புகள், தினசரி கத்தோலிக்க உள்ளடக்கம் & விருப்பங்கள்
• 🌐 ஆலய இணையதளத்தில் தகவல்களைத் தேடுதல்

ஆலயம், கத்தோலிக்க விசுவாசம் அல்லது பங்கு சேவைகள் தொடர்பான உங்கள் கேள்விகளைத் தட்டச்சு செய்து கேட்கலாம். 🙏`;
  }

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

Please ask a church, Catholic faith, parish, or SJDB Connect-related question. 🙏`;
}

/**
 * Updated Help & Guidance Message
 */
function getHelpMessage(isTamil = false) {
  if (isTamil) {
    return `❓ *SJDB Connect — உதவி & வழிகாட்டி*
_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_

📌 *பயன்படுத்தக்கூடிய முக்கிய கட்டளைகள்:*
• *MENU* — முதன்மை மெனு
• *SERVICES* — 14 பங்கு சேவைகள் பட்டியல்
• *BOT LANGUAGE* — SJDB CONNECT Bot மொழியை மாற்ற
• *CATHOLIC LANGUAGE* — தினசரி கத்தோலிக்க உள்ளடக்கத்தின் மொழியை மாற்ற
• *VERIFY* — தொலைபேசி எண் சரிபார்ப்பு
• *STOP* — தினசரி செய்திகளை நிறுத்த

💡 *1 முதல் 8 வரை எண்களில் பதிலளிக்கலாம் அல்லது உங்கள் கேள்வியை இயல்பாகத் தட்டச்சு செய்து அனுப்பலாம்!*`;
  }
  return `❓ *SJDB Connect — Help & Guidance*
_St. John de britto Church, Kalayarkoil_

📌 *Key Commands You Can Type Anytime:*
• *MENU* — Main Navigation Menu
• *SERVICES* — 14-Option Parish Services Directory
• *BOT LANGUAGE* — Change SJDB CONNECT Bot Language
• *CATHOLIC LANGUAGE* — Change Daily Catholic Content Language
• *VERIFY* — Phone Number Verification
• *STOP* — Stop daily messages

💡 *You can reply with numbers 1 to 8 or type your question naturally in English or Tamil!*`;
}

/**
 * Check if the input message contains non-English / non-Tamil scripts
 */
function isUnsupportedLanguage(text) {
  if (!text) return false;
  const foreignScriptsRegex = /[\u0600-\u06FF\u0750-\u077F\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u1200-\u137F\u1780-\u17FF\u1800-\u18AF\u1900-\u194F\u2C00-\u2C5F\u2D30-\u2D7F\u3040-\u30FF\u3100-\u312F\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\u0400-\u04FF\u0370-\u03FF]/;
  return foreignScriptsRegex.test(text);
}

async function sendTodayVerseToUser(replyTarget, session, wa, isTamil = false) {
  try {
    const dailyContent = await getCachedDailyContent();
    const lang = session.catholicLanguage || (isTamil ? 'ta' : (session.language || 'en'));
    const msg = generateVerseMessage({ dailyContent, language: lang });
    await wa.sendWhatsAppMessage(replyTarget, msg);
  } catch (err) {
    console.error('[BotHandler] Error delivering verse:', err.message);
    const fallbackText = isTamil
      ? `📖 *தினசரி இறைவார்த்தை*\n\nஇன்றைய இறைவார்த்தையை இணையத்தில் வாசிக்க:\n${getSiteUrl(SITE_ROUTES.DAILY_VERSE)}`
      : `📖 *Daily Bible Verse*\n\nView today's Bible verse online:\n${getSiteUrl(SITE_ROUTES.DAILY_VERSE)}`;
    await wa.sendWhatsAppMessage(replyTarget, fallbackText);
  }
}

async function sendTodayReadingsToUser(replyTarget, session, wa, isTamil = false) {
  try {
    const dailyContent = await getCachedDailyContent();
    const lang = session.catholicLanguage || (isTamil ? 'ta' : (session.language || 'en'));
    const msg = generateReadingsMessage({ dailyContent, language: lang });
    await wa.sendWhatsAppMessage(replyTarget, msg);
  } catch (err) {
    console.error('[BotHandler] Error delivering readings:', err.message);
    const fallbackText = isTamil
      ? `📖 *தினசரி திருப்பலி வாசகங்கள்*\n\nமுழு வாசகங்களை இணையத்தில் வாசிக்க:\n${getSiteUrl(SITE_ROUTES.DAILY_READINGS)}`
      : `📖 *Daily Mass Readings*\n\nRead complete readings online:\n${getSiteUrl(SITE_ROUTES.DAILY_READINGS)}`;
    await wa.sendWhatsAppMessage(replyTarget, fallbackText);
  }
}

async function sendTodayReflectionToUser(replyTarget, session, wa, isTamil = false) {
  try {
    const dailyContent = await getCachedDailyContent();
    const lang = session.catholicLanguage || (isTamil ? 'ta' : (session.language || 'en'));
    const msg = generateReflectionMessage({ dailyContent, language: lang });
    await wa.sendWhatsAppMessage(replyTarget, msg);
  } catch (err) {
    console.error('[BotHandler] Error delivering reflection:', err.message);
    const fallbackText = isTamil
      ? `🕊️ *தினசரி தியானம்*\n\nஇன்றைய தியானத்தை இணையத்தில் வாசிக்க:\n${getSiteUrl(SITE_ROUTES.DAILY_REFLECTION)}`
      : `🕊️ *Daily Reflection*\n\nRead today's reflection online:\n${getSiteUrl(SITE_ROUTES.DAILY_REFLECTION)}`;
    await wa.sendWhatsAppMessage(replyTarget, fallbackText);
  }
}

async function sendTodaySaintToUser(replyTarget, session, wa, isTamil = false) {
  try {
    const dailyContent = await getCachedDailyContent();
    const lang = session.catholicLanguage || (isTamil ? 'ta' : (session.language || 'en'));
    const saintImageUrl = dailyContent?.saintImage || dailyContent?.saint?.image || dailyContent?.saintOfTheDay?.english?.imageUrl;
    const saintInfoMsg = generateSaintInfoMessage({ dailyContent, language: lang });

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
  } catch (err) {
    console.error('[BotHandler] Error delivering saint info:', err.message);
    const fallbackText = isTamil
      ? `✝️ *இன்றைய புனிதர்*\n\nஇன்றைய புனிதர் பற்றி இணையத்தில் வாசிக்க:\n${getSiteUrl(SITE_ROUTES.SAINT_OF_THE_DAY)}`
      : `✝️ *Saint of the Day*\n\nRead about today's saint online:\n${getSiteUrl(SITE_ROUTES.SAINT_OF_THE_DAY)}`;
    await wa.sendWhatsAppMessage(replyTarget, fallbackText);
  }
}

async function sendFullDevotionsToUser(replyTarget, session, wa, isTamil = false) {
  try {
    const dailyContent = await getCachedDailyContent();
    const lang = session.catholicLanguage || (isTamil ? 'ta' : (session.language || 'en'));

    const msg1 = generateDailyCatholicMessage({
      dailyContent,
      language: lang,
      readingPreference: 'full'
    });
    const readingsLink = isTamil
      ? `\n\n🌐 *முழு திருப்பலி வாசகங்களை இணையத்தில் வாசிக்க:* ${getSiteUrl(SITE_ROUTES.DAILY_READINGS)}`
      : `\n\n🌐 *Read complete Mass Readings online:* ${getSiteUrl(SITE_ROUTES.DAILY_READINGS)}`;
    await wa.sendWhatsAppMessage(replyTarget, `${msg1}${readingsLink}`);
  } catch (err) {
    console.error('[BotHandler] Error delivering devotions:', err.message);
    const fallbackText = isTamil
      ? `📖 *தினசரி கத்தோலிக்க வாசகங்கள் & தியானம்*\n\nஇன்றைய திருப்பலி வாசகங்களை இணையத்தில் வாசிக்க:\n${getSiteUrl(SITE_ROUTES.DAILY_READINGS)}`
      : `📖 *Daily Catholic Readings & Devotions*\n\nView today's Mass readings, verse and reflection online:\n${getSiteUrl(SITE_ROUTES.DAILY_READINGS)}`;
    await wa.sendWhatsAppMessage(replyTarget, fallbackText);
  }
}

async function handleConversationalBirthdayRequest(replyTarget, session, wa, isTamil = false) {
  try {
    const { isUserBirthdayToday, getBirthdayMessages, getISTDateParts } = require('../services/birthdayService');
    let linkedUser = null;
    if (session.linkedUserId) {
      linkedUser = await User.findById(session.linkedUserId);
    } else {
      const searchPhone = (session.providedPhone || session.phoneNumber || '').replace(/\D/g, '').slice(-10);
      if (searchPhone) {
        linkedUser = await User.findOne({ phone: { $regex: searchPhone } });
      }
    }

    const userName = linkedUser?.name || session.pushName || (isTamil ? 'அன்பரே' : 'Parishioner');
    const todayIST = getISTDateParts(new Date());

    if (linkedUser && linkedUser.dob) {
      const isToday = isUserBirthdayToday(linkedUser.dob, todayIST);
      if (isToday) {
        const blessing = getBirthdayMessages(linkedUser.name, isTamil ? 'ta' : 'en');
        await wa.sendWhatsAppMessage(replyTarget, blessing.text);
        return;
      }

      const dobDate = new Date(linkedUser.dob);
      const dobFormatted = dobDate.toLocaleDateString(isTamil ? 'ta-IN' : 'en-GB', {
        day: 'numeric',
        month: 'long'
      });

      const upcomingMsg = isTamil
        ? `🎂 *வணக்கம், ${userName}!*

📅 உங்கள் பதிவு செய்யப்பட்ட பிறந்தநாள்: *${dobFormatted}*

✨ *SJDB CONNECT தானியங்கி வாழ்த்து அமைப்பு:*
உங்கள் பிறந்தநாளன்று நள்ளிரவு சரியாய் *12:00 மணிக்கு (12:00 AM IST)*, பங்குத்தந்தையின் சிறப்பு ஆசீரும் வாழ்த்துக்களும் உங்களுக்கு வாட்ஸ்அப் மூலம் தானாக அனுப்பி வைக்கப்படும்! 🙏🎂

இறைவன் உங்களையும் உங்கள் குடும்பத்தினரையும் ஆசீர்வதிப்பாராக! ❤️`
        : `🎂 *Hello, ${userName}!*

📅 Your Registered Birthday: *${dobFormatted}*

✨ *SJDB CONNECT Automated Birthday Notification System:*
On your birthday sharply at *12:00 AM midnight IST*, parish blessings and personalized greetings will be automatically delivered to you here on WhatsApp! 🙏🎂

May God bless you and your family abundantly! ❤️`;

      await wa.sendWhatsAppMessage(replyTarget, upcomingMsg);
      return;
    }

    const noDobMsg = isTamil
      ? `🎂 *வணக்கம், ${userName}!*

உங்கள் பங்கு சுயவிவரத்தில் பிறந்த தேதி (DOB) இன்னும் பதிவு செய்யப்படவில்லை.

✨ உங்கள் பிறந்தநாளன்று நள்ளிரவு சரியாய் *12:00 மணிக்கு (12:00 AM IST)* தானாக வாட்ஸ்அப்பில் ஆசீர்வாத வாழ்த்துக்களைப் பெற, உங்கள் பங்கு கணக்கில் பிறந்த தேதியை பதிவு செய்யவும்:
🌐 ${getSiteUrl(SITE_ROUTES.PROFILE_EDIT || '/profile')}

பதிவு செய்த பிறகு, ஆண்டுதோறும் உங்கள் பிறந்தநாளில் நள்ளிரவில் தானாகவே வாழ்த்துக்கள் வழங்கப்படும்! 🙏❤️`
      : `🎂 *Hello, ${userName}!*

Your Date of Birth (DOB) is not yet registered in your church profile.

✨ To automatically receive church birthday blessings here on WhatsApp sharply at *12:00 AM midnight IST*, please update your Date of Birth in your profile:
🌐 ${getSiteUrl(SITE_ROUTES.PROFILE_EDIT || '/profile')}

Once updated, you will automatically receive midnight birthday wishes every year! 🙏❤️`;

    await wa.sendWhatsAppMessage(replyTarget, noDobMsg);
  } catch (err) {
    console.error('[BotHandler] Birthday query handler error:', err.message);
  }
}

async function handleIncomingMessage(fromNumber, body, rawJid, pushName, messageId = null, messageTimestamp = null) {
  const rawText = (body || '').trim();
  if (!rawText) return;
  const normalizedText = rawText.toLowerCase().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

  const replyTarget = rawJid || fromNumber;

  // 0. Signal Session Decryption Error Guard (Never process decryption errors / Bad MAC as user commands)
  const { isSignalDecryptionError, signalSessionTracker } = require('./signalSessionRecovery');
  if (isSignalDecryptionError(rawText)) {
    signalSessionTracker.recordDecryptFailure(replyTarget, rawText);
    console.warn(`[WHATSAPP-SESSION] Signal decryption error text intercepted — dropping message for ${fromNumber}`);
    return;
  }

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
      session = new BotSession({ phoneNumber: sessionKey, step: 'language_selection' });
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

    const isStopCommand = /^(stop|unsubscribe|நிறுத்து|விலகு)$/i.test(normalizedText);
    if (isStopCommand) {
      session.step = 'stopped';
      session.isOnboarded = false;
      session.isVerified = false;
      session.preferences = [];
      session.language = null;
      await session.save();

      if (session.linkedUserId) {
        try {
          await User.findByIdAndUpdate(session.linkedUserId, { whatsappOptIn: false, botPreferences: [] });
        } catch (e) { }
      }

      const stopMsg = `You have been unsubscribed from SJDB Connect.

Reply *HI* anytime to re-subscribe. God bless! 🙏

—
நீங்கள் *SJDB Connect* சேவையிலிருந்து விலகியுள்ளீர்கள்.

மீண்டும் இணைய எப்போது வேண்டுமானாலும் *HI* என்று பதிலளிக்கவும். இறை ஆசீர்வாதம்! 🙏`;
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

— *St. John de britto Church, Kalayarkoil*
_SJDB Connect_`;
          await wa.sendWhatsAppMessage(replyTarget, emergencyMsg);
          return;
        }

        const maintMsg = `🔧 *SJDB Connect is Temporarily Unavailable*

Our church digital services are currently under maintenance.
The WhatsApp Bot is temporarily unavailable while we carry out scheduled maintenance and improvements.

Please try again later. Thank you for your patience.

— *St. John de britto Church, Kalayarkoil*
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

    const cleanDigits = phone ? phone.slice(-10) : '';
    const formattedPhone = cleanDigits.length === 10
      ? `+91 ${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5)}`
      : (phone ? `+${phone}` : (fromNumber || ''));

    // ── Stopped State Guard ───────────────────────────────────────────────────
    if (session.step === 'stopped') {
      const isRestartGreeting = /^(hi|hello|hey|vanakkam|வணக்கம்|start)$/i.test(normalizedText);
      if (isRestartGreeting) {
        session.step = 'bot_language';
        session.pendingStep = 'bot_language';
        session.waitingForReply = true;
        session.language = null;
        session.isVerified = false;
        session.isOnboarded = false;
        session.preferences = [];
        await session.save();

        const langPrompt = getBilingualLanguageSelectionPrompt();
        await wa.sendWhatsAppMessage(replyTarget, langPrompt);
        return;
      }

      // Any other command (including MENU or SERVICES) for a stopped user must NOT bypass onboarding!
      const unsubscribedNotice = `You are currently unsubscribed from SJDB Connect. Reply *HI* to re-subscribe and get started. 🙏\n\n—\nநீங்கள் தற்போது *SJDB Connect* சேவையிலிருந்து விலகியுள்ளீர்கள். மீண்டும் இணைய *HI* என்று பதிலளிக்கவும். இறை ஆசீர்வாதம்! 🙏`;
      await wa.sendWhatsAppMessage(replyTarget, unsubscribedNotice);
      return;
    }

    // ── STEP 1: Language Selection Gate (Strictly Before Phone Verification or Any Bot Feature) ──
    const isLanguageSelectionStep = session.step === 'language_selection' || session.step === 'bot_language' || session.step === 'welcome' || !session.language;
    if (isLanguageSelectionStep) {
      if (/^(1|tamil|தமிழ்|ta)$/i.test(normalizedText)) {
        session.language = 'ta';
        session.step = 'phone_verification';
        session.pendingStep = 'phone_verification';
        session.waitingForReply = true;
        await session.save();

        await wa.sendWhatsAppMessage(replyTarget, getPhoneVerificationPrompt(formattedPhone, true));
        return;
      }

      if (/^(2|english|ஆங்கிலம்|eng|en)$/i.test(normalizedText)) {
        session.language = 'en';
        session.step = 'phone_verification';
        session.pendingStep = 'phone_verification';
        session.waitingForReply = true;
        await session.save();

        await wa.sendWhatsAppMessage(replyTarget, getPhoneVerificationPrompt(formattedPhone, false));
        return;
      }

      // If already waiting for a reply, send concise correction ONLY without repeating the welcome greeting
      if (session.waitingForReply && (session.pendingStep === 'bot_language' || session.step === 'bot_language' || session.step === 'language_selection')) {
        const conciseCorrection = `👉 Please reply with *1* or *2*.\n👉 தயவுசெய்து *1* அல்லது *2* என்று பதிலளிக்கவும்.`;
        await wa.sendWhatsAppMessage(replyTarget, conciseCorrection);
        session.step = 'bot_language';
        session.pendingStep = 'bot_language';
        session.waitingForReply = true;
        await session.save();
        return;
      }

      // First-time greeting: send full bilingual welcome & wait
      session.step = 'bot_language';
      session.pendingStep = 'bot_language';
      session.waitingForReply = true;
      await session.save();

      const langPrompt = getBilingualLanguageSelectionPrompt();
      await wa.sendWhatsAppMessage(replyTarget, langPrompt);
      return;
    }

    // ── Bot Response Language (Always Determined by User's Saved Language Preference) ──
    const botLang = session.language === 'ta' ? 'ta' : 'en';
    const isTamil = botLang === 'ta';

    // ── Global Setting & Navigation Commands (Can be triggered anytime) ─────────
    const isBotLangCmd = /^(bot\s*language|bot\s*lang|பாட்\s*மொழி|language|lang|மொழி)$/i.test(normalizedText);
    if (isBotLangCmd) {
      session.step = 'bot_language_change';
      session.pendingStep = 'bot_language_change';
      session.waitingForReply = true;
      await session.save();
      await wa.sendWhatsAppMessage(replyTarget, getBilingualLanguageSelectionPrompt());
      return;
    }

    const isCatholicLangCmd = /^(catholic\s*language|catholic\s*lang|devotion\s*language|கத்தோலிக்க\s*மொழி)$/i.test(normalizedText);
    if (isCatholicLangCmd) {
      session.step = 'catholic_language_change';
      session.pendingStep = 'catholic_language_change';
      session.waitingForReply = true;
      await session.save();
      await wa.sendWhatsAppMessage(replyTarget, getCatholicLanguagePrompt(isTamil));
      return;
    }

    const isHelpCmd = /^(help|\?|உதவி|commands|options|வழிகாட்டி)$/i.test(normalizedText);
    if (isHelpCmd) {
      const helpMsg = getHelpMessage(isTamil);
      await wa.sendWhatsAppMessage(replyTarget, helpMsg);
      return;
    }

    const isVerifyCmd = /^(verify|reverify|சரிபார்)$/i.test(normalizedText);
    if (isVerifyCmd) {
      session.isVerified = false;
      session.step = 'phone_verification';
      session.pendingStep = 'phone_verification';
      session.waitingForReply = true;
      await session.save();
      await wa.sendWhatsAppMessage(replyTarget, getPhoneVerificationPrompt(formattedPhone, isTamil));
      return;
    }

    // ── Language Change State Handlers ──────────────────────────────────────────
    if (session.step === 'bot_language_change') {
      if (/^(1|tamil|தமிழ்|ta)$/i.test(normalizedText)) {
        session.language = 'ta';
        session.step = 'done';
        session.pendingStep = null;
        session.waitingForReply = false;
        await session.save();
        if (session.linkedUserId) {
          try { await User.findByIdAndUpdate(session.linkedUserId, { preferredLanguage: 'ta' }); } catch (e) {}
        }
        const taAck = `✅ *உங்கள் பாட் மொழி தமிழாக மாற்றப்பட்டது! (Bot language set to Tamil)*\n\nஇனி பாட் தகவல்கள் மற்றும் மெனுக்கள் தமிழில் வழங்கப்படும்.\n📌 உதவிக்கு *MENU* அல்லது *SERVICES* என தட்டச்சு செய்யவும்.`;
        await wa.sendWhatsAppMessage(replyTarget, taAck);
        return;
      }

      if (/^(2|english|ஆங்கிலம்|eng|en)$/i.test(normalizedText)) {
        session.language = 'en';
        session.step = 'done';
        session.pendingStep = null;
        session.waitingForReply = false;
        await session.save();
        if (session.linkedUserId) {
          try { await User.findByIdAndUpdate(session.linkedUserId, { preferredLanguage: 'en' }); } catch (e) {}
        }
        const enAck = `✅ *Bot language updated to English successfully!*\n\nFuture bot responses and navigation menus will be delivered in English.\n📌 Type *MENU* for Quick Commands or *SERVICES* for Help Desk.`;
        await wa.sendWhatsAppMessage(replyTarget, enAck);
        return;
      }

      const prompt = `👉 Please reply with *1* or *2*.\n👉 தயவுசெய்து *1* அல்லது *2* என்று பதிலளிக்கவும்.`;
      await wa.sendWhatsAppMessage(replyTarget, prompt);
      return;
    }

    if (session.step === 'catholic_language_change') {
      if (/^(1|tamil|தமிழ்|ta)$/i.test(normalizedText)) {
        session.catholicLanguage = 'ta';
        session.step = 'done';
        session.pendingStep = null;
        session.waitingForReply = false;
        await session.save();
        if (session.linkedUserId) {
          try { await User.findByIdAndUpdate(session.linkedUserId, { mass_reflection_language: 'ta' }); } catch (e) {}
        }
        const ack = isTamil
          ? `✅ *தினசரி கத்தோலிக்க உள்ளடக்க மொழி தமிழாக மாற்றப்பட்டது!*\nதினசரி விவிலியம், திருப்பலி வாசகங்கள், தியானம் & புனிதர் விபரம் தமிழில் வழங்கப்படும்.\n\n📌 உதவிக்கு *MENU* அல்லது *SERVICES* என தட்டச்சு செய்யவும்.`
          : `✅ *Daily Catholic Content Language set to Tamil!*\nDaily Bible Verse, Mass Readings, Reflection & Saint of the Day will be delivered in Tamil.\n\n📌 Type *MENU* for Quick Commands or *SERVICES* for Help Desk.`;
        await wa.sendWhatsAppMessage(replyTarget, ack);
        return;
      }

      if (/^(2|english|ஆங்கிலம்|eng|en)$/i.test(normalizedText)) {
        session.catholicLanguage = 'en';
        session.step = 'done';
        session.pendingStep = null;
        session.waitingForReply = false;
        await session.save();
        if (session.linkedUserId) {
          try { await User.findByIdAndUpdate(session.linkedUserId, { mass_reflection_language: 'en' }); } catch (e) {}
        }
        const ack = isTamil
          ? `✅ *தினசரி கத்தோலிக்க உள்ளடக்க மொழி ஆங்கிலமாக மாற்றப்பட்டது!*\nதினசரி விவிலியம், திருப்பலி வாசகங்கள், தியானம் & புனிதர் விபரம் ஆங்கிலத்தில் வழங்கப்படும்.\n\n📌 உதவிக்கு *MENU* அல்லது *SERVICES* என தட்டச்சு செய்யவும்.`
          : `✅ *Daily Catholic Content Language set to English!*\nDaily Bible Verse, Mass Readings, Reflection & Saint of the Day will be delivered in English.\n\n📌 Type *MENU* for Quick Commands or *SERVICES* for Help Desk.`;
        await wa.sendWhatsAppMessage(replyTarget, ack);
        return;
      }

      if (/^(3|both|இரண்டும்|both tamil & english|all)$/i.test(normalizedText)) {
        session.catholicLanguage = 'both';
        session.step = 'done';
        session.pendingStep = null;
        session.waitingForReply = false;
        await session.save();
        if (session.linkedUserId) {
          try { await User.findByIdAndUpdate(session.linkedUserId, { mass_reflection_language: 'both' }); } catch (e) {}
        }
        const ack = isTamil
          ? `✅ *தினசரி கத்தோலிக்க உள்ளடக்க மொழி தமிழ் & ஆங்கிலம் (Both) என மாற்றப்பட்டது!*\nதினசரி விவிலியம், திருப்பலி வாசகங்கள், தியானம் & புனிதர் விபரம் இரு மொழிகளிலும் வழங்கப்படும்.\n\n📌 உதவிக்கு *MENU* அல்லது *SERVICES* என தட்டச்சு செய்யவும்.`
          : `✅ *Daily Catholic Content Language set to Both (Tamil & English)!*\nDaily Bible Verse, Mass Readings, Reflection & Saint of the Day will be delivered in both Tamil & English.\n\n📌 Type *MENU* for Quick Commands or *SERVICES* for Help Desk.`;
        await wa.sendWhatsAppMessage(replyTarget, ack);
        return;
      }

      const prompt = isTamil
        ? `👉 *1, 2 அல்லது 3* என்று பதிலளிக்கவும்.`
        : `👉 Please reply with *1, 2, or 3*.`;
      await wa.sendWhatsAppMessage(replyTarget, prompt);
      return;
    }

    // ── Dedicated Account Re-Verification Request / Support ───────────────────────
    const isReverifyHelp = /(re-?verify(\s*account)?|account\s*re-?verification|verify\s*account|reverification|கணக்கு\s*சரிபார்ப்பு|மறுசரிபார்ப்பு)/i.test(normalizedText);
    if (isReverifyHelp) {
      const clientUrl = (process.env.CLIENT_URL || 'https://st-jb-church.vercel.app').replace('http://localhost:5173', 'https://st-jb-church.vercel.app').replace(/\/$/, '');
      const reverifyInfoMsg = isTamil
        ? `*புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்*\n🔐 *கணக்கு மறுசரிபார்ப்பு சேவை*\n\nஉங்கள் பங்கு இணையதளக் கணக்கை மறுசரிபார்க்க அல்லது 6-இலக்க OTP குறியீட்டைப் பெற்று சரிபார்க்க, கீழே உள்ள நேரடி இணைப்பைப் பயன்படுத்தவும்:\n\n👉 *நேரடி சரிபார்ப்பு இணைப்பு:*\n${clientUrl}/verify-account\n\nபதிவுசெய்த மின்னஞ்சல் அல்லது தொலைபேசி எண்ணை உள்ளிட்டு 1 நிமிடத்தில் சரிபார்க்கலாம்.\n\n_புனித அருளானந்தர் தேவாலயம்_`
        : `*St. John de britto Church, Kalayarkoil*\n🔐 *Parish Account Re-Verification*\n\nTo complete your mandatory account re-verification or verify your 6-digit OTP code, please visit the direct portal link:\n\n👉 *Direct Verification Link:*\n${clientUrl}/verify-account\n\nEnter your registered email or phone number to receive a 5-minute code and verify in under 1 minute.\n\n_St. John de britto Church, Kalayarkoil_`;

      await wa.sendWhatsAppMessage(replyTarget, reverifyInfoMsg);
      return;
    }

    // ── STEP 2: Phone Number Verification State ─────────────────────────────────
    if (session.step === 'phone_verification' || session.step === 'ask_phone_manual') {
      const rawDigits = rawText.replace(/\D/g, '');
      if (rawDigits.length >= 10) {
        const clean10 = rawDigits.slice(-10);
        session.providedPhone = clean10;
        const parishUser = await User.findOne({ phone: { $regex: clean10 } });
        if (parishUser) session.linkedUserId = parishUser._id;

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        session.tempOtp = otp;
        session.tempOtpExpires = new Date(Date.now() + 5 * 60 * 1000);
        session.step = 'otp_verification';
        session.pendingStep = 'otp_verification';
        session.waitingForReply = true;
        await session.save();

        await wa.sendWhatsAppMessage(replyTarget, getOtpPrompt(otp, isTamil));
        return;
      }

      // Concise correction without repeating entire message
      const concisePhonePrompt = isTamil
        ? `👉 தயவுசெய்து உங்கள் 10-இலக்க மொபைல் எண்ணை உள்ளிடவும் (எ.கா: *9876543210*).`
        : `👉 Please enter your 10-digit mobile number (e.g., *9876543210*).`;
      await wa.sendWhatsAppMessage(replyTarget, concisePhonePrompt);
      return;
    }

    // ── STEP 3: OTP Verification State ──────────────────────────────────────────
    if (session.step === 'otp_verification') {
      const cleanOtpDigits = rawText.replace(/\D/g, '');
      if (cleanOtpDigits.length === 6) {
        if (session.tempOtpExpires && new Date() > new Date(session.tempOtpExpires)) {
          session.step = 'phone_verification';
          session.pendingStep = 'phone_verification';
          session.waitingForReply = true;
          session.tempOtp = null;
          session.tempOtpExpires = null;
          await session.save();
          const expMsg = isTamil
            ? `⚠️ இந்த OTP குறியீட்டின் காலம் முடிந்துவிட்டது. புதிய குறியீட்டைப் பெற மீண்டும் தொடரவும்:\n\n` + getPhoneVerificationPrompt(formattedPhone, true)
            : `⚠️ This OTP code has expired. Please verify your phone number again:\n\n` + getPhoneVerificationPrompt(formattedPhone, false);
          await wa.sendWhatsAppMessage(replyTarget, expMsg);
          return;
        }

        if (session.tempOtp && cleanOtpDigits === session.tempOtp) {
          session.isVerified = true;
          session.step = 'select_preferences';
          session.pendingStep = 'select_preferences';
          session.waitingForReply = true;
          session.tempOtp = null;
          session.tempOtpExpires = null;
          await session.save();

          // Send Step 4 (Phone Verified!) + Step 5 (Preferences Menu)
          await wa.sendWhatsAppMessage(replyTarget, getVerifiedAndPreferencesPrompt(isTamil));
          return;
        } else {
          const failMsg = isTamil
            ? `❌ தவறான OTP குறியீடு. தயவுசெய்து சரியான 6-இலக்க OTP குறியீட்டை உள்ளிடவும்:`
            : `❌ Invalid OTP code. Please enter the correct 6-digit verification code:`;
          await wa.sendWhatsAppMessage(replyTarget, failMsg);
          return;
        }
      }

      const reEnterMsg = isTamil
        ? `📱 தயவுசெய்து உங்கள் 6-இலக்க OTP குறியீட்டை உள்ளிடவும்:`
        : `📱 Please enter your 6-digit OTP code to continue:`;
      await wa.sendWhatsAppMessage(replyTarget, reEnterMsg);
      return;
    }

    // ── STEP 5: Preferences Selection State ─────────────────────────────────────
    if (session.step === 'select_preferences' || session.step === 'preferences') {
      let selectedPrefs = [];
      if (normalizedText === '6' || /^(all|\*|all of the above|அனைத்தும்|7)$/i.test(normalizedText)) {
        selectedPrefs = ['verse', 'saint', 'mass', 'events', 'announcements'];
      } else {
        const prefMap = {
          '1': 'verse',
          '2': 'saint',
          '3': 'mass',
          '4': 'events',
          '5': 'announcements'
        };
        const parts = rawText.split(/[,\s]+/).map(s => s.trim().replace(/[^0-9]/g, '')).filter(Boolean);
        selectedPrefs = Array.from(new Set(parts.map(p => prefMap[p]).filter(Boolean)));
      }

      if (selectedPrefs.length > 0) {
        session.preferences = selectedPrefs;
        session.step = 'catholic_language';
        session.pendingStep = 'catholic_language';
        session.waitingForReply = true;
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

        // Send Step 6: Catholic Content Language prompt
        await wa.sendWhatsAppMessage(replyTarget, getCatholicLanguagePrompt(isTamil));
        return;
      }

      const retryPrefMsg = isTamil
        ? `⚠️ தவறான தேர்வு. எண்களை காற்புள்ளியுடன் (எ.கா: *1,2,3*) அல்லது அனைத்திற்கும் *6* என்று பதிலளிக்கவும்.`
        : `⚠️ Invalid selection. Please reply with numbers (e.g. *1,2,3*) or reply *6* for all services.`;
      await wa.sendWhatsAppMessage(replyTarget, retryPrefMsg);
      return;
    }

    // ── STEP 6: Daily Catholic Content Language Selection State ─────────────────
    if (session.step === 'catholic_language') {
      let chosenCatLang = null;
      if (/^(1|tamil|தமிழ்|ta)$/i.test(normalizedText)) {
        chosenCatLang = 'ta';
      } else if (/^(2|english|ஆங்கிலம்|eng|en)$/i.test(normalizedText)) {
        chosenCatLang = 'en';
      } else if (/^(3|both|இரண்டும்|both tamil & english|all)$/i.test(normalizedText)) {
        chosenCatLang = 'both';
      }

      if (chosenCatLang) {
        session.catholicLanguage = chosenCatLang;
        session.isOnboarded = true;
        session.step = 'done';
        session.pendingStep = null;
        session.waitingForReply = false;
        await session.save();

        let userName = '';
        if (session.linkedUserId) {
          try {
            const u = await User.findById(session.linkedUserId);
            if (u) {
              userName = u.name;
              u.preferredLanguage = session.language;
              u.mass_reflection_language = session.catholicLanguage;
              u.whatsappOptIn = true;
              await u.save();
            }
          } catch (uErr) {}
        }

        // Step 7: Confirmation Message with Subscribed Services
        const step7Msg = getSetupCompleteMessage(session.preferences, session.catholicLanguage, isTamil);

        // Step 8: SJDB Connect Assistance Message (sent in another message)
        const step8Assistance = getAssistanceMessage(isTamil);

        await wa.sendWhatsAppMessage(replyTarget, step7Msg);
        await new Promise(r => setTimeout(r, 600));
        await wa.sendWhatsAppMessage(replyTarget, step8Assistance);
        return;
      }

      const retryCatMsg = isTamil
        ? `👉 *1, 2 அல்லது 3* என்று பதிலளிக்கவும்.`
        : `👉 Please reply with *1, 2, or 3*.`;
      await wa.sendWhatsAppMessage(replyTarget, retryCatMsg);
      return;
    }

    // ── Onboarding Gate: Unverified / in-progress users must NOT bypass to general menus or services ──
    const isFullyCompleted = session.step === 'done' && session.isVerified;
    if (!isFullyCompleted) {
      if (session.step === 'phone_verification' || session.step === 'ask_phone_manual') {
        await wa.sendWhatsAppMessage(replyTarget, isTamil ? `👉 தயவுசெய்து உங்கள் 10-இலக்க மொபைல் எண்ணை உள்ளிடவும் (எ.கா: *9876543210*).` : `👉 Please enter your 10-digit mobile number (e.g., *9876543210*).`);
        return;
      }
      if (session.step === 'otp_verification') {
        await wa.sendWhatsAppMessage(replyTarget, isTamil ? `📱 தயவுசெய்து உங்கள் 6-இலக்க OTP குறியீட்டை உள்ளிடவும்:` : `📱 Please enter your 6-digit OTP code to continue:`);
        return;
      }
      if (session.step === 'select_preferences') {
        await wa.sendWhatsAppMessage(replyTarget, isTamil ? `⚠️ எண்களை காற்புள்ளியுடன் (எ.கா: *1,2,3*) அல்லது அனைத்திற்கும் *6* என்று பதிலளிக்கவும்.` : `⚠️ Please reply with numbers (e.g. *1,2,3*) or *6* for all.`);
        return;
      }
      if (session.step === 'catholic_language') {
        await wa.sendWhatsAppMessage(replyTarget, isTamil ? `👉 *1, 2 அல்லது 3* என்று பதிலளிக்கவும்.` : `👉 Please reply with *1, 2, or 3*.`);
        return;
      }
      // Default for bot_language or unstarted:
      await wa.sendWhatsAppMessage(replyTarget, `👉 Please reply with *1* or *2*.\n👉 தயவுசெய்து *1* அல்லது *2* என்று பதிலளிக்கவும்.`);
      return;
    }

    // ── Preferences Command (Trigger preferences update anytime after onboarding)
    if (/^(preferences|prefs|விருப்பங்கள்)$/i.test(normalizedText)) {
      session.step = 'select_preferences';
      session.pendingStep = 'select_preferences';
      session.waitingForReply = true;
      await session.save();
      await wa.sendWhatsAppMessage(replyTarget, getVerifiedAndPreferencesPrompt(isTamil));
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
      session.currentMenu = 'services';
      await session.save();
      const servicesMsg = getServicesMenuMessage(isTamil);
      await wa.sendWhatsAppMessage(replyTarget, servicesMsg);
      return;
    }

    // ── 2. MAIN MENU / QUICK COMMANDS (0, Menu, Home, Start, Hi, Quick Commands) ──────────
    const isMenuTrigger = /^(menu|0|home|start|hi|hello|hey|quick commands|வணக்கம்)$/i.test(normalizedText) ||
      normalizedText.includes('main menu') ||
      normalizedText.includes('முதன்மை மெனு') ||
      normalizedText.includes('sjdb connect');

    if (isMenuTrigger) {
      session.currentMenu = 'main';
      await session.save();
      let linkedUser = null;
      if (session.linkedUserId) {
        linkedUser = await User.findById(session.linkedUserId);
      } else if (session.providedPhone || phone) {
        const searchPhone = (session.providedPhone || phone).slice(-10);
        linkedUser = await User.findOne({ phone: { $regex: searchPhone } });
      }

      const userName = linkedUser ? linkedUser.name : (pushName || '');
      const menuMsg = getMainMenuMessage(userName, isTamil);
      await wa.sendWhatsAppMessage(replyTarget, menuMsg);
      return;
    }

    // ── 3. NUMBERED MENU & DIRECT INTENT ROUTING ────────────────────────────────

    // 3.0 Explicit Full Devotions Request (Conversational ONLY — Never triggers proactive notification job)
    const isFullDevotionsQuery = /^(daily devotions|daily catholic devotions|all daily devotions|full devotions|today devotions|all daily content|தினசரி கத்தோலிக்க வாசகங்கள்|முழு வாசகங்கள்)$/i.test(normalizedText);
    if (isFullDevotionsQuery) {
      await sendFullDevotionsToUser(replyTarget, session, wa, isTamil);
      return;
    }

    // 3.1 Daily Bible Verse (Option 1 & Verse Keywords)
    const isVerseQuery =
      normalizedText === '1' ||
      /^(verse|bible verse|today verse|daily verse|daily bible|today bible|bible|scripture|word of god|what is today\'?s? verse|give me today\'?s? verse|tell me today\'?s? verse)$/i.test(normalizedText) ||
      /(தினசரி விவிலியம்|விவிலியம்|இறைவார்த்தை|வேத வசனம்|வசனம்)/.test(rawText);

    if (isVerseQuery) {
      await sendTodayVerseToUser(replyTarget, session, wa, isTamil);
      return;
    }

    // 3.2 Daily Mass Readings (Readings Keywords)
    const isReadingsQuery =
      /\b(readings|mass readings|today readings|daily mass readings|what are today\'?s? readings|give me today\'?s? readings|gospel|today gospel|mass reading)\b/i.test(normalizedText) ||
      /(திருப்பலி வாசகங்கள்|இன்றைய வாசகங்கள்|வாசகங்கள்|வாசகம்|நற்செய்தி|திருப்பாடல்|பதிலுரை பாடல்)/.test(rawText);

    if (isReadingsQuery) {
      await sendTodayReadingsToUser(replyTarget, session, wa, isTamil);
      return;
    }

    // 3.3 Daily Reflection (Reflection Keywords)
    const isReflectionQuery =
      /\b(reflection|today reflection|daily reflection|give me today\'?s? reflection|what is today\'?s? reflection|spiritual reflection)\b/i.test(normalizedText) ||
      /(தியானம்|இன்றைய தியானம்|சிந்தனை|இன்றைய சிந்தனை)/.test(rawText);

    if (isReflectionQuery) {
      await sendTodayReflectionToUser(replyTarget, session, wa, isTamil);
      return;
    }

    // 3.4 Saint of the Day (Option 7 & Saint Keywords)
    const isSaintQuery =
      normalizedText === '7' ||
      /\b(saint|today saint|saint of the day|who is today saint|who is the saint today|today\'?s saint|saints)\b/i.test(normalizedText) ||
      /(இன்றைய புனிதர்|புனிதர் யார்|புனிதர்)/.test(rawText);

    if (isSaintQuery) {
      await sendTodaySaintToUser(replyTarget, session, wa, isTamil);
      return;
    }

    // 3.5 Mass Timings (Option 2 & Mass Keywords)
    const isMassTimingsQuery =
      normalizedText === '2' ||
      /\b(mass timings|mass time|mass schedule|when is mass|what time is mass|morning mass|evening mass|sunday mass|today mass)\b/i.test(normalizedText) ||
      /(திருப்பலி நேரம்|பூசை நேரம்|திருப்பலி நேரங்கள்|ஞாயிறு திருப்பலி)/.test(rawText);

    if (isMassTimingsQuery) {
      const massMsg = isTamil
        ? `⛪ *புனித அருளானந்தர் தேவாலயம் — திருப்பலி நேரங்கள்*
_காளையார்கோவில், சிவகங்கை மறைமாவட்டம்_

📅 *வாரநாட்கள் (திங்கள் – சனி):*
• காலை 6:00 மணி — தினசரி காலை திருப்பலி

🌟 *ஞாயிறு திருப்பலிகள்:*
• காலை 6:00 மணி — அதிகாலை திருப்பலி
• காலை 8:00 மணி — பங்குப் பெருந்திருப்பலி

🕯️ *செவ்வாய் நவநாள் திருப்பலி:*
• மாலை 6:00 மணி — புனித அந்தோனியார் நவநாள் & திருப்பலி

🕊️ *மாதத்தின் முதல் வெள்ளி:*
• மாலை 6:00 மணி — நற்கருணை ஆராதனை & சிறப்பு திருப்பலி

🕊️ *பாவசங்கீர்த்தனம் (ஒப்புரவு):*
• சனிக்கிழமை: மாலை 5:30 – 6:30 மணி & காலை திருப்பலிக்கு முன்

🌐 *முழு அட்டவணை:* ${getSiteUrl(SITE_ROUTES.MASS_TIMINGS)}`
        : `⛪ *St. John de britto Church — Holy Mass Timings*
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

    // 3.6 Services Menu (Option 3)
    if (normalizedText === '3') {
      const servicesMsg = getServicesMenuMessage(isTamil);
      await wa.sendWhatsAppMessage(replyTarget, servicesMsg);
      return;
    }

    // 3.7 Confession Timings
    const isConfessionQuery =
      /\b(confession|confession timings?|reconciliation)\b/i.test(normalizedText) ||
      /(ஒப்புரவு|பாவசங்கீர்த்தனம்)/.test(rawText);

    if (isConfessionQuery) {
      const confMsg = isTamil
        ? `🕊️ *ஒப்புரவு அருட்சாதனம் (பாவசங்கீர்த்தனம்)*
_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_

• ஒவ்வொரு சனிக்கிழமை மாலை 5:30 மணி முதல் 6:30 மணி வரை
• தினசரி காலை திருப்பலிக்கு முன் (காலை 5:30 மணி)
• பங்குத்தந்தையரிடம் எந்நேரமும் தனிப்பட்ட முறையில் பெற்றுக்கொள்ளலாம்.

_"உங்கள் பாவங்கள் கருஞ்சிவப்பாய் இருந்தாலும் அவை பனிபோல் வெண்மையாகும்." (எசாயா 1:18)_

🌐 ${getSiteUrl(SITE_ROUTES.MASS_TIMINGS)}`
        : `🕊️ *Sacrament of Reconciliation (Confession)*
_St. John de britto Church, Kalayarkoil_

• Every Saturday from 5:30 PM to 6:30 PM
• Daily before morning Holy Mass (5:30 AM)
• Available anytime upon personal request to the Parish Priests.

_"Though your sins are like scarlet, they shall be as white as snow." (Isaiah 1:18)_

🌐 ${getSiteUrl(SITE_ROUTES.MASS_TIMINGS)}`;
      await wa.sendWhatsAppMessage(replyTarget, confMsg);
      return;
    }

    // 3.8 Other Sacraments
    const isSacramentQuery =
      /\b(sacraments?|baptism|matrimony|holy communion|confirmation|anointing)\b/i.test(normalizedText) ||
      /(திருவருட்சாதனம்|திருவருட்சாதனங்கள்|ஞானஸ்நானம்|திருமணம்)/.test(rawText);

    if (isSacramentQuery) {
      const sacMsg = isTamil
        ? `✝️ *திருவருட்சாதனங்கள் & ஆன்மீக வழிகாட்டுதல்*
_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_

1. *ஞானஸ்நானம் (திருமுழுக்கு):* பங்கு அலுவலகத்தில் முன் பதிவு
2. *முதல் நற்கருணை & திடப்படுத்தல்:* ஞாயிறு மறைக்கல்வி பயிற்சி
3. *திருமணம்:* 1 மாதத்திற்கு முன் பதிவு + திருமண ஆயத்த பயிற்சி
4. *நோயாளரின் பூசுதல்:* முதியோர் மற்றும் நோயாளிகளுக்கு எந்நேரமும் கிடைக்கும்
5. *ஒப்புரவு:* சனிக்கிழமை மாலை 5:30 & காலை திருப்பலிக்கு முன்

🌐 ${getSiteUrl(SITE_ROUTES.ABOUT)}`
        : `✝️ *Sacraments & Spiritual Guidance*
_St. John de britto Church, Kalayarkoil_

1. *Baptism:* Prior registration with parish office
2. *Holy Communion & Confirmation:* Sunday Catechism formation
3. *Holy Matrimony:* Registration 1 month prior + Pre-Cana course
4. *Anointing of Sick:* Available anytime for elderly and ill
5. *Reconciliation:* Saturdays 5:30 PM & daily before morning Mass

🌐 ${getSiteUrl(SITE_ROUTES.ABOUT)}`;
      await wa.sendWhatsAppMessage(replyTarget, sacMsg);
      return;
    }

    // 3.9 Catholic Prayers
    const isPrayersQuery =
      /\b(prayers?|rosary|our father|hail mary)\b/i.test(normalizedText) ||
      /(ஜெபம்|செபம்|ஜெபங்கள்|செபங்கள்|ஜெபமாலை)/.test(rawText);

    if (isPrayersQuery) {
      const prayersMsg = isTamil
        ? `🙏 *கத்தோலிக்க ஜெபங்கள் & ஆன்மீக வழிகாட்டுதல்*
_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_

• *பரலோகத்தில் இருக்கிற எங்கள் பிதாவே*
• *அருள் நிறைந்த மரியே (மங்கள வார்த்தை ஜெபம்)*
• *திரித்துவதிற்கு மகிமை (பிதா, சுதன், பரிசுத்த ஆவி)*
• *பரிசுத்த ஜெபமாலை & மறைபொருள்கள்*
• *திருப்பலிக்கு முந்தைய மற்றும் நற்கருணைக்கு பிந்தைய ஜெபங்கள்*

🌐 *ஆடியோ ஜெபமாலை & ஜெபங்கள்:* ${getSiteUrl(SITE_ROUTES.ROSARY)}`
        : `🙏 *Catholic Prayers & Prayer Guidance*
_St. John de britto Church, Kalayarkoil_

• *The Lord's Prayer (Our Father)*
• *Hail Mary (Angelic Salutation)*
• *Glory Be (Doxology)*
• *The Holy Rosary & Mysteries*
• *Prayer Before Holy Mass & After Communion*

🌐 *Audio Rosary & Prayers:* ${getSiteUrl(SITE_ROUTES.ROSARY)}`;
      await wa.sendWhatsAppMessage(replyTarget, prayersMsg);
      return;
    }

    // 3.10 Church Events (Main Menu 4 & Services Menu 8 & Keywords)
    const isEventsChoice =
      (session.currentMenu !== 'services' && normalizedText === '4') ||
      (session.currentMenu === 'services' && normalizedText === '8') ||
      /\b(events|upcoming events|church events)\b/i.test(normalizedText) ||
      /(நிகழ்வுகள்|நிகழ்ச்சிகள்)/.test(rawText);

    if (isEventsChoice) {
      try {
        const events = await getCachedEvents();

        let eventsMsg = '';
        if (events && events.length > 0) {
          const lines = events.map(ev => {
            const dt = new Date(ev.date).toLocaleDateString(isTamil ? 'ta-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
            return `📌 *${ev.title}*\n📅 ${dt} ${ev.time ? `• ⏰ ${ev.time}` : ''}\n📍 ${ev.venue || (isTamil ? 'ஆலய வளாகம்' : 'Church Premises')}\n`;
          }).join('\n');
          eventsMsg = isTamil
            ? `📅 *வரவிருக்கும் பங்கு நிகழ்வுகள்:*\n\n${lines}\n🔗 ${getSiteUrl(SITE_ROUTES.EVENTS)}`
            : `📅 *Upcoming Church Events:*\n\n${lines}\n🔗 ${getSiteUrl(SITE_ROUTES.EVENTS)}`;
        } else {
          eventsMsg = isTamil
            ? `📅 *பங்கு நிகழ்வுகள்:*\n\nதற்போது புதிய நிகழ்வுகள் ஏதுமில்லை.\n\n🌐 ${getSiteUrl(SITE_ROUTES.EVENTS)}`
            : `📅 *Church Events:*\n\nNo special upcoming events scheduled currently.\n\n🌐 ${getSiteUrl(SITE_ROUTES.EVENTS)}`;
        }
        await wa.sendWhatsAppMessage(replyTarget, eventsMsg);
        return;
      } catch (eErr) {
        console.error('[BotHandler] Events error:', eErr.message);
      }
    }

    // 3.10b Birthday Wishes & Registered DOB Query (Keywords)
    const isBirthdayChoice =
      /\b(birthday|birthdays|bday|today is my birthday|it'?s my birthday|my birthday|happy birthday)\b/i.test(normalizedText) ||
      /(பிறந்தநாள்|இன்று என் பிறந்தநாள்|பிறந்தநாள் வாழ்த்து|பிறந்த நாள்)/.test(rawText);

    if (isBirthdayChoice) {
      await handleConversationalBirthdayRequest(replyTarget, session, wa, isTamil);
      return;
    }

    // 3.11 Parish Announcements (Main Menu 5 & Services Menu 9 & Keywords)
    const isAnnouncementsChoice =
      (session.currentMenu !== 'services' && normalizedText === '5') ||
      (session.currentMenu === 'services' && normalizedText === '9') ||
      /\b(announcements?|notices?|parish announcements?)\b/i.test(normalizedText) ||
      /(அறிவிப்புகள்|பங்கு அறிவிப்பு)/.test(rawText);

    if (isAnnouncementsChoice) {
      try {
        const announcements = await getCachedAnnouncements();

        let annMsg = '';
        if (announcements && announcements.length > 0) {
          const lines = announcements.map(a => `📢 *${a.title}*\n${(a.content || a.description || '').slice(0, 120)}...\n`).join('\n');
          annMsg = isTamil
            ? `📢 *பங்கு அறிவிப்புகள்:*\n\n${lines}\n🌐 ${getSiteUrl(SITE_ROUTES.ANNOUNCEMENTS)}`
            : `📢 *Parish Announcements:*\n\n${lines}\n🌐 ${getSiteUrl(SITE_ROUTES.ANNOUNCEMENTS)}`;
        } else {
          annMsg = isTamil
            ? `📢 *பங்கு அறிவிப்புகள்:*\n\nதற்போது புதிய அறிவிப்புகள் ஏதுமில்லை.\n\n🌐 ${getSiteUrl(SITE_ROUTES.ANNOUNCEMENTS)}`
            : `📢 *Parish Announcements:*\n\nThere are no new announcements at this moment.\n\n🌐 ${getSiteUrl(SITE_ROUTES.ANNOUNCEMENTS)}`;
        }
        await wa.sendWhatsAppMessage(replyTarget, annMsg);
        return;
      } catch (aErr) {
        console.error('[BotHandler] Announcements error:', aErr.message);
      }
    }

    // 3.12 Church Information & History (Main Menu 6 & Services Menu 13 & Keywords)
    const isChurchInfoChoice =
      (session.currentMenu !== 'services' && normalizedText === '6') ||
      normalizedText === '13' ||
      /\b(church information|church info|about church|history|patron saint)\b/i.test(normalizedText) ||
      /(ஆலய விபரம்|பங்கு வரலாறு|புனிதர் வரலாறு|வரலாறு)/.test(rawText);

    if (isChurchInfoChoice) {
      const histMsg = isTamil
        ? `🏛️ *புனித அருளானந்தர் தேவாலயம் — ஆலய விபரம் & வரலாறு*
_காளையார்கோவில், சிவகங்கை மறைமாவட்டம்_

👑 *பாதுகாவலர்:* புனித ஜான் டி பிரிட்டோ (அருளானந்தர்)
🎉 *ஆலயப் பெருவிழா:* பிப்ரவரி 4

போர்ச்சுகல் நாட்டின் லிஸ்பன் நகரில் பிறந்த இயேசு சபை துறவியான புனித ஜான் டி பிரிட்டோ, இந்தியாவிற்கு வந்து மறவ நாட்டில் எளிய துறவி போல காவி உடை தரித்து நற்செய்தி அறிவித்தார். 1693 பிப்ரவரி 4 அன்று ஓரியூரில் மறைசாட்சியாக உயிர்நீத்தார்.

காளையார்கோவிலில் அமைந்துள்ள நமது திருத்தலம் விசுவாசத்தின் புனித கேந்திரமாகவும், அன்பியங்களின் சங்கமமாகவும் விளங்குகிறது.

🌐 *முழு விபரம்:* ${getSiteUrl(SITE_ROUTES.ABOUT)}`
        : `🏛️ *St. John de britto Church — Church Information*
_Kalayarkoil, Sivagangai Diocese_

👑 *Patron Saint:* St. John de Britto (Arulanandar)
🎉 *Patronal Feast Day:* February 4

St. John de Britto was a Portuguese Jesuit missionary who adopted local Indian ascetic customs and attire to proclaim the Gospel across Marava country before his martyrdom at Oriyur on February 4, 1693.

Our parish in Kalayarkoil stands as a historic sanctuary of faith, vibrant Anbiyams, and active pastoral ministries.

🌐 *Read Complete History & Info:* ${getSiteUrl(SITE_ROUTES.ABOUT)}`;

      await wa.sendWhatsAppMessage(replyTarget, histMsg);
      return;
    }

    // 3.13 Help (Main Menu 8)
    const isHelpChoice =
      (session.currentMenu !== 'services' && normalizedText === '8') ||
      /\b(help|commands|how to use|guide|options)\b/i.test(normalizedText) ||
      /(உதவி|வழிகாட்டி)/.test(rawText);

    if (isHelpChoice) {
      const helpMsg = getHelpMessage(isTamil);
      await wa.sendWhatsAppMessage(replyTarget, helpMsg);
      return;
    }

    // Option 10: Church Location & Google Maps
    const isLocationChoice = normalizedText === '10' ||
      /\b(where is the church|where is church|church location|location|how to reach|maps?)\b/i.test(normalizedText) ||
      /(அமைவிடம்|கோவில் எங்கு|ஆலயம் எங்கு|முகவரி)/.test(rawText);

    if (isLocationChoice) {
      const locMsg = isTamil
        ? `🏛️ *புனித அருளானந்தர் தேவாலயம் — அமைவிடம்*
சர்ச் ரோடு, காளையார்கோவில் — 630551, சிவகங்கை மாவட்டம், தமிழ்நாடு.

🕒 *பார்வையிடும் நேரம்:* தினமும் காலை 5:30 மணி முதல் இரவு 8:00 மணி வரை

📍 *கூகுள் மேப் அமைவிடம்:*
${EXTERNAL_LINKS.GOOGLE_MAPS}

🌐 ${getSiteUrl(SITE_ROUTES.CONTACT)}`
        : `🏛️ *St. John de britto Church — Location*
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
      const minMsg = isTamil
        ? `👥 *பங்கு அமைப்புகள் & அன்பியங்கள்*
_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_

• 👥 *12 அன்பியங்கள்:* குடும்ப ஜெபக் குழுக்கள்
• 🏛️ *பங்கு அருட்பணிப் பேரவை:* பங்கு நிர்வாக வழிகாட்டுதல்
• 🎶 *பாடகர் குழு:* திருவழிபாட்டுப் பாடல்கள்
• 🕯️ *பீடச் சிறார்கள்:* திருப்பலி உதவி
• 🌟 *இளைஞர் இயக்கம் (ICYM):* ஆன்மீக மற்றும் சமூகப் பணிகள்
• 📖 *ஞாயிறு மறைக்கல்வி:* சிறார்களுக்கான விசுவாசப் பயிற்சி
• ❤️ *வின்சென்ட் தே பவுல் சபை:* ஏழை எளியோருக்கான உதவி

🌐 *மேலும் வாசிக்க:* ${getSiteUrl(SITE_ROUTES.ANBIYAMS)}`
        : `👥 *Parish Ministries & Anbiyams*

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
          pList = priests.map(p => `• *${p.designation || (isTamil ? 'பங்கு குரு' : 'Priest')}:* அருட்தந்தை ${p.name} ${p.phone ? `(தொலைபேசி: ${p.phone})` : ''}`).join('\n');
        } else {
          pList = isTamil
            ? `• *பங்குத்தந்தை:* அருட்தந்தை பங்குத்தந்தை (தொலைபேசி: +91 96556 39144)`
            : `• *Parish Priest:* Rev. Fr. Parish Priest (Ph: +91 96556 39144)`;
        }

        const pMsg = isTamil
          ? `👑 *பங்குத்தந்தை & குருக்கள்*
_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_

${pList}

🌐 ${getSiteUrl(SITE_ROUTES.PRIESTS)}`
          : `👑 *Parish Priests & Clergy*
_St. John de britto Church, Kalayarkoil_

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
      const histMsg = isTamil
        ? `🏛️ *புனித அருளானந்தர் தேவாலயம் — வரலாறு*
_சிவகங்கை மறைமாவட்டம்_

👑 *பாதுகாவலர்:* புனித ஜான் டி பிரிட்டோ (அருளானந்தர்)
🎉 *ஆலயப் பெருவிழா:* பிப்ரவரி 4

போர்ச்சுகல் நாட்டின் லிஸ்பன் நகரில் பிறந்த இயேசு சபை துறவியான புனித ஜான் டி பிரிட்டோ, இந்தியாவிற்கு வந்து மறவ நாட்டில் எளிய துறவி போல காவி உடை தரித்து நற்செய்தி அறிவித்தார். 1693 பிப்ரவரி 4 அன்று ஓரியூரில் மறைசாட்சியாக உயிர்நீத்தார்.

காளையார்கோவிலில் அமைந்துள்ள நமது திருத்தலம் விசுவாசத்தின் புனித கேந்திரமாகவும், அன்பியங்களின் சங்கமமாகவும் விளங்குகிறது.

🌐 *முழு வரலாறு:* ${getSiteUrl(SITE_ROUTES.ABOUT)}`
        : `🏛️ *St. John de britto Church — History*
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
      const contactMsg = isTamil
        ? `📞 *பங்குத் தொடர்பு & அலுவலக நேரம்*

🏛️ *முகவரி:*
புனித அருளானந்தர் தேவாலயம்,
சர்ச் ரோடு, காளையார்கோவில் — 630551,
சிவகங்கை மாவட்டம், தமிழ்நாடு, இந்தியா.

📱 *தொலைபேசி:* +91 96556 39144
📧 *மின்னஞ்சல்:* arndas777@gmail.com
🕒 *அலுவலக நேரம்:* காலை 9:00 – 1:00 & மாலை 4:00 – 7:00

📍 *கூகுள் மேப் அமைவிடம்:*
${EXTERNAL_LINKS.GOOGLE_MAPS}

🌐 ${getSiteUrl(SITE_ROUTES.CONTACT)}`
        : `📞 *Parish Contact & Office Hours*

🏛️ *Address:*
St. John de britto Church,
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

      const userAuthContext = {
        user: linkedUser,
        session
      };

      // Query language for response is STRICTLY the bot's saved language preference (botLang)
      const ragResult = await answerChurchQuestion(rawText, botLang, userAuthContext);

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
    const fallbackMsg = getMainMenuMessage(session.pushName || '', isTamil);
    await wa.sendWhatsAppMessage(replyTarget, fallbackMsg);
  } finally {
    activeSessionLocks.delete(lockKey);
  }
}

module.exports = {
  handleIncomingMessage,
  getSetupCompleteMessage,
  getAssistanceMessage,
  formatSubscribedServices,
  _clearDedupCacheForTesting: async () => {
    processedMessageIdsCache.clear();
    incomingMsgDeduplication.clear();
    activeSessionLocks.clear();
    try {
      if (require('mongoose').connection.readyState === 1) {
        await ProcessedMessage.deleteMany({});
      }
    } catch (e) { }
  }
};
