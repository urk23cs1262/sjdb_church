const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
const DailyReflection = require('../models/DailyReflection');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const DEFAULT_DAILY_REFLECTION_BASE_URL = 'https://www.tamilcatholicdaily.com/dailyverse';

/**
 * Reusable helper to get date in Asia/Kolkata timezone (YYYY-MM-DD)
 * Avoids UTC shift skew (e.g., new Date().toISOString() can produce yesterday/tomorrow)
 */
function getIndiaDate(d = new Date()) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
    return d.trim();
  }
  const dt = (d instanceof Date && !isNaN(d)) ? d : new Date(d);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dt);
}

/**
 * Clean text whitespace and non-breaking spaces
 */
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/[ \u00a0]+/g, ' ')
    .trim();
}

/**
 * Resolve Daily Reflection URL for a date (respecting SiteSettings if set)
 */
async function getDailyReflectionUrl(dateStr) {
  let baseUrl = DEFAULT_DAILY_REFLECTION_BASE_URL;
  try {
    const SiteSettings = require('../models/SiteSettings');
    const setting = await SiteSettings.findOne({ key: 'daily_reflection_fetch_url' }).lean();
    if (setting && setting.value && setting.value.trim() !== '') {
      baseUrl = setting.value.trim();
    }
  } catch (err) {
    console.warn('[TAMIL REFLECTION] Could not read daily_reflection_fetch_url setting:', err.message);
  }

  // If URL contains date query parameter or placeholder, substitute
  if (baseUrl.includes('{date}') || baseUrl.includes('{YYYY-MM-DD}')) {
    return baseUrl.replace(/\{date\}|\{YYYY-MM-DD\}/g, dateStr);
  }

  if (baseUrl.includes('tamilcatholicdaily.com/dailyverse/all')) {
    return baseUrl.includes('?') ? `${baseUrl}&date=${dateStr}` : `${baseUrl}?date=${dateStr}`;
  }

  // Preferred authoritative date URL format
  if (baseUrl.includes('tamilcatholicdaily.com/dailyverse')) {
    return `https://www.tamilcatholicdaily.com/dailyverse/all?date=${dateStr}`;
  }

  return baseUrl;
}

/**
 * Parse Tamil Catholic Daily HTML for "இன்றைய சிந்தனை"
 * Resilient to DOM changes without fixed nth-child or fragile CSS selectors
 */
