const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { SITE_ROUTES, EXTERNAL_LINKS, getSiteUrl, getBaseClientUrl } = require('../config/siteRoutes');
const { normalizeContentLanguage } = require('../utils/userLanguageHelper');

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
  let firstRef = '';
  let secondReading = '';
  let secondRef = '';
  let psalm = '';
  let psalmRef = '';
  let gospel = '';
  let gospelRef = '';

  readings.forEach((r) => {
    const heading = (r.type || '').toLowerCase();
    const content = (r.text || '').trim();
    const ref = (r.reference || '').trim();

    if (heading.includes('முதல்') || heading.includes('first')) {
      firstReading = content;
      firstRef = ref;
    } else if (heading.includes('இரண்டாம்') || heading.includes('second')) {
      secondReading = content;
      secondRef = ref;
    } else if (heading.includes('பாடல்') || heading.includes('psalm') || heading.includes('பதிலுரை')) {
      psalm = content;
      psalmRef = ref;
    } else if (heading.includes('நற்செய்தி') || heading.includes('gospel')) {
      // Avoid acclamations (e.g. 'Gospel Acclamation', 'நற்செய்திக்கு முன் வாழ்த்தொலி')
      if (!heading.includes('முன்') && !heading.includes('acclamation')) {
        gospel = content;
        gospelRef = ref;
      }
    }
  });

  // Fallback to fullText if specific sections aren't separated
  if (!firstReading && !psalm && !gospel && massReadingsLangObj?.fullText) {
    firstReading = massReadingsLangObj.fullText;
  }

  // Prepend reference cleanly if available and not already in reading text
  if (firstRef && !firstReading.includes(firstRef)) {
    firstReading = `_${firstRef}_\n\n${firstReading}`;
  }
  if (secondRef && !secondReading.includes(secondRef)) {
    secondReading = `_${secondRef}_\n\n${secondReading}`;
  }
  if (psalmRef && !psalm.includes(psalmRef)) {
    psalm = `_${psalmRef}_\n\n${psalm}`;
  }
  if (gospelRef && !gospel.includes(gospelRef)) {
    gospel = `_${gospelRef}_\n\n${gospel}`;
  }

  return { firstReading, firstRef, secondReading, secondRef, psalm, psalmRef, gospel, gospelRef };
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
 * CAPTION FOR DAILY BIBLE VERSE IMAGE (Displays directly under the image in WhatsApp)
 *
 * Example:
 * 📖 இன்றைய இறைவார்த்தை / DAILY BIBLE VERSE
 *
 * "But in your hearts revere Christ as Lord. Always be prepared to give an answer to everyone who asks you to give the reason for the hope that you have."
 *
 * "நீங்கள் உங்கள் இருதயங்களில் கர்த்தராகிய கிறிஸ்துவைப் பரிசுத்தப்படுத்தி, உங்களில் இருக்கும் நம்பிக்கையைக்குறித்துக் காரணம் கேட்கிற எவருக்கும், சாந்தத்தோடும் வணக்கத்தோடும் உத்தரவு கொடுக்க எப்பொழுதும் ஆயத்தமாயிருங்கள்."
 * — 1 Peter 3:15
 */
function generateDailyVerseCaption({ dailyContent, language = 'ta' }) {
  const lang = normalizeContentLanguage(language);
  const verseEn = (dailyContent?.bible?.english || dailyContent?.verse?.english || '').trim();
  const verseTa = (dailyContent?.bible?.tamil || dailyContent?.verse?.tamil || '').trim();
  const rawRef = (dailyContent?.bible?.ref || dailyContent?.verse?.reference || '').trim();

  const { getTamilBibleReference, getEnglishBibleReference } = require('../utils/bibleRefHelper');
  const refEn = getEnglishBibleReference(rawRef);
  const refTa = getTamilBibleReference(rawRef);

  if (lang === 'ta') {
    let caption = `📖 *இன்றைய இறைவார்த்தை*\n\n`;
    if (verseTa) {
      caption += `"${verseTa}"\n`;
      if (refTa) caption += `— *${refTa}*`;
    } else if (verseEn) {
      caption += `"${verseEn}"\n— *${refEn}*`;
    }
    return removeAllUrls(caption.trim());
  }

  if (lang === 'en') {
    let caption = `📖 *Daily Bible Verse*\n\n`;
    if (verseEn) {
      caption += `"${verseEn}"\n`;
      if (refEn) caption += `— *${refEn}*`;
    } else if (verseTa) {
      caption += `"${verseTa}"\n— *${refTa}*`;
    }
    return removeAllUrls(caption.trim());
  }

  // Both
  let caption = `📖 *இன்றைய இறைவார்த்தை / DAILY BIBLE VERSE*\n\n`;
  if (verseTa) {
    caption += `"${verseTa}"\n`;
    if (refTa) caption += `— *${refTa}*\n\n`;
  }
  if (verseEn) {
    caption += `"${verseEn}"\n`;
    if (refEn) caption += `— *${refEn}*`;
  }
  return removeAllUrls(caption.trim());
}

