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
 * Helper to check if a line is a scripture citation / book reference
 */
function isScriptureCitation(text = '') {
  if (!text) return false;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  return (
    trimmed.includes('✠') ||
    trimmed.includes('\u2720') ||
    trimmed.includes('நூலிலிருந்து வாசகம்') ||
    trimmed.includes('திருமுகத்திலிருந்து') ||
    trimmed.includes('திருத்தூதர் பணி நூலிலிருந்து') ||
    trimmed.includes('எழுதிய தூய நற்செய்தியிலிருந்து') ||
    trimmed.includes('எழுதிய நற்செய்தியிலிருந்து') ||
    lower.includes('reading from the book') ||
    lower.includes('reading from the letter') ||
    lower.includes('reading from the holy gospel') ||
    lower.includes('gospel according to') ||
    lower.startsWith('a reading from') ||
    lower.startsWith('reading from') ||
    lower.startsWith('text from') ||
    ((lower.includes('reading') || lower.includes('epistle') || lower.includes('text') || trimmed.includes('வாசகம்')) && /\d+:\s*\d+/.test(trimmed) && trimmed.length < 200)
  );
}

/**
 * Checks if a string is a standard liturgical ending/acclamation
 */
function isLiturgicalEnding(text = '') {
  if (!text) return false;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  return (
    trimmed === 'ஆண்டவரின் அருள்வாக்கு.' ||
    trimmed === 'ஆண்டவரின் அருள்வாக்கு' ||
    trimmed === '— இறைவா உமக்கு நன்றி.' ||
    trimmed === 'இறைவா உமக்கு நன்றி.' ||
    trimmed === '— இறைவா உமக்கு நன்றி' ||
    trimmed === 'இது கிறிஸ்து வழங்கும் நற்செய்தி.' ||
    trimmed === 'கிறிஸ்து வழங்கும் நற்செய்தி.' ||
    trimmed === '— கிறிஸ்துவே உமக்கு புகழ்.' ||
    trimmed === 'கிறிஸ்துவே உமக்கு புகழ்.' ||
    trimmed === '— கிறிஸ்துவே உமக்கு புகழ்' ||
    lower === 'the word of the lord.' ||
    lower === 'the word of the lord' ||
    lower === 'thanks be to god.' ||
    lower === '— thanks be to god.' ||
    lower === 'the gospel of the lord.' ||
    lower === 'this is the gospel of the lord.' ||
    lower === 'praise to you, lord jesus christ.' ||
    lower === '— praise to you, lord jesus christ.'
  );
}

/**
 * Checks if a line is solely an introductory liturgical speaker phrase
 */
function isIntroPhrase(text = '') {
  if (!text) return false;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  return (
    trimmed === 'அக்காலத்தில்' ||
    trimmed === 'அக்காலத்தில்:' ||
    trimmed === 'இறைவன் கூறுவது:' ||
    trimmed === 'ஆண்டவர் கூறுவது:' ||
    trimmed === 'சகோதரர் சகோதரிகளே,' ||
    trimmed === 'சகோதரர்களே,' ||
    lower === 'in those days:' ||
    lower === 'at that time' ||
    lower === 'at that time:' ||
    lower === 'brothers and sisters,' ||
    lower === 'brothers and sisters:'
  );
}

/**
 * Formats introductory liturgical speaker phrases within a paragraph
 */
function formatIntroSpeakerPhrase(p = '') {
  if (!p) return '';
  const matchTa = p.match(/^(அக்காலத்தில்(?::|\s+|,)?|இறைவன் கூறுவது:|ஆண்டவர் கூறுவது:|சகோதரர் சகோதரிகளே,|சகோதரர்களே,)\s*/);
  if (matchTa) {
    const phrase = matchTa[1].trim();
    const rest = p.slice(matchTa[0].length).trim();
    return rest ? `*${phrase}* ${rest}` : `*${phrase}*`;
  }
  const matchEn = p.match(/^(In those days(?::|,)?|At that time(?::|,)?|Brothers and sisters(?::|,)?|Thus says the Lord(?::|,)?)\s*/i);
  if (matchEn) {
    const phrase = matchEn[1].trim();
    const rest = p.slice(matchEn[0].length).trim();
    return rest ? `*${phrase}* ${rest}` : `*${phrase}*`;
  }
  return p;
}