function parseTamilReflectionHtml(html, requestedDate, sourceUrl) {
  if (!html || typeof html !== 'string') return null;

  const $ = cheerio.load(html);

  // 1. Identify heading "இன்றைய சிந்தனை"
  let headingEl = null;
  $('*').each((_, el) => {
    const directText = $(el).clone().children().remove().end().text().trim();
    if (directText.includes('இன்றைய சிந்தனை') || directText === 'இன்றைய சிந்தனை') {
      headingEl = $(el);
      return false; // Found primary match
    }
  });

  if (!headingEl || headingEl.length === 0) {
    // Fallback: search anywhere containing the text concisely
    $(':contains("இன்றைய சிந்தனை")').each((_, el) => {
      const text = $(el).text().trim();
      if (text.includes('இன்றைய சிந்தனை') && text.length < 60) {
        headingEl = $(el);
        return false;
      }
    });
  }

  if (!headingEl || headingEl.length === 0) {
    return null;
  }

  // 2. Identify parent card / section container
  let container = headingEl.closest('.card');
  if (!container.length) {
    container = headingEl.closest('.container, section, article, div.row, div.col');
  }

  let title = '';
  let scriptureQuote = '';
  let paragraphs = [];
  let prayer = null;

  if (container.length && container.hasClass('card')) {
    // Tamil Catholic Daily card structure:
    // .card-header: "இன்றைய சிந்தனை"
    // .card-body[0]: Scripture quote & Bible reference
    // .card-body[1]: Full reflection paragraphs
    // <p><strong>மன்றாட்டு:</strong></p> -> .card-body[2]: Prayer
    const bodies = container.find('.card-body');
    if (bodies.length >= 1) {
      const b0 = $(bodies[0]).clone();
      b0.find('br').replaceWith(' ');
      const b0Text = cleanText(b0.text());
      scriptureQuote = b0Text;
      title = b0Text;
    }

    if (bodies.length >= 2) {
      const b1 = $(bodies[1]).clone();
      b1.find('br').replaceWith('\n');
      paragraphs = b1.text()
        .split('\n')
        .map(p => cleanText(p))
        .filter(p => p.length > 0 && !p.startsWith('மன்றாட்டு:'));
    }

    // Extract Prayer
    let prayerText = '';
    if (bodies.length >= 3) {
      prayerText = cleanText($(bodies[2]).text());
    } else {
      container.find('*').each((_, el) => {
        const t = $(el).text().trim();
        if (t.includes('மன்றாட்டு:')) {
          const next = $(el).next();
          if (next.length) {
            prayerText = cleanText(next.text());
          }
        }
      });
    }

    if (prayerText) {
      prayerText = prayerText.replace(/^மன்றாட்டு\s*:\s*/, '').trim();
      if (prayerText.length > 0) {
        prayer = prayerText;
      }
    }
  } else {
    // Resilient fallback collecting siblings after the heading
    let current = headingEl.next();
    const collected = [];
    let isPrayer = false;

    while (current.length) {
      const tag = current.prop('tagName')?.toLowerCase();
      if (['footer', 'nav', 'header'].includes(tag)) break;
      if (['h1', 'h2', 'h3'].includes(tag) && !current.text().includes('மன்றாட்டு')) break;

      const clone = current.clone();
      clone.find('br').replaceWith('\n');
      const text = cleanText(clone.text());

      if (text.includes('மன்றாட்டு:')) {
        isPrayer = true;
        const remaining = text.replace(/^.*மன்றாட்டு\s*:\s*/, '').trim();
        if (remaining) prayer = remaining;
      } else if (isPrayer) {
        if (!prayer) prayer = text;
        else prayer += '\n' + text;
      } else if (text) {
        if (!scriptureQuote && (text.startsWith("''") || text.startsWith('“') || text.includes('('))) {
          scriptureQuote = text;
          title = text;
        } else {
          collected.push(text);
        }
      }

      current = current.next();
    }

    if (collected.length > 0) {
      paragraphs = collected;
    }
  }

  const reflectionText = paragraphs.join('\n\n');

  return {
    date: requestedDate,
    heading: 'இன்றைய சிந்தனை',
    title: title || scriptureQuote || 'இன்றைய சிந்தனை',
    scriptureQuote: scriptureQuote || title,
    reflection: reflectionText,
    paragraphs,
    prayer: prayer || null,
    sourceUrl,
    source: 'Tamil Catholic Daily',
    fetchedAt: new Date()
  };
}

/**
 * Validate extracted Daily Reflection
 * Logs in exact required format:
 * [TAMIL REFLECTION] Date: ... Source: ... Fetch: OK/FAILED Section: FOUND/MISSING Content length: ... Prayer: FOUND/MISSING Validation: PASS/FAILED
 */
function validateDailyReflection(parsed, requestedDate, sourceUrl, fetchSuccess = true) {
  const fetchStatus = fetchSuccess ? 'OK' : 'FAILED';
  const sectionStatus = (parsed && parsed.heading) ? 'FOUND' : 'MISSING';
  const contentLength = parsed?.reflection ? parsed.reflection.length : 0;
  const prayerStatus = (parsed && parsed.prayer) ? 'FOUND' : 'MISSING';

  let isValid = false;
  if (
    fetchSuccess &&
    parsed &&
    parsed.date === requestedDate &&
    parsed.reflection &&
    parsed.reflection.trim().length >= 80 &&
    parsed.paragraphs &&
    parsed.paragraphs.length >= 1
  ) {
    isValid = true;
  }

  const valStatus = isValid ? 'PASS' : 'FAILED';

  console.log(`[TAMIL REFLECTION] Date: ${requestedDate} Source: ${sourceUrl} Fetch: ${fetchStatus} Section: ${sectionStatus} Content length: ${contentLength} Prayer: ${prayerStatus} Validation: ${valStatus}`);

  return isValid;
}

/**
 * Fetch and store Daily Reflection for a specific date
 */