/**
 * MESSAGE 1 — DAILY BIBLE VERSE (Sent as its own separate WhatsApp message or fallback)
 *
 * Guaranteed to contain 0 URLs. Contains both English and Tamil verses with scripture reference under each language.
 */
function generateDailyVerseMessage({ dailyContent, language = 'ta' }) {
  const lang = normalizeContentLanguage(language);
  const verseEn = (dailyContent?.bible?.english || dailyContent?.verse?.english || '').trim();
  const verseTa = (dailyContent?.bible?.tamil || dailyContent?.verse?.tamil || '').trim();
  const rawRef = (dailyContent?.bible?.ref || dailyContent?.verse?.reference || '').trim();

  const { getTamilBibleReference, getEnglishBibleReference } = require('../utils/bibleRefHelper');
  const refEn = getEnglishBibleReference(rawRef);
  const refTa = getTamilBibleReference(rawRef);

  if (lang === 'ta') {
    return removeAllUrls(`⛪ *புனித அருளானந்தர் திருத்தலம், காளையார்கோவில்*\n_SJDB Connect_\n\n📖 *இன்றைய இறைவார்த்தை*\n\n"${verseTa || verseEn}"\n— *${refTa || refEn}*`);
  }

  if (lang === 'en') {
    return removeAllUrls(`⛪ *St. John de Britto Church, Kalayarkoil*\n_SJDB Connect_\n\n📖 *Daily Bible Verse*\n\n"${verseEn || verseTa}"\n— *${refEn || refTa}*`);
  }

  const msg = `⛪ *St. John de Britto Church, Kalayarkoil*
_புனித ஜான் டி பிரிட்டோ திருத்தலம்_

📖 *இன்றைய இறைவார்த்தை / DAILY BIBLE VERSE*

"${verseEn}"
— *${refEn}*

"${verseTa}"
— *${refTa}*`;

  return removeAllUrls(msg.trim());
}

/**
 * MESSAGE 2 — DAILY MASS READINGS (Sent as its own separate WhatsApp message)
 *
 * Contains:
 * - Header with Date
 * - First Reading
 * - Responsorial Psalm
 * - Second Reading (if applicable)
 * - Gospel
 * - All required references
 * Complete readings without unnecessary truncation. Guaranteed 0 URLs.
 */
