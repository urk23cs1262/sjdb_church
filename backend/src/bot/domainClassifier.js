/**
 * Domain Classifier for SJDB Connect WhatsApp Bot
 * 
 * Enforces a strict hard domain-classification layer:
 * - Checks if the user's query is strictly related to:
 *   1. St. John de Britto Church, Kalayarkoil (parish info, history, timings, priests, anbiyams)
 *   2. Catholic faith, Scripture, Bible, Catechism, Sacraments, Prayers, Liturgical seasons
 *   3. Daily Catholic readings, Saints, Reflections, Feasts
 *   4. SJDB Connect bot commands, portal features, registrations, donations, contact, ministries
 * - Refuses general/unrelated topics (sports, politics, weather, programming, stocks, general jokes, etc.)
 */

// Permitted Church Categories
const CHURCH_CATEGORIES = {
  MASS_TIMINGS: 'mass_timings',
  CONFESSION: 'confession',
  PARISH_INFO: 'parish_info',
  HISTORY: 'history',
  EVENTS: 'events',
  ANNOUNCEMENTS: 'announcements',
  PRIESTS: 'priests',
  SACRAMENTS: 'sacraments',
  PRAYERS: 'prayers',
  BIBLE_SCRIPTURE: 'bible_scripture',
  SAINTS: 'saints',
  DAILY_READINGS: 'daily_readings',
  LITURGY_SEASONS: 'liturgy_seasons',
  ANBIYAM: 'anbiyam',
  MINISTRIES: 'ministries',
  CONTACT: 'contact',
  LOCATION: 'location',
  BOT_FEATURES: 'bot_features',
  DONATIONS_PORTAL: 'donations_portal',
  GENERAL_CATHOLIC: 'general_catholic'
};

// Patterns strongly indicating church/Catholic domain
const CHURCH_PATTERNS = [
  // English Keywords
  /\b(church|parishes|parish|mass|masses|holy mass|eucharist|altar|communion|confession|confessions|conf|reconciliation|rosary|rosaries|novena|novenas|adoration)\b/i,
  /\b(father|fathers|priest|priests|pastor|pastors|bishop|bishops|pope|popes|deacon|deacons|sister|sisters|nun|nuns|catechism|catechisms|sacrament|sacraments|baptism|baptisms|confirmation|matrimony|wedding)\b/i,
  /\b(bible|bibles|gospel|gospels|scripture|scriptures|verse|verses|psalm|psalms|testament|testaments|jesus|christ|mary|our lady|joseph|john de britto|britto|saint|saints|feast|feasts)\b/i,
  /\b(prayer|prayers|pray|praying|blessing|blessings|bless|lent|easter|advent|christmas|pentecost|good friday|ash wednesday|holy week|liturgy|liturgical|calendar)\b/i,
  /\b(kalayarkoil|sivagangai|anbiyam|anbiyams|substation|substations|sjdb|connect|readings|reading|reflection|reflections|catholic|catholics|vatican|christian|christians|faith)\b/i,
  /\b(timing|timings|schedule|schedules|event|events|announcement|announcements|donation|donations|register|registration|registering|offering|tithe|choir|catechist|ministry|ministries|association|associations|contact|location|address|office hours|forms|portal|website|language|notification|notifications|preference|preferences|subscribe|unsubscribe|profile|account|service|services|menu|help)\b/i,
  /\b(hi|hello|hey|greetings|good morning|good evening|praise the lord|peace|welcome|start|reset|vanakkam)\b/i,

  // Tamil Keywords
  /(கோவில்|ஆலயம்|பங்கு|திருப்பலி|பூசை|நற்கருணை|ஒப்புரவு|பாவசங்கீர்த்தனம்|ஜெபமாலை|நவநாள்|ஆராதனை)/,
  /(பங்குத்தந்தை|அருட்தந்தை|குரு|ஆயவர்|போப்|கன்னியர்|மறைக் கல்வி|திருவருட்சாதனம்|திருவருட்சாதனங்கள்|ஞானஸ்நானம்|திடப்படுத்தல்|திருமணம்)/,
  /(வேத புத்தகம்|பைபிள்|நற்செய்தி|வசனம்|திருப்பாடல்|இயேசு|கிறிஸ்து|மரியன்னை|மாதா|சூசையப்பர்|அருளானந்தர்|புனிதர்|புனிதர்கள்|திருவிழா|பெருவிழா)/,
  /(ஜெபம்|ஜெபங்கள்|பிரார்த்தனை|ஆசீர்வாதம்|தவக்காலம்|பாஸ்கா|திருவருகை|கிறிஸ்துமஸ்|பெந்தேகோஸ்தே|புனித வெள்ளி|சாம்பல் புதன்|திருவழிபாடு)/,
  /(காளையார்கோவில்|சிவகங்கை|அன்பியம்|அன்பியங்கள்|கிளைப்பங்கு|தினசரி வாசகம்|தியானம்|கத்தோலிக்க|விசுவாசம்|நேரம்|நேரங்கள்|நிகழ்வு|அறிவிப்பு|முகவரி|தொடர்பு|அமைப்புகள்|மன்றங்கள்|பதிவு|முன்பதிவு|உதவி|சுயவிவரம்|கணக்கு|சேவை|சேவைகள்|மெனு|வணக்கம்|காலை வணக்கம்|இயேசுவுக்கே புகழ்)/
];