/**
 * Formats a reading section (First Reading, Second Reading, Gospel) for WhatsApp
 * with rich line spacing, bold theme subtitle, bold citation, and acclamations.
 */
function formatReadingSectionForWhatsApp(sec, defaultHeading, isGospel = false, lang = 'ta', isShort = false) {
  if (!sec) return '';
  const isTa = lang === 'ta';
  
  let heading = defaultHeading;
  const rawHeading = sec.heading || sec.type || sec.title || '';
  if (rawHeading.includes('முதல்') || rawHeading.toLowerCase().includes('first')) {
    heading = isTa ? '📖 *முதல் வாசகம்*' : '📖 *First Reading*';
  } else if (rawHeading.includes('இரண்டாம்') || rawHeading.toLowerCase().includes('second')) {
    heading = isTa ? '📖 *இரண்டாம் வாசகம்*' : '📖 *Second Reading*';
  } else if (rawHeading.includes('நற்செய்தி') || rawHeading.toLowerCase().includes('gospel')) {
    heading = isTa ? '✝️ *நற்செய்தி வாசகம்*' : '✝️ *Gospel Reading*';
  }

  const parts = [heading];

  let subtitle = (sec.subtitle || '').trim();
  let reference = (sec.reference || '').trim();

  let paras = [];
  if (sec.paragraphs && Array.isArray(sec.paragraphs) && sec.paragraphs.length > 0) {
    paras = [...sec.paragraphs];
  } else if (sec.text) {
    paras = sec.text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  }

  // Detect subtitle from first paragraph if missing
  if (!subtitle && paras.length > 2) {
    const p0 = paras[0].trim();
    if (p0.length < 250 && !isScriptureCitation(p0) && !isIntroPhrase(p0)) {
      subtitle = p0;
      paras.shift();
    }
  }

  // If English reading has a Tamil reference, search paras for an English citation
  if (!isTa && reference && /[\u0B80-\u0BFF]/.test(reference) && paras.length > 0) {
    for (let i = 0; i < Math.min(2, paras.length); i++) {
      if (isScriptureCitation(paras[i])) {
        reference = paras[i].trim();
        paras.splice(i, 1);
        break;
      }
    }
  }

  // Detect reference if missing
  if (!reference && paras.length > 0) {
    for (let i = 0; i < Math.min(2, paras.length); i++) {
      if (isScriptureCitation(paras[i])) {
        reference = paras[i].trim();
        paras.splice(i, 1);
        break;
      }
    }
  }

  // Clean out any duplicate subtitle or reference or ending in paras, plus leftover citation lines
  paras = paras.filter(p => {
    const pt = p.trim();
    return pt !== subtitle && pt !== reference && !isScriptureCitation(pt) && !isLiturgicalEnding(pt);
  });

  if (subtitle) {
    parts.push(`*${subtitle}*`);
  }
  if (reference) {
    parts.push(`*${reference}*`);
  }

  // Merge standalone introductory phrases like 'அக்காலத்தில்' with next paragraph
  const cleanBodyParas = [];
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i].trim();
    if (!p) continue;
    if (isIntroPhrase(p) && i + 1 < paras.length) {
      const nextP = paras[i + 1].trim();
      cleanBodyParas.push(`*${p}* ${nextP}`);
      i++;
      continue;
    }
    cleanBodyParas.push(formatIntroSpeakerPhrase(p));
  }

  if (isShort && cleanBodyParas.length > 0) {
    parts.push(createExcerpt(cleanBodyParas.join('\n\n'), 350));
  } else {
    cleanBodyParas.forEach(p => parts.push(p));
  }

  // Liturgical Conclusion with distinct line gap
  if (isGospel) {
    parts.push(isTa 
      ? `*ஆண்டவரின் அருள்வாக்கு.*\n*— கிறிஸ்துவே உமக்கு புகழ்.*`
      : `*The Gospel of the Lord.*\n*— Praise to you, Lord Jesus Christ.*`
    );
  } else {
    parts.push(isTa
      ? `*ஆண்டவரின் அருள்வாக்கு.*\n*— இறைவா உமக்கு நன்றி.*`
      : `*The word of the Lord.*\n*— Thanks be to God.*`
    );
  }

  return parts.join('\n\n');
}

