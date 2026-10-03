const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
const nodeCron = require('node-cron');
const DailyMassReading = require('../models/DailyMassReading');
const { cleanCatholicContent, deduplicateReadings, getCanonicalReadingKey } = require('../utils/cleanCatholicContent');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const DEFAULT_MASS_READINGS_URL = 'https://www.catholicgallery.org/tamil-mass-readings-today/';
const DEFAULT_DAILY_REFLECTION_URL = 'https://www.tamilcatholicdaily.com/dailyverse';

/**
 * Clean text whitespace
 */
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Filter out calendar widgets, month/year selectors, and garbage footer lines
 */
function isGarbageOrCalendarLine(l) {
  if (!l || typeof l !== 'string') return true;
  const trimmed = l.trim();
  if (!trimmed) return true;

  // Advertisement and CSS rules/classes
  if (
    trimmed.includes('.cgAd') ||
    trimmed.includes('.cgWrap') ||
    trimmed.includes('cgAd2') ||
    trimmed.includes('cgAd-2') ||
    trimmed.includes('cgWrap-2') ||
    trimmed.includes('@media') ||
    trimmed.includes('!important') ||
    trimmed.includes('display:inline-block') ||
    trimmed.includes('min-height:') ||
    trimmed.includes('text-align:') ||
    trimmed.includes('Official Catholic Gallery App') ||
    trimmed.includes('Download our Official') ||
    (trimmed.includes('width:') && trimmed.includes('height:')) ||
    /^[.#][a-zA-Z0-9_-]+\s*\{/.test(trimmed) ||
    /\{[^}]*(?:width|height|margin|padding|display|color|font)[^}]*\}/i.test(trimmed) ||
    /^[{}\s;]+$/.test(trimmed) ||
    trimmed === 'New:' ||
    trimmed === 'New' ||
    trimmed === 'Android &' ||
    trimmed === 'iOS' ||
    trimmed.includes('Android') ||
    trimmed.includes('iOS') ||
    trimmed.includes('Catholic Gallery')
  ) {
    return true;
  }

  // Month-Year pattern like ஆகஸ்ட்-2026, August-2026, etc.
  if (/^(ஜனவரி|பிப்ரவரி|மார்ச்|ஏப்ரல்|மே|ஜூன்|ஜூலை|ஆகஸ்ட்|ஆகத்து|செப்டம்பர்|அக்டோபர்|நவம்பர்|டிசம்பர்|January|February|March|April|May|June|July|August|September|October|November|December)[-\s]?\d{4}$/i.test(trimmed)) {
    return true;
  }

  // Standalone years like 2025, 2026, 2027, 2028
  if (/^(19|20)\d{2}$/.test(trimmed)) {
    return true;
  }

  // Calendar day abbreviations or lone digits
  if (/^(ஞா|தி|செ|பு|வி|வெ|ச|Sun|Mon|Tue|Wed|Thu|Fri|Sat|\d{1,2})$/i.test(trimmed)) {
    return true;
  }

  // Archive widgets, ads, share text, or navigation links
  if (
    trimmed.startsWith('Archive') || 
    trimmed.includes('Download Mass Readings') || 
    trimmed.includes('Leave a Reply') || 
    trimmed.includes('Share:') || 
    trimmed.includes('◄') || 
    trimmed.includes('►') || 
    trimmed.includes('adsbygoogle') || 
    trimmed.includes('adslot_')
  ) {
    return true;
  }

  return false;
}

/**
 * Format date key from Date or string in Asia/Kolkata timezone (YYYY-MM-DD)
 */
function getDateKey(d = new Date()) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dt = new Date(d);
  const kolkataDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dt);
  return kolkataDate;
}

/**
 * Resolve Daily Mass Readings URL from SiteSettings or Default Catholic Gallery (https://bible.catholicgallery.org/tamil-mass-reading/tr-DDMMYY/)
 */
async function getMassReadingsFetchUrl(dateStr) {
  let url = DEFAULT_MASS_READINGS_URL;
  try {
    const SiteSettings = require('../models/SiteSettings');
    const setting = await SiteSettings.findOne({ key: 'daily_mass_fetch_url' }).lean();
    if (setting && setting.value && setting.value.trim() !== '') {
      url = setting.value.trim();
    }
  } catch (err) {
    console.warn('[Mass Readings] Could not read daily_mass_fetch_url setting:', err.message);
  }

  const [year, month, day] = dateStr.split('-');
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yy = String(year).slice(-2);

  // If custom URL contains date placeholders, substitute them
  if (url.includes('{DD}') || url.includes('{MM}') || url.includes('{YY}') || url.includes('{YYYY}')) {
    return url
      .replace(/\{YYYY\}/g, year)
      .replace(/\{YY\}/g, yy)
      .replace(/\{MM\}/g, mm)
      .replace(/\{DD\}/g, dd);
  }

  // Authoritative Catholic Gallery URL structure: tr-DDMMYY
  if (url.includes('catholicgallery.org')) {
    return `https://bible.catholicgallery.org/tamil-mass-reading/tr-${dd}${mm}${yy}/`;
  }

  return url;
}

/**
 * Resolve Daily Reflection URL from SiteSettings or Default Tamil Catholic Daily
 */
