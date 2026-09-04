const axios = require('axios');
const { SITE_ROUTES, EXTERNAL_LINKS, getSiteUrl, getBaseClientUrl } = require('../config/siteRoutes');

const PUBLIC_CLIENT_URL = 'https://st-jb-church.vercel.app';

function getPublicDomain() {
  return getBaseClientUrl();
}

const CLIENT_URL = getBaseClientUrl();

// In-memory cache for validated URLs to avoid repeating network requests during broadcasts
const urlValidationCache = new Map();

/**
 * Remove any URL or web link pattern completely from text
 */
function removeAllUrls(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/www\.[^\s]+/gi, '')
    .replace(/Source:\s*Vatican\s*News\s*\([^)]*\)/gi, '')
    .replace(/Read more:\s*Vatican\s*News/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Validates whether a URL is reachable and does not return 404 or an error.
 * Uses a quick HEAD / GET request with a 3.5s timeout.
 */
async function validateUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) return false;

  // Don't ping localhost in production, but allow for testing
  if (cleanUrl.includes('localhost')) return true;

  if (urlValidationCache.has(cleanUrl)) {
    return urlValidationCache.get(cleanUrl);
  }

  try {
    const res = await axios.get(cleanUrl, {
      timeout: 3500,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SJDB-Church-Bot/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400
    });

    const isValid = res.status >= 200 && res.status < 400;
    urlValidationCache.set(cleanUrl, isValid);
    return isValid;
  } catch (err) {
    urlValidationCache.set(cleanUrl, false);
    return false;
  }
}

/**
 * Helper to extract readings parts (First Reading, Psalm, Gospel) from structured massReadings
 */
function extractLiturgicalReadings(massReadingsLangObj) {
  const readings = massReadingsLangObj?.readings || [];
  let firstReading = '';
  let secondReading = '';
  let psalm = '';
  let gospel = '';

  readings.forEach((r) => {
    const heading = (r.type || '').toLowerCase();
    const content = (r.text || '').trim();

    if (heading.includes('முதல்') || heading.includes('first')) {
      firstReading = content;
    } else if (heading.includes('இரண்டாம்') || heading.includes('second')) {
      secondReading = content;
    } else if (heading.includes('பாடல்') || heading.includes('psalm') || heading.includes('பதிலுரை')) {
      psalm = content;
    } else if (heading.includes('நற்செய்தி') || heading.includes('gospel')) {
      gospel = content;
    }
  });

  // Fallback to fullText if specific sections aren't separated
  if (!firstReading && !psalm && !gospel && massReadingsLangObj?.fullText) {
    firstReading = massReadingsLangObj.fullText;
  }

  return { firstReading, secondReading, psalm, gospel };
}

/**
 * Truncate text cleanly for 'short' reading preference
 */
function createExcerpt(text, maxLength = 300) {
  if (!text) return '';
  const clean = text.trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength).trim() + '...';
}

/**
 * MESSAGE 1 — DAILY CATHOLIC MESSAGE (Devotional & Readings Content ONLY — 0 URLs)
 *
 * Automatically includes all four essential sections:
 * 1. Daily Bible Verse
 * 2. Daily Mass Readings (First Reading, Responsorial Psalm, Second Reading if applicable, Gospel)
 * 3. Daily Reflection
 * 4. Saint of the Day
 *
 * @param {Object} dailyContent - Structured daily content object
 * @param {String} language - 'ta' (default) | 'en' | 'ml' | 'both'
 * @param {String} readingPreference - 'full' | 'short' | 'verse-reflection' | 'complete'
 * @returns {String} Formatted WhatsApp message guaranteed to contain ZERO URLs.
 */
