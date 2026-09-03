/**
 * SJDB Connect — NLP Intent Engine & Focused Church Assistant
 * 
 * Scope Hierarchy:
 * 1. Church & Parish (History, Patron Saint St. John de Britto, Clergy, Office, Location, Timings, Confession, Sacraments, Ministries)
 * 2. Daily Catholic (Bible Verse, Mass Readings, Reflection, Saint of the Day, Catholic Prayers, Liturgical Calendar)
 * 3. Parish Information (Events, Announcements, Registration & Forms)
 * 4. Website & Portal Navigation
 * 5. User's Own Account (Profile, Language, Notification Preferences, Event Registrations) — Strictly Authenticated
 */

const mongoose = require('mongoose');
const { SJDB_OFFICIAL_KNOWLEDGE, CATHOLIC_FAITH_KNOWLEDGE } = require('./churchKnowledgeBase');
const { CHURCH_CATEGORIES, classifyChurchDomain, CHURCH_REFUSAL_MSG } = require('./domainClassifier');
const User = require('../models/User');
const Booking = require('../models/Booking');
const BotSession = require('../models/BotSession');
const Priest = require('../models/Priest');
const Event = require('../models/Event');
const Announcement = require('../models/Announcement');
const { SITE_ROUTES, EXTERNAL_LINKS, getSiteUrl } = require('../config/siteRoutes');
const {
  getCachedDailyContent,
  getCachedPriests,
  getCachedEvents,
  getCachedAnnouncements
} = require('./churchDataCache');

/**
 * Text Normalization:
 * - Lowercases, cleans punctuation
 * - Expands colloquialisms, abbreviations, phonetic misspellings in English & Tamil
 */