async function getDailyReflectionFetchUrl() {
  try {
    const SiteSettings = require('../models/SiteSettings');
    const setting = await SiteSettings.findOne({ key: 'daily_reflection_fetch_url' }).lean();
    if (setting && setting.value && setting.value.trim() !== '') {
      return setting.value.trim();
    }
  } catch (err) {
    console.warn('[Mass Readings] Could not read daily_reflection_fetch_url setting:', err.message);
  }
  return DEFAULT_DAILY_REFLECTION_URL;
}

/**
 * Parse Responsorial Psalm from Catholic Gallery block
 * Extracts reference, refrain, and separates individual verse groups (e.g. 1-3, 7-8, 9-10, 13-14ab)
 */
function parseResponsorialPsalm($, blockEl) {
  const block = $(blockEl);

  // 1. Reference: find span or text with திபா / Psalm
  let reference = '';
  block.find('span, p').each((_, el) => {
    const t = cleanText($(el).text());
    if ((t.startsWith('திபா') || t.includes('திபா')) && !reference && t.length < 120) {
      reference = t;
    }
  });

  // 2. Refrain / Response: find p or span with "பல்லவி:"
  let response = '';
  block.find('p, span').each((_, el) => {
    const t = cleanText($(el).text());
    if (t.includes('பல்லவி:') && (!response || response.length < t.length)) {
      response = t;
    }
  });
  const refrain = response.replace(/^பல்லவி:\s*/, '').trim();

  // 3. Expected ranges from reference, e.g. "திபா 139: 1-3. 7-8. 9-10. 13-14ab (பல்லவி: 24b)" -> ["1-3", "7-8", "9-10", "13-14ab"]
  const expectedRanges = [];
  const refPartsMatch = reference.match(/:\s*([^(]+)/);
  if (refPartsMatch) {
    const rawSegments = refPartsMatch[1].split(/[.\s]+/).map(s => s.trim().replace(/,$/, '')).filter(Boolean);
    rawSegments.forEach(seg => {
      if (/^\d/.test(seg)) {
        expectedRanges.push(seg);
      }
    });
  }

  // 4. Extract verses inside .psalmText
  const psalmDiv = block.find('.psalmText');
  let rawHtml = psalmDiv.length > 0 ? psalmDiv.html() : block.html();

  // Split on "– பல்லவி" or "- பல்லவி" or "<span class="clrgreen">பல்லவி</span>"
  const chunks = rawHtml.split(/–\s*<span[^>]*>பல்லவி<\/span>|<span[^>]*>–\s*பல்லவி<\/span>|–\s*பல்லவி|-\s*பல்லவி/i)
    .map(c => c.trim())
    .filter(c => c.length > 5);

  const verses = [];

  chunks.forEach((chunk, idx) => {
    const $chunk = cheerio.load(`<div>${chunk}</div>`);

    // Extract verse numbers found in this chunk
    const numsInChunk = [];
    $chunk('.psmvnum').each((_, el) => {
      const n = $chunk(el).text().trim();
      if (n) numsInChunk.push(n);
    });

    // Build verse text with numbers
    let groupText = '';
    if ($chunk('.psmvnum, .psmvcont').length > 0) {
      $chunk('div').children().each((_, el) => {
        const isNum = $chunk(el).hasClass('psmvnum');
        const isCont = $chunk(el).hasClass('psmvcont');
        const txt = cleanText($chunk(el).text());
        if (txt) {
          if (isNum) {
            groupText += `${txt} `;
          } else if (isCont) {
            const cleanedCont = txt.replace(/[-–]\s*பல்லவி$/i, '').trim();
            groupText += `${cleanedCont} `;
          }
        }
      });
    }

    if (!groupText.trim()) {
      groupText = cleanText($chunk.text().replace(/[-–]\s*பல்லவி$/i, ''));
    }

    groupText = cleanText(groupText);

    let groupNumbers = '';
    if (expectedRanges[idx]) {
      groupNumbers = expectedRanges[idx];
    } else if (numsInChunk.length === 1) {
      groupNumbers = numsInChunk[0];
    } else if (numsInChunk.length > 1) {
      groupNumbers = `${numsInChunk[0]}-${numsInChunk[numsInChunk.length - 1]}`;
    } else {
      groupNumbers = `பகுதி ${idx + 1}`;
    }

    if (groupText) {
      verses.push({
        numbers: groupNumbers,
        text: groupText
      });
    }
  });

  return {
    title: 'பதிலுரைப் பாடல்',
    heading: 'பதிலுரைப் பாடல்',
    reference: reference || 'திபா',
    refrain: refrain || response,
    response: response || (refrain ? `பல்லவி: ${refrain}` : 'பல்லவி'),
    verses
  };
}

/**
 * Authoritative HTML parser for Catholic Gallery Tamil Mass Readings
 * Implements robust heading-based & .readings-block extraction.
 * Guarantees no sidebars, advertisements, or notices are mistakenly extracted as scripture.
 */
function parseTamilMassReading(html, dateStr, sourceUrl) {
  const $ = cheerio.load(html);

  // 1. Remove ONLY non-content ads, scripts, and navigation widgets
  $('style, script, noscript, iframe, ins, .cgAd2, .cgAd-2, .cgWrap-2, [class*="cgAd"], [class*="cgWrap"], [class*="adslot"], .comments-area, .share-buttons, #respond, nav.npdaystyle, .cg_month_table, .massrexbtnsty').remove();

  // 2. Liturgical Info & Titles
  const pageTitle = cleanText($('h1.entry-title, h1').first().text()) || `திருப்பலி வாசகங்கள் – ${dateStr}`;
  let liturgicalDay = cleanText($('.dayTitle, .cgTamHead').first().text());
  let celebration = '';

  const headEl = $('.cgTamHead');
  if (headEl.length > 0) {
    const headText = cleanText(headEl.text());
    const dayTitle = cleanText($('.dayTitle').text());
    if (dayTitle && headText.includes(dayTitle)) {
      liturgicalDay = dayTitle;
      celebration = cleanText(headText.replace(dayTitle, ''));
    } else {
      liturgicalDay = headText;
    }
  }

  // Extract special notices (e.g. "நற்செய்தி வாசகம் தூய காவல் தூதர்கள் நினைவுக்கு உரியது.")
  const notices = [];
  $('.notice').each((_, el) => {
    const n = cleanText($(el).text());
    if (n) notices.push(n);
  });

  // 3. Find reading blocks (Catholic Gallery uses .readings containers)
  const readingBlocks = [];
  if ($('.readings').length > 0) {
    $('.readings').each((_, el) => {
      readingBlocks.push($(el));
    });
  }

  let firstReading = null;
  let secondReading = null;
  let responsorialPsalm = null;
  let gospelAcclamation = null;
  let gospel = null;

  readingBlocks.forEach(($block) => {
    const headingText = cleanText($block.find('.readingsTitle, h2, h3, h4, p').first().text());

    if (headingText.includes('முதல் வாசகம்')) {
      const subtitle = cleanText($block.find('.readingIntro').text());
      
      let reference = '';
      $block.find('p').each((_, p) => {
        const pt = cleanText($(p).text());
        if ((pt.includes('நூலிலிருந்து') || pt.includes('திருமுகத்திலிருந்து') || pt.includes('வாசகம்')) && !reference && pt !== headingText && pt !== subtitle) {
          reference = pt;
        }
      });

      const paragraphs = [];
      $block.find('.readingTxt').each((_, p) => {
        const pt = cleanText($(p).text());
        if (pt) paragraphs.push(pt);
      });

      if (paragraphs.length === 0) {
        let afterRef = false;
        $block.find('p').each((_, p) => {
          const pt = cleanText($(p).text());
          if (pt === reference) {
            afterRef = true;
          } else if (afterRef && pt) {
            paragraphs.push(pt);
          }
        });
      }

      const lastP = paragraphs[paragraphs.length - 1];
      if (!lastP || !lastP.includes('ஆண்டவரின் அருள்வாக்கு')) {
        paragraphs.push('ஆண்டவரின் அருள்வாக்கு.');
      }

      firstReading = {
        title: 'முதல் வாசகம்',
        heading: 'முதல் வாசகம்',
        subtitle,
        reference,
        text: paragraphs.join('\n\n'),
        paragraphs
      };

    } else if (headingText.includes('இரண்டாம் வாசகம்')) {
      const subtitle = cleanText($block.find('.readingIntro').text());
      let reference = '';
      $block.find('p').each((_, p) => {
        const pt = cleanText($(p).text());
        if ((pt.includes('நூலிலிருந்து') || pt.includes('திருமுகத்திலிருந்து') || pt.includes('வாசகம்')) && !reference && pt !== headingText && pt !== subtitle) {
          reference = pt;
        }
      });

      const paragraphs = [];
      $block.find('.readingTxt').each((_, p) => {
        const pt = cleanText($(p).text());
        if (pt) paragraphs.push(pt);
      });
      if (paragraphs.length === 0) {
        let afterRef = false;
        $block.find('p').each((_, p) => {
          const pt = cleanText($(p).text());
          if (pt === reference) {
            afterRef = true;
          } else if (afterRef && pt) {
            paragraphs.push(pt);
          }
        });
      }
      const lastP = paragraphs[paragraphs.length - 1];
      if (!lastP || !lastP.includes('ஆண்டவரின் அருள்வாக்கு')) {
        paragraphs.push('ஆண்டவரின் அருள்வாக்கு.');
      }

      secondReading = {
        title: 'இரண்டாம் வாசகம்',
        heading: 'இரண்டாம் வாசகம்',
        subtitle,
        reference,
        text: paragraphs.join('\n\n'),
        paragraphs
      };

    } else if (headingText.includes('பதிலுரைப் பாடல்') || headingText.includes('பதிலுரை பாடல்')) {
      responsorialPsalm = parseResponsorialPsalm($, $block);

    } else if (headingText.includes('நற்செய்திக்கு முன் வாழ்த்தொலி') || headingText.includes('வாழ்த்தொலி')) {
      let reference = '';
      let text = '';
      $block.find('span, p').each((_, el) => {
        const pt = cleanText($(el).text());
        if (pt.includes('திபா') || pt.includes('யோவா') || pt.includes('மத்') || pt.includes('லூக்') || pt.includes('எபி')) {
          if (!reference && pt.length < 50) reference = pt;
        } else if (pt.includes('அல்லேலூயா') || $(el).hasClass('alleluiaTxt')) {
          if (!text || text.length < pt.length) text = pt;
        }
      });

      gospelAcclamation = {
        title: 'நற்செய்திக்கு முன் வாழ்த்தொலி',
        heading: 'நற்செய்திக்கு முன் வாழ்த்தொலி',
        reference: reference || 'அல்லேலூயா',
        text: text
      };

    } else if (headingText.includes('நற்செய்தி வாசகம்')) {
      const subtitle = cleanText($block.find('.readingIntro').text());
      
      let reference = '';
      $block.find('p').each((_, p) => {
        const pt = cleanText($(p).text());
        if ((pt.includes('நற்செய்தியிலிருந்து') || pt.includes('✠') || pt.includes('\u2720')) && !reference) {
          reference = pt;
        }
      });

      const paragraphs = [];
      $block.find('.readingTxt').each((_, p) => {
        const pt = cleanText($(p).text());
        if (pt) paragraphs.push(pt);
      });

      if (paragraphs.length === 0) {
        let afterRef = false;
        $block.find('p').each((_, p) => {
          const pt = cleanText($(p).text());
          if (pt === reference) {
            afterRef = true;
          } else if (afterRef && pt) {
            paragraphs.push(pt);
          }
        });
      }

      let introduction = '';
      if (paragraphs.length > 0 && paragraphs[0].startsWith('அக்காலத்தில்')) {
        introduction = paragraphs[0];
      }

      const lastP = paragraphs[paragraphs.length - 1];
      if (!lastP || (!lastP.includes('ஆண்டவரின் அருள்வாக்கு') && !lastP.includes('கிறிஸ்து வழங்கும் நற்செய்தி'))) {
        paragraphs.push('ஆண்டவரின் அருள்வாக்கு.');
      }

      gospel = {
        title: 'நற்செய்தி வாசகம்',
        heading: 'நற்செய்தி வாசகம்',
        subtitle,
        reference,
        introduction,
        text: paragraphs.join('\n\n'),
        paragraphs,
        conclusion: 'ஆண்டவரின் அருள்வாக்கு.'
      };
    }
  });

  let title = celebration || liturgicalDay || 'இன்றைய திருப்பலி வாசகங்கள்';
  if (!title || title === 'New:' || title.length < 4) {
    title = 'இன்றைய திருப்பலி வாசகங்கள்';
  }

  return {
    date: dateStr,
    title,
    pageTitle,
    liturgicalInfo: {
      day: liturgicalDay,
      celebration,
      notices
    },
    liturgicalDay: liturgicalDay || 'இன்றைய திருப்பலி வாசகங்கள்',
    celebration,
    lectionary: '',
    originalLanguage: 'ta',
    firstReading,
    secondReading,
    responsorialPsalm,
    gospelAcclamation,
    alleluia: gospelAcclamation, // backward compatible alias
    gospel,
    sourceUrl
  };
}

/**
 * Validate that mandatory Mass Reading sections were successfully extracted
 */
function validateTamilMassReading(parsedData, sourceUrl, dateStr) {
  console.log(`[TAMIL MASS] Fetching: ${dateStr}`);
  console.log(`[TAMIL MASS] Source URL: ${sourceUrl}`);

  const hasFirstReading = !!(parsedData.firstReading && parsedData.firstReading.text && parsedData.firstReading.text.trim().length > 50);
  const psalmVerseCount = parsedData.responsorialPsalm?.verses?.length || 0;
  const hasPsalm = psalmVerseCount > 0;
  const hasAlleluia = !!(parsedData.gospelAcclamation && parsedData.gospelAcclamation.text);
  const hasGospel = !!(parsedData.gospel && parsedData.gospel.text && parsedData.gospel.text.trim().length > 50);

  console.log(`[TAMIL MASS] First Reading: ${hasFirstReading ? 'OK' : 'MISSING'}`);
  console.log(`[TAMIL MASS] Responsorial Psalm: ${hasPsalm ? 'OK' : 'MISSING'}`);
  console.log(`[TAMIL MASS] Gospel Acclamation: ${hasAlleluia ? 'OK' : 'MISSING'}`);
  console.log(`[TAMIL MASS] Gospel: ${hasGospel ? 'OK' : 'MISSING'}`);
  console.log(`[TAMIL MASS] Verse groups: ${psalmVerseCount}`);

  if (hasFirstReading && hasPsalm && hasGospel) {
    console.log('[TAMIL MASS] Validation: PASS');
    return true;
  } else {
    console.warn('[TAMIL MASS] Validation: FAILED');
    return false;
  }
}

/**
 * Build standard UI sections array preserving structured verses for Responsorial Psalm
 */
function buildStandardSections(parsedData) {
  const sections = [];

  // 1. First Reading
  if (parsedData.firstReading) {
    const secParagraphs = [];
    if (parsedData.firstReading.subtitle) secParagraphs.push(parsedData.firstReading.subtitle);
    if (parsedData.firstReading.reference) secParagraphs.push(parsedData.firstReading.reference);
    if (parsedData.firstReading.paragraphs && parsedData.firstReading.paragraphs.length > 0) {
      secParagraphs.push(...parsedData.firstReading.paragraphs);
    }
    sections.push({
      heading: 'முதல் வாசகம்',
      reference: parsedData.firstReading.reference,
      subtitle: parsedData.firstReading.subtitle,
      paragraphs: secParagraphs
    });
  }

  // 2. Responsorial Psalm (separated verse groups with refrain after each group)
  if (parsedData.responsorialPsalm) {
    const secParagraphs = [];
    if (parsedData.responsorialPsalm.reference) secParagraphs.push(parsedData.responsorialPsalm.reference);
    if (parsedData.responsorialPsalm.response) secParagraphs.push(parsedData.responsorialPsalm.response);

    if (parsedData.responsorialPsalm.verses && parsedData.responsorialPsalm.verses.length > 0) {
      parsedData.responsorialPsalm.verses.forEach(v => {
        secParagraphs.push(`${v.numbers} ${v.text}\n— பல்லவி`);
      });
    }

    sections.push({
      heading: 'பதிலுரைப் பாடல்',
      reference: parsedData.responsorialPsalm.reference,
      refrain: parsedData.responsorialPsalm.refrain,
      paragraphs: secParagraphs,
      verses: parsedData.responsorialPsalm.verses
    });
  }

  // 3. Second Reading (if present, e.g. Sunday)
  if (parsedData.secondReading) {
    const secParagraphs = [];
    if (parsedData.secondReading.subtitle) secParagraphs.push(parsedData.secondReading.subtitle);
    if (parsedData.secondReading.reference) secParagraphs.push(parsedData.secondReading.reference);
    if (parsedData.secondReading.paragraphs && parsedData.secondReading.paragraphs.length > 0) {
      secParagraphs.push(...parsedData.secondReading.paragraphs);
    }
    sections.push({
      heading: 'இரண்டாம் வாசகம்',
      reference: parsedData.secondReading.reference,
      subtitle: parsedData.secondReading.subtitle,
      paragraphs: secParagraphs
    });
  }

  // 4. Gospel Acclamation
  if (parsedData.gospelAcclamation) {
    const secParagraphs = [];
    if (parsedData.gospelAcclamation.reference) secParagraphs.push(parsedData.gospelAcclamation.reference);
    if (parsedData.gospelAcclamation.text) secParagraphs.push(parsedData.gospelAcclamation.text);
    sections.push({
      heading: 'நற்செய்திக்கு முன் வாழ்த்தொலி',
      reference: parsedData.gospelAcclamation.reference,
      paragraphs: secParagraphs
    });
  }

  // 5. Gospel
  if (parsedData.gospel) {
    const secParagraphs = [];
    if (parsedData.gospel.subtitle) secParagraphs.push(parsedData.gospel.subtitle);
    if (parsedData.gospel.reference) secParagraphs.push(parsedData.gospel.reference);
    if (parsedData.gospel.paragraphs && parsedData.gospel.paragraphs.length > 0) {
      secParagraphs.push(...parsedData.gospel.paragraphs);
    }
    sections.push({
      heading: 'நற்செய்தி வாசகம்',
      reference: parsedData.gospel.reference,
      subtitle: parsedData.gospel.subtitle,
      paragraphs: secParagraphs
    });
  }

  return sections;
}

/**
/**
 * Fetch Daily Reflection from Tamil Catholic Daily via dailyReflectionService
 * Authoritative, date-based extraction with zero hardcoding or paraphrasing
 */
async function fetchDailyReflection(dateStr) {
  const { getTodayReflection } = require('./dailyReflectionService');
  try {
    const doc = await getTodayReflection(dateStr);
    if (doc) {
      return {
        heading: doc.heading || 'இன்றைய சிந்தனை',
        title: doc.title,
        scriptureQuote: doc.scriptureQuote,
        content: doc.reflection,
        paragraphs: doc.paragraphs || [],
        prayer: doc.prayer || '',
        sourceUrl: doc.sourceUrl
      };
    }
  } catch (err) {
    console.error(`[Daily Mass Reading] Error linking daily reflection for ${dateStr}:`, err.message);
  }
  return null;
}

/**
 * Fetch and Upsert Tamil Mass Reading into MongoDB with full validation and fallback URLs
 */
async function fetchAndStoreTamilReading(dateStr) {
  const primaryUrl = await getMassReadingsFetchUrl(dateStr);

  const [year, month, day] = dateStr.split('-');
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yy = String(year).slice(-2);
  const standardBibleUrl = `https://bible.catholicgallery.org/tamil-mass-reading/tr-${dd}${mm}${yy}/`;

  const candidateUrls = [primaryUrl];
  if (primaryUrl.endsWith('/')) {
    candidateUrls.push(primaryUrl.slice(0, -1));
  } else {
    candidateUrls.push(primaryUrl + '/');
  }
  if (!candidateUrls.includes(standardBibleUrl)) {
    candidateUrls.push(standardBibleUrl);
  }
  if (!candidateUrls.includes(standardBibleUrl.slice(0, -1))) {
    candidateUrls.push(standardBibleUrl.slice(0, -1));
  }

  let parsedData = null;
  let successfulUrl = null;
  let lastError = null;

  for (const url of candidateUrls) {
    try {
      console.log(`[TAMIL MASS] Attempting fetch from: ${url}`);
      let res = null;
      try {
        res = await axios.get(url, {
          httpsAgent,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ta,en-US;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache'
          },
          timeout: 15000
        });
      } catch (directErr) {
        console.warn(`[TAMIL MASS] Direct fetch failed for ${url} (${directErr.message}). Trying reader proxy...`);
        res = await axios.get(`https://r.jina.ai/${url}`, {
          headers: {
            'X-Return-Format': 'html',
            'Accept': 'text/html,application/xhtml+xml'
          },
          timeout: 30000
        });
      }

      if (res && res.data && typeof res.data === 'string' && res.data.length > 500) {
        const candidateParsed = parseTamilMassReading(res.data, dateStr, url);
        const isValid = validateTamilMassReading(candidateParsed, url, dateStr);
        if (isValid) {
          parsedData = candidateParsed;
          successfulUrl = url;
          break;
        } else {
          console.warn(`[TAMIL MASS] Validation failed for content from ${url}`);
        }
      }
    } catch (err) {
      console.warn(`[TAMIL MASS] Fetch and proxy failed for ${url}:`, err.message);
      lastError = err;
    }
  }

  if (!parsedData) {
    console.error(`[TAMIL MASS] All candidate URLs failed for ${dateStr}. Last error:`, lastError?.message);
    const existing = await DailyMassReading.findOne({ date: dateStr });
    if (existing && existing.gospel?.text && existing.gospel.text.length >= 60) {
      console.log(`[TAMIL MASS] Preserving valid cached MongoDB reading for ${dateStr}.`);
      return existing;
    }
    throw lastError || new Error(`Failed to fetch valid Tamil Mass Reading for ${dateStr}`);
  }

  // Attach Daily Reflection ("இன்றைய சிந்தனை")
  const reflectionData = await fetchDailyReflection(dateStr);
  parsedData.reflection = reflectionData;

  // Build standard sections array
  parsedData.sections = buildStandardSections(parsedData);
  parsedData.sourceUrl = successfulUrl;
  parsedData.fetchedAt = new Date();
  parsedData.updatedAt = new Date();

  const doc = await DailyMassReading.findOneAndUpdate(
    { date: dateStr },
    { $set: parsedData },
    { upsert: true, new: true }
  );

  console.log(`[TAMIL MASS] Successfully stored reading & reflection for ${dateStr} in MongoDB.`);
  return doc;
}