async function fetchAndStoreDailyReflection(dateStr) {
  const cleanDate = getIndiaDate(dateStr);
  const preferredUrl = await getDailyReflectionUrl(cleanDate);
  const fallbackUrl = DEFAULT_DAILY_REFLECTION_BASE_URL;

  console.log(`\n[TAMIL DAILY REFLECTION] Starting sync...`);
  console.log(`Date: ${cleanDate}`);
  console.log(`URL: ${preferredUrl}`);
  console.log(`Fetching source...`);

  let resData = null;
  let usedUrl = preferredUrl;
  let fetchError = null;

  try {
    const res = await axios.get(preferredUrl, {
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ta,en-US;q=0.9,en;q=0.8'
      },
      timeout: 12000
    });
    if (res.data) {
      resData = res.data;
    }
  } catch (err) {
    fetchError = err;
    console.warn(`[TAMIL DAILY REFLECTION] Preferred URL fetch failed (${err.message}). Trying fallback main URL: ${fallbackUrl}`);
  }

  // Fallback to main /dailyverse if preferred URL failed and cleanDate is today
  const todayKolkata = getIndiaDate(new Date());
  if (!resData && cleanDate === todayKolkata) {
    try {
      usedUrl = fallbackUrl;
      const resFallback = await axios.get(fallbackUrl, {
        httpsAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ta,en-US;q=0.9,en;q=0.8'
        },
        timeout: 12000
      });
      if (resFallback.data) {
        resData = resFallback.data;
      }
    } catch (err2) {
      console.warn(`[TAMIL DAILY REFLECTION] Fallback URL fetch also failed:`, err2.message);
    }
  }

  const sectionFound = !!(resData && resData.includes('இன்றைய சிந்தனை'));
  console.log(`Section found: ${sectionFound}`);

  const parsed = resData ? parseTamilReflectionHtml(resData, cleanDate, usedUrl) : null;
  const reflectionExtracted = !!(parsed && parsed.reflection && parsed.reflection.length > 0);
  const prayerExtracted = !!(parsed && parsed.prayer);
  const characters = parsed?.reflection ? parsed.reflection.length : 0;

  console.log(`Reflection extracted: ${reflectionExtracted}`);
  console.log(`Prayer extracted: ${prayerExtracted}`);
  console.log(`Characters: ${characters}`);

  const isValid = validateDailyReflection(parsed, cleanDate, usedUrl, !!resData);

  if (!isValid) {
    console.warn(`[TAMIL DAILY REFLECTION] Validation failed for ${cleanDate}. Valid cached reflection will NOT be overwritten.`);
    const existing = await DailyReflection.findOne({ date: cleanDate });
    if (existing) {
      console.log(`[TAMIL DAILY REFLECTION] Preserving existing valid reflection in database for ${cleanDate}.`);
      return existing;
    }
    throw new Error(`Tamil Daily Reflection validation failed for ${cleanDate}: scraping incomplete or source unavailable`);
  }

  // Upsert to DailyReflection collection
  const savedDoc = await DailyReflection.findOneAndUpdate(
    { date: cleanDate },
    {
      $set: {
        date: cleanDate,
        heading: parsed.heading || 'இன்றைய சிந்தனை',
        title: parsed.title,
        scriptureQuote: parsed.scriptureQuote,
        reflection: parsed.reflection,
        paragraphs: parsed.paragraphs,
        prayer: parsed.prayer,
        sourceUrl: usedUrl,
        source: 'Tamil Catholic Daily',
        fetchedAt: new Date(),
        active: true
      }
    },
    { upsert: true, new: true }
  );

  console.log(`Database update: SUCCESS`);
  console.log(`Active date: ${cleanDate}`);

  // Also sync to DailyMassReading.reflection if exists or when accessed
  try {
    const DailyMassReading = require('../models/DailyMassReading');
    await DailyMassReading.updateOne(
      { date: cleanDate },
      {
        $set: {
          reflection: {
            heading: parsed.heading || 'இன்றைய சிந்தனை',
            title: parsed.title,
            scriptureQuote: parsed.scriptureQuote,
            content: parsed.reflection,
            paragraphs: parsed.paragraphs,
            prayer: parsed.prayer || '',
            sourceUrl: usedUrl
          }
        }
      }
    );
  } catch (syncErr) {
    // Non-fatal if DailyMassReading doesn't exist yet
  }

  return savedDoc;
}