/**
 * Formats Responsorial Psalm with stanzas and refrain repetition
 */
function formatPsalmSectionForWhatsApp(sec, lang = 'ta') {
  if (!sec) return '';
  const isTa = lang === 'ta';
  const heading = isTa ? '📖 *பதிலுரைப் பாடல்*' : '📖 *Responsorial Psalm*';
  const parts = [heading];

  const reference = (sec.reference || '').trim();
  if (reference) {
    parts.push(`*${reference}*`);
  }

  let refrain = (sec.refrain || sec.response || '').trim();
  refrain = refrain.replace(/^(?:பல்லவி:|Response:|Refrain:|R\.)\s*/i, '').trim();

  if (refrain) {
    parts.push(`*${isTa ? 'பல்லவி:' : 'Response:'} ${refrain}*`);
  }

  if (sec.verses && Array.isArray(sec.verses) && sec.verses.length > 0) {
    sec.verses.forEach(v => {
      let vText = (v.text || '').trim();
      let vNum = v.numbers ? `*${v.numbers}* ` : '';
      let stanza = `${vNum}${vText}`.trim();
      if (refrain) {
        stanza += `\n*✦ ${isTa ? 'பல்லவி:' : 'Response:'} ${refrain}*`;
      }
      parts.push(stanza);
    });
  } else if (sec.paragraphs && Array.isArray(sec.paragraphs) && sec.paragraphs.length > 0) {
    sec.paragraphs.forEach(p => {
      const pt = p.trim();
      if (!pt || pt === reference || pt === sec.response || pt.startsWith('பல்லவி:')) return;
      parts.push(pt);
    });
  } else if (sec.text) {
    parts.push(sec.text.trim());
  }

  return parts.join('\n\n');
}

/**
 * Formats Gospel Acclamation for WhatsApp
 */
function formatAcclamationSectionForWhatsApp(sec, lang = 'ta') {
  if (!sec) return '';
  const isTa = lang === 'ta';
  const heading = isTa ? '📖 *நற்செய்திக்கு முன் வாழ்த்தொலி*' : '📖 *Gospel Acclamation*';
  const parts = [heading];

  const reference = (sec.reference || '').trim();
  if (reference) {
    parts.push(`*${reference}*`);
  }

  let text = '';
  if (sec.paragraphs && Array.isArray(sec.paragraphs) && sec.paragraphs.length > 0) {
    text = sec.paragraphs.filter(p => p.trim() !== reference).join('\n\n').trim();
  } else if (sec.text) {
    text = sec.text.trim();
  }

  if (text) {
    parts.push(`*${text}*`);
  }

  return parts.join('\n\n');
}

/**
 * Formats all Mass Readings for a specific language into a clean, spaced block
 */