/**
 * Get reading for a given date (Returns Original Tamil with self-healing integrity check)
 */
async function getReadingForDate(dateStr) {
  const cleanDate = getDateKey(dateStr);
  let reading = await DailyMassReading.findOne({ date: cleanDate });

  const isCorruptedOrIncomplete = (doc) => {
    if (!doc) return true;
    if (doc.date !== cleanDate) return true;
    // Check if Gospel was corrupted (e.g. only contains notice text or < 2 paragraphs)
    const badGospel = !doc.gospel?.text || doc.gospel.text.length < 60 || doc.gospel.paragraphs?.length < 2 || (doc.gospel.text.includes('தூய காவல் தூதர்கள் நினைவுக்கு உரியது.') && doc.gospel.paragraphs?.length <= 2);
    // Check if Responsorial Psalm is missing verse groups
    const badPsalm = !doc.responsorialPsalm?.verses || doc.responsorialPsalm.verses.length === 0;
    // Check if CSS rules corrupted text
    const hasCss = doc.sections?.some(s => s.paragraphs?.some(p => p.includes('cgAd') || p.includes('cgWrap') || p.includes('@media'))) ||
      (doc.firstReading?.text && (doc.firstReading.text.includes('cgAd') || doc.firstReading.text.includes('@media')));

    return badGospel || badPsalm || hasCss;
  };

  if (!reading || isCorruptedOrIncomplete(reading)) {
    try {
      console.log(`[Mass Readings] Fetching/healing authoritative reading for ${cleanDate}...`);
      reading = await fetchAndStoreTamilReading(cleanDate);
    } catch (e) {
      console.warn(`[Mass Readings] Live fetch failed for ${cleanDate}:`, e.message);
      // NEVER fallback to sort({ date: -1 })! Serving an old date's reading corrupts the UI.
    }
  }

  // Double check that returned reading actually matches cleanDate
  if (reading && reading.date !== cleanDate) {
    console.warn(`[Mass Readings] Discarding date-mismatched document (expected ${cleanDate}, got ${reading.date})`);
    reading = null;
  }

  return reading;
}