function generateDailyMassReadingsMessage({ dailyContent, language = 'ta', readingPreference = 'full' }) {
  const lang = normalizeContentLanguage(language);
  const isShort = String(readingPreference || 'full').toLowerCase() === 'short';

  const dateEn = dailyContent.formattedDate || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const dateTa = dailyContent.formattedDateTa || dateEn;

  const enReadings = extractLiturgicalReadings(dailyContent.massReadings?.english);
  const taReadings = extractLiturgicalReadings(dailyContent.massReadings?.tamil);

  let msg = '';

  if (lang === 'en') {
    const firstR = isShort ? createExcerpt(enReadings.firstReading, 350) : (enReadings.firstReading || 'First reading is not available today.');
    const psalmR = isShort ? createExcerpt(enReadings.psalm, 250) : (enReadings.psalm || 'Responsorial Psalm is not available today.');
    const secondR = enReadings.secondReading ? (isShort ? createExcerpt(enReadings.secondReading, 300) : enReadings.secondReading) : '';
    const gospelR = isShort ? createExcerpt(enReadings.gospel, 400) : (enReadings.gospel || 'Gospel reading is not available today.');

    msg = `✝️ *Today's Catholic Mass Readings*
📅 ${dateEn}

📖 *First Reading*
${firstR}

📖 *Responsorial Psalm*
${psalmR}
${secondR ? `\n📖 *Second Reading*\n${secondR}\n` : ''}
✝️ *Gospel*
${gospelR}`;

  } else if (lang === 'both') {
    const firstEn = isShort ? createExcerpt(enReadings.firstReading, 300) : enReadings.firstReading;
    const firstTa = isShort ? createExcerpt(taReadings.firstReading, 300) : taReadings.firstReading;

    const psalmEn = isShort ? createExcerpt(enReadings.psalm, 200) : enReadings.psalm;
    const psalmTa = isShort ? createExcerpt(taReadings.psalm, 200) : taReadings.psalm;

    const secondEn = enReadings.secondReading ? (isShort ? createExcerpt(enReadings.secondReading, 250) : enReadings.secondReading) : '';
    const secondTa = taReadings.secondReading ? (isShort ? createExcerpt(taReadings.secondReading, 250) : taReadings.secondReading) : '';

    const gospelEn = isShort ? createExcerpt(enReadings.gospel, 350) : enReadings.gospel;
    const gospelTa = isShort ? createExcerpt(taReadings.gospel, 350) : taReadings.gospel;

    msg = `✝️ *Today's Catholic Mass Readings / திருப்பலி வாசகங்கள்*
📅 ${dateEn} / ${dateTa}

📖 *First Reading / முதல் வாசகம்*
${firstEn || ''}
${firstTa && firstTa !== firstEn ? `\n${firstTa}` : ''}

📖 *Responsorial Psalm / பதிலுரைப் பாடல்*
${psalmEn || ''}
${psalmTa && psalmTa !== psalmEn ? `\n${psalmTa}` : ''}
${(secondEn || secondTa) ? `\n📖 *Second Reading / இரண்டாம் வாசகம்*\n${secondEn || ''}\n${secondTa && secondTa !== secondEn ? `\n${secondTa}` : ''}\n` : ''}
✝️ *Gospel / நற்செய்தி வாசகம்*
${gospelEn || ''}
${gospelTa && gospelTa !== gospelEn ? `\n${gospelTa}` : ''}`;

  } else {
    // Tamil (default)
    let firstR = isShort ? createExcerpt(taReadings.firstReading, 350) : taReadings.firstReading;
    let psalmR = isShort ? createExcerpt(taReadings.psalm, 250) : taReadings.psalm;
    let secondR = taReadings.secondReading ? (isShort ? createExcerpt(taReadings.secondReading, 300) : taReadings.secondReading) : '';
    let gospelR = isShort ? createExcerpt(taReadings.gospel, 400) : taReadings.gospel;

    // Fallbacks if Tamil readings not available
    if (!firstR && enReadings.firstReading) firstR = enReadings.firstReading;
    if (!psalmR && enReadings.psalm) psalmR = enReadings.psalm;
    if (!secondR && enReadings.secondReading) secondR = enReadings.secondReading;
    if (!gospelR && enReadings.gospel) gospelR = enReadings.gospel;

    msg = `✝️ *இன்றைய கத்தோலிக்க திருப்பலி வாசகங்கள்*
📅 ${dateTa}

📖 *முதல் வாசகம்*
${firstR || 'இன்றைய வாசகம் கிடைக்கவில்லை.'}

📖 *பதிலுரைப் பாடல்*
${psalmR || 'இன்றைய திருப்பாடல் கிடைக்கவில்லை.'}
${secondR ? `\n📖 *இரண்டாம் வாசகம்*\n${secondR}\n` : ''}
✝️ *நற்செய்தி வாசகம்*
${gospelR || 'இன்றைய நற்செய்தி வாசகம் கிடைக்கவில்லை.'}`;
  }

  return removeAllUrls(msg.trim());
}

/**
 * MESSAGE 3 — DAILY REFLECTION (Sent as its own separate WhatsApp text message)
 *
 * Contains:
 * - Title: இன்றைய தியானம் (DAILY REFLECTION) or language-appropriate title
 * - Complete reflection content fetched from dailyContent.reflection
 * - Relevant Bible references and prayer/closing content if included
 * - Formatted according to user's selected language: English, Tamil, or Both
 *
 * Guaranteed 0 URLs. Delivered strictly after Daily Mass Readings and before Saint of the Day image.
 */