// Patterns strongly indicating non-church / prohibited / general domain queries
const UNRELATED_PATTERNS = [
  /\b(cricket|football|ipl|score|match|world cup|messi|ronaldo|cinema|movie|movies|actor|actress|bollywood|kollywood)\b/i,
  /\b(python|javascript|java|c\+\+|coding|code|programming|algorithm|software|debug|html|css|sql|github)\b/i,
  /\b(weather|temperature|forecast|rain today|stock|stocks|crypto|bitcoin|shares|nifty|sensex|gold rate|petrol price)\b/i,
  /\b(joke|jokes|riddle|riddles|game|games|recipe|recipes|cook|cooking|restaurant|hotel booking|flight ticket|train timing|movie tickets)\b/i,
  /\b(politics|election|elections|modi|bjp|congress|dmk|aiadmk|minister|war|ukraine|russia|president|prime minister)\b/i,
  /(வானிலை|மழை|கிரிக்கெட்|சினிமா|திரைப்படம்|நகைச்சுவை|சமையல்|பங்குச்சந்தை|அரசியல்|தேர்தல்)/
];

/**
 * Classifies whether a user message belongs to the Church / Catholic / SJDB domain.
 */
function classifyChurchDomain(rawText) {
  if (!rawText || !rawText.trim()) {
    return {
      is_church_related: false,
      category: 'empty',
      confidence: 0.0,
      reason: 'Empty message'
    };
  }

  const text = rawText.trim();

  // 1. Check for explicitly unrelated / banned general query patterns
  const isUnrelatedMatch = UNRELATED_PATTERNS.some(regex => regex.test(text));
  const isChurchMatch = CHURCH_PATTERNS.some(regex => regex.test(text));

  // If contains unrelated keywords and zero church context -> immediate refusal
  if (isUnrelatedMatch && !isChurchMatch) {
    return {
      is_church_related: false,
      category: 'unrelated_general_query',
      confidence: 0.95,
      reason: 'Matched general / non-church prohibited topics'
    };
  }

  // 2. Identify Church Category (with priority order)
  let detectedCategory = CHURCH_CATEGORIES.GENERAL_CATHOLIC;
  let confidence = 0.50;

  if (/\b(prayer|prayers|pray|rosary|rosaries|our father|hail mary|novena|novenas|litany)\b/i.test(text) || /(ஜெபம்|ஜெபமாலை|பிரார்த்தனை)/.test(text)) {
    detectedCategory = CHURCH_CATEGORIES.PRAYERS;
    confidence = 0.95;
  } else if (/\b(confession|confessions|conf|reconciliation|reconcile)\b/i.test(text) || /(பாவசங்கீர்த்தனம்|ஒப்புரவு)/.test(text)) {
    detectedCategory = CHURCH_CATEGORIES.CONFESSION;
    confidence = 0.96;
  } else if (/\b(mass|masses|tuesday|sunday|timing|timings|schedule|schedules|time)\b/i.test(text) || /(பூசை|திருப்பலி நேரம்|நேரம்)/.test(text)) {
    detectedCategory = CHURCH_CATEGORIES.MASS_TIMINGS;
    confidence = 0.95;
  } else if (/\b(sacrament|sacraments|baptism|baptisms|marriage|communion|confirmation)\b/i.test(text) || /(திருவருட்சாதனம்|திருவருட்சாதனங்கள்|ஞானஸ்நானம்)/.test(text)) {
    detectedCategory = CHURCH_CATEGORIES.SACRAMENTS;
    confidence = 0.95;
  } else if (/\b(history|established|started|built|heritage)\b/i.test(text) || /(வரலாறு|தோற்றம்)/.test(text)) {
    detectedCategory = CHURCH_CATEGORIES.HISTORY;
    confidence = 0.92;
  } else if (/\b(priest|priests|parish priest|assistant priest|pastor|bishop|pope)\b/i.test(text) || (/\bfather\b/i.test(text) && !text.includes('our father')) || /(பங்குத்தந்தை|அருட்தந்தை)/.test(text)) {
    detectedCategory = CHURCH_CATEGORIES.PRIESTS;
    confidence = 0.92;
  } else if (/\b(event|events|feast|feasts|celebration|festival|program)\b/i.test(text) || /(நிகழ்வு|திருவிழா|பெருவிழா)/.test(text)) {
    detectedCategory = CHURCH_CATEGORIES.EVENTS;
    confidence = 0.90;
  } else if (/\b(announcement|announcements|notice|notices|circular)\b/i.test(text) || /(அறிவிப்பு|செய்தி)/.test(text)) {
    detectedCategory = CHURCH_CATEGORIES.ANNOUNCEMENTS;
    confidence = 0.90;
  } else if (/\b(saint|saints|britto|john de britto|anthony|mary|joseph|st\.)\b/i.test(text) || /(புனிதர்|புனிதர்கள்|அருளானந்தர்)/.test(text)) {
    detectedCategory = CHURCH_CATEGORIES.SAINTS;
    confidence = 0.94;
  } else if (/\b(reading|readings|gospel|gospels|verse|verses|psalm|psalms|reflection|reflections)\b/i.test(text) || /(இன்றைய வாசகம்|நற்செய்தி|வேத வசனம்|தியானம்)/.test(text)) {
    detectedCategory = CHURCH_CATEGORIES.DAILY_READINGS;
    confidence = 0.96;
  } else if (/\b(lent|easter|advent|christmas|holy week|season|liturgical|calendar)\b/i.test(text) || /(தவக்காலம்|பாஸ்கா|கிறிஸ்துமஸ்|திருவழிபாடு)/.test(text)) {
    detectedCategory = CHURCH_CATEGORIES.LITURGY_SEASONS;
    confidence = 0.92;
  } else if (/\b(anbiyam|anbiyams|substation|substations|ward|zone)\b/i.test(text) || /(அன்பியம்|கிளைப்பங்கு)/.test(text)) {
    detectedCategory = CHURCH_CATEGORIES.ANBIYAM;
    confidence = 0.92;
  } else if (/\b(ministry|ministries|association|associations|council|choir|altar server|youth)\b/i.test(text) || /(அமைப்புகள்|மன்றங்கள்|பேரவை|பாடகர் குழு)/.test(text)) {
    detectedCategory = CHURCH_CATEGORIES.MINISTRIES;
    confidence = 0.92;
  } else if (/\b(contact|phone|email|office|office hours|visit)\b/i.test(text) || /(தொடர்பு|தொலைபேசி|அலுவலக)/.test(text)) {
    detectedCategory = CHURCH_CATEGORIES.CONTACT;
    confidence = 0.92;
  } else if (/\b(where|location|address|route|directions)\b/i.test(text) || /(முகவரி|அமைவிடம்|எங்கு)/.test(text)) {
    detectedCategory = CHURCH_CATEGORIES.LOCATION;
    confidence = 0.92;
  } else if (/\b(bot|sjdb|connect|help|register|registration|registering|website|donate|portal|bot help|language|notification|notifications|preference|preferences)\b/i.test(text) || /(பதிவு|வழிகாட்டி|உதவி|மொழி)/.test(text)) {
    detectedCategory = CHURCH_CATEGORIES.BOT_FEATURES;
    confidence = 0.92;
  } else if (isChurchMatch) {
    detectedCategory = CHURCH_CATEGORIES.GENERAL_CATHOLIC;
    confidence = 0.85;
  }

  // Final Decision threshold
  const isChurchRelated = isChurchMatch && confidence >= 0.70;

  return {
    is_church_related: isChurchRelated,
    category: detectedCategory,
    confidence: isChurchRelated ? confidence : 0.30,
    reason: isChurchRelated ? 'Recognized valid Catholic/Church topic' : 'Query outside permitted church domain'
  };
}

const CHURCH_REFUSAL_MSG = `🙏 *SJDB Connect Assistance*

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

module.exports = {
  CHURCH_CATEGORIES,
  classifyChurchDomain,
  CHURCH_REFUSAL_MSG
};