function generateDailyCatholicMessage({ dailyContent, language = 'ta', readingPreference = 'full' }) {
  const rawLang = String(language || 'ta').toLowerCase();
  let lang = 'ta'; // Default to Tamil

  if (rawLang === 'en' || rawLang.startsWith('en')) {
    lang = 'en';
  } else if (rawLang === 'ml' || rawLang.startsWith('ml') || rawLang.includes('malayalam')) {
    lang = 'ml';
  } else if (rawLang === 'both' || (rawLang.includes('ta') && rawLang.includes('en')) || rawLang === 'all') {
    lang = 'both';
  } else {
    lang = 'ta'; // Tamil fallback for everything else
  }

  const pref = String(readingPreference || 'full').toLowerCase();
  const isVerseReflectionOnly = pref === 'verse-reflection';
  const isShort = pref === 'short';

  const dateEn = dailyContent.formattedDate || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const dateTa = dailyContent.formattedDateTa || dateEn;

  const verseEn = dailyContent.bible?.english || '';
  const verseTa = dailyContent.bible?.tamil || '';
  const verseRef = dailyContent.bible?.ref || '';

  const enReadings = extractLiturgicalReadings(dailyContent.massReadings?.english);
  const taReadings = extractLiturgicalReadings(dailyContent.massReadings?.tamil);

  const reflectionEn = dailyContent.reflection?.english || '';
  const reflectionTa = dailyContent.reflection?.tamil || '';

  const saintNameEn = dailyContent.saint?.nameEnglish || dailyContent.saintOfTheDay?.english?.name || 'Holy Saint';
  const saintNameTa = dailyContent.saint?.nameTamil || dailyContent.saintOfTheDay?.tamil?.name || saintNameEn;
  const saintDescEn = dailyContent.saint?.description || dailyContent.saintOfTheDay?.english?.description || '';
  const saintDescTa = dailyContent.saint?.descriptionTamil || dailyContent.saintOfTheDay?.tamil?.description || saintDescEn;

  let message = '';

  // ───────────────────────────────────────────────────────────────────────────
  // 1. ENGLISH USER
  // ───────────────────────────────────────────────────────────────────────────
  if (lang === 'en') {
    let readingContent = '';
    if (!isVerseReflectionOnly) {
      const firstR = isShort ? createExcerpt(enReadings.firstReading, 320) : (enReadings.firstReading || 'First reading is not available today.');
      const psalmR = isShort ? createExcerpt(enReadings.psalm, 220) : (enReadings.psalm || 'Responsorial Psalm is not available today.');
      const secondR = enReadings.secondReading ? (isShort ? createExcerpt(enReadings.secondReading, 250) : enReadings.secondReading) : '';
      const gospelR = isShort ? createExcerpt(enReadings.gospel, 350) : (enReadings.gospel || 'Gospel reading is not available today.');

      readingContent = `📖 *DAILY MASS READINGS*

*First Reading*
${firstR}

*Responsorial Psalm*
${psalmR}
${secondR ? `\n*Second Reading*\n${secondR}\n` : ''}
✝️ *Gospel*
${gospelR}

`;
    }

    const reflBlock = reflectionEn || 'The Word of the Lord is a lamp to our feet and a light to our path.';
    const saintShortDesc = saintDescEn ? (isShort ? createExcerpt(saintDescEn, 200) : saintDescEn) : '';
    const prayerBlock = `Lord, guide us through this day.
Strengthen our faith, fill our hearts with
your love, and help us to follow your word.`;

    message = `⛪ *St. John de britto Church, Kalayarkoil*

🙏 Good Morning!

✝️ *Daily Catholic Devotions* — ${dateEn}

📖 *DAILY BIBLE VERSE*

"${verseEn}"
${verseRef ? `— _${verseRef}_` : ''}

${readingContent}🕊️ *DAILY REFLECTION*

${reflBlock}

✨ *SAINT OF THE DAY*

👑 *${saintNameEn}*
${saintShortDesc ? `${saintShortDesc}\n` : ''}
🙏 *PRAYER*

${prayerBlock}

✨ Have a blessed day.

📍 *St. John de britto Church*
_Kalayarkoil_`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. MALAYALAM USER (മലയാളം)
  // ───────────────────────────────────────────────────────────────────────────
  else if (lang === 'ml') {
    let readingContent = '';
    if (!isVerseReflectionOnly) {
      const firstR = isShort ? createExcerpt(enReadings.firstReading, 320) : (enReadings.firstReading || 'First reading not available');
      const psalmR = isShort ? createExcerpt(enReadings.psalm, 220) : (enReadings.psalm || 'Psalm not available');
      const gospelR = isShort ? createExcerpt(enReadings.gospel, 350) : (enReadings.gospel || 'Gospel not available');

      readingContent = `📖 *ഇന്നത്തെ വായനകൾ (Daily Readings)*

*ഒന്നാം വായന (First Reading)*
${firstR}

*പ്രതിവചന സങ്കീർത്തനം (Psalm)*
${psalmR}

✝️ *സുവിശേഷം (Gospel)*
${gospelR}

`;
    }

    const reflBlock = isShort ? createExcerpt(reflectionEn, 280) : reflectionEn;
    const prayerBlock = `സ്നേഹനിധിയായ ദൈവമേ, ഈ പുതിയ ദിനത്തിൽ ഞങ്ങളെ വഴിനടത്തേണമേ.
ഞങ്ങളുടെ വിശ്വാസം വർദ്ധിപ്പിക്കുകയും അങ്ങയുടെ സ്നേഹം ഞങ്ങളിൽ നിറയ്ക്കുകയും ചെയ്യേണമേ.`;

    message = `⛪ *വിശുദ്ധ ஜோൺ ഡി ബ്രിട്ടോ ദേவാലയം, കാളയാർകോവിൽ*

🙏 പ്രഭാത വന്ദനം!

✝️ *ദിവസേനയുള്ള കത്തോലിക്കാ വായനകൾ* — ${dateEn}

📖 *ഇന്നത്തെ തിരുവചനം (Daily Bible Verse)*

"${verseEn}"
${verseRef ? `— _${verseRef}_` : ''}

${readingContent}🕊️ *ധ്യാനം (Daily Reflection)*

${reflBlock}

✨ *ഇന്നത്തെ വിശുദ്ധൻ (Saint of the Day)*

👑 *${saintNameEn}*

🙏 *പ്രാർത്ഥന (Prayer)*

${prayerBlock}

✨ ദൈവം താങ്കളെ സമൃദ്ധമായി അനുഗ്രഹിക്കട്ടെ.

📍 *St. John de britto Church*
_Kalayarkoil_`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. TAMIL + ENGLISH (Bilingual)
  // ───────────────────────────────────────────────────────────────────────────
  else if (lang === 'both') {
    let readingContent = '';
    if (!isVerseReflectionOnly) {
      const firstEn = isShort ? createExcerpt(enReadings.firstReading, 240) : enReadings.firstReading;
      const firstTa = isShort ? createExcerpt(taReadings.firstReading, 240) : taReadings.firstReading;

      const psalmEn = isShort ? createExcerpt(enReadings.psalm, 180) : enReadings.psalm;
      const psalmTa = isShort ? createExcerpt(taReadings.psalm, 180) : taReadings.psalm;

      const gospelEn = isShort ? createExcerpt(enReadings.gospel, 260) : enReadings.gospel;
      const gospelTa = isShort ? createExcerpt(taReadings.gospel, 260) : taReadings.gospel;

      readingContent = `📖 *DAILY MASS READINGS / திருப்பலி வாசகங்கள்*

*First Reading / முதல் வாசகம்*
${firstEn || 'First reading is not available.'}
${firstTa && firstTa !== firstEn ? `\n${firstTa}` : ''}

*Responsorial Psalm / திருப்பாடல்*
${psalmEn || 'Responsorial Psalm is not available.'}
${psalmTa && psalmTa !== psalmEn ? `\n${psalmTa}` : ''}

✝️ *Gospel / நற்செய்தி*
${gospelEn || 'Gospel reading is not available.'}
${gospelTa && gospelTa !== gospelEn ? `\n${gospelTa}` : ''}

`;
    }

    const reflEn = isShort ? createExcerpt(reflectionEn, 220) : reflectionEn;
    const reflTa = isShort ? createExcerpt(reflectionTa, 220) : reflectionTa;

    const prayerEn = `Lord, guide us through this day.
Strengthen our faith, fill our hearts with
your love, and help us to follow your word.`;

    const prayerTa = `அன்பின் ஆண்டவரே, இந்த நாளில் எங்களை வழிநடத்தும்.
எங்கள் விசுவாசத்தை திடப்படுத்தி, உம் அன்பால் இதயங்களை நிரப்பி,
உம் வார்த்தையின்படி நடக்க அருள் தாரும்.`;

    message = `⛪ *St. John de britto Church, Kalayarkoil*
_புனித ஜான் டி பிரிட்டோ திருத்தலம், காளையார்கோவில்_

🙏 Good Morning! / காலை வணக்கம்!

✝️ *DAILY CATHOLIC DEVOTIONS / இன்றைய கத்தோலிக்க வாசகங்கள்*
📅 ${dateEn} / ${dateTa}

📖 *DAILY BIBLE VERSE / இன்றைய இறைவார்த்தை*

"${verseEn}"

"${verseTa}"
${verseRef ? `— _${verseRef}_` : ''}

${readingContent}🕊️ *DAILY REFLECTION / தியானம்*

${reflEn}
${reflTa && reflTa !== reflEn ? `\n${reflTa}` : ''}

✨ *SAINT OF THE DAY / இன்றைய புனிதர்*

👑 *${saintNameEn}* ${saintNameTa && saintNameTa !== saintNameEn ? `/ *${saintNameTa}*` : ''}

🙏 *PRAYER / செபம்*

${prayerEn}

${prayerTa}

✨ Have a blessed day!
இறைவன் உங்கள் நாளை ஆசீர்வதிப்பாராக.

📍 *St. John de britto Church*
_Kalayarkoil_`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. TAMIL USER (Default for all who haven't specified another language)
  // ───────────────────────────────────────────────────────────────────────────
  else {
    let readingContent = '';
    if (!isVerseReflectionOnly) {
      let firstR = isShort ? createExcerpt(taReadings.firstReading, 320) : taReadings.firstReading;
      let psalmR = isShort ? createExcerpt(taReadings.psalm, 220) : taReadings.psalm;
      let secondR = taReadings.secondReading ? (isShort ? createExcerpt(taReadings.secondReading, 250) : taReadings.secondReading) : '';
      let gospelR = isShort ? createExcerpt(taReadings.gospel, 350) : taReadings.gospel;

      // Fallback if Tamil reading is unavailable
      if (!firstR && enReadings.firstReading) {
        firstR = `தமிழில் இந்த வாசகம் தற்போது கிடைக்கவில்லை.\n\nEnglish version:\n${enReadings.firstReading}`;
      }
      if (!psalmR && enReadings.psalm) {
        psalmR = `தமிழில் இந்த திருப்பாடல் தற்போது கிடைக்கவில்லை.\n\nEnglish version:\n${enReadings.psalm}`;
      }
      if (!gospelR && enReadings.gospel) {
        gospelR = `தமிழில் இந்த நற்செய்தி தற்போது கிடைக்கவில்லை.\n\nEnglish version:\n${enReadings.gospel}`;
      }

      readingContent = `📖 *இன்றைய திருப்பலி வாசகங்கள்*

*முதல் வாசகம்*
${firstR || 'இன்றைய வாசகம் கிடைக்கவில்லை.'}

*திருப்பாடல்*
${psalmR || 'இன்றைய திருப்பாடல் கிடைக்கவில்லை.'}
${secondR ? `\n*இரண்டாம் வாசகம்*\n${secondR}\n` : ''}
✝️ *நற்செய்தி*
${gospelR || 'இன்றைய நற்செய்தி வாசகம் கிடைக்கவில்லை.'}

`;
    }

    const reflBlock = reflectionTa || 'இறைவனின் வார்த்தை நம் வாழ்வின் வெளிச்சம்.';
    const saintShortDesc = saintDescTa ? (isShort ? createExcerpt(saintDescTa, 200) : saintDescTa) : '';
    const prayerBlock = `அன்பின் ஆண்டவரே, இந்த புதிய நாளில் எங்களை வழிநடத்தும்.
எங்கள் விசுவாசத்தை திடப்படுத்தி, உம் தெய்வீக அன்பால் எங்கள் இதயங்களை நிரப்பி,
உம் திருமொழியின்படி வாழ எங்களுக்கு அருள் தாரும்.`;

    message = `⛪ *புனித ஜான் டி பிரிட்டோ திருத்தலம்*
_காளையார்கோவில்_

🙏 காலை வணக்கம்!

✝️ *இன்றைய கத்தோலிக்க திருப்பலி வாசகங்கள்* — ${dateTa}

📖 *இன்றைய இறைவார்த்தை / DAILY BIBLE VERSE*

"${verseEn}"

"${verseTa}"
${verseRef ? `— _${verseRef}_` : ''}

${readingContent}🕊️ *இன்றைய தியானம் (DAILY REFLECTION)*

${reflBlock}

✨ *இன்றைய புனிதர் (SAINT OF THE DAY)*

👑 *${saintNameTa}*
${saintShortDesc ? `${saintShortDesc}\n` : ''}
🙏 *செபம் (PRAYER)*

${prayerBlock}

✨ இறைவன் உங்கள் நாளை ஆசீர்வதிப்பாராக.

📍 *புனித ஜான் டி பிரிட்டோ திருத்தலம்*
_காளையார்கோவில்_`;
  }

  // Double-ensure NO URLs exist anywhere in Message 1
  return removeAllUrls(message);
}

/**
 * SAINT OF THE DAY — SEPARATE INFORMATION MESSAGE (Message 2 in Saint flow)
 */
function generateSaintInfoMessage({ dailyContent, language = 'ta' }) {
  const isTamil = language === 'ta';
  const saintNameEn = dailyContent?.saint?.nameEnglish || dailyContent?.saintOfTheDay?.english?.name || dailyContent?.saintName || 'Saint of the Day';
  const saintNameTa = dailyContent?.saint?.nameTamil || dailyContent?.saintOfTheDay?.tamil?.name || dailyContent?.saintNameTa || saintNameEn;
  const feastDay = dailyContent?.saint?.feastDay || dailyContent?.saintOfTheDay?.english?.feastDay || dailyContent?.formattedDate || '';
  const descEn = dailyContent?.saint?.description || dailyContent?.saintOfTheDay?.english?.description || dailyContent?.saintDescription || '';
  const descTa = dailyContent?.saint?.descriptionTamil || dailyContent?.saintOfTheDay?.tamil?.description || descEn;

  const name = isTamil ? saintNameTa : saintNameEn;
  const desc = isTamil ? (descTa || descEn) : (descEn || descTa);
  const saintLink = getSiteUrl(SITE_ROUTES.SAINT_OF_THE_DAY);

  let msg = isTamil ? `✝️ *இன்றைய புனிதர் (Saint of the Day)*\n\n👑 *${name}*\n\n` : `✝️ *Saint of the Day*\n\n👑 *${name}*\n\n`;

  if (feastDay) {
    msg += `📅 *${isTamil ? 'திருவிழா / நாள்' : 'Feast Day'}:* ${feastDay}\n\n`;
  }
  if (desc) {
    msg += `${desc}\n\n`;
  }

  msg += `🔗 *${isTamil ? 'மேலும் வாசிக்க' : 'Read More'}:*\n${saintLink}\n\n`;
  msg += `— *${isTamil ? 'புனித ஜான் டி பிரிட்டோ திருத்தலம், காளையார்கோவில்' : "St. John de britto Church, Kalayarkoil"}*\n_SJDB Connect_`;

  return msg;
}

/**
 * MESSAGE 2 — SAINT OF THE DAY SEPARATE MESSAGE CAPTION (Tamil + English Bilingual)
 */
function generateSaintCaption({ dailyContent }) {
  const saintNameEn = dailyContent?.saint?.nameEnglish || dailyContent?.saintOfTheDay?.english?.name || dailyContent?.saintName || 'Holy Saint';
  const saintNameTa = dailyContent?.saint?.nameTamil || dailyContent?.saintOfTheDay?.tamil?.name || dailyContent?.saintNameTa || saintNameEn;
  const feastDay = dailyContent?.saint?.feastDay || dailyContent?.saintOfTheDay?.english?.feastDay || dailyContent?.saintFeastDay || 'Today';

  const descEn = dailyContent?.saint?.description || dailyContent?.saintOfTheDay?.english?.description || dailyContent?.saintDescription || '';
  const descTa = dailyContent?.saint?.descriptionTamil || dailyContent?.saintOfTheDay?.tamil?.description || descEn;

  return `🕊️ *Saint of the Day / இன்றைய புனிதர்*
👑 *${saintNameEn}* ${saintNameTa && saintNameTa !== saintNameEn ? `(${saintNameTa})` : ''}

📅 *Feast Day / திருவிழா:* ${feastDay}

📖 *Biography / புனிதர் வரலாறு:*
${descEn}

${descTa && descTa !== descEn ? `\n*தமிழ் குறிப்பு:*\n${descTa}\n` : ''}
May the intercession and holy life of ${saintNameEn} bring peace and blessings to your family today. 🙏❤️

📍 *St. John de britto Church, Kalayarkoil*
_புனித ஜான் டி பிரிட்டோ திருத்தலம்_`;
}

/**
 * MESSAGE 2 — SEPARATE LINKS MESSAGE (Provides individual clickable links for all 4 items)
 *
 * Rules:
 * - Direct individual links for: Bible Verse, Daily Mass Readings, Daily Reflection, Saint of the Day
 * - Strictly uses https://stjb-church.vercel.app
 *
 * @param {Object} dailyContent - Structured daily content object
 * @param {String} language - 'ta' (default) | 'en' | 'ml' | 'both'
 * @returns {String} Formatted links message with 4 direct links.
 */
function generateDailyLinksMessage({ dailyContent, language = 'ta' }) {
  const bibleLink = getSiteUrl(SITE_ROUTES.DAILY_VERSE);
  const readingsLink = getSiteUrl(SITE_ROUTES.DAILY_READINGS);
  const reflectionLink = getSiteUrl(SITE_ROUTES.DAILY_REFLECTION);
  const saintLink = getSiteUrl(SITE_ROUTES.SAINT_OF_THE_DAY);

  if (language === 'ta') {
    return `🌐 *மேலும் வாசிக்க (Read More)*

📖 *இன்றைய இறைவார்த்தை:*
${bibleLink}

📜 *இன்றைய திருப்பலி வாசகங்கள்:*
${readingsLink}

🕊️ *இன்றைய சிந்தனை:*
${reflectionLink}

✨ *இன்றைய புனிதர்:*
${saintLink}

— *புனித ஜான் டி பிரிட்டோ திருத்தலம், காளையார்கோவில்*
_SJDB Connect_`;
  }

  return `🌐 *Read More*

📖 *Bible Verse:*
${bibleLink}

📜 *Daily Mass Readings:*
${readingsLink}

🕊️ *Daily Reflection:*
${reflectionLink}

✨ *Saint of the Day:*
${saintLink}

— *St. John de britto Church, Kalayarkoil*
_SJDB Connect_`;
}

module.exports = {
  generateDailyCatholicMessage,
  generateSaintCaption,
  generateSaintInfoMessage,
  generateDailyLinksMessage,
  validateUrl,
  removeAllUrls
};