function generateDailyReflectionMessage({ dailyContent, language = 'ta' }) {
  const lang = normalizeContentLanguage(language);

  const reflTa = (dailyContent?.reflection?.tamil || '').trim();
  const reflEn = (dailyContent?.reflection?.english || '').trim();

  let msg = '';

  if (lang === 'en') {
    const text = reflEn || reflTa || 'The Word of God is a lamp to our feet and a light to our path. May God bless and guide you today.';
    msg = `🕊️ *Daily Reflection*

${text}

— *St. John de Britto Church, Kalayarkoil*
_SJDB Connect_`;
  } else if (lang === 'both') {
    const textTa = reflTa || reflEn || 'இறைவனின் வார்த்தை நம் வாழ்வின் வழிகாட்டி. இன்றைய நாளில் இறைவனின் அன்பிலும் இரக்கத்திலும் திளைப்போம்.';
    const textEn = reflEn && reflEn !== reflTa ? `\n\n*English Reflection:*\n${reflEn}` : '';
    msg = `🕊️ *இன்றைய தியானம் (DAILY REFLECTION)*

${textTa}${textEn}

— *புனித அருளானந்தர் ஆலயம் (St. John de Britto Church), காளையார்கோவில்*
_SJDB Connect_`;
  } else {
    // Tamil (default)
    const text = reflTa || reflEn || 'இறைவனின் வார்த்தை நம் வாழ்வின் வழிகாட்டி. இன்றைய நாளில் இறைவனின் அன்பிலும் இரக்கத்திலும் திளைப்போம்.';
    msg = `🕊️ *இன்றைய தியானம்*

${text}

— *புனித அருளானந்தர் திருத்தலம், காளையார்கோவில்*
_SJDB Connect_`;
  }

  return removeAllUrls(msg.trim());
}

/**
/**
 * Generate concise, informative caption for the Saint image message
 */
function generateSaintImageCaption({ dailyContent, language = 'ta' }) {
  const lang = normalizeContentLanguage(language);
  const saintNameEn = dailyContent?.saint?.nameEn || dailyContent?.saint?.nameEnglish || dailyContent?.saint?.name || dailyContent?.saintName || 'Saint of the Day';
  const saintNameTa = dailyContent?.saint?.nameTa || dailyContent?.saint?.nameTamil || dailyContent?.saintNameTa || saintNameEn;
  const feastDayEn = dailyContent?.saint?.feastDayEn || dailyContent?.saint?.feastDay || dailyContent?.formattedDate || 'Today';
  const feastDayTa = dailyContent?.saint?.feastDayTa || dailyContent?.formattedDateTa || feastDayEn;
  const titleEn = dailyContent?.saint?.titleEn || dailyContent?.saint?.feastTitle || '';
  const titleTa = dailyContent?.saint?.titleTa || dailyContent?.saint?.feastTitleTa || '';

  if (lang === 'ta') {
    let caption = `✨ *இன்றைய புனிதர்: ${saintNameTa}*\n📅 *திருவிழா நாள்:* ${feastDayTa}`;
    if (titleTa && titleTa !== saintNameTa) {
      caption += `\n👑 ${titleTa}`;
    }
    return caption;
  }

  if (lang === 'both') {
    let caption = `✨ *Saint of the Day • இன்றைய புனிதர்*\n👑 *${saintNameEn}*`;
    if (saintNameTa && saintNameTa !== saintNameEn) {
      caption += ` (${saintNameTa})`;
    }
    caption += `\n📅 *Feast Day / திருவிழா:* ${feastDayEn}`;
    return caption;
  }

  // English default
  let caption = `✨ *Saint of the Day: ${saintNameEn}*\n📅 *Feast Day:* ${feastDayEn}`;
  if (titleEn && titleEn !== saintNameEn) {
    caption += `\n👑 ${titleEn}`;
  }
  return caption;
}

/**
 * MESSAGE 4 — SAINT IMAGE PAYLOAD
 *
 * Prepares image buffer or URL for Baileys sendWhatsAppMedia.
 * Includes saint's name and concise summary in the caption.
 */