/**
 * Get Today's Reflection (or specific date) with reliable DB/cache-first strategy
 * 1. Determine date in Asia/Kolkata
 * 2. Return valid cached record if present
 * 3. If missing, fetch from source immediately, validate, save, and return
 */
async function getTodayReflection(targetDate = null) {
  const dateStr = getIndiaDate(targetDate || new Date());
  let doc = await DailyReflection.findOne({ date: dateStr, active: true }).lean();

  if (doc && doc.reflection && doc.reflection.length >= 80) {
    return doc;
  }

  // Not in DB or incomplete: fetch on-demand
  try {
    console.log(`[TAMIL DAILY REFLECTION] Reflection not in cache for ${dateStr}. Fetching immediately...`);
    const fetched = await fetchAndStoreDailyReflection(dateStr);
    return fetched.toObject ? fetched.toObject() : fetched;
  } catch (err) {
    console.warn(`[TAMIL DAILY REFLECTION] On-demand fetch failed for ${dateStr} (${err.message}). Checking latest available fallback...`);
    if (doc) return doc;
    // Fallback: return most recent active reflection in DB to avoid empty content
    const latest = await DailyReflection.findOne({ active: true }).sort({ date: -1 }).lean();
    return latest;
  }
}

/**
 * Synchronization function with automatic retry schedule (0, 5, 15, 30, 60 minutes)
 * Can be called manually for testing: syncDailyTamilReflection("2026-10-02")
 */
async function syncDailyTamilReflection(targetDate = null) {
  const dateStr = getIndiaDate(targetDate || new Date());

  const retryDelays = [0, 5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000];

  const attemptSync = async (attemptIndex = 0) => {
    try {
      return await fetchAndStoreDailyReflection(dateStr);
    } catch (err) {
      console.error(`[TAMIL DAILY REFLECTION] Attempt ${attemptIndex + 1} failed for ${dateStr}:`, err.message);
      if (attemptIndex + 1 < retryDelays.length) {
        const nextDelayMs = retryDelays[attemptIndex + 1];
        const nextDelayMins = Math.round(nextDelayMs / 60000);
        console.log(`[TAMIL DAILY REFLECTION] Scheduling automatic retry ${attemptIndex + 2} in ${nextDelayMins} minutes...`);
        setTimeout(() => {
          attemptSync(attemptIndex + 1).catch(e => console.error('[TAMIL DAILY REFLECTION] Retry error:', e.message));
        }, nextDelayMs);
      } else {
        console.error(`[TAMIL DAILY REFLECTION] All automatic retries exhausted for ${dateStr}. Preserving existing database reflection.`);
      }
      return null;
    }
  };

  return await attemptSync(0);
}

/**
 * Startup Safety Check:
 * When backend starts:
 * 1. Determine today's date in Asia/Kolkata
 * 2. Check whether today's reflection exists in DB/cache
 * 3. If missing: fetch immediately
 * 4. If exists: use cached version without unnecessary scraping
 */
async function startupSafetyCheck() {
  const todayKolkata = getIndiaDate(new Date());
  try {
    const existing = await DailyReflection.findOne({ date: todayKolkata });
    if (existing && existing.reflection && existing.reflection.length >= 80) {
      console.log(`[TAMIL DAILY REFLECTION] Startup safety: Found valid cached reflection for today (${todayKolkata}) in DB. Skipping redundant fetch.`);
      return existing;
    }

    console.log(`[TAMIL DAILY REFLECTION] Startup safety: Today's reflection missing in DB for ${todayKolkata}. Fetching from Tamil Catholic Daily...`);
    return await syncDailyTamilReflection(todayKolkata);
  } catch (err) {
    console.error(`[TAMIL DAILY REFLECTION] Startup safety check encountered error:`, err.message);
    return null;
  }
}

module.exports = {
  getIndiaDate,
  parseTamilReflectionHtml,
  validateDailyReflection,
  fetchAndStoreDailyReflection,
  getTodayReflection,
  syncDailyTamilReflection,
  startupSafetyCheck
};