// In-memory cache for translations
const translationMemoryCache = new Map();

/**
 * Translate Tamil text to English via multi-tier fallback
 */
async function translateTamilToEnglish(text) {
  if (!text || typeof text !== 'string' || !text.trim()) return text || '';
  const trimmed = text.trim();

  if (translationMemoryCache.has(trimmed)) {
    return translationMemoryCache.get(trimmed);
  }

  // Liturgical Shortcuts
  if (trimmed === 'ஆண்டவரின் அருள்வாக்கு.' || trimmed === 'ஆண்டவரின் அருள்வாக்கு') return 'The word of the Lord.';
  if (trimmed === '— இறைவா உமக்கு நன்றி.' || trimmed === 'இறைவா உமக்கு நன்றி.') return '— Thanks be to God.';
  if (trimmed.includes('கிறிஸ்து வழங்கும் நற்செய்தி')) return 'The Gospel of the Lord.';
  if (trimmed.includes('கிறிஸ்துவே உமக்கு புகழ்')) return '— Praise to you, Lord Jesus Christ.';
  if (trimmed === 'முதல் வாசகம்') return 'First Reading';
  if (trimmed === 'இரண்டாம் வாசகம்') return 'Second Reading';
  if (trimmed === 'பதிலுரைப் பாடல்' || trimmed === 'பதிலுரை பாடல்') return 'Responsorial Psalm';
  if (trimmed.includes('வாழ்த்தொலி') || trimmed.includes('அல்லேலூயா')) return 'Gospel Acclamation';
  if (trimmed === 'நற்செய்தி வாசகம்') return 'Gospel';
  if (trimmed.startsWith('பல்லவி:')) {
    const rest = trimmed.replace(/^பல்லவி:\s*/, '');
    const transRest = await translateTamilToEnglish(rest);
    return `Response: ${transRest}`;
  }

  // Tier 1: Google Translate GTX Endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ta&tl=en&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await axios.get(url, { 
      timeout: 6000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (res.data && res.data[0]) {
      const translated = res.data[0].map(x => x[0]).join('').trim();
      if (translated && !/[\u0B80-\u0BFF]/.test(translated)) {
        translationMemoryCache.set(trimmed, translated);
        return translated;
      }
    }
  } catch (err) {
    // Fall through
  }

  // Tier 2: Google Mobile HTML Translate
  try {
    const mobileUrl = `https://translate.google.com/m?sl=ta&tl=en&q=${encodeURIComponent(trimmed)}`;
    const res = await axios.get(mobileUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' },
      timeout: 6000
    });
    const $ = cheerio.load(res.data);
    const result = $('.result-container').text().trim();
    if (result && !/[\u0B80-\u0BFF]/.test(result)) {
      translationMemoryCache.set(trimmed, result);
      return result;
    }
  } catch (err) {
    // Fall through
  }

  return trimmed;
}