function getDailySaintImagePayload({ dailyContent, language = 'ta' }) {
  let saintObj = dailyContent?.saint;
  if (!saintObj || !saintObj.nameEn) {
    try {
      const { getDailySaint } = require('./saintService');
      const directSaint = getDailySaint();
      if (directSaint) {
        if (!dailyContent) dailyContent = {};
        dailyContent.saint = directSaint;
        saintObj = directSaint;
      }
    } catch (e) {}
  }

  let saintImageBuffer = saintObj?.imageAttachment?.content || null;
  const saintImageUrl = saintObj?.remoteUrl ||
                        saintObj?.imageUrl ||
                        saintObj?.image || 
                        dailyContent?.saintImage || 
                        dailyContent?.saintOfTheDay?.english?.imageUrl ||
                        null;
  const localPath = saintObj?.localPath || null;
  const localUrl = saintObj?.localUrl || null;

  // If buffer is missing, try reading local file if available
  if (!saintImageBuffer) {
    const candidates = [localPath, localUrl, saintImageUrl].filter(Boolean);
    for (const c of candidates) {
      let resolved = c;
      if (typeof c === 'string' && c.startsWith('/uploads/')) {
        const p1 = path.join(__dirname, '../../', c);
        if (fs.existsSync(p1)) resolved = p1;
        else {
          const p2 = path.join(process.cwd(), c);
          if (fs.existsSync(p2)) resolved = p2;
        }
      }
      if (typeof resolved === 'string' && fs.existsSync(resolved)) {
        try {
          saintImageBuffer = fs.readFileSync(resolved);
          break;
        } catch (e) {}
      }
    }
  }

  // Scan uploads/saints/ directory if buffer is still missing
  if (!saintImageBuffer) {
    try {
      const dir1 = path.join(__dirname, '../../uploads/saints');
      const dir2 = path.join(process.cwd(), 'uploads/saints');
      const sDir = fs.existsSync(dir1) ? dir1 : fs.existsSync(dir2) ? dir2 : null;
      if (sDir) {
        const files = fs.readdirSync(sDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
        const sName = (saintObj?.nameEn || saintObj?.saintName || saintObj?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
        const matched = files.find(f => {
          const base = f.toLowerCase().replace(/\.[^/.]+$/, "");
          return sName.includes(base) || base.includes(sName) || (sName.includes('jerome') && base.includes('jerome'));
        }) || files[0];
        if (matched) {
          saintImageBuffer = fs.readFileSync(path.join(sDir, matched));
        }
      }
    } catch (e) {}
  }

  if (!saintImageBuffer && !saintImageUrl) {
    return null;
  }

  const caption = generateSaintImageCaption({ dailyContent, language });

  if (saintImageBuffer) {
    return {
      buffer: saintImageBuffer,
      mimetype: 'image/jpeg',
      caption,
      fileName: 'saint_of_the_day.jpg'
    };
  }

  return {
    url: saintImageUrl,
    mimetype: 'image/jpeg',
    caption,
    fileName: 'saint_of_the_day.jpg'
  };
}

/**
 * MESSAGE 5 — SAINT OF THE DAY CONTENT (Sent as its own separate WhatsApp text message)
 *
 * Contains:
 * - Saint's name
 * - Saint's title / feast information if available
 * - Feast day information
 * - Biography / description in selected language (Tamil, English, or Both)
 * - Church footer
 *
 * Guaranteed 0 URLs. No Read More link.
 */
function generateSaintContentMessage({ dailyContent, language = 'ta' }) {
  const lang = normalizeContentLanguage(language);

  let saintObj = dailyContent?.saint;
  if (!saintObj || !saintObj.nameEn) {
    try {
      const { getDailySaint } = require('./saintService');
      const directSaint = getDailySaint();
      if (directSaint) {
        if (!dailyContent) dailyContent = {};
        dailyContent.saint = directSaint;
        saintObj = directSaint;
      }
    } catch (e) {}
  }

  const saintNameEn = saintObj?.nameEn || saintObj?.nameEnglish || saintObj?.name || dailyContent?.saintName || 'Saint of the Day';
  const saintNameTa = saintObj?.nameTa || saintObj?.nameTamil || dailyContent?.saintNameTa || '';
  const titleEn = saintObj?.titleEn || saintObj?.feastTitle || saintNameEn;
  const titleTa = saintObj?.titleTa || saintObj?.feastTitleTa || saintNameTa;
  const feastDayEn = saintObj?.feastDayEn || saintObj?.feastDay || dailyContent?.formattedDate || '';
  const feastDayTa = saintObj?.feastDayTa || dailyContent?.formattedDateTa || feastDayEn;

  const descEn = (
    dailyContent?.saint?.descriptionEn ||
    dailyContent?.saint?.description ||
    dailyContent?.saint?.descriptionEnglish ||
    dailyContent?.saintDescription ||
    dailyContent?.saintDescriptionEn ||
    ''
  ).trim();

  const descTaRaw = (
    dailyContent?.saint?.descriptionTa ||
    dailyContent?.saint?.descriptionTamil ||
    dailyContent?.saintDescriptionTa ||
    ''
  ).trim();

  // Validate that Tamil biography actually contains Tamil characters
  const hasTamilInBio = Boolean(descTaRaw && /[\u0B80-\u0BFF]/.test(descTaRaw));
  const descTa = hasTamilInBio ? descTaRaw : '';

  const feastTypeEn = dailyContent?.saint?.feastType || 'Feast';
  const feastTypeTa = dailyContent?.saint?.feastTypeTa || 'நினைவுநாள்';

  let msg = '';

  // 1. ENGLISH ONLY
  if (lang === 'en') {
    msg = `✨ *Saint of the Day*\n\n👑 *${saintNameEn}*\n\n`;
    if (feastDayEn) {
      msg += `📅 *Feast Day:* ${feastDayEn}\n\n`;
    }
    if (titleEn && titleEn !== saintNameEn) {
      msg += `🎉 *${feastTypeEn}:* ${titleEn}\n\n`;
    }
    if (descEn) {
      msg += `${descEn}\n\n`;
    }
    msg += `— *St. John de Britto Church, Kalayarkoil*\n_SJDB Connect_`;
    return removeAllUrls(msg.trim());
  }

  // 2. BILINGUAL (TAMIL + ENGLISH)
  if (lang === 'both') {
    const finalNameTa = saintNameTa || saintNameEn;
    const finalFeastDayTa = feastDayTa || feastDayEn;
    const finalTitleTa = titleTa && titleTa !== titleEn ? titleTa : (dailyContent?.saint?.feastTitleTa || null);

    msg = `🇮🇳 *தமிழ் (Tamil)*\n✨ *இன்றைய புனிதர்*\n\n👑 *${finalNameTa}*\n\n`;
    if (finalFeastDayTa) {
      msg += `📅 *திருவிழா நாள்:* ${finalFeastDayTa}\n\n`;
    }
    if (finalTitleTa && finalTitleTa !== finalNameTa) {
      msg += `🎉 *${feastTypeTa}:* ${finalTitleTa}\n\n`;
    }
    if (descTa) {
      msg += `${descTa}\n\n`;
    } else {
      msg += `இன்றைய புனிதரின் வாழ்க்கை வரலாறு மற்றும் அருளுரைகள் எமது ஆலய இணையதளத்தில் வாசிக்கலாம்.\n\n`;
    }

    msg += `🇬🇧 *English*\n✨ *Saint of the Day*\n\n👑 *${saintNameEn}*\n\n`;
    if (feastDayEn) {
      msg += `📅 *Feast Day:* ${feastDayEn}\n\n`;
    }
    if (titleEn && titleEn !== saintNameEn) {
      msg += `🎉 *${feastTypeEn}:* ${titleEn}\n\n`;
    }
    if (descEn) {
      msg += `${descEn}\n\n`;
    }

    msg += `— *St. John de Britto Church, Kalayarkoil*\n_SJDB Connect_`;
    return removeAllUrls(msg.trim());
  }

  // 3. TAMIL ONLY (Strict default)
  const finalName = saintNameTa || saintNameEn;
  const finalFeastDay = feastDayTa || feastDayEn;
  const finalTitle = titleTa && titleTa !== titleEn ? titleTa : (dailyContent?.saint?.feastTitleTa || null);

  msg = `✨ *இன்றைய புனிதர்*\n\n👑 *${finalName}*\n\n`;
  if (finalFeastDay) {
    msg += `📅 *திருவிழா நாள்:* ${finalFeastDay}\n\n`;
  }
  if (finalTitle && finalTitle !== finalName) {
    msg += `🎉 *${feastTypeTa}:* ${finalTitle}\n\n`;
  }
  if (descTa) {
    msg += `${descTa}\n\n`;
  } else {
    console.warn('[SaintOfDay] Tamil biography unavailable — using dignified Tamil notice');
    msg += `இன்றைய புனிதரின் வாழ்க்கை வரலாறு மற்றும் அருளுரைகள் எமது ஆலய இணையதளத்தில் வாசிக்கலாம்.\nஇறைவனின் ஆசீரும் புனிதரின் பரிந்துரையும் நம்மோடு இருப்பதாக.\n\n`;
  }
  msg += `— *புனித அருளானந்தர் திருத்தலம், காளையார்கோவில்*\n_SJDB Connect_`;

  return removeAllUrls(msg.trim());
}

/**
 * MESSAGE 5 — READ MORE LINK (Sent as final separate message)
 *
 * Dedicated Read More message with website deep-links for:
 * - Daily Bible Verse (#verse)
 * - Daily Mass Readings (#readings)
 * - Daily Reflection (#reflection)
 * - Saint of the Day (#saint-of-the-day)
 */
function generateReadMoreMessage({ dailyContent, language = 'ta' }) {
  const verseUrl = getSiteUrl(SITE_ROUTES.DAILY_VERSE);
  const readingsUrl = getSiteUrl(SITE_ROUTES.DAILY_READINGS);
  const reflectionUrl = getSiteUrl(SITE_ROUTES.DAILY_REFLECTION);
  const saintUrl = getSiteUrl(SITE_ROUTES.SAINT_OF_THE_DAY);
  const rawLang = String(language || 'ta').toLowerCase();

  if (rawLang === 'en' || rawLang.startsWith('en')) {
    return `🌐 *Read More*

📖 *Today's Daily Verse:*
${verseUrl}

📜 *Today's Mass Readings:*
${readingsUrl}

🕊️ *Today's Reflection:*
${reflectionUrl}

✨ *Saint of the Day:*
${saintUrl}

— *St. John de Britto Church, Kalayarkoil*
_SJDB Connect_`;
  }

  if (rawLang === 'both' || (rawLang.includes('ta') && rawLang.includes('en')) || rawLang === 'all') {
    return `🌐 *மேலும் வாசிக்க / Read More*

📖 *இன்றைய இறைவார்த்தை / Daily Verse:*
${verseUrl}

📜 *இன்றைய திருப்பலி வாசகங்கள் / Mass Readings:*
${readingsUrl}

🕊️ *இன்றைய சிந்தனை / Daily Reflection:*
${reflectionUrl}

✨ *இன்றைய புனிதர் / Saint of the Day:*
${saintUrl}

— *புனித ஜான் டி பிரிட்டோ திருத்தலம், காளையார்கோவில்*
— *St. John de Britto Church, Kalayarkoil*
_SJDB Connect_`;
  }

  // Tamil (default)
  return `🌐 *மேலும் வாசிக்க (Read More)*

📖 *இன்றைய இறைவார்த்தை:*
${verseUrl}

📜 *இன்றைய திருப்பலி வாசகங்கள்:*
${readingsUrl}

🕊️ *இன்றைய சிந்தனை:*
${reflectionUrl}

✨ *இன்றைய புனிதர்:*
${saintUrl}

— *புனித ஜான் டி பிரிட்டோ திருத்தலம், காளையார்கோவில்*
_SJDB Connect_`;
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
  const saintDescEn = dailyContent.saint?.description || dailyContent.saint?.descriptionEnglish || dailyContent.saintOfTheDay?.english?.description || dailyContent.saintDescription || '';
  const saintDescTa = dailyContent.saint?.descriptionTamil || dailyContent.saint?.descriptionTa || dailyContent.saintOfTheDay?.tamil?.description || saintDescEn;

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

    message = `⛪ *St. John de Britto Church, Kalayarkoil*

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

📍 *St. John de Britto Church*
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

📍 *St. John de Britto Church*
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

    message = `⛪ *St. John de Britto Church, Kalayarkoil*
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

📍 *St. John de Britto Church*
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
  const isBoth = language === 'both';
  const saintNameEn = dailyContent?.saint?.nameEnglish || dailyContent?.saintOfTheDay?.english?.name || dailyContent?.saintName || 'Saint of the Day';
  const saintNameTa = dailyContent?.saint?.nameTamil || dailyContent?.saintOfTheDay?.tamil?.name || dailyContent?.saintNameTa || saintNameEn;
  const feastDay = dailyContent?.saint?.feastDay || dailyContent?.saintOfTheDay?.english?.feastDay || dailyContent?.formattedDate || '';
  const descEn = dailyContent?.saint?.description || dailyContent?.saint?.descriptionEnglish || dailyContent?.saintOfTheDay?.english?.description || dailyContent?.saintDescription || '';
  const descTa = dailyContent?.saint?.descriptionTamil || dailyContent?.saint?.descriptionTa || dailyContent?.saintOfTheDay?.tamil?.description || descEn;
  const saintLink = getSiteUrl(SITE_ROUTES.SAINT_OF_THE_DAY);

  if (isBoth) {
    let msg = `✝️ *Saint of the Day • இன்றைய புனிதர்*\n\n`;
    msg += `👑 *${saintNameEn}* (${saintNameTa})\n\n`;
    if (feastDay) {
      msg += `📅 *Feast Day / திருவிழா:* ${feastDay}\n\n`;
    }
    if (dailyContent?.saint?.feastTitle) {
      msg += `🎉 *Feast / திருவிழா:* ${dailyContent.saint.feastTitle}\n\n`;
    }
    if (descTa && descTa !== descEn) {
      msg += `🇮🇳 *தமிழ் (Tamil):*\n${descTa}\n\n`;
    }
    if (descEn) {
      msg += `🇬🇧 *English:*\n${descEn}\n\n`;
    }
    msg += `🔗 *மேலும் வாசிக்க / Read More:*\n${saintLink}\n\n`;
    msg += `— *St. John de Britto Church, Kalayarkoil*\n_புனித ஜான் டி பிரிட்டோ திருத்தலம்_\n_SJDB Connect_`;
    return msg;
  }

  const name = isTamil ? saintNameTa : saintNameEn;
  const desc = isTamil ? (descTa || descEn) : (descEn || descTa);

  let msg = isTamil ? `✝️ *இன்றைய புனிதர் (Saint of the Day)*\n\n👑 *${name}*\n\n` : `✝️ *Saint of the Day*\n\n👑 *${name}*\n\n`;

  if (feastDay) {
    msg += `📅 *${isTamil ? 'திருவிழா / நாள்' : 'Feast Day'}:* ${feastDay}\n\n`;
  }
  if (dailyContent?.saint?.feastTitle) {
    const fType = isTamil ? (dailyContent.saint.feastTypeTa || 'திருவிழா') : (dailyContent.saint.feastType || 'Feast');
    const fTitle = isTamil ? (dailyContent.saint.feastTitleTa || dailyContent.saint.feastTitle) : dailyContent.saint.feastTitle;
    msg += `🎉 *${fType}:* ${fTitle}\n\n`;
  }
  if (desc) {
    msg += `${desc}\n\n`;
  }

  msg += `🔗 *${isTamil ? 'மேலும் வாசிக்க' : 'Read More'}:*\n${saintLink}\n\n`;
  msg += `— *${isTamil ? 'புனித ஜான் டி பிரிட்டோ திருத்தலம், காளையார்கோவில்' : "St. John de Britto Church, Kalayarkoil"}*\n_SJDB Connect_`;

  return msg;
}

/**
 * MESSAGE 2 — SAINT OF THE DAY SEPARATE MESSAGE CAPTION (Tamil + English Bilingual)
 */
function generateSaintCaption({ dailyContent }) {
  const saintNameEn = dailyContent?.saint?.nameEnglish || dailyContent?.saintOfTheDay?.english?.name || dailyContent?.saintName || 'Holy Saint';
  const saintNameTa = dailyContent?.saint?.nameTamil || dailyContent?.saintOfTheDay?.tamil?.name || dailyContent?.saintNameTa || saintNameEn;
  const feastDay = dailyContent?.saint?.feastDay || dailyContent?.saintOfTheDay?.english?.feastDay || dailyContent?.saintFeastDay || 'Today';

  const feastTitleEn = dailyContent?.saint?.feastTitle;
  const feastTitleTa = dailyContent?.saint?.feastTitleTa || feastTitleEn;
  const feastTypeEn = dailyContent?.saint?.feastType || 'Feast';
  const feastTypeTa = dailyContent?.saint?.feastTypeTa || 'திருவிழா';
  const feastLine = feastTitleEn 
    ? `🎉 *${feastTypeEn} / ${feastTypeTa}:* ${feastTitleEn}${feastTitleTa && feastTitleTa !== feastTitleEn ? ` (${feastTitleTa})` : ''}\n` 
    : '';

  const descEn = dailyContent?.saint?.description || dailyContent?.saint?.descriptionEnglish || dailyContent?.saintOfTheDay?.english?.description || dailyContent?.saintDescription || '';
  const descTa = dailyContent?.saint?.descriptionTamil || dailyContent?.saint?.descriptionTa || dailyContent?.saintOfTheDay?.tamil?.description || descEn;

  return `🕊️ *Saint of the Day / இன்றைய புனிதர்*
👑 *${saintNameEn}* ${saintNameTa && saintNameTa !== saintNameEn ? `(${saintNameTa})` : ''}

📅 *Feast Day / திருவிழா:* ${feastDay}
${feastLine}

📖 *Biography / புனிதர் வரலாறு:*
${descEn}

${descTa && descTa !== descEn ? `\n*தமிழ் குறிப்பு:*\n${descTa}\n` : ''}
May the intercession and holy life of ${saintNameEn} bring peace and blessings to your family today. 🙏❤️

📍 *St. John de Britto Church, Kalayarkoil*
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

— *St. John de Britto Church, Kalayarkoil*
_SJDB Connect_`;
}

module.exports = {
  generateDailyVerseCaption,
  generateDailyVerseMessage,
  generateDailyMassReadingsMessage,
  generateDailyReflectionMessage,
  getDailySaintImagePayload,
  generateSaintContentMessage,
  generateReadMoreMessage,
  generateDailyCatholicMessage,
  generateSaintCaption,
  generateSaintInfoMessage,
  generateDailyLinksMessage,
  validateUrl,
  removeAllUrls
};