function normalizeUserText(rawText) {
  if (!rawText) return '';
  let text = rawText.trim().toLowerCase();

  // Normalize common English WhatsApp abbreviations
  const replacements = [
    [/\babt\b/g, 'about'],
    [/\bu\b/g, 'you'],
    [/\bur\b/g, 'your'],
    [/\bpls\b|\bplz\b/g, 'please'],
    [/\bsun\b|\bsund\b/g, 'sunday'],
    [/\bmon\b/g, 'monday'],
    [/\btue\b|\btues\b/g, 'tuesday'],
    [/\bfri\b/g, 'friday'],
    [/\bsat\b/g, 'saturday'],
    [/\bconf\b|\bconfesion\b|\bconfesn\b/g, 'confession'],
    [/\bmsg\b|\bmsgs\b/g, 'message'],
    [/\bnotif\b|\bnotifs\b|\bnotifcation\b|\bnotifcations\b/g, 'notifications'],
    [/\blang\b/g, 'language'],
    [/\breg\b|\bregistrn\b|\bregistartion\b/g, 'registration'],
    [/\bbritto\b|\bde britto\b|\barulanandar\b|\barulanandhar\b/g, 'john de britto'],
    [/\bst\b|\bst\.\b/g, 'saint'],
    [/\banbyam\b|\banbiyam\b|\banbiyams\b|\bbcc\b/g, 'anbiyam'],
    [/\btimings\b|\btme\b|\btim\b/g, 'time'],
    [/\bvers\b|\bvrs\b/g, 'verse'],
    [/\breadngs\b|\brdngs\b|\breading\b/g, 'readings'],
    [/\brefl\b|\breflectn\b|\breflctn\b/g, 'reflection'],
    [/\bfr\b|\bfather\b|\bpastor\b/g, 'priest'],
    [/\bloc\b|\baddr\b|\baddress\b/g, 'location'],
    [/\bprof\b|\bacct\b|\bacc\b/g, 'profile']
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  return text;
}

/**
 * Detect language of query: 'ta' (Tamil) or 'en' (English)
 */
function detectQueryLanguage(text) {
  if (!text) return 'en';
  const tamilCharRegex = /[\u0B80-\u0BFF]/;
  return tamilCharRegex.test(text) ? 'ta' : 'en';
}

/**
 * Fetch dynamic parish data via Fast In-Memory Cache
 */
async function getDynamicParishContext() {
  const dynamicContext = {
    priests: [],
    upcomingEvents: [],
    announcements: []
  };

  try {
    const priests = await getCachedPriests();
    if (priests && priests.length > 0) {
      dynamicContext.priests = priests.map(p => `${p.designation || 'Parish Clergy'}: Rev. Fr. ${p.name} ${p.phone ? `(Ph: ${p.phone})` : ''}`);
    }
  } catch (e) {
    console.warn('[ChurchRAG] Could not fetch priests from cache:', e.message);
  }

  try {
    const events = await getCachedEvents();
    if (events && events.length > 0) {
      dynamicContext.upcomingEvents = events.slice(0, 3).map(ev => `• *${ev.title}* — ${new Date(ev.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} ${ev.time ? `at ${ev.time}` : ''}`);
    }
  } catch (e) {
    console.warn('[ChurchRAG] Could not fetch events from cache:', e.message);
  }

  try {
    const announcements = await getCachedAnnouncements();
    if (announcements && announcements.length > 0) {
      dynamicContext.announcements = announcements.slice(0, 3).map(a => `• *${a.title}*: ${a.content || a.description || ''}`);
    }
  } catch (e) {
    console.warn('[ChurchRAG] Could not fetch announcements from cache:', e.message);
  }

  return dynamicContext;
}

/**
 * Robust Intent & Entity Extraction:
 * Understands short forms, natural phrasing, misspellings, English & Tamil.
 */
function extractQueryIntents(rawText) {
  const norm = normalizeUserText(rawText);
  const intents = [];

  // 0. Dedicated Services Menu Intent (Case-insensitive: services, what services do you provide, church services, சேவைகள்)
  const isServicesQuery = /\b(services|our services|church services|parish services|services list|what services|list services|all services|available services|what services do you provide)\b/i.test(norm) ||
    norm === 'services' || norm === 'service' ||
    /(சேவைகள்|பங்கு சேவைகள்|சேவை பட்டியல்|என்னென்ன சேவைகள்)/.test(rawText);
  if (isServicesQuery) {
    return ['services_menu'];
  }

  // Exact single word 'mass' ambiguity
  if (norm === 'mass' || norm === 'holy mass' || norm === 'திருப்பலி' || norm === 'பூசை') {
    return ['mass_ambiguous'];
  }

  // 1. User Own Account Queries
  const isProfileQuery = /\b(my profile|who am i|my account|my details|my family id|my parish id|my member id)\b/i.test(norm) ||
    /(என் சுயவிவரம்|என் கணக்கு|என் விபரம்|நான் யார்)/.test(rawText);
  if (isProfileQuery) intents.push('user_profile');

  const isUserLanguageQuery = /\b(what language|my language|my saved language|current language|saved language)\b/i.test(norm) ||
    /(என் மொழி|சேமிக்கப்பட்ட மொழி)/.test(rawText);
  if (isUserLanguageQuery) intents.push('user_language');

  const isUserNotificationsQuery = /\b(my notifications|my alerts|my notification preferences|my preferences|my subscriptions|notification settings)\b/i.test(norm) ||
    /(என் அறிவிப்புகள்|என் விருப்பங்கள்|நோட்டிபிகேஷன்)/.test(rawText);
  if (isUserNotificationsQuery) intents.push('user_notifications');

  const isUserRegistrationsQuery = /\b(what events did i register|my registrations|my bookings|my registered events|my tickets)\b/i.test(norm) ||
    /(என் பதிவுகள்|நான் பதிவு செய்த நிகழ்வுகள்|என் முன்பதிவு)/.test(rawText);
  if (isUserRegistrationsQuery) intents.push('user_registrations');

  // If already identified user account intent, return early
  if (intents.length > 0) {
    return [...new Set(intents)];
  }

  // 2. Saint History (Entity: St. John de Britto / Patron Saint)
  const isSaintHistory = /\b(saint history|our saint history|saint john de britto history|john de britto|de britto|about our saint|tell me about our saint|saint info|who is our saint|life of saint|martyrdom|oriyur)\b/i.test(norm) ||
    /(அருளானந்தர் வரலாறு|பிரிட்டோ வரலாறு|நமது புனிதர்|புனிதர் வரலாறு|ஓரியூர்)/.test(rawText);
  if (isSaintHistory) {
    intents.push('saint_history');
  }

  // 3. Church History
  const isChurchHistory = (/\b(church history|about.*church|tell me about.*church|how old is church|history of.*church|history of kalayarkoil)\b/i.test(norm) ||
    /(ஆலய வரலாறு|கோவில் வரலாறு|பங்கு வரலாறு|பங்கு பற்றி)/.test(rawText)) && !intents.includes('saint_history');
  if (isChurchHistory) {
    intents.push('church_history');
  }

  // 4. Saint of the Day (Entity: Today's Saint)
  const isSaintOfDay = (/\b(today.*saint|saint.*today|who is.*saint|saint of the day|todays saint)\b/i.test(norm) ||
    norm === 'saint' ||
    /(இன்றைய புனிதர்|புனிதர் யார்)/.test(rawText)) && !intents.includes('saint_history');
  if (isSaintOfDay) {
    intents.push('saint_of_the_day');
  }

  // 5. Bible Verse
  const isVerseQuery = /\b(verse|today.*verse|say today.*verse|bible verse|scripture quote|word of god)\b/i.test(norm) ||
    norm === 'verse' ||
    /(இறைவார்த்தை|வேத வசனம்|வசனம்)/.test(rawText);
  if (isVerseQuery) {
    intents.push('verse');
  }

  // 6. Mass Readings (Liturgy)
  const isReadingsQuery = /\b(readings|today.*readings|what are today.*readings|mass readings|gospel|first reading|second reading|psalm)\b/i.test(norm) ||
    norm === 'readings' ||
    /(வாசகம்|வாசகங்கள்|நற்செய்தி|திருப்பாடல்|திருப்பலி வாசகம்)/.test(rawText);
  if (isReadingsQuery) {
    intents.push('readings');
  }

  // 7. Daily Reflection
  const isReflectionQuery = /\b(reflection|today.*reflection|give me today.*reflection|daily reflection|spiritual reflection)\b/i.test(norm) ||
    norm === 'reflection' ||
    /(தியானம்|இன்றைய தியானம்)/.test(rawText);
  if (isReflectionQuery) {
    intents.push('reflection');
  }

  // 8. Mass Timings
  const isMassTimingQuery = /\b(today mass|sunday mass|mass time|mass schedule|when is mass|what time is mass|morning mass|evening mass|mass timings|sun mass)\b/i.test(norm) ||
    /(பூசை நேரம்|திருப்பலி நேரம்|திருப்பலி நேரங்கள்|ஞாயிறு திருப்பலி|இன்றைய திருப்பலி)/.test(rawText);
  if (isMassTimingQuery) {
    intents.push('mass_timings');
  }

  // 9. Confession (Reconciliation)
  const isConfessionQuery = /\b(confession|confession time|what time is confession|reconciliation|how to confess)\b/i.test(norm) ||
    norm === 'conf' || norm === 'confession' ||
    /(பாவசங்கீர்த்தனம்|ஒப்புரவு|ஒப்புரவு அருட்சாதனம்)/.test(rawText);
  if (isConfessionQuery) {
    intents.push('confession');
  }

  // 10. Sacraments (Baptism, Marriage, Communion, Confirmation, Anointing)
  const isSacramentQuery = /\b(sacrament|sacraments|baptism|first communion|holy communion|confirmation|marriage|wedding|matrimony|anointing|holy orders)\b/i.test(norm) ||
    /(திருவருட்சாதனம்|திருவருட்சாதனங்கள்|ஞானஸ்நானம்|திருமுழுக்கு|முதல் நற்கருணை|திடப்படுத்துதல்|திருமணம்|நோயாளரின் பூசுதல்)/.test(rawText);
  if (isSacramentQuery && !intents.includes('confession')) {
    intents.push('sacraments');
  }

  // 11. Catholic Prayers & Prayer Guidance
  const isPrayerQuery = /\b(prayer|prayers|pray|prayer for today|prayer before mass|prayer after communion|rosary|how to pray|our father|hail mary|creed|angelus|divine mercy|novena)\b/i.test(norm) ||
    /(ஜெபம்|ஜெபங்கள்|பிரார்த்தனை|ஜெபமாலை|பரலோக பிதாவே|அருள் நிறைந்த மரியே|நவநாள்)/.test(rawText);
  if (isPrayerQuery) {
    intents.push('prayers');
  }

  // 12. Registration & Forms
  const isRegisterQuery = /\b(how.*register|how to register|registration|register event|register parish|join parish|forms|membership)\b/i.test(norm) ||
    /(பதிவு|முன்பதிவு|உறுப்பினர் பதிவு|படிவங்கள்)/.test(rawText);
  if (isRegisterQuery) {
    intents.push('register');
  }

  // 13. Events
  const isEventsQuery = (/\b(upcoming events|events list|programs|functions|celebrations)\b/i.test(norm) ||
    norm === 'events' ||
    /(நிகழ்வுகள்|நிகழ்ச்சிகள்|வரவிருக்கும் நிகழ்வுகள்)/.test(rawText)) && !isRegisterQuery;
  if (isEventsQuery) {
    intents.push('events');
  }

  // 14. Announcements
  const isAnnouncementsQuery = /\b(announcement|announcements|parish announcement|notices|circular|news)\b/i.test(norm) ||
    norm === 'announcements' ||
    /(அறிவிப்பு|அறிவிப்புகள்|பங்கு அறிவிப்பு)/.test(rawText);
  if (isAnnouncementsQuery) {
    intents.push('announcements');
  }

  // 15. Location & Address & Visiting
  const isLocationQuery = /\b(where is church|church location|location|how to reach|route|directions|visiting|visit church|where is the church)\b/i.test(norm) ||
    /(முகவரி|ஆலயம் எங்கு|கோவில் எங்கு|அமைவிடம்)/.test(rawText);
  if (isLocationQuery) {
    intents.push('location');
  }

  // 16. Contact & Office Hours
  const isContactQuery = /\b(contact|contact parish|phone number|email|phone|office contact|office phone|office hours|how can i contact priest)\b/i.test(norm) ||
    /(தொடர்பு|தொலைபேசி|அலுவலக நேரம்|அலுவலக தொடர்பு)/.test(rawText);
  if (isContactQuery) {
    intents.push('contact');
  }

  // 17. Ministries & Parish Groups
  const isMinistriesQuery = /\b(ministry|ministries|anbiyam|council|parish council|associations|choir|altar server|youth group|youth ministry|catechism|vincent de paul|legion of mary)\b/i.test(norm) ||
    norm === 'anbiyam' || norm === 'choir' || norm === 'youth' ||
    /(அன்பியம்|அன்பியங்கள்|பங்கு பேரவை|பங்கு அமைப்புகள்|பாடகர் குழு|பீடச்சிறார்கள்|இளைஞர் இயக்கம்|மறைக்கல்வி|வின்சென்ட் தே பவுல்|மரியாயின் சேனை)/.test(rawText);
  if (isMinistriesQuery) {
    intents.push('ministries');
  }

  // 18. Liturgical Calendar & Feast Days
  const isFeastCalendarQuery = (/\b(feast|feasts|feast day|when is feast|liturgical calendar|liturgy season|lent|easter|advent|christmas|special day|today feast)\b/i.test(norm) ||
    /(திருவிழா|பெருவிழா|திருவழிபாட்டுக் காலம்|திருவழிபாடு காலண்டர்|தவக்காலம்|பாஸ்கா|கிறிஸ்துமஸ்)/.test(rawText)) && !intents.includes('saint_of_the_day') && !intents.includes('events');
  if (isFeastCalendarQuery) {
    intents.push('feast_calendar');
  }

  // 19. Priests / Clergy
  const isPriestQuery = (/\b(priest|priests|parish priest|assistant priest|clergy)\b/i.test(norm) && !norm.includes('our father')) ||
    /(பங்குத்தந்தை|அருட்தந்தை|குருக்கள்|குருக்கள் விபரம்)/.test(rawText);
  if (isPriestQuery) {
    intents.push('priests');
  }

  // 20. Website & SJDB Connect Help Guide
  const isWebsiteHelpQuery = ((/\b(change language|how receive notifications|where announcements|where events|where readings|website assistance|how to use|commands|bot help|guide)\b/i.test(norm) ||
    norm === 'help' || norm === 'menu' ||
    /(மொழி மாற்ற|அறிவிப்புகள் எங்கே|நிகழ்வுகள் எங்கே|வழிகாட்டி|உதவி)/.test(rawText)) && !intents.includes('church_history'));
  if (isWebsiteHelpQuery) {
    intents.push('help');
  }

  return [...new Set(intents)];
}

/**
 * Modular content generators for each focused intent
 */

// Saint of the Day Section
function buildSaintSection(dailyContent, isTamil) {
  const saintNameEn = dailyContent?.saint?.nameEnglish || dailyContent?.saintOfTheDay?.english?.name || dailyContent?.saintName || 'Saint of the Day';
  const saintNameTa = dailyContent?.saint?.nameTamil || dailyContent?.saintOfTheDay?.tamil?.name || dailyContent?.saintNameTa || saintNameEn;
  const descEn = dailyContent?.saint?.description || dailyContent?.saintOfTheDay?.english?.description || dailyContent?.saintDescription || '';
  const descTa = dailyContent?.saint?.descriptionTamil || dailyContent?.saintOfTheDay?.tamil?.description || descEn;
  const feastDay = dailyContent?.saint?.feastDay || dailyContent?.saintOfTheDay?.english?.feastDay || dailyContent?.formattedDate || '';
  const saintImageUrl = dailyContent?.saintImage || dailyContent?.saint?.image || dailyContent?.saintOfTheDay?.english?.imageUrl;

  const name = isTamil ? saintNameTa : saintNameEn;
  const desc = isTamil ? (descTa || descEn) : (descEn || descTa);

  let body = `👑 *${name}*\n\n`;
  if (feastDay) {
    body += `📅 *${isTamil ? 'திருவிழா / நாள்' : 'Feast Day'}:* ${feastDay}\n\n`;
  }
  if (desc) {
    body += `${desc}\n`;
  }

  return {
    header: isTamil ? `✝️ *இன்றைய புனிதர் (Saint of the Day)*` : `✝️ *Saint of the Day*`,
    body,
    linkTitle: isTamil ? 'இன்றைய புனிதர்' : 'Saint of the Day',
    url: getSiteUrl(SITE_ROUTES.SAINT_OF_THE_DAY),
    isSaintOfDayFlow: true,
    imageUrl: saintImageUrl
  };
}

// Saint History Section (Entity: St. John de Britto / Arulanandar)
function buildSaintHistorySection(isTamil) {
  const body = isTamil
    ? `👑 *புனித ஜான் டி பிரிட்டோ (அருளானந்தர்) — ஆலய பாதுகாவலர்*

போர்ச்சுகல் நாட்டின் லிஸ்பன் நகரில் பிறந்த இயேசு சபை துறவியான புனித ஜான் டி பிரிட்டோ, இந்தியாவிற்கு வந்து மறவ நாட்டில் எளிய இந்திய துறவி போல காவி உடை தரித்து நற்செய்தி அறிவித்தார்.

அவரது விசுவாசத்திற்காகவும் மக்கள் மீதான அன்பிற்காகவும் 1693 பிப்ரவரி 4 அன்று ஓரியூரில் மறைசாட்சியாக உயிர்நீத்தார்.

🎉 *ஆலய பெருவிழா:* பிப்ரவரி 4\n`
    : `👑 *St. John de Britto (Arulanandar) — Our Patron Saint*

Born in Lisbon, Portugal, St. John de Britto was a Jesuit missionary who embraced Indian customs and ascetic attire to proclaim the Gospel across Marava country (Tamil Nadu).

He was martyred for his Catholic faith at Oriyur on February 4, 1693. Pope Pius XII canonized him in 1947.

🎉 *Patronal Feast Day:* February 4\n`;

  return {
    header: isTamil ? `📜 *புனித ஜான் டி பிரிட்டோ வரலாறு (Saint History)*` : `📜 *St. John de Britto — Saint History*`,
    body,
    linkTitle: isTamil ? 'புனிதர் வரலாறு' : 'Saint History',
    url: getSiteUrl(SITE_ROUTES.ABOUT)
  };
}

// Church History Section
function buildChurchHistorySection(isTamil) {
  const body = isTamil
    ? `காளையார்கோவிலில் அமைந்துள்ள புனித ஜான் டி பிரிட்டோ திருத்தலம் சிவகங்கை மறைமாவட்டத்தின் புகழ்மிக்க ஆன்மீகக் கோட்டையாகும். மறைசாட்சி புனித அருளானந்தர் நினைவாக அர்ப்பணிக்கப்பட்டு, பல தலைமுறைகளாக மக்களின் விசுவாச மையமாக விளங்கி வருகிறது.\n`
    : `St. John de Britto's Church in Kalayarkoil is a historic parish of the Diocese of Sivagangai. Dedicated to martyr St. John de Britto, it serves thousands of Catholic families with vibrant Anbiyams and active pastoral ministries.\n`;

  return {
    header: isTamil ? `⛪ *காளையார்கோவில் ஆலய வரலாறு (Church History)*` : `⛪ *About St. John de Britto's Church & Parish Details*`,
    body,
    linkTitle: isTamil ? 'ஆலய வரலாறு' : 'Church History',
    url: getSiteUrl(SITE_ROUTES.ABOUT)
  };
}

// Bible Verse Section
function buildVerseSection(dailyContent, isTamil) {
  const vEn = dailyContent?.bible?.english || '';
  const vTa = dailyContent?.bible?.tamil || '';
  const ref = dailyContent?.bible?.ref || '';

  const verseText = isTamil ? (vTa || vEn) : (vEn || vTa);

  return {
    header: isTamil ? `📖 *இன்றைய இறைவார்த்தை (Bible Verse)*` : `📖 *Bible Verse*`,
    body: `"${verseText}"\n${ref ? `— _${ref}_\n` : ''}`,
    linkTitle: isTamil ? 'இறைவார்த்தை' : 'Bible Verse',
    url: getSiteUrl(SITE_ROUTES.DAILY_VERSE)
  };
}

// Daily Mass Readings Section
function buildReadingsSection(dailyContent, isTamil) {
  const taReadings = dailyContent?.massReadings?.tamil || {};
  const enReadings = dailyContent?.massReadings?.english || {};

  const firstR = isTamil ? (taReadings.firstReading || enReadings.firstReading) : (enReadings.firstReading || taReadings.firstReading);
  const psalmR = isTamil ? (taReadings.psalm || enReadings.psalm) : (enReadings.psalm || taReadings.psalm);
  const secondR = isTamil ? (taReadings.secondReading || enReadings.secondReading) : (enReadings.secondReading || taReadings.secondReading);
  const gospelR = isTamil ? (taReadings.gospel || enReadings.gospel) : (enReadings.gospel || taReadings.gospel);

  const dateStr = isTamil
    ? new Date().toLocaleDateString('ta-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  let body = `📅 ${dateStr}\n\n`;
  body += `*${isTamil ? 'முதல் வாசகம்' : 'First Reading'}:*\n${firstR || (isTamil ? 'இன்றைய வாசகம் கிடைக்கவில்லை.' : 'Not available')}\n\n`;
  body += `*${isTamil ? 'திருப்பாடல்' : 'Responsorial Psalm'}:*\n${psalmR || (isTamil ? 'இன்றைய திருப்பாடல் கிடைக்கவில்லை.' : 'Not available')}\n\n`;
  if (secondR) {
    body += `*${isTamil ? 'இரண்டாம் வாசகம்' : 'Second Reading'}:*\n${secondR}\n\n`;
  }
  body += `✝️ *${isTamil ? 'நற்செய்தி வாசகம்' : 'Holy Gospel'}:*\n${gospelR || (isTamil ? 'இன்றைய நற்செய்தி கிடைக்கவில்லை.' : 'Not available')}\n`;

  return {
    header: isTamil ? `📖 *இன்றைய திருப்பலி வாசகங்கள் (Daily Mass Readings)*` : `📖 *Daily Mass Readings*`,
    body,
    linkTitle: isTamil ? 'திருப்பலி வாசகங்கள்' : 'Daily Mass Readings',
    url: getSiteUrl(SITE_ROUTES.DAILY_READINGS)
  };
}

// Daily Reflection Section
function buildReflectionSection(dailyContent, isTamil) {
  const reflEn = dailyContent?.reflection?.english || '';
  const reflTa = dailyContent?.reflection?.tamil || '';
  const reflectionText = isTamil ? (reflTa || reflEn) : (reflEn || reflTa);

  return {
    header: isTamil ? `🕊️ *இன்றைய தியானம் (Daily Reflection)*` : `🕊️ *Daily Reflection*`,
    body: `${reflectionText || (isTamil ? 'இறைவனின் வார்த்தை நம் வாழ்வின் வெளிச்சம்.' : 'The word of God is a light unto our path.')}\n`,
    linkTitle: isTamil ? 'இன்றைய தியானம்' : 'Daily Reflection',
    url: getSiteUrl(SITE_ROUTES.DAILY_REFLECTION)
  };
}

// Mass Timings Section
function buildMassTimingsSection(isTamil) {
  const body = isTamil
    ? `📅 *தினசரி திருப்பலி (திங்கள் – சனி):* காலை 6:00 மணி
🌟 *ஞாயிறு திருப்பலிகள்:* காலை 6:00 மணி & காலை 8:00 மணி
🕯️ *செவ்வாய் நவநாள் திருப்பலி:* மாலை 6:00 மணி (புனித அந்தோனியார்)
🕊️ *மாதத்தின் முதல் வெள்ளி:* மாலை 6:00 மணி (நற்கருணை ஆராதனை & சிறப்பு திருப்பலி)\n`
    : `📅 *Daily Mass (Mon – Sat):* 6:00 AM
🌟 *Sunday Holy Masses:* 6:00 AM & 8:00 AM
🕯️ *Tuesday Novena to St. Antony:* 6:00 PM
🕊️ *First Friday Eucharistic Adoration & Mass:* 6:00 PM\n`;

  return {
    header: isTamil ? `⛪ *திருப்பலி நேரங்கள் (Holy Mass Timings)*` : `⛪ *Holy Mass Timings*`,
    body,
    linkTitle: isTamil ? 'திருப்பலி அட்டவணை' : 'Mass Timings',
    url: getSiteUrl(SITE_ROUTES.MASS_TIMINGS)
  };
}

// Mass Ambiguous Section (for single generic word 'mass')
function buildMassAmbiguousSection(isTamil) {
  const body = isTamil
    ? `திருப்பலி பற்றி நீங்கள் என்ன அறிய விரும்புகிறீர்கள்?
• 🕒 *திருப்பலி நேரம்* (எ.கா: "ஞாயிறு திருப்பலி நேரம்")
• 📖 *தினசரி வாசகங்கள்* (எ.கா: "இன்றைய வாசகங்கள்")
• 🙏 *திருப்பலி செபங்கள்* (எ.கா: "திருப்பலிக்கு முன் செபம்")\n`
    : `Could you tell me what you'd like to know about Mass?
• 🕒 *Mass Timings* (e.g. "Sunday Mass time")
• 📖 *Daily Mass Readings* (e.g. "Today's readings")
• 🙏 *Mass Prayers* (e.g. "Prayer before Mass")\n`;

  return {
    header: isTamil ? `⛪ *திருப்பலி வழிகாட்டுதல் (Holy Mass)*` : `⛪ *Holy Mass — St. John de Britto's Church*`,
    body,
    linkTitle: isTamil ? 'திருப்பலி அட்டவணை' : 'Mass Schedule',
    url: getSiteUrl(SITE_ROUTES.MASS_TIMINGS)
  };
}

// Confession Section
function buildConfessionSection(isTamil) {
  const body = isTamil
    ? `• ஒவ்வொரு சனிக்கிழமை மாலை 5:30 மணி முதல் 6:30 மணி வரை
• தினசரி காலை திருப்பலிக்கு முன்
• மேலும் பங்குத்தந்தையர்களை அணுகி எந்த நேரத்திலும் ஒப்புரவு பெறலாம்.

_"உங்கள் பாவங்கள் கறைபடிந்திருந்தாலும் உறைந்த பனிபோல் வெண்மையாகும்." (எசாயா 1:18)_\n`
    : `• Every Saturday from 5:30 PM to 6:30 PM
• Before daily morning Mass
• Available anytime upon personal request to the Parish Priests.

_"Though your sins are like scarlet, they shall be as white as snow." (Isaiah 1:18)_\n`;

  return {
    header: isTamil ? `🕊️ *ஒப்புரவு அருட்சாதனம் (Confession Timings)*` : `🕊️ *Sacrament of Reconciliation (Confession)*`,
    body,
    linkTitle: isTamil ? 'ஆலய தொடர்பு' : 'Parish Contact',
    url: getSiteUrl(SITE_ROUTES.CONTACT)
  };
}

// Sacraments Guidance Section
function buildSacramentsSection(text, isTamil) {
  const norm = normalizeUserText(text);
  let specificSacrament = '';

  if (norm.includes('baptism') || norm.includes('ஞானஸ்நானம்') || norm.includes('திருமுழுக்கு')) {
    specificSacrament = isTamil
      ? `🕊️ *ஞானஸ்நானம் (Baptism):*
பங்கு அலுவலகத்தில் பிறப்புச் சான்றிதழ் மற்றும் பெற்றோர்/ஞானப்பெற்றோர் விபரங்களுடன் முன்கூட்டியே பதிவு செய்து ஞானஸ்நானம் பெற்றுக்கொள்ளலாம்.`
      : `🕊️ *Sacrament of Baptism:*
Baptism is administered with prior registration at the Parish Office. Parents and Godparents are requested to attend preparation briefing.`;
  } else if (norm.includes('marriage') || norm.includes('wedding') || norm.includes('matrimony') || norm.includes('திருமணம்')) {
    specificSacrament = isTamil
      ? `💍 *திருமண அருட்சாதனம் (Holy Matrimony):*
திருமணத்திற்கு குறைந்தபட்சம் 1 மாதத்திற்கு முன்பாக பங்கு அலுவலகத்தில் பதிவு செய்து, மறைமாவட்ட திருமணத் தயாரிப்புப் பயிற்சி (Pre-Cana Course) சான்றிதழ் சமர்ப்பிக்க வேண்டும்.`
      : `💍 *Sacrament of Holy Matrimony:*
Couples must register at the Parish Office at least 1 month prior, complete the diocesan Pre-Cana preparation course, and publish parish banns.`;
  } else if (norm.includes('communion') || norm.includes('முதல் நற்கருணை')) {
    specificSacrament = isTamil
      ? `🍞 *முதல் நற்கருணை (First Holy Communion):*
பங்கு ஞாயிறு மறைக்கல்வி வகுப்புகள் வழியாக குழந்தைகள் ஆன்மீகத் தயாரிப்பு பெற்று ஆண்டுதோறும் வழங்கப்படுகிறது.`
      : `🍞 *First Holy Communion:*
Administered annually to children who have completed parish Sunday Catechism sacramental preparation.`;
  } else if (norm.includes('confirmation') || norm.includes('திடப்படுத்துதல்')) {
    specificSacrament = isTamil
      ? `🔥 *திடப்படுத்துதல் (Confirmation):*
சிவகங்கை மறைமாவட்ட ஆயரின் மேய்ப்புப்பணி வருகையின் போது இளையோருக்கு வழங்கப்படுகிறது.`
      : `🔥 *Sacrament of Confirmation:*
Administered by the Bishop of Sivagangai during pastoral parish visits to prepared youth.`;
  } else if (norm.includes('anointing') || norm.includes('நோயாளரின் பூசுதல்')) {
    specificSacrament = isTamil
      ? `🌿 *நோயாளரின் பூசுதல் (Anointing of the Sick):*
முதியோர் மற்றும் தீவிர உடல்நலக்குறைவு உள்ளவர்களுக்காக எந்த நேரத்திலும் பங்குத்தந்தையை இல்லத்திற்கோ அல்லது மருத்துவமனைக்கோ அழைக்கலாம்.`
      : `🌿 *Anointing of the Sick:*
Available anytime for the elderly and seriously ill. Please contact the parish office or priests for home or hospital visits.`;
  } else {
    specificSacrament = isTamil
      ? `⛪ *கத்தோலிக்க திருச்சபையின் ஏழு அருட்சாதனங்கள்:*
1. திருமுழுக்கு (Baptism)
2. உறுதிப்பூசுதல் (Confirmation)
3. நற்கருணை (Holy Eucharist)
4. ஒப்புரவு (Reconciliation / Confession)
5. நோயாளரின் பூசுதல் (Anointing of the Sick)
6. குருத்துவம் (Holy Orders)
7. திருமணம் (Holy Matrimony)`
      : `⛪ *The Seven Catholic Sacraments:*
1. Baptism — Gateway to life in the Spirit
2. Confirmation — Strengthening by the Holy Spirit
3. Holy Eucharist — Body & Blood of Christ
4. Reconciliation (Confession) — Forgiveness of sins
5. Anointing of the Sick — Healing & strength
6. Holy Orders — Priesthood ministry
7. Holy Matrimony — Sacred covenant in Christ`;
  }

  return {
    header: isTamil ? `✝️ *திருவருட்சாதனங்கள் வழிகாட்டுதல் (Catholic Sacraments)*` : `✝️ *Sacraments & Spiritual Guidance*`,
    body: `${specificSacrament}\n`,
    linkTitle: isTamil ? 'பங்கு விபரம்' : 'Parish Guide',
    url: getSiteUrl(SITE_ROUTES.ABOUT)
  };
}

// Catholic Prayers Section
function buildPrayersSection(text, isTamil) {
  const norm = normalizeUserText(text);
  let prayerContent = '';

  if (norm.includes('prayer before mass') || norm.includes('திருப்பலிக்கு முன் ஜெபம்')) {
    prayerContent = isTamil
      ? `🙏 *திருப்பலிக்கு முன் செபம்:*
"எல்லாம் வல்ல இறைவா, உமது திருக்குமாரனின் திருப்பலியில் தகுதியோடு பங்கேற்க என் உள்ளத்தையும் நாவையும் தூய்மைப்படுத்தியருளும். உம் பேரன்பினால் என் விசுவாசத்தை திடப்படுத்தி, இந்த திருப்பலி பலனை எனக்குத் தந்தருளும். ஆமென்."`
      : `🙏 *Prayer Before Holy Mass (St. Thomas Aquinas):*
"Almighty and everlasting God, I approach the sacrament of Your only-begotten Son, our Lord Jesus Christ. I come as one sick to the physician of life, as one unclean to the fountain of mercy. Cleanse my sins and prepare my heart for this Holy Sacrifice. Amen."`;
  } else if (norm.includes('prayer after communion') || norm.includes('நற்கருணைக்கு பின் ஜெபம்')) {
    prayerContent = isTamil
      ? `🙏 *நற்கருணைக்குப் பின் செபம் (கிறிஸ்துவின் ஆன்மாவே):*
"கிறிஸ்துவின் ஆன்மாவே, என்னைத் தூய்மையாக்கும். கிறிஸ்துவின் திருவுடலே, என்னை இரட்சிக்கும். கிறிஸ்துவின் திருஇரத்தமே, எனக்குப் போதையூட்டும். கிறிஸ்துவின் விலாத்து நீரே, என்னைக் கழுவும். ஆமென்."`
      : `🙏 *Anima Christi (Prayer After Holy Communion):*
"Soul of Christ, sanctify me. Body of Christ, save me. Blood of Christ, inebriate me. Water from the side of Christ, wash me. Passion of Christ, strengthen me. O good Jesus, hear me. Amen."`;
  } else if (norm.includes('prayer for today') || norm.includes('today prayer') || norm.includes('இன்றைய ஜெபம்')) {
    prayerContent = isTamil
      ? `🙏 *இன்றைய நாளுக்கான செபம்:*
"அன்பின் ஆண்டவரே, இந்த புதிய நாளில் என்னை உம் திருக்கரத்தில் ஒப்படைக்கிறேன். எனது எண்ணங்களையும், செயல்களையும், வார்த்தைகளையும் உமது சித்தத்திற்கு ஏற்ப அமைத்தருளும். என்னையும் என் குடும்பத்தினரையும் பாதுகாத்து ஆசீர்வதியும். ஆமென்."`
      : `🙏 *Prayer for Today:*
"Lord God, thank You for the gift of this new day. Guide my steps in Your truth, guard my family in Your peace, and grant me the grace to reflect Your love to everyone I meet today. Amen."`;
  } else if (norm.includes('rosary') || norm.includes('how to pray the rosary') || norm.includes('ஜெபமாலை')) {
    const rm = CATHOLIC_FAITH_KNOWLEDGE.rosaryMysteries;
    prayerContent = isTamil
      ? `📿 *பரிசுத்த ஜெபமாலை மறைபொருள்கள்:*
• ${rm.joyful}
• ${rm.luminous}
• ${rm.sorrowful}
• ${rm.glorious}

_ஜெபமாலை செபிப்பது எப்படி: சிலுவை அடையாளம் → விசுவாச அறிக்கை → 1 பரலோக பிதாவே → 3 அருள் நிறைந்த மரியே → 1 மகிமை → 5 மறைபொருள்கள் தியானித்து 10 அருள் நிறைந்த மரியே._`
      : `📿 *How to Pray the Holy Rosary:*
1. Sign of the Cross & Apostles' Creed
2. 1 Our Father, 3 Hail Marys (Faith, Hope, Charity), 1 Glory Be
3. Announce each Mystery, pray 1 Our Father, 10 Hail Marys, 1 Glory Be, Fatima Prayer.

*Mysteries:*
• ${rm.joyful}
• ${rm.luminous}
• ${rm.sorrowful}
• ${rm.glorious}`;
  } else if (norm.includes('our father') || norm.includes('பிதாவே') || norm.includes('பரலோக')) {
    prayerContent = isTamil
      ? `📖 *பரலோகத்தில் இருக்கிற எங்கள் பிதாவே:*\n\n${CATHOLIC_FAITH_KNOWLEDGE.prayers.ourFather.ta}`
      : `📖 *The Lord's Prayer (Our Father):*\n\n${CATHOLIC_FAITH_KNOWLEDGE.prayers.ourFather.en}`;
  } else if (norm.includes('hail mary') || norm.includes('மரியே') || norm.includes('மாதா')) {
    prayerContent = isTamil
      ? `🌹 *அருள் நிறைந்த மரியே:*\n\n${CATHOLIC_FAITH_KNOWLEDGE.prayers.hailMary.ta}`
      : `🌹 *Hail Mary:*\n\n${CATHOLIC_FAITH_KNOWLEDGE.prayers.hailMary.en}`;
  } else {
    prayerContent = isTamil
      ? `🙏 *கத்தோலிக்க விசுவாச செபங்கள்:*
• பரலோகத்தில் இருக்கிற எங்கள் பிதாவே (Our Father)
• அருள் நிறைந்த மரியே (Hail Mary)
• பிதாவுக்கும் சுதனுக்கும் தூய ஆவிக்கும் மகிமை (Glory Be)
• பரிசுத்த ஜெபமாலை (Holy Rosary)
• மனஸ்தாப செபம் & தேவமாதா புகழ்ச்சி`
      : `🙏 *Catholic Prayers & Prayer Guidance:*
• The Lord's Prayer (Our Father)
• Hail Mary (Angelic Salutation)
• Glory Be (Doxology)
• The Holy Rosary & Mysteries
• Act of Contrition & Litany`;
  }

  return {
    header: isTamil ? `🙏 *கத்தோலிக்க செபங்கள் (Catholic Prayers)*` : `🙏 *Catholic Prayers & Prayer Guidance*`,
    body: `${prayerContent}\n`,
    linkTitle: isTamil ? 'ஜெபமாலை & செபங்கள்' : 'Audio Rosary & Prayers',
    url: getSiteUrl(SITE_ROUTES.ROSARY)
  };
}

// Upcoming Events Section
function buildEventsSection(dynamicContext, isTamil) {
  const events = dynamicContext.upcomingEvents || [];
  const body = events.length > 0
    ? `${events.join('\n')}\n`
    : (isTamil ? `தற்போது இந்த வாரத்திற்கான சிறப்பு நிகழ்வுகள் அறிவிக்கப்படவில்லை. தினசரி திருப்பலி வழக்கம் போல் காலை 6:00 மணிக்கு நடைபெறும்.\n` : `Currently no special upcoming events scheduled this week. Daily Mass continues at 6:00 AM.\n`);

  return {
    header: isTamil ? `📅 *வரவிருக்கும் பங்கு நிகழ்வுகள் (Upcoming Events)*` : `📅 *Upcoming Parish Events*`,
    body,
    linkTitle: isTamil ? 'நிகழ்வுகள் & முன்பதிவு' : 'Events & Registration',
    url: getSiteUrl(SITE_ROUTES.EVENTS)
  };
}

// Announcements Section
function buildAnnouncementsSection(dynamicContext, isTamil) {
  const announcements = dynamicContext.announcements || [];
  const body = announcements.length > 0
    ? `${announcements.join('\n')}\n`
    : (isTamil ? `தற்போது புதிய பங்கு அறிவிப்புகள் ஏதுமில்லை.\n` : `There are no new parish announcements at this moment.\n`);

  return {
    header: isTamil ? `📢 *பங்கு அறிவிப்புகள் (Parish Announcements)*` : `📢 *Parish Announcements*`,
    body,
    linkTitle: isTamil ? 'அனைத்து அறிவிப்புகள்' : 'All Announcements',
    url: getSiteUrl(SITE_ROUTES.ANNOUNCEMENTS)
  };
}

// Location, Address & Visiting Section
function buildLocationSection(isTamil) {
  const body = isTamil
    ? `🏛️ *புனித ஜான் டி பிரிட்டோ திருத்தலம்*
சர்ச் ரோடு, காளையார்கோவில்,
சிவகங்கை மாவட்டம், தமிழ்நாடு — 630551.
(சிவகங்கை மறைமாவட்டம்)

🕒 *ஆலய திறக்கும் நேரம்:* தினசரி காலை 5:30 மணி முதல் இரவு 8:00 மணி வரை பார்வையாளர்களுக்காகவும் செபத்திற்காகவும் திறந்திருக்கும்.

📍 *கூகுள் மேப் வழிகாட்டல் (Google Maps):*
${EXTERNAL_LINKS.GOOGLE_MAPS}\n`
    : `🏛️ *St. John de Britto's Church*
Church Road, Kalayarkoil,
Sivagangai District, Tamil Nadu — 630551.
(Diocese of Sivagangai)

🕒 *Visiting Hours:* Open daily from 5:30 AM to 8:00 PM for prayer and pilgrims.

📍 *Google Maps Location:*
${EXTERNAL_LINKS.GOOGLE_MAPS}\n`;

  return {
    header: isTamil ? `📍 *ஆலய அமைவிடம் & முகவரி (Church Location)*` : `📍 *Church Location & Google Maps*`,
    body,
    linkTitle: isTamil ? 'தொடர்பு & அமைவிடம்' : 'Location & Contact',
    url: getSiteUrl(SITE_ROUTES.CONTACT)
  };
}

// Contact & Office Hours Section
function buildContactSection(isTamil) {
  const body = isTamil
    ? `• *பங்கு அலுவலகம்:* சர்ச் ரோடு, காளையார்கோவில் - 630551
• *தொலைபேசி:* +91 96556 39144 / பங்கு அலுவலகம்
• *மின்னஞ்சல்:* arndas777@gmail.com
• *அலுவலக நேரம்:* திங்கள் முதல் சனி வரை: காலை 9:00 – பிற்பகல் 1:00 & மாலை 4:00 – 7:00 (ஞாயிறு திருப்பலிக்குப் பின் விடுமுறை)

📍 *கூகுள் மேப் (Google Maps):*
${EXTERNAL_LINKS.GOOGLE_MAPS}\n`
    : `• *Parish Office:* Church Road, Kalayarkoil - 630551
• *Phone:* +91 96556 39144 / Parish Office
• *Email:* arndas777@gmail.com
• *Office Hours:* Monday – Saturday: 9:00 AM – 1:00 PM & 4:00 PM – 7:00 PM (Closed Sunday afternoons)

📍 *Google Maps Location:*
${EXTERNAL_LINKS.GOOGLE_MAPS}\n`;

  return {
    header: isTamil ? `📞 *பங்கு அலுவலக தொடர்பு (Contact & Office Hours)*` : `📞 *Parish Contact & Office Hours*`,
    body,
    linkTitle: isTamil ? 'தொடர்பு கொள்ள' : 'Contact Us Online',
    url: getSiteUrl(SITE_ROUTES.CONTACT)
  };
}

// Ministries, Groups & Anbiyams Section
function buildMinistriesSection(isTamil) {
  const body = isTamil
    ? `• 👥 *அன்பியங்கள் (Basic Christian Communities):* 12 வார்டுகளில் குடும்ப செபக் கூட்டங்கள்
• 🏛️ *பங்கு அருட்பணி பேரவை (Parish Pastoral Council):* பங்கு வளர்ச்சி மற்றும் நிர்வாக வழிகாட்டல்
• 🎶 *ஆலய பாடகர் குழு (Parish Choir):* திருப்பலி வழிபாட்டுப் பாடல்கள்
• 🕯️ *பீடச்சிறார்கள் சங்கம் (Altar Servers Guild):* பீடப் பணி மற்றும் திருப்பலி உதவி
• 🌟 *இளைஞர் இயக்கம் (ICYM):* பங்கு இளைஞர் ஆன்மீக வளர்ச்சி மற்றும் சமூகப் பணி
• 📖 *மறைக்கல்வி மன்றம் (Sunday Catechism):* சிறார்களுக்கான விசுவாசக் கல்வி
• ❤️ *புனித வின்சென்ட் தே பவுல் சபை (SVP):* ஏழை எளியோருக்கான உதவி
• 🌹 *மரியாயின் சேனை (Legion of Mary):* அன்னை மரியாவின் ஜெபப்பணி\n`
    : `• 👥 *Anbiyams (Basic Christian Communities):* 12 active ward prayer groups
• 🏛️ *Parish Pastoral Council:* Pastoral leadership and pastoral community initiatives
• 🎶 *Parish Choir:* Tamil & English liturgical worship choirs
• 🕯️ *Altar Servers Guild:* Dedicated youth serving the Holy Altar
• 🌟 *Youth Movement (ICYM):* Active parish youth ministry and community outreach
• 📖 *Sunday Catechism Association:* Faith formation classes for children
• ❤️ *Society of St. Vincent de Paul (SVP):* Charitable service to the needy
• 🌹 *Legion of Mary:* Marian prayer and apostolic visitation ministry\n`;

  return {
    header: isTamil ? `🏛️ *பங்கு அமைப்புகள் & அன்பியங்கள் (Ministries & Groups)*` : `🏛️ *Parish Ministries, Groups & Services*`,
    body,
    linkTitle: isTamil ? 'பங்கு அமைப்புகள்' : 'Parish Ministries',
    url: getSiteUrl(SITE_ROUTES.ABOUT)
  };
}

// Liturgical Calendar & Feast Days Section
function buildFeastCalendarSection(isTamil) {
  const body = isTamil
    ? `👑 *ஆலய பெருவிழா (Patronal Feast):* ஒவ்வொரு ஆண்டும் பிப்ரவரி 4 — புனித ஜான் டி பிரிட்டோ (அருளானந்தர்) பெருவிழா
🌟 *ஓரியூர் திருத்தல யாத்திரை:* பிப்ரவரி முதல் வாரம்
🕯️ *புனித அந்தோனியார் வார நவநாள்:* ஒவ்வொரு செவ்வாய் மாலை 6:00 மணி
🕊️ *மாதத்தின் முதல் வெள்ளி:* நற்கருணை ஆராதனை & சிறப்பு திருப்பலி

✨ *திருவழிபாட்டுக் காலங்கள்:*
• திருவருகைக் காலம் (Advent) & கிறிஸ்து பிறப்பு (Christmas)
• தவக்காலம் (Lent) & புனித வாரம் (Holy Week)
• பாஸ்கா காலம் (Easter) & பொதுக்காலம் (Ordinary Time)\n`
    : `👑 *Patronal Feast Day:* February 4 — Solemnity of St. John de Britto (Arulanandar)
🌟 *Oriyur Martyrdom Shrine Pilgrimage:* First week of February
🕯️ *Weekly Novena to St. Antony:* Every Tuesday at 6:00 PM
🕊️ *First Friday Devotion:* Eucharistic Adoration & Holy Mass

✨ *Liturgical Seasons:*
• Advent & Christmas Season
• Lent & Holy Week (Good Friday / Easter)
• Easter Season (Pentecost) & Ordinary Time\n`;

  return {
    header: isTamil ? `🗓️ *திருவழிபாடு காலண்டர் & திருவிழாக்கள் (Feast Days & Liturgy)*` : `🗓️ *Liturgical Calendar & Feast Days*`,
    body,
    linkTitle: isTamil ? 'கத்தோலிக்க காலண்டர்' : 'Catholic Calendar',
    url: getSiteUrl(SITE_ROUTES.CALENDAR)
  };
}

// Registration & Forms Section
function buildRegisterSection(isTamil) {
  const body = isTamil
    ? `பங்கு நிகழ்வுகள் மற்றும் புதிய உறுப்பினர் பதிவை எங்களது இணையதளத்தில் எளிதாக மேற்கொள்ளலாம்:

• *நிகழ்வுகள் பதிவு:* பங்கு நிகழ்ச்சிகள் மற்றும் விளையாட்டுப் போட்டிகள்
• *உறுப்பினர் குடும்பப் பதிவு:* புதிய பங்கு குடும்பப் பதிவு மற்றும் விபரங்கள்\n`
    : `You can register for parish events and new member family registration directly on our website:

• *Events Registration:* Parish events, retreats, and competitions
• *Parish Family Registration:* Register your household into the parish database\n`;

  return {
    header: isTamil ? `📝 *முன்பதிவு வழிகாட்டி (Registration & Forms)*` : `📝 *Event Registration & Parish Forms*`,
    body,
    linkTitle: isTamil ? 'உறுப்பினர் பதிவு' : 'Parish Registration',
    url: getSiteUrl(SITE_ROUTES.REGISTER)
  };
}

// Priests / Clergy Section
function buildPriestsSection(dynamicContext, isTamil) {
  const priests = dynamicContext.priests || [];
  const priestList = priests.length > 0 ? priests.join('\n• ') : 'Rev. Fr. Parish Priest';
  const body = `• ${priestList}\n\n📍 சர்ச் ரோடு, காளையார்கோவில் - 630551.\n`;

  return {
    header: isTamil ? `👥 *பங்குப் பணியாளர்கள் (Parish Clergy)*` : `👥 *Parish Clergy & Priests*`,
    body,
    linkTitle: isTamil ? 'குருக்கள் விபரம்' : 'Parish Priests',
    url: getSiteUrl(SITE_ROUTES.PRIESTS)
  };
}

// Dedicated 1-14 Services Menu Section
function buildServicesMenuSection(isTamil) {
  const body = isTamil
    ? `1️⃣ ⛪ *திருப்பலி நேரங்கள்* (Mass Timings)
2️⃣ 🕊️ *ஒப்புரவு அருட்சாதனம்* (Confession Timings)
3️⃣ ✝️ *பிற திருவருட்சாதனங்கள்* (Other Sacraments)
4️⃣ 📖 *தினசரி விவிலிய வசனம்* (Daily Bible Verse)
5️⃣ 📜 *திருப்பலி வாசகங்கள்* (Daily Mass Readings)
6️⃣ 🌟 *இன்றைய புனிதர்* (Saint of the Day)
7️⃣ 🙏 *கத்தோலிக்க செபங்கள்* (Catholic Prayers)
8️⃣ 📅 *பங்கு நிகழ்வுகள்* (Church Events)
9️⃣ 📢 *பங்கு அறிவிப்புகள்* (Parish Announcements)
🔟 📍 *ஆலய அமைவிடம் & வரைபடம்* (Location & Maps)
1️⃣1️⃣ 👥 *பங்கு அமைப்புகள் & அன்பியங்கள்* (Ministries & Anbiyams)
1️⃣2️⃣ 👑 *பங்குத்தந்தையர்கள்* (Parish Priests & Clergy)
1️⃣3️⃣ 🏛️ *ஆலய வரலாறு* (Church History)
1️⃣4️⃣ 📞 *தொடர்பு விபரம்* (Contact Information)

👉 *1 முதல் 14 வரை உள்ள எண்ணை அழுத்தவும் அல்லது உங்கள் கேள்வியை நேரடியாகக் கேட்கவும்!*
_(எ.கா: "திருப்பலி நேரம்", "கோவில் எங்கு உள்ளது", "இன்றைய வாசகங்கள்")_\n`
    : `1️⃣ ⛪ *Mass Timings*
2️⃣ 🕊️ *Confession Timings*
3️⃣ ✝️ *Other Sacrament Timings*
4️⃣ 📖 *Daily Bible Verse*
5️⃣ 📜 *Daily Mass Readings*
6️⃣ 🌟 *Saint of the Day*
7️⃣ 🙏 *Catholic Prayers*
8️⃣ 📅 *Church Events*
9️⃣ 📢 *Announcements*
🔟 📍 *Church Location & Map*
1️⃣1️⃣ 👥 *Parish Ministries*
1️⃣2️⃣ 👑 *Parish Priest & Clergy*
1️⃣3️⃣ 🏛️ *Church History*
1️⃣4️⃣ 📞 *Contact Church*

👉 *Reply with a number (1-14) or type your question naturally.*
_(e.g., "What time is Mass?", "Where is the church?", "Confession timings")_\n`;

  return {
    header: isTamil ? `⛪ *SJDB Connect – பங்கு சேவைகள் (Parish Services)*` : `⛪ *SJDB Connect – Services*`,
    body,
    linkTitle: isTamil ? 'பங்கு சேவைகள்' : 'Parish Services',
    url: getSiteUrl(SITE_ROUTES.ABOUT)
  };
}

// Help Guide Section
function buildHelpSection(isTamil) {
  const body = isTamil
    ? `நீங்கள் என்னிடம் பின்வரும் விபரங்களைக் கேட்கலாம்:

• ⛪ *திருப்பலி & ஒப்புரவு நேரங்கள்:* "திருப்பலி நேரங்கள் எப்போது?"
• 📖 *இறைவார்த்தை & தியானம்:* "இன்றைய இறைவார்த்தை", "இன்றைய தியானம்"
• 🕊️ *புனிதர் & வாசகங்கள்:* "இன்றைய புனிதர் யார்?", "இன்றைய வாசகங்கள்"
• 🙏 *செபங்கள் & ஜெபமாலை:* "ஜெபமாலை செபிப்பது எப்படி?"
• ✝️ *திருவருட்சாதனங்கள்:* "ஞானஸ்நானம் எடுப்பது எப்படி?", "திருமண பதிவு"
• 📅 *நிகழ்வுகள் & அறிவிப்புகள்:* "அறிவிப்புகள் என்ன?", "வரவிருக்கும் நிகழ்வுகள்"
• 🏛️ *அமைப்புகள் & அன்பியங்கள்:* "பங்கு அமைப்புகள் என்னென்ன?"
• 📍 *அமைவிடம் & தொடர்பு:* "ஆலயம் எங்கு உள்ளது?", "அலுவலக தொலைபேசி எண்"
• 📱 *சுயவிவரம் & கணக்கு:* "என் சுயவிவரம்", "என் மொழி", "என் அறிவிப்புகள்"
• 🌐 *இணையதள சேவைகள்:* மொழி மாற்ற *LANGUAGE*, முழு வாசகங்கள் பெற *READINGS*\n`
    : `You can ask me about any church or faith-related topic:

• ⛪ *Mass & Confession:* "When is Sunday Mass?", "What time is confession?"
• 📖 *Scripture & Devotions:* "Say today's Bible verse", "Give me today's reflection"
• 🕊️ *Saints & Readings:* "Who is today's saint?", "What are today's Mass readings?"
• 🙏 *Prayers & Rosary:* "How do I pray the Rosary?", "Prayer before Mass"
• ✝️ *Sacraments:* "How do I register for Baptism / Marriage?"
• 📅 *Parish News:* "Any parish announcements?", "What events are coming?"
• 🏛️ *Ministries:* "What ministries are available?", "Anbiyam groups"
• 📍 *Location & Contact:* "Where is the church?", "Parish office hours"
• 📱 *My Account:* "My profile", "My language", "My notifications", "My registrations"
• 🌐 *Bot Commands:* Reply *READINGS* for full readings, *LANGUAGE* to change language\n`;

  return {
    header: isTamil ? `⛪ *SJDB Connect உதவி & வழிகாட்டி*` : `⛪ *How to use SJDB Connect*`,
    body,
    linkTitle: isTamil ? 'பங்கு இணையதளம்' : 'Parish Web Portal',
    url: getSiteUrl(SITE_ROUTES.HOME)
  };
}

// Authenticated User Own Account Handlers
async function buildUserProfileSection(userAuthContext, isTamil) {
  const { user, session } = userAuthContext;

  if (!user && (!session || !session.phoneNumber)) {
    return {
      header: isTamil ? `👤 *உங்கள் சுயவிவரம் (My Profile)*` : `👤 *My Parish Profile*`,
      body: isTamil
        ? `உங்கள் வாட்ஸ்அப் எண் பங்கு கணக்குடன் இன்னும் இணைக்கப்படவில்லை. பதிவு செய்ய *VERIFY* என அனுப்பவும் அல்லது பங்கு இணையதளத்தில் பதிவு செய்யவும்.\n`
        : `Your WhatsApp number is not yet linked to a verified parish account. Reply with *VERIFY* or register online.\n`,
      linkTitle: isTamil ? 'உறுப்பினர் பதிவு' : 'Parish Registration',
      url: getSiteUrl(SITE_ROUTES.REGISTER)
    };
  }

  const name = user?.name || 'Parishioner';
  const memberId = user?.parishMemberId || 'N/A';
  const familyId = user?.familyId || 'N/A';
  const phone = user?.phone || session?.phoneNumber || 'N/A';
  const anbiyam = user?.anbiyam || 'Kalayarkoil Parish';
  const status = user?.isVerified ? '✅ Verified Parishioner' : '⏳ Pending Verification';

  const body = isTamil
    ? `👤 *பெயர்:* ${name}
🆔 *பங்கு உறுப்பினர் எண்:* ${memberId}
🏠 *குடும்ப அடையாள எண்:* ${familyId}
📱 *தொலைபேசி:* ${phone}
👥 *அன்பியம் / வார்டு:* ${anbiyam}
🛡️ *நிலை:* ${status}\n`
    : `👤 *Name:* ${name}
🆔 *Parish Member ID:* ${memberId}
🏠 *Family ID:* ${familyId}
📱 *Phone:* ${phone}
👥 *Anbiyam / Ward:* ${anbiyam}
🛡️ *Status:* ${status}\n`;

  return {
    header: isTamil ? `👤 *உங்கள் பங்கு சுயவிவரம் (My Profile)*` : `👤 *Your Parish Profile*`,
    body,
    linkTitle: isTamil ? 'சுயவிவர போர்டல்' : 'Profile Portal',
    url: getSiteUrl(SITE_ROUTES.PROFILE)
  };
}

async function buildUserLanguageSection(userAuthContext, isTamil) {
  const { session, user } = userAuthContext;
  const langCode = session?.language || user?.preferredLanguage || 'ta';
  const langNames = {
    ta: 'தமிழ் (Tamil)',
    en: 'English',
    both: 'தமிழ் + English (Both)'
  };
  const currentLang = langNames[langCode] || 'English';

  const body = isTamil
    ? `🌐 உங்கள் தற்போதைய மொழி: *${currentLang}*

மொழியை மாற்ற விரும்பினால் *3* அல்லது *LANGUAGE* என தட்டச்சு செய்து அனுப்பவும்.\n`
    : `🌐 Your saved language preference: *${currentLang}*

To change your language, reply with *3* or *LANGUAGE* anytime.\n`;

  return {
    header: isTamil ? `🌐 *மொழி விருப்பத்தேர்வு (Language Preference)*` : `🌐 *Saved Language Preference*`,
    body,
    linkTitle: isTamil ? 'அமைப்புகள் போர்டல்' : 'Settings Portal',
    url: getSiteUrl(SITE_ROUTES.SETTINGS)
  };
}

async function buildUserNotificationsSection(userAuthContext, isTamil) {
  const { session } = userAuthContext;
  const prefs = session?.preferences || ['verse', 'saint', 'mass', 'events', 'announcements'];
  const prefLabels = {
    verse: '📖 Daily Bible Verse',
    saint: '🕊️ Saint of the Day',
    mass: '⛪ Daily Mass Readings',
    events: '📅 Church Events',
    announcements: '📢 Parish Announcements',
    birthday: '🎂 Birthday Wishes'
  };

  const activeList = prefs.map(p => `• ${prefLabels[p] || p}`).join('\n');

  const body = isTamil
    ? `🔔 உங்கள் வாட்ஸ்அப் சந்தா விபரங்கள்:
${activeList}

விருப்பங்களை மாற்ற விரும்பினால் *2* அல்லது *PREFERENCES* என தட்டச்சு செய்து அனுப்பவும்.\n`
    : `🔔 Your active daily WhatsApp notification subscriptions:
${activeList}

To customize your notification subscriptions, reply with *2* or *PREFERENCES* anytime.\n`;

  return {
    header: isTamil ? `🔔 *அறிவிப்பு விருப்பங்கள் (Notification Preferences)*` : `🔔 *Your Notification Subscriptions*`,
    body,
    linkTitle: isTamil ? 'அறிவிப்பு அமைப்புகள்' : 'Notification Settings',
    url: getSiteUrl(SITE_ROUTES.NOTIFICATIONS)
  };
}

async function buildUserRegistrationsSection(userAuthContext, isTamil) {
  const { user, session } = userAuthContext;
  const phone = user?.phone || session?.phoneNumber || session?.providedPhone;

  let bookings = [];
  if (phone && mongoose.connection.readyState === 1) {
    try {
      bookings = await Booking.find({ phone }).sort({ createdAt: -1 }).limit(3).lean();
    } catch (e) {
      console.warn('[ChurchRAG] Could not fetch bookings:', e.message);
    }
  }

  let body = '';
  if (bookings && bookings.length > 0) {
    const list = bookings.map(b => `• *${b.eventTitle || b.type || 'Booking'}* — Ref: ${b.referenceNumber || b._id} (${b.status || 'Confirmed'})`).join('\n');
    body = isTamil ? `நீங்கள் பதிவு செய்துள்ள நிகழ்வுகள்:\n${list}\n` : `Your active registrations:\n${list}\n`;
  } else {
    body = isTamil
      ? `தற்போது உங்களது பதிவுகள் ஏதுமில்லை. வரவிருக்கும் பங்கு நிகழ்வுகளுக்கு இணையதளத்தில் பதிவு செய்யலாம்.\n`
      : `You currently have no registered bookings. You can explore and register for upcoming parish events on our website.\n`;
  }

  return {
    header: isTamil ? `📝 *உங்கள் நிகழ்வுப் பதிவுகள் (My Registrations)*` : `📝 *Your Event Registrations*`,
    body,
    linkTitle: isTamil ? 'நிகழ்வுகள் & முன்பதிவு' : 'Events & Registration',
    url: getSiteUrl(SITE_ROUTES.BOOKINGS)
  };
}

/**
 * Master Query Answering Engine:
 * Authenticates user context securely, evaluates intents, and returns ONLY requested sections + direct links.
 */
async function answerChurchQuestion(rawText, userPreferredLang = null, userAuthContext = {}) {
  const classification = classifyChurchDomain(rawText);

  // Hard domain refusal if query is outside church / account scope
  if (!classification.is_church_related) {
    return {
      success: false,
      isChurchRelated: false,
      reply: CHURCH_REFUSAL_MSG
    };
  }

  const queryLang = userPreferredLang || detectQueryLanguage(rawText);
  const isTamil = queryLang === 'ta';

  const intents = extractQueryIntents(rawText);
  const dailyContent = await getCachedDailyContent();
  const dynamicContext = await getDynamicParishContext();

  const sections = [];

  // Map intents to focused sections
  for (const intent of intents) {
    switch (intent) {
      case 'services_menu':
        sections.push(buildServicesMenuSection(isTamil));
        break;
      case 'mass_ambiguous':
        sections.push(buildMassAmbiguousSection(isTamil));
        break;
      case 'saint_history':
        sections.push(buildSaintHistorySection(isTamil));
        break;
      case 'church_history':
        sections.push(buildChurchHistorySection(isTamil));
        break;
      case 'saint_of_the_day':
        sections.push(buildSaintSection(dailyContent, isTamil));
        break;
      case 'verse':
        sections.push(buildVerseSection(dailyContent, isTamil));
        break;
      case 'readings':
        sections.push(buildReadingsSection(dailyContent, isTamil));
        break;
      case 'reflection':
        sections.push(buildReflectionSection(dailyContent, isTamil));
        break;
      case 'mass_timings':
        sections.push(buildMassTimingsSection(isTamil));
        break;
      case 'confession':
        sections.push(buildConfessionSection(isTamil));
        break;
      case 'sacraments':
        sections.push(buildSacramentsSection(rawText, isTamil));
        break;
      case 'prayers':
        sections.push(buildPrayersSection(rawText, isTamil));
        break;
      case 'events':
        sections.push(buildEventsSection(dynamicContext, isTamil));
        break;
      case 'announcements':
        sections.push(buildAnnouncementsSection(dynamicContext, isTamil));
        break;
      case 'location':
        sections.push(buildLocationSection(isTamil));
        break;
      case 'contact':
        sections.push(buildContactSection(isTamil));
        break;
      case 'ministries':
        sections.push(buildMinistriesSection(isTamil));
        break;
      case 'feast_calendar':
        sections.push(buildFeastCalendarSection(isTamil));
        break;
      case 'register':
        sections.push(buildRegisterSection(isTamil));
        break;
      case 'priests':
        sections.push(buildPriestsSection(dynamicContext, isTamil));
        break;
      case 'help':
        sections.push(buildHelpSection(isTamil));
        break;

      // User's Own Account (Secure WhatsApp Authorization)
      case 'user_profile':
        sections.push(await buildUserProfileSection(userAuthContext, isTamil));
        break;
      case 'user_language':
        sections.push(await buildUserLanguageSection(userAuthContext, isTamil));
        break;
      case 'user_notifications':
        sections.push(await buildUserNotificationsSection(userAuthContext, isTamil));
        break;
      case 'user_registrations':
        sections.push(await buildUserRegistrationsSection(userAuthContext, isTamil));
        break;
    }
  }

  // Fallback if no specific sub-intent was matched but query was classified as church-related
  if (sections.length === 0) {
    const cat = classification.category;
    if (cat === CHURCH_CATEGORIES.MASS_TIMINGS) sections.push(buildMassTimingsSection(isTamil));
    else if (cat === CHURCH_CATEGORIES.CONFESSION) sections.push(buildConfessionSection(isTamil));
    else if (cat === CHURCH_CATEGORIES.SAINTS) sections.push(buildSaintSection(dailyContent, isTamil));
    else if (cat === CHURCH_CATEGORIES.DAILY_READINGS) sections.push(buildReadingsSection(dailyContent, isTamil));
    else if (cat === CHURCH_CATEGORIES.PRAYERS) sections.push(buildPrayersSection(rawText, isTamil));
    else if (cat === CHURCH_CATEGORIES.SACRAMENTS) sections.push(buildSacramentsSection(rawText, isTamil));
    else if (cat === CHURCH_CATEGORIES.EVENTS) sections.push(buildEventsSection(dynamicContext, isTamil));
    else if (cat === CHURCH_CATEGORIES.ANNOUNCEMENTS) sections.push(buildAnnouncementsSection(dynamicContext, isTamil));
    else if (cat === CHURCH_CATEGORIES.LOCATION) sections.push(buildLocationSection(isTamil));
    else if (cat === CHURCH_CATEGORIES.CONTACT) sections.push(buildContactSection(isTamil));
    else if (cat === CHURCH_CATEGORIES.MINISTRIES) sections.push(buildMinistriesSection(isTamil));
    else if (cat === CHURCH_CATEGORIES.HISTORY) sections.push(buildSaintHistorySection(isTamil));
    else if (cat === CHURCH_CATEGORIES.PRIESTS) sections.push(buildPriestsSection(dynamicContext, isTamil));
    else sections.push(buildHelpSection(isTamil));
  }

  // Compose the final message from ONLY the matched sections
  let messageContent = '';
  const links = [];

  sections.forEach((sec, idx) => {
    if (idx > 0) messageContent += '\n━━━━━━━━━━━━━━━━━━━━\n\n';
    messageContent += `${sec.header}\n\n${sec.body}`;
    if (sec.url && !links.some(l => l.url === sec.url)) {
      links.push({ title: sec.linkTitle, url: sec.url });
    }
  });

  // Append relevant link(s)
  if (links.length === 1) {
    messageContent += `\n🌐 *${isTamil ? 'மேலும் விபரம்' : 'Read more'}:*\n${links[0].url}\n`;
  } else if (links.length > 1) {
    messageContent += `\n🌐 *${isTamil ? 'மேலும் வாசிக்க' : 'Read more'}:*\n`;
    links.forEach(l => {
      messageContent += `• *${l.title}:* ${l.url}\n`;
    });
  }

  // Consistent Church Signature
  messageContent += `\n— *${isTamil ? 'புனித ஜான் டி பிரிட்டோ திருத்தலம், காளையார்கோவில்' : "St. John de Britto's Church, Kalayarkoil"}*\n_SJDB Connect_`;

  const isSaintOnly = sections.length === 1 && sections[0].isSaintOfDayFlow;

  return {
    success: true,
    isChurchRelated: true,
    isSaintOfDayFlow: !!isSaintOnly,
    imageUrl: isSaintOnly ? sections[0].imageUrl : null,
    reply: messageContent,
    matchedIntents: intents
  };
}

module.exports = {
  answerChurchQuestion,
  detectQueryLanguage,
  extractQueryIntents,
  normalizeUserText
};