function formatMassReadingsLangBlock(massReadingsLangObj, lang = 'ta', isShort = false) {
  if (!massReadingsLangObj) return '';
  const isTa = lang === 'ta';
  const sections = massReadingsLangObj.sections || massReadingsLangObj.readings || [];

  if (sections.length > 0) {
    const formattedSections = [];

    let firstSec = sections.find(s => {
      const h = (s.heading || s.type || s.title || '').toLowerCase();
      return h.includes('முதல்') || h.includes('first');
    }) || massReadingsLangObj.firstReading;

    let psalmSec = sections.find(s => {
      const h = (s.heading || s.type || s.title || '').toLowerCase();
      return h.includes('பதிலுரை') || h.includes('psalm');
    }) || massReadingsLangObj.responsorialPsalm;

    let secondSec = sections.find(s => {
      const h = (s.heading || s.type || s.title || '').toLowerCase();
      return h.includes('இரண்டாம்') || h.includes('second');
    }) || massReadingsLangObj.secondReading;

    let acclamationSec = sections.find(s => {
      const h = (s.heading || s.type || s.title || '').toLowerCase();
      return h.includes('வாழ்த்தொலி') || h.includes('acclamation') || (h.includes('அல்லேலூயா') && !h.includes('நற்செய்தி வாசகம்'));
    }) || massReadingsLangObj.gospelAcclamation;

    let gospelSec = sections.find(s => {
      const h = (s.heading || s.type || s.title || '').toLowerCase();
      return (h.includes('நற்செய்தி') || h.includes('gospel')) && !h.includes('முன்') && !h.includes('acclamation');
    }) || massReadingsLangObj.gospel;

    if (firstSec) {
      formattedSections.push(formatReadingSectionForWhatsApp(firstSec, isTa ? '📖 *முதல் வாசகம்*' : '📖 *First Reading*', false, lang, isShort));
    }
    if (psalmSec) {
      formattedSections.push(formatPsalmSectionForWhatsApp(psalmSec, lang));
    }
    if (secondSec) {
      formattedSections.push(formatReadingSectionForWhatsApp(secondSec, isTa ? '📖 *இரண்டாம் வாசகம்*' : '📖 *Second Reading*', false, lang, isShort));
    }
    if (acclamationSec) {
      formattedSections.push(formatAcclamationSectionForWhatsApp(acclamationSec, lang));
    }
    if (gospelSec) {
      formattedSections.push(formatReadingSectionForWhatsApp(gospelSec, isTa ? '✝️ *நற்செய்தி வாசகம்*' : '✝️ *Gospel Reading*', true, lang, isShort));
    }

    if (formattedSections.length > 0) {
      return formattedSections.join('\n\n');
    }
  }

  // Fallback to extractLiturgicalReadings if sections array is not available
  const extracted = extractLiturgicalReadings(massReadingsLangObj);
  const parts = [];
  if (extracted.firstReading) {
    parts.push(formatReadingSectionForWhatsApp({ text: extracted.firstReading, reference: extracted.firstRef }, isTa ? '📖 *முதல் வாசகம்*' : '📖 *First Reading*', false, lang, isShort));
  }
  if (extracted.psalm) {
    parts.push(formatPsalmSectionForWhatsApp({ text: extracted.psalm, reference: extracted.psalmRef }, lang));
  }
  if (extracted.secondReading) {
    parts.push(formatReadingSectionForWhatsApp({ text: extracted.secondReading, reference: extracted.secondRef }, isTa ? '📖 *இரண்டாம் வாசகம்*' : '📖 *Second Reading*', false, lang, isShort));
  }
  if (extracted.gospel) {
    parts.push(formatReadingSectionForWhatsApp({ text: extracted.gospel, reference: extracted.gospelRef }, isTa ? '✝️ *நற்செய்தி வாசகம்*' : '✝️ *Gospel Reading*', true, lang, isShort));
  }

  return parts.join('\n\n');
}

/**
 * Formats Daily Reflection into a clean, spaced block with bold quote and prayer
 */