/**
 * Batch translate paragraphs
 */
async function batchTranslateTamilToEnglish(paragraphs = []) {
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) return [];
  const promises = paragraphs.map(p => translateTamilToEnglish(p));
  return await Promise.all(promises);
}

/**
 * Map Tamil Liturgical Headings to English
 */
function translateLiturgicalHeading(heading = '') {
  if (!heading || typeof heading !== 'string') return heading || '';
  const trimmed = heading.trim();
  const lower = trimmed.toLowerCase();

  if (trimmed === 'முதல் வாசகம்' || lower.includes('முதல்') || lower.includes('first')) return 'First Reading';
  if (trimmed === 'இரண்டாம் வாசகம்' || lower.includes('இரண்டாம்') || lower.includes('second')) return 'Second Reading';
  if (trimmed === 'பதிலுரைப் பாடல்' || lower.includes('பதிலுரை') || lower.includes('psalm')) return 'Responsorial Psalm';
  if (trimmed.includes('வாழ்த்தொலி') || trimmed.includes('அல்லேலூயா') || lower.includes('alleluia')) return 'Gospel Acclamation';
  if (trimmed.includes('நற்செய்தி') || lower.includes('gospel')) return 'Gospel';
  if (trimmed.includes('சிந்தனை') || lower.includes('reflection')) return 'Daily Reflection';

  return null;
}

/**
 * Translate Tamil Reading Document into English on Demand
 */
async function getOrGenerateEnglishTranslation(dateStr) {
  const reading = await getReadingForDate(dateStr);
  if (!reading) throw new Error('Reading not found');

  const cachedEn = reading.translation?.en;
  const isProperlyTranslated = cachedEn &&
    cachedEn.sections?.length > 0 &&
    cachedEn.title && !/[\u0B80-\u0BFF]/.test(cachedEn.title) &&
    cachedEn.sections[0]?.paragraphs?.[0] && !/[\u0B80-\u0BFF]/.test(cachedEn.sections[0].paragraphs[0]);

  if (cachedEn && isProperlyTranslated) {
    return cachedEn;
  }

  console.log(`[Translation Service] Translating reading for ${reading.date} to English...`);

  const headerTexts = [reading.title || '', reading.liturgicalDay || '', reading.celebration || ''];
  const [translatedTitle, translatedLiturgicalDay, translatedCelebration] = await batchTranslateTamilToEnglish(headerTexts);

  // Translate sections
  const translatedSections = [];
  if (reading.sections && reading.sections.length > 0) {
    for (const sec of reading.sections) {
      let translatedHeading = translateLiturgicalHeading(sec.heading);
      if (!translatedHeading) {
        translatedHeading = await translateTamilToEnglish(sec.heading || '');
      }

      let translatedParagraphs = [];
      if (sec.paragraphs && sec.paragraphs.length > 0) {
        const rawTranslated = await batchTranslateTamilToEnglish(sec.paragraphs);
        translatedParagraphs = rawTranslated.map(p => cleanCatholicContent(p)).filter(Boolean);
      }

      // If section has structured verses (Responsorial Psalm), translate them too
      let translatedVerses = [];
      let translatedRefrain = '';
      if (sec.verses && sec.verses.length > 0) {
        const verseTexts = sec.verses.map(v => v.text);
        const transTexts = await batchTranslateTamilToEnglish(verseTexts);
        translatedVerses = sec.verses.map((v, i) => ({
          numbers: v.numbers,
          text: transTexts[i] || v.text
        }));
      }
      if (sec.refrain) {
        translatedRefrain = await translateTamilToEnglish(sec.refrain);
      }

      translatedSections.push({
        heading: translatedHeading,
        reference: sec.reference || '',
        subtitle: sec.subtitle ? await translateTamilToEnglish(sec.subtitle) : '',
        paragraphs: translatedParagraphs,
        verses: translatedVerses,
        refrain: translatedRefrain
      });
    }
  }

  // Translate Daily Reflection
  let translatedReflection = null;
  if (reading.reflection) {
    const quoteToTranslate = reading.reflection.scriptureQuote || reading.reflection.title || '';
    const reflectionHeaders = [quoteToTranslate, reading.reflection.prayer || ''];
    const [transQuote, transPrayer] = await batchTranslateTamilToEnglish(reflectionHeaders);

    let transParagraphs = [];
    if (reading.reflection.paragraphs && reading.reflection.paragraphs.length > 0) {
      const rawTransParagraphs = await batchTranslateTamilToEnglish(reading.reflection.paragraphs);
      transParagraphs = rawTransParagraphs.map(p => cleanCatholicContent(p)).filter(Boolean);
    }

    translatedReflection = {
      heading: 'Daily Reflection',
      title: transQuote || 'Daily Reflection',
      scriptureQuote: transQuote || '',
      content: transParagraphs.join('\n\n'),
      paragraphs: transParagraphs,
      prayer: transPrayer || '',
      sourceUrl: reading.reflection.sourceUrl || DEFAULT_DAILY_REFLECTION_URL
    };
  }

  const englishData = {
    date: reading.date,
    title: translatedTitle || 'Daily Mass Readings',
    liturgicalDay: translatedLiturgicalDay,
    celebration: translatedCelebration,
    lectionary: reading.lectionary || '',
    sections: deduplicateReadings(translatedSections),
    reflection: translatedReflection,
    originalLanguage: 'ta',
    translatedLanguage: 'en',
    isTranslated: true,
    sourceUrl: reading.sourceUrl
  };

  await DailyMassReading.updateOne(
    { date: reading.date },
    { $set: { 'translation.en': englishData } }
  );

  return englishData;
}