function formatDailyReflectionBlock(reflData, lang = 'ta') {
  if (!reflData) return '';
  const isTa = lang === 'ta';

  let quote = (reflData.scriptureQuote || '').trim();
  let paragraphs = [];
  let prayer = (reflData.prayer || '').trim();

  if (reflData.paragraphs && Array.isArray(reflData.paragraphs) && reflData.paragraphs.length > 0) {
    paragraphs = [...reflData.paragraphs];
  }

  const rawText = typeof reflData === 'string' ? reflData : (reflData.tamil || reflData.english || reflData.content || reflData.reflection || '');
  if (paragraphs.length === 0 && rawText) {
    const rawBlocks = rawText.split(/\n\n+/).map(b => b.trim()).filter(Boolean);
    for (let i = 0; i < rawBlocks.length; i++) {
      const block = rawBlocks[i];
      if (i === 0 && !quote && (/^["'“'']/.test(block) || /\(\s*(?:மத்|லூக்|யோவா|மாற்|மத்தேயு|லூக்கா|யோவான்|மாற்கு|Matthew|Luke|John|Mark|Romans|Corinthians)\s*\d+/i.test(block))) {
        quote = block;
        continue;
      }
      if (/^(?:மன்றாட்டு:|Prayer:)/i.test(block)) {
        prayer = block.replace(/^(?:மன்றாட்டு:|Prayer:)\s*/i, '').trim();
        continue;
      }
      paragraphs.push(block);
    }
  }

  const parts = [];
  parts.push(isTa ? `🕊️ *இன்றைய சிந்தனை & நற்செய்தி தியானம்*` : `🕊️ *Daily Reflection & Gospel Meditation*`);

  if (quote) {
    const cleanQuote = quote.replace(/^[“"''\s]+/, '').replace(/["''\s]+$/, '').trim();
    parts.push(`*“${cleanQuote}”*`);
  }

  paragraphs.forEach(p => {
    const pt = p.trim();
    if (pt) parts.push(pt);
  });

  if (prayer) {
    const cleanPrayer = prayer.replace(/^(?:மன்றாட்டு:|Prayer:)\s*/i, '').trim();
    parts.push(`*${isTa ? 'மன்றாட்டு:' : 'Prayer:'}*\n${cleanPrayer}`);
  }

  return parts.join('\n\n');
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

  let msg = '';

  if (lang === 'en') {
    const formattedEn = formatMassReadingsLangBlock(dailyContent.massReadings?.english, 'en', isShort);
    msg = `✝️ *Today's Catholic Mass Readings*\n📅 *${dateEn}*\n\n${formattedEn || 'Readings are not available today.'}`;
  } else if (lang === 'both') {
    const formattedTa = formatMassReadingsLangBlock(dailyContent.massReadings?.tamil, 'ta', isShort);
    const formattedEn = formatMassReadingsLangBlock(dailyContent.massReadings?.english, 'en', isShort);
    msg = `✝️ *இன்றைய கத்தோலிக்க திருப்பலி வாசகங்கள்*\n📅 *${dateTa}*\n\n${formattedTa || 'இன்றைய வாசகம் கிடைக்கவில்லை.'}\n\n━━━━━━━━━━━━━━━━━━━━━\n\n✝️ *Today's Catholic Mass Readings*\n📅 *${dateEn}*\n\n${formattedEn || 'Readings are not available today.'}`;
  } else {
    // Tamil (default)
    const formattedTa = formatMassReadingsLangBlock(dailyContent.massReadings?.tamil, 'ta', isShort);
    const fallbackEn = !formattedTa ? formatMassReadingsLangBlock(dailyContent.massReadings?.english, 'en', isShort) : '';
    msg = `✝️ *இன்றைய கத்தோலிக்க திருப்பலி வாசகங்கள்*\n📅 *${dateTa}*\n\n${formattedTa || fallbackEn || 'இன்றைய வாசகம் கிடைக்கவில்லை.'}`;
  }

  return removeAllUrls(msg.trim());
}

/**
 * MESSAGE 3 — DAILY REFLECTION (Sent as its own separate WhatsApp text message)
 *
 * Contains:
 * - Title: இன்றைய சிந்தனை & நற்செய்தி தியானம் / Daily Reflection & Gospel Meditation
 * - Complete reflection content fetched from dailyContent.reflection (Tamil / English / Both)
 * - Relevant scripture quote in bold
 * - Body paragraphs separated by double newline (\n\n)
 * - Concluding prayer with bold heading
 * - Parish footer
 *
 * Guaranteed 0 URLs. Delivered strictly after Daily Mass Readings and before Saint of the Day image.
 */
function generateDailyReflectionMessage({ dailyContent, language = 'ta' }) {
  const lang = normalizeContentLanguage(language);

  const reflTaData = dailyContent?.reflection?.tamilStructured || dailyContent?.reflection?.tamil || dailyContent?.reflection;
  const reflEnData = dailyContent?.reflection?.englishStructured || dailyContent?.reflection?.english || dailyContent?.reflection;

  let msg = '';

  if (lang === 'en') {
    const formattedEn = formatDailyReflectionBlock(reflEnData, 'en');
    msg = `${formattedEn || '🕊️ *Daily Reflection & Gospel Meditation*\n\nThe Word of God is a lamp to our feet and a light to our path. May God bless and guide you today.'}\n\n— *St. John de Britto Church, Kalayarkoil*\n_SJDB Connect_`;
  } else if (lang === 'both') {
    const formattedTa = formatDailyReflectionBlock(reflTaData, 'ta');
    const formattedEn = formatDailyReflectionBlock(reflEnData, 'en');

    if (formattedEn && formattedEn !== formattedTa) {
      msg = `${formattedTa}\n\n━━━━━━━━━━━━━━━━━━━━━\n\n${formattedEn}\n\n— *புனித அருளானந்தர் திருத்தலம் (St. John de Britto Church), காளையார்கோவில்*\n_SJDB Connect_`;
    } else {
      msg = `${formattedTa}\n\n— *புனித அருளானந்தர் திருத்தலம், காளையார்கோவில்*\n_SJDB Connect_`;
    }
  } else {
    // Tamil (default)
    const formattedTa = formatDailyReflectionBlock(reflTaData, 'ta');
    const fallbackEn = !formattedTa ? formatDailyReflectionBlock(reflEnData, 'en') : '';
    msg = `${formattedTa || fallbackEn || '🕊️ *இன்றைய சிந்தனை & நற்செய்தி தியானம்*\n\nஇறைவனின் வார்த்தை நம் வாழ்வின் வழிகாட்டி. இன்றைய நாளில் இறைவனின் அன்பிலும் இரக்கத்திலும் திளைப்போம்.'}\n\n— *புனித அருளானந்தர் திருத்தலம், காளையார்கோவில்*\n_SJDB Connect_`;
  }

  return removeAllUrls(msg.trim());
}

/**
/**
 * Generate concise, informative caption for the Saint image message
 */
function generateSaintImageCaption({ dailyContent, language = 'ta' }) {
  const lang = normalizeContentLanguage(language);
  const { getSaintForDate } = require('../data/catholic_saints_calendar');
  const fallbackSaint = getSaintForDate(dailyContent?.dateKey || new Date());

  let saintNameEn = dailyContent?.saint?.nameEn || dailyContent?.saint?.nameEnglish || dailyContent?.saint?.name || dailyContent?.saintName;
  if (!saintNameEn || saintNameEn.toLowerCase().includes('saint of the day') || saintNameEn.toLowerCase().includes('today\'s saint')) {
    saintNameEn = fallbackSaint?.name || 'Saint of the Day';
  }

  let saintNameTa = dailyContent?.saint?.nameTa || dailyContent?.saint?.nameTamil || dailyContent?.saintNameTa;
  if (!saintNameTa || saintNameTa.trim() === 'இன்றைய புனிதர்' || saintNameTa.trim() === 'புனிதர்') {
    saintNameTa = fallbackSaint?.nameTa || saintNameEn;
  }

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
  let saintImageUrl = saintObj?.remoteUrl ||
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
          return sName.includes(base) || base.includes(sName) || (sName.includes('candida') && base.includes('candida')) || (sName.includes('jerome') && base.includes('jerome'));
        }) || files[0];
        if (matched) {
          saintImageBuffer = fs.readFileSync(path.join(sDir, matched));
        }
      }
    } catch (e) {}
  }

  // Fallback to Catholic liturgical calendar preset if image still missing
  if (!saintImageBuffer && !saintImageUrl) {
    try {
      const { getSaintForDate } = require('../data/catholic_saints_calendar');
      const fallbackSaint = getSaintForDate(dailyContent?.dateKey || new Date());
      if (fallbackSaint?.image) {
        saintImageUrl = fallbackSaint.image;
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

  const { getSaintForDate } = require('../data/catholic_saints_calendar');
  const fallbackSaint = getSaintForDate(dailyContent?.dateKey || new Date());

  let saintNameEn = saintObj?.nameEn || saintObj?.nameEnglish || saintObj?.name || dailyContent?.saintName;
  if (!saintNameEn || saintNameEn.toLowerCase().includes('saint of the day') || saintNameEn.toLowerCase().includes('today\'s saint')) {
    saintNameEn = fallbackSaint?.name || 'Saint of the Day';
  }

  let saintNameTa = saintObj?.nameTa || saintObj?.nameTamil || dailyContent?.saintNameTa;
  if (!saintNameTa || saintNameTa.trim() === 'இன்றைய புனிதர்' || saintNameTa.trim() === 'புனிதர்') {
    saintNameTa = fallbackSaint?.nameTa || saintNameEn;
  }

  const titleEn = saintObj?.titleEn || saintObj?.feastTitle || saintNameEn;
  const titleTa = saintObj?.titleTa || saintObj?.feastTitleTa || saintNameTa;
  const feastDayEn = saintObj?.feastDayEn || saintObj?.feastDay || dailyContent?.formattedDate || '';
  const feastDayTa = saintObj?.feastDayTa || dailyContent?.formattedDateTa || feastDayEn;

  const isBoilerplate = (text) => /Every day, we will|Other Sts whose feast day|December 31|டிசம்பர் 31|ஒவ்வொரு நாளும்|பீடிகாபிகேஷன்|Saints are special people in the Catholic faith|beacons of light|கலங்கரை விளக்கங்களாக/i.test(text || '');

  let descEn = (
    dailyContent?.saint?.descriptionEn ||
    dailyContent?.saint?.description ||
    dailyContent?.saint?.descriptionEnglish ||
    dailyContent?.saintDescription ||
    dailyContent?.saintDescriptionEn ||
    ''
  ).trim();

  let descTaRaw = (
    dailyContent?.saint?.descriptionTa ||
    dailyContent?.saint?.descriptionTamil ||
    dailyContent?.saintDescriptionTa ||
    ''
  ).trim();

  if (isBoilerplate(descEn) || !descEn) {
    descEn = fallbackSaint?.description || '';
  }
  if (isBoilerplate(descTaRaw) || !descTaRaw) {
    descTaRaw = fallbackSaint?.descriptionTa || '';
  }

  // Validate that Tamil biography actually contains Tamil characters
  const hasTamilInBio = Boolean(descTaRaw && /[\u0B80-\u0BFF]/.test(descTaRaw));
  const descTa = hasTamilInBio ? descTaRaw : (fallbackSaint?.descriptionTa || '');

  const feastTypeEn = dailyContent?.saint?.feastType || 'Feast';
  const feastTypeTa = dailyContent?.saint?.feastTypeTa || 'நினைவுநாள்';

  const otherSaints = saintObj?.otherSaints || dailyContent?.otherSaints || [];

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
    if (otherSaints.length > 0) {
      msg += `🕊️ *Other Saints Commemorated Today:*\n`;
      otherSaints.forEach(os => {
        msg += `• *${os.name || os.title}*\n`;
      });
      msg += `\n`;
    }
    msg += `— *St. John de Britto Church, Kalayarkoil*\n_SJDB Connect_`;
    return removeAllUrls(msg.trim());
  }

  // 2. BILINGUAL (TAMIL + ENGLISH)
  if (lang === 'both') {
    let finalNameTa = saintNameTa || saintNameEn;
    if (!finalNameTa || finalNameTa.trim() === 'இன்றைய புனிதர்') {
      finalNameTa = fallbackSaint?.nameTa || fallbackSaint?.name || 'Saint of the Day';
    }
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
    if (otherSaints.length > 0) {
      msg += `🕊️ *இன்று நினைவுகூரப்படும் பிற புனிதர்கள்:*\n`;
      otherSaints.forEach(os => {
        msg += `• *${os.nameTa || os.tamilName || os.name || os.title}*\n`;
      });
      msg += `\n`;
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
    if (otherSaints.length > 0) {
      msg += `🕊️ *Other Saints Commemorated Today:*\n`;
      otherSaints.forEach(os => {
        msg += `• *${os.name || os.title}*\n`;
      });
      msg += `\n`;
    }

    msg += `— *St. John de Britto Church, Kalayarkoil*\n_SJDB Connect_`;
    return removeAllUrls(msg.trim());
  }

  // 3. TAMIL ONLY (Strict default)
  let finalName = saintNameTa || saintNameEn;
  if (!finalName || finalName.trim() === 'இன்றைய புனிதர்') {
    finalName = fallbackSaint?.nameTa || fallbackSaint?.name || 'Saint of the Day';
  }
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
  if (otherSaints.length > 0) {
    msg += `🕊️ *இன்று நினைவுகூரப்படும் பிற புனிதர்கள்:*\n`;
    otherSaints.forEach(os => {
      msg += `• *${os.nameTa || os.tamilName || os.name || os.title}*\n`;
    });
    msg += `\n`;
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
      const formattedEn = formatMassReadingsLangBlock(dailyContent.massReadings?.english, 'en', isShort);
      if (formattedEn) {
        readingContent = `${formattedEn}\n\n`;
      }
    }

    const reflBlock = formatDailyReflectionBlock(dailyContent?.reflection?.englishStructured || dailyContent?.reflection?.english || dailyContent?.reflection, 'en') || (reflectionEn || 'The Word of the Lord is a lamp to our feet and a light to our path.');
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
      const formattedEn = formatMassReadingsLangBlock(dailyContent.massReadings?.english, 'en', isShort);
      if (formattedEn) {
        readingContent = `${formattedEn}\n\n`;
      }
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
      const formattedTa = formatMassReadingsLangBlock(dailyContent.massReadings?.tamil, 'ta', isShort);
      const formattedEn = formatMassReadingsLangBlock(dailyContent.massReadings?.english, 'en', isShort);
      if (formattedTa || formattedEn) {
        readingContent = `${formattedTa || ''}\n\n━━━━━━━━━━━━━━━━━━━━━\n\n${formattedEn || ''}\n\n`;
      }
    }

    const reflTaBlock = formatDailyReflectionBlock(dailyContent?.reflection?.tamilStructured || dailyContent?.reflection?.tamil || dailyContent?.reflection, 'ta');
    const reflEnBlock = formatDailyReflectionBlock(dailyContent?.reflection?.englishStructured || dailyContent?.reflection?.english || dailyContent?.reflection, 'en');

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

${reflTaBlock}
${reflEnBlock && reflEnBlock !== reflTaBlock ? `\n\n━━━━━━━━━━━━━━━━━━━━━\n\n${reflEnBlock}` : ''}

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
      const formattedTa = formatMassReadingsLangBlock(dailyContent.massReadings?.tamil, 'ta', isShort);
      const fallbackEn = !formattedTa ? formatMassReadingsLangBlock(dailyContent.massReadings?.english, 'en', isShort) : '';
      if (formattedTa || fallbackEn) {
        readingContent = `${formattedTa || fallbackEn}\n\n`;
      }
    }

    const reflBlock = formatDailyReflectionBlock(dailyContent?.reflection?.tamilStructured || dailyContent?.reflection?.tamil || dailyContent?.reflection, 'ta') || (reflectionTa || 'இறைவனின் வார்த்தை நம் வாழ்வின் வெளிச்சம்.');
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

${readingContent}🕊️ *இன்றைய சிந்தனை (DAILY REFLECTION)*

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