/**
 * Initialize 12:00 AM IST Daily Automated Sync Scheduler
 * Executes sharply at midnight (00:00 Asia/Kolkata) with automatic retries
 * Synchronizes Mass Readings & Daily Reflection from Tamil Catholic Daily
 */
function initMidnightCron() {
  const { syncDailyTamilReflection, startupSafetyCheck } = require('./dailyReflectionService');

  // Startup Safety Check: Verify today's reflection exists in DB, fetch if missing
  startupSafetyCheck().catch(err => {
    console.warn('[Daily Reflection] Startup safety check notice:', err.message);
  });

  // Startup Safety Check: Verify today's mass reading exists in DB and is complete, fetch if missing
  (async () => {
    const todayKolkata = getDateKey(new Date());
    const existing = await DailyMassReading.findOne({ date: todayKolkata });
    if (!existing || !existing.gospel?.text || existing.gospel.text.length < 60) {
      console.log(`[Daily Mass Reading] Startup check: missing or incomplete reading for ${todayKolkata}. Fetching...`);
      await fetchAndStoreTamilReading(todayKolkata).catch(err => {
        console.warn(`[Daily Mass Reading] Startup fetch notice for ${todayKolkata}:`, err.message);
      });
    }
  })().catch(() => {});

  // Sharp 12:00 AM IST (00:00 Asia/Kolkata)
  nodeCron.schedule('0 0 * * *', async () => {
    const todayKolkata = getDateKey(new Date());
    console.log(`[Daily Midnight Cron] 12:00 AM IST sharp trigger. Syncing Mass Reading & Daily Reflection for ${todayKolkata}...`);
    try {
      await Promise.allSettled([
        fetchAndStoreTamilReading(todayKolkata),
        syncDailyTamilReflection(todayKolkata)
      ]);
    } catch (e) {
      console.error('[Daily Midnight Cron] Initial 12:00 AM sync failed, scheduling automatic 12:02 AM retry:', e.message);
      setTimeout(async () => {
        try {
          console.log('[Daily Midnight Cron] 12:02 AM retry running...');
          await Promise.allSettled([
            fetchAndStoreTamilReading(todayKolkata),
            syncDailyTamilReflection(todayKolkata)
          ]);
        } catch (err2) {
          console.error('[Daily Midnight Cron] 12:02 AM retry failed:', err2.message);
        }
      }, 2 * 60 * 1000);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  console.log('[Daily Midnight Scheduler] 12:00 AM IST automated sync scheduler active (Mass Readings & Reflection).');
}

module.exports = {
  parseTamilMassReading,
  validateTamilMassReading,
  buildStandardSections,
  fetchAndStoreTamilReading,
  fetchDailyReflection,
  getReadingForDate,
  getOrGenerateEnglishTranslation,
  translateTamilToEnglish,
  batchTranslateTamilToEnglish,
  initMidnightCron,
  getDateKey
};
