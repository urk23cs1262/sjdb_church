const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const { getSaintForDate } = require('../data/catholic_saints_calendar');
const { resolveSaintImage, verifyImageUrl, searchSaintFallback, cleanSaintName } = require('./saintImageResolver');

// ─── SOURCE CONFIGURATION ────────────────────────────────────────────────────
// Primary source: catholicreadings.org — date-specific URLs contain NO year,
// so they work automatically for 2027, 2028, and all future years.
const SAINT_OF_THE_DAY_URL = "https://catholicreadings.org/catholic-saint-of-the-day/";
const CATHOLIC_READINGS_BASE = "https://catholicreadings.org";

let dailySaint = null;

// ─── IST DATE HELPER ─────────────────────────────────────────────────────────

function getISTDateParts(targetDate = new Date()) {
  let dt;
  if (typeof targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    const [y, m, d] = targetDate.split('-').map(Number);
    dt = new Date(Date.UTC(y, m - 1, d, 6, 0, 0));
  } else {
    dt = targetDate instanceof Date ? targetDate : new Date(targetDate);
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).formatToParts(dt);

  const day = parts.find(p => p.type === 'day')?.value || '01';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const year = parts.find(p => p.type === 'year')?.value || '2026';
  const dateKey = `${year}-${month}-${day}`;

  return { dt, day, month, year, dateKey };
}

let retryTimeout = null;

// ─── PARISH PATRON SAINT (FEBRUARY 4) ───────────────────────────────────────

const ST_JOHN_DE_BRITTO = {
  name: "St. John de Britto (Patron Saint)",
  saintName: "St. John de Britto (Patron Saint)",
  englishName: "St. John de Britto (Patron Saint)",
  tamilName: "புனித அருளானந்தர் (ஜான் டி பிரி்ட்டோ )",
  nameTa: "புனித அருளானந்தர் (ஜான் டி பிரி்ட்டோ )",
  description: "St. John de Britto, also known as Arul Anandar, was a Portuguese Jesuit missionary and martyr. He was the first European to adopt the dress and lifestyle of a Pandarasamy (Hindu ascetic) to preach the Gospel in Tamil Nadu. He traveled extensively across the Madurai Mission, converting thousands to Christianity. He was arrested, tortured, and eventually beheaded for his faith in Kalayarkoil in 1693. Patron of our parish!",
  descriptionTa: "புனித அருளானந்தர் (ஜான் டி பிரி்ட்டோ) ஒரு போர்த்துகீசிய இயேசு சபை துறவி மற்றும் தியாகி ஆவார். இவர் தமிழ்நாட்டில் நற்செய்தியைப் போதிப்பதற்காக ஒரு இந்து சன்னியாசியின் ஆடை மற்றும் வாழ்க்கை முறையை ஏற்றுக்கொண்ட முதல் ஐரோப்பியர் ஆவார். மதுரை தூதுக்குழுவின் கீழ் விரிவாகப் பயணம் செய்து, ஆயிரக்கணக்கானோரை கிறிஸ்தவ விசுவாசத்திற்கு ஈர்த்தார். தனது விசுவாசத்திற்காகக் கைது செய்யப்பட்டு, சித்திரவதைக்கு உட்படுத்தப்பட்டு, இறுதியாக 1693 இல் கலையார்கோவிலில் மறைசாட்சியாக உயிர் நீத்தார். நமது ஆலயத்தின் பாதுகாவலர்!",
  image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/St._John_De_Britto.jpg/500px-St._John_De_Britto.jpg",
  imageSource: "parish_patron",
  imageSourceUrl: "https://www.catholic.org/saints/saint.php?saint_id=4025",
  imageFallback: false,
  feastDay: "February 4",
  source: "Parish Patron Feast",
  link: "https://www.catholic.org/saints/saint.php?saint_id=4025",
  sourceUrl: "https://www.catholic.org/saints/saint.php?saint_id=4025",
  updatedAt: new Date()
};

// ─── TEXT UTILITIES (UNCHANGED) ──────────────────────────────────────────────

function splitIntoSentences(text) {
  let temp = text
    .replace(/St\./g, 'St_TEMP_DOT')
    .replace(/St\u00a0/g, 'St_TEMP_SPACE')
    .replace(/Dr\./g, 'Dr_TEMP_DOT')
    .replace(/Mr\./g, 'Mr_TEMP_DOT')
    .replace(/Mrs\./g, 'Mrs_TEMP_DOT')
    .replace(/Fr\./g, 'Fr_TEMP_DOT');

  const sentences = temp.match(/[^.!?]+[.!?]+(\s|$)/g) || [temp];

  return sentences.map(s => s
    .replace(/St_TEMP_DOT/g, 'St.')
    .replace(/St_TEMP_SPACE/g, 'St.')
    .replace(/Dr_TEMP_DOT/g, 'Dr.')
    .replace(/Mr_TEMP_DOT/g, 'Mr.')
    .replace(/Mrs_TEMP_DOT/g, 'Mrs.')
    .replace(/Fr_TEMP_DOT/g, 'Fr.')
  );
}

const saintTranslationCache = new Map();

async function translateText(text, targetLang = 'ta') {
  if (!text || text.trim() === '') return '';
  const trimmed = text.trim();
  const cacheKey = `${targetLang}:${trimmed}`;

  if (saintTranslationCache.has(cacheKey)) {
    return saintTranslationCache.get(cacheKey);
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(trimmed)}`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (response.data && response.data[0]) {
      const translated = response.data[0].map(item => item[0]).join('').trim();
      if (translated) {
        saintTranslationCache.set(cacheKey, translated);
        return translated;
      }
    }
  } catch (error) {
    if (error.response?.status === 429) {
      console.warn(`[Saint Service] Google Translate rate-limit (429) — using untranslated fallback.`);
    } else {
      console.warn(`[Saint Service] Translation notice: ${error.message}`);
    }
  }
  return '';
}

/**
 * Fetch a brief verified biography extract from Wikipedia summary API
 */
async function fetchWikipediaSummary(saintName) {
  if (!saintName) return '';
  const cleanName = saintName
    .replace(/^Sts?\.\s+/i, '')
    .replace(/^Saint\s+/i, '')
    .replace(/,\s*(Pope|Bishop|Martyr|Priest|Doctor|Virgin|Apostle|Confessor|Widow|Abbot|Deacon|Religious|King|Queen|Evangelist|Member).*$/i, '')
    .replace(/\(.*?\)/g, '')
    .trim();

  const slugs = [
    saintName.replace(/\s+/g, '_'),
    cleanName.replace(/\s+/g, '_'),
    `Saint_${cleanName.replace(/\s+/g, '_')}`,
    `Pope_${cleanName.replace(/\s+/g, '_')}`
  ];

  for (const slug of slugs) {
    try {
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
      const res = await axios.get(summaryUrl, {
        headers: { 'User-Agent': 'SJDBChurchApp/1.0 (Catholic Parish Management; contact: stjdbchurch@gmail.com)' },
        timeout: 5000
      });
      if (res.data && res.data.extract && res.data.extract.length > 30) {
        const sentences = splitIntoSentences(res.data.extract);
        return sentences.slice(0, 3).join(' ').trim();
      }
    } catch (e) {
      // 404 or network skip — try next slug
    }
  }
  return '';
}

// ─── CATHOLIC READINGS ORG — 3-STEP FETCH PIPELINE ──────────────────────────

const MONTH_NAMES_LC = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache'
};

/**
 * Build the Catholic Readings date-specific URL.
 * Uses month name + day number only (NO year) — automatically valid for
 * any future year when catholicreadings.org publishes the content.
 *
 * Example: month='09', day='23'  →  /saint-of-the-day-for-september-23/
 * Example: month='02', day='29'  →  /saint-of-the-day-for-february-29/
 */
function buildCatholicReadingsDateUrl(month, day) {
  const monthIdx = parseInt(month, 10) - 1;
  const monthName = MONTH_NAMES_LC[monthIdx] || 'january';
  const dayNum = parseInt(day, 10); // strip leading zero (e.g. "03" → 3)
  return `${CATHOLIC_READINGS_BASE}/saint-of-the-day-for-${monthName}-${dayNum}/`;
}

/**
 * STEP 1 PARSER: Extract the primary saint name and detail URL from the
 * date-specific listing page (e.g. /saint-of-the-day-for-september-23/).
 *
 * Strategy 1: Find a link whose visible text contains the 👉 emoji.
 * Strategy 2: Parse og:description / meta description — catholicreadings.org
 *             reliably embeds "👉 Saint Name" in the page meta, even when the
 *             body uses a plain link. Extract the name and find its matching
 *             href from the page links.
 * Strategy 3: Fall back to the first content link pointing to a saint detail
 *             page (excluding nav/index/social links).
 *
 * Returns: { name, url } or null
 */
function extractPrimarySaintFromDatePage($, datePageUrl) {
  let primaryName = null;
  let primaryUrl = null;

  // Strategy 1 — 👉 emoji in visible link text
  $('a').each((i, el) => {
    const text = $(el).text().trim();
    if (!text.includes('👉')) return;

    const cleanName = text.replace(/👉\s*/gu, '').trim();
    const href = $(el).attr('href') || '';
    if (
      cleanName &&
      href &&
      href.startsWith('http') &&
      !href.includes('saint-of-the-day-for-') &&
      !href.includes('catholic-saint-of-the-day') &&
      !href.includes('whatsapp.com') &&
      !href.includes('twitter.com') &&
      !href.includes('facebook.com')
    ) {
      primaryName = cleanName;
      primaryUrl = href;
      return false; // break
    }
  });

  // Strategy 2 — Parse og:description or meta description for "👉 Saint Name"
  // catholicreadings.org always puts "👉 [Primary Saint Name]" in the page meta
  // even when the body links don't have the emoji directly attached.
  if (!primaryName) {
    const metaDesc = (
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      ''
    );
    const emojiMatch = metaDesc.match(/👉\s*([^👉\n\r]+)/u);
    if (emojiMatch) {
      // Extract the first saint name from the meta (stop at common delimiters)
      const rawMetaName = emojiMatch[1]
        .split(/[,|;–\n]/)[0]
        .replace(/\s*saint\s+john\s+francis\s+regis.*/i, '') // strip trailing saints
        .trim();

      if (rawMetaName && rawMetaName.length > 2) {
        // Clean up leading "St" vs "Saint" normalization for slug matching
        const metaNameLc = rawMetaName.toLowerCase()
          .replace(/^(sts?\.?\s+|saint\s+)/i, '')
          .replace(/[^a-z0-9\s]/g, '')
          .trim();

        // Find the matching link on the page by comparing slugified name to href slug
        $('a').each((i, el) => {
          const href = $(el).attr('href') || '';
          const linkText = $(el).text().replace(/\s+/g, ' ').trim();

          if (!href.startsWith(CATHOLIC_READINGS_BASE)) return;
          if (href.includes('saint-of-the-day-for-')) return;
          if (href.includes('catholic-saint-of-the-day')) return;
          if (href.includes('morning-prayer') || href.includes('verse-of-the-day')) return;
          if (href.includes('trivia-quiz') || href.includes('crossword')) return;

          // Check if URL slug contains key words from the meta name
          const hrefSlug = href.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
          const metaWords = metaNameLc.split(/\s+/).filter(w => w.length > 2);
          const matchScore = metaWords.filter(w => hrefSlug.includes(w)).length;

          if (matchScore >= 1 && matchScore >= Math.ceil(metaWords.length * 0.5)) {
            primaryName = linkText || rawMetaName;
            primaryUrl = href;
            return false; // break
          }
        });

        // If no URL matched, still use the meta name — we'll rely on fallback for URL
        if (!primaryName) {
          primaryName = rawMetaName;
          // primaryUrl stays null — caller will handle missing URL
        }
      }
    }
  }

  // Strategy 3 — first content link pointing to a saint detail page
  if (!primaryName) {
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().replace(/\s+/g, ' ').trim();

      if (!href.startsWith(CATHOLIC_READINGS_BASE)) return;
      if (href.includes('saint-of-the-day-for-')) return;
      if (href.includes('catholic-saint-of-the-day')) return;
      if (href.includes('morning-prayer')) return;
      if (href.includes('verse-of-the-day')) return;
      if (href.includes('trivia-quiz') || href.includes('crossword') || href.includes('roman-catholic-trivia')) return;
      if (!text || text.length < 3) return;
      // Reject very long text — site logo/banner anchor has composite text >120 chars
      if (text.length > 120) return;

      const lc = text.toLowerCase();
      if (lc.startsWith('other') || lc.includes('follow') || lc.includes('subscribe')) return;
      if (lc === 'home' || lc === 'saint of the day' || lc === 'morning prayer') return;
      if (lc.includes('catholic reading') || lc.includes('daily reading') || lc.includes('trivia')) return;

      primaryName = text;
      primaryUrl = href;
      return false; // break
    });
  }

  if (!primaryName) return null;

  // Strip any leading emoji/punctuation from the final name
  primaryName = primaryName.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}👉✅]+\s*/gu, '').trim();

  // If we have a name but no URL (meta-only match), return just the name — 
  // fetchDailySaint will attempt Wikipedia as the bio source instead
  if (!primaryUrl) {
    return { name: primaryName, url: null };
  }

  return { name: primaryName, url: primaryUrl };
}

/**
 * STEP 2 PARSER: Extract saint biography and image from an individual
 * saint detail page (e.g. /saint-pio-of-pietrelcina-padre-pio/).
 *
 * Returns: { name, description, imageUrl } or null
 */
function extractSaintDetailFromPage($, detailPageUrl) {
  // 1. Extract name
  let name = $('h1').first().text().trim();
  if (!name) {
    name = $('title').text().trim();
  }
  // Strip website clutter, date references, and trailing year suffixes
  name = name
    .replace(/\s*[-–—|]\s*Saint of the Day.*$/i, '')
    .replace(/\s*[-–—|]\s*Catholic Readings.*$/i, '')
    .replace(/\s+\d{4}\s*$/g, '')
    .trim();

  // 2. Extract biography paragraphs — user requirement: show at least 5 lines of content
  const BOILERPLATE = [
    'follow the catholic', 'translate to your', 'subscribe to receive',
    'powered by', 'related links', 'whatsapp channel', 'trivia quiz',
    'crossword puzzle', 'morning prayer', 'verse of the day', 'seo experts'
  ];

  const paragraphs = [];

  const articleSelectors = 'article p, .entry-content p, .post-content p, .wp-block-paragraph';
  $(articleSelectors).each((i, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!text || text.length < 30) return;
    if (BOILERPLATE.some(b => text.toLowerCase().includes(b))) return;
    paragraphs.push(text);
  });

  // Fallback: scan all <p> tags if article selectors yield nothing
  if (paragraphs.length === 0) {
    $('p').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (!text || text.length < 40) return;
      if (BOILERPLATE.some(b => text.toLowerCase().includes(b))) return;
      paragraphs.push(text);
    });
  }

  // Accumulate paragraphs until we reach at least 500 characters / multiple paragraphs for 5+ lines
  const selectedParas = [];
  let charCount = 0;
  for (const p of paragraphs) {
    selectedParas.push(p);
    charCount += p.length;
    if (selectedParas.length >= 2 && charCount >= 500) break;
    if (selectedParas.length >= 4) break;
  }
  const description = selectedParas.length > 0
    ? selectedParas.join('\n\n').trim()
    : paragraphs.slice(0, 3).join('\n\n').trim();

  // 3. Extract image
  let imageUrl = null;
  const IMG_IGNORE = [
    'logo', 'icon', 'banner', 'header', 'footer', 'nav',
    'whatsapp', 'twitter', 'facebook', 'instagram', 'youtube',
    'data:image', 'gravatar', 'avatar', 'spinner', 'loading',
    '50x50', '40x40', '30x30', '32x32', '16x16', '24x24', '48x48'
  ];

  $('img').each((i, el) => {
    if (imageUrl) return false;
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original') || '';
    const alt = ($(el).attr('alt') || '').toLowerCase();
    const cls = ($(el).attr('class') || '').toLowerCase();
    const srcLc = src.toLowerCase(); // case-insensitive filename matching

    if (!src || src.startsWith('data:')) return;

    const isIgnored = IMG_IGNORE.some(p =>
      srcLc.includes(p) || alt.includes(p) || cls.includes(p)
    );
    if (isIgnored) return;

    // Skip small icons — require at least 100px in each specified dimension
    const width = parseInt($(el).attr('width') || '0', 10);
    const height = parseInt($(el).attr('height') || '0', 10);
    if (width > 0 && width < 100) return;
    if (height > 0 && height < 100) return;

    let fullSrc = src;
    if (!fullSrc.startsWith('http')) {
      fullSrc = `${CATHOLIC_READINGS_BASE}${fullSrc.startsWith('/') ? '' : '/'}${fullSrc}`;
    }
    imageUrl = fullSrc.split('#')[0];
  });

  if (!name && !description) return null;
  return { name, description, imageUrl };
}

/**
 * 3-STEP FETCH: Retrieve today's saint from catholicreadings.org.
 *
 * Step 1 — Fetch /saint-of-the-day-for-{month-name}-{day}/
 *           Find primary saint link (👉 marker or first content link).
 *
 * Step 2 — Fetch /{saint-slug}/
 *           Extract name, biography, and image.
 *
 * Step 3 — Return { name, description, imageUrl, link, source } or null on failure.
 *
 * The URL has NO year component, so it works automatically for all future years.
 * If the source has not yet published the date, returns null gracefully.
 */
async function fetchFromCatholicReadings(month, day, dt) {
  const datePageUrl = buildCatholicReadingsDateUrl(month, day);
  const monthName = MONTH_NAMES_LC[parseInt(month, 10) - 1];
  const dayNum = parseInt(day, 10);

  try {
    // ── STEP 1: Date-specific listing page ───────────────────────────────────
    console.log(`[Saint Service] CatholicReadings Step 1 → ${datePageUrl}`);
    const datePageRes = await axios.get(datePageUrl, {
      headers: FETCH_HEADERS,
      timeout: 12000
    });

    if (datePageRes.status !== 200) {
      console.warn(`[Saint Service] CatholicReadings date page HTTP ${datePageRes.status}. Skipping.`);
      return null;
    }

    const $datePage = cheerio.load(datePageRes.data);

    // Soft validation: check page title mentions the expected month
    const pageTitle = $datePage('title').text().toLowerCase();
    const pageH = $datePage('h1, h2').first().text().toLowerCase();
    const combined = pageTitle + ' ' + pageH;
    if (!combined.includes(monthName)) {
      console.warn(`[Saint Service] CatholicReadings: title "${pageTitle.slice(0, 60)}" may not match ${monthName} ${dayNum}. Proceeding.`);
    }

    const primarySaint = extractPrimarySaintFromDatePage($datePage, datePageUrl);
    if (!primarySaint) {
      console.warn(`[Saint Service] CatholicReadings: No primary saint found on date page for ${monthName} ${dayNum}.`);
      return null;
    }

    console.log(`[Saint Service] CatholicReadings Step 1 ✓ "${primarySaint.name}" → ${primarySaint.url || '(name-only, no detail URL matched)'}`);

    // ── STEP 2: Individual saint detail page ─────────────────────────────────
    // Skip Step 2 if we only have a name from meta (no URL found for the detail page)
    if (!primarySaint.url) {
      console.log(`[Saint Service] CatholicReadings: Name extracted from meta only — "${primarySaint.name}". Using Wikipedia for bio.`);
      return { name: primarySaint.name, description: '', imageUrl: null, link: datePageUrl, source: 'catholicreadings.org' };
    }

    console.log(`[Saint Service] CatholicReadings Step 2 → ${primarySaint.url}`);
    let detailRes;
    try {
      detailRes = await axios.get(primarySaint.url, {
        headers: FETCH_HEADERS,
        timeout: 12000
      });
    } catch (detailErr) {
      console.warn(`[Saint Service] CatholicReadings detail page error: ${detailErr.message}. Using name only.`);
      return { name: primarySaint.name, description: '', imageUrl: null, link: primarySaint.url, source: 'catholicreadings.org' };
    }

    if (detailRes.status !== 200) {
      console.warn(`[Saint Service] CatholicReadings detail page HTTP ${detailRes.status}. Using name only.`);
      return { name: primarySaint.name, description: '', imageUrl: null, link: primarySaint.url, source: 'catholicreadings.org' };
    }

    const $detail = cheerio.load(detailRes.data);
    const saintDetail = extractSaintDetailFromPage($detail, primarySaint.url);

    if (!saintDetail) {
      console.warn(`[Saint Service] CatholicReadings: Detail extraction failed for ${primarySaint.url}. Using name only.`);
      return { name: primarySaint.name, description: '', imageUrl: null, link: primarySaint.url, source: 'catholicreadings.org' };
    }

    // Prefer the richer name between detail page and date page link text
    const resolvedName = (saintDetail.name && saintDetail.name.length > 3)
      ? saintDetail.name
      : primarySaint.name;

    console.log(`[Saint Service] CatholicReadings Step 2 ✓ name="${resolvedName}", bio=${saintDetail.description?.length || 0} chars, image=${saintDetail.imageUrl ? 'yes' : 'no'}`);

    // ── STEP 3: Return structured result ─────────────────────────────────────
    return {
      name: resolvedName,
      description: saintDetail.description || '',
      imageUrl: saintDetail.imageUrl || null,
      link: primarySaint.url,
      source: 'catholicreadings.org',
      datePageUrl
    };

  } catch (error) {
    if (error.response?.status === 404) {
      console.warn(`[Saint Service] CatholicReadings 404 — ${monthName} ${dayNum} not yet published. Will use fallback.`);
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      console.warn(`[Saint Service] CatholicReadings timeout (${monthName} ${dayNum}). Will use fallback.`);
    } else {
      console.warn(`[Saint Service] CatholicReadings error (${monthName} ${dayNum}): ${error.message}`);
    }
    return null;
  }
}

// ─── MAIN DAILY SAINT FETCH ──────────────────────────────────────────────────

/**
 * Fetch Saint of the Day for the current (or given) IST date.
 *
 * Priority:
 *   1. catholicreadings.org — 3-step pipeline (date listing → saint link → detail page)
 *   2. Wikipedia biography enhancement if bio is missing/short
 *   3. Catholic Liturgical Calendar (catholic_saints_calendar.js) local fallback
 *
 * Future-year compatible: URL uses only month name + day number (no year).
 * February 4 always returns the Parish Patron St. John de Britto.
 * Validates the fetched content belongs to the current date.
 * Never overwrites valid cached data with empty or mismatched content.
 */
async function fetchDailySaint(targetDate = new Date()) {
  let dt;
  if (typeof targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    const [y, m, d] = targetDate.split('-').map(Number);
    dt = new Date(Date.UTC(y, m - 1, d, 6, 0, 0));
  } else {
    dt = new Date(targetDate);
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).formatToParts(dt);

  const day = parts.find(p => p.type === 'day')?.value || '01';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const year = parts.find(p => p.type === 'year')?.value || '2026';
  const dateKey = `${year}-${month}-${day}`;

  // February 4 — Parish Patron Feast Day override
  if (month === '02' && day === '04') {
    dailySaint = {
      ...ST_JOHN_DE_BRITTO,
      date: dateKey,
      status: "Synced",
      lastSynced: new Date()
    };
    await saveSaintToDatabase(dailySaint);
    console.log(' Saint of the Day forced to Patron Saint St. John de Britto (Feb 4th)');
    return dailySaint;
  }

  const fallbackSaint = getSaintForDate(dateKey);
  const formattedFeastDay = dt.toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  let saintName = '';
  let description = '';
  let tamilName = '';
  let descriptionTa = '';
  let articleImg = null;
  let detailUrl = '';
  let usedCatholicReadings = false;

  // ── PRIMARY FETCH: catholicreadings.org ──────────────────────────────────
  console.log(`[Saint Service] Fetching Saint of the Day for ${dateKey} (IST) via catholicreadings.org...`);
  const crResult = await fetchFromCatholicReadings(month, day, dt);

  if (crResult) {
    usedCatholicReadings = true;
    saintName = crResult.name;
    detailUrl = crResult.link;
    articleImg = crResult.imageUrl || null;

    if (crResult.description && crResult.description.length >= 40) {
      // Sufficient biography directly from catholicreadings.org
      description = crResult.description;
    } else {
      // Biography absent or too short — enhance via Wikipedia
      console.log(`[Saint Service] CatholicReadings bio short (${crResult.description?.length || 0} chars) for "${saintName}". Fetching Wikipedia...`);
      const wikiBio = await fetchWikipediaSummary(saintName);
      if (wikiBio && wikiBio.length >= 30) {
        description = wikiBio;
        console.log(`[Saint Service] Wikipedia bio found for "${saintName}" (${wikiBio.length} chars).`);
      } else {
        // Check if the fetched saint name matches our local calendar entry
        const cleanFetched = saintName.toLowerCase().replace(/[^a-z]/g, '');
        const cleanFallback = fallbackSaint.name.toLowerCase().replace(/[^a-z]/g, '');
        if (cleanFetched.includes(cleanFallback) || cleanFallback.includes(cleanFetched)) {
          // Same saint — use local calendar description + Tamil translation
          description = fallbackSaint.description;
          tamilName = fallbackSaint.nameTa;
          descriptionTa = fallbackSaint.descriptionTa;
        } else {
          // Different saint, no Wikipedia bio — use whatever bio we have
          description = crResult.description || fallbackSaint.description;
        }
      }
    }
  } else {
    // ── FALLBACK: Catholic Liturgical Calendar ───────────────────────────────
    console.log(`[Saint Service] CatholicReadings unavailable. Using liturgical calendar fallback for ${dateKey}.`);
    saintName = fallbackSaint.name;
    description = fallbackSaint.description;
    tamilName = fallbackSaint.nameTa;
    descriptionTa = fallbackSaint.descriptionTa;
    detailUrl = fallbackSaint.link || SAINT_OF_THE_DAY_URL;
  }

  // ── IMAGE RESOLUTION ─────────────────────────────────────────────────────
  // User requirement: Fetch saint portrait from Google/online search by saint name
  // rather than using text-heavy or banner graphics from CatholicReadings.
  let imageResult = null;
  const cleanSearchName = cleanSaintName(saintName) || saintName;
  try {
    console.log(`[Saint Service] Fetching saint portrait via Google/online search for "${cleanSearchName}"...`);
    imageResult = await searchSaintFallback(cleanSearchName);
    if (imageResult && imageResult.url) {
      console.log(`[Saint Service] Google/online portrait found for "${cleanSearchName}": ${imageResult.url}`);
    }
  } catch (err) {
    console.warn(`[Saint Service] Google/online search error for "${cleanSearchName}":`, err.message);
  }

  // Backup 1: If online search found nothing, try article image if valid
  if (!imageResult && articleImg) {
    const isOk = await verifyImageUrl(articleImg);
    if (isOk) {
      imageResult = {
        url: articleImg,
        source: 'catholicreadings',
        sourceUrl: detailUrl || SAINT_OF_THE_DAY_URL,
        fallback: false
      };
    }
  }

  // Backup 2: Full fallback pipeline (calendar -> dignified portrait)
  if (!imageResult) {
    imageResult = await resolveSaintImage(saintName, detailUrl || SAINT_OF_THE_DAY_URL, null, dt);
  }

  // ── TAMIL TRANSLATION ────────────────────────────────────────────────────
  if (!tamilName) {
    const translated = await translateText(saintName);
    tamilName = translated || saintName;
  }
  if (!descriptionTa) {
    const translatedBio = await translateText(description);
    descriptionTa = translatedBio || description;
  }

  // ── BUILD & SAVE SAINT OBJECT ────────────────────────────────────────────
  dailySaint = {
    date: dateKey,
    saintName,
    englishName: saintName,
    tamilName: tamilName || saintName,
    name: saintName,
    nameTa: tamilName || saintName,
    description,
    descriptionTa: descriptionTa || description,
    image: imageResult.url,
    imageSource: imageResult.source,
    imageSourceUrl: imageResult.sourceUrl,
    imageFallback: imageResult.fallback,
    feastDay: formattedFeastDay,
    source: usedCatholicReadings
      ? "Catholic Readings / Catholic Liturgical Calendar"
      : "Catholic Liturgical Calendar",
    sourceUrl: detailUrl || SAINT_OF_THE_DAY_URL,
    link: detailUrl || SAINT_OF_THE_DAY_URL,
    status: "Synced",
    lastSynced: new Date()
  };

  await saveSaintToDatabase(dailySaint);
  console.log(` Saint of the Day synced (${dateKey}): ${saintName} [Source: ${dailySaint.source}] [Image: ${imageResult.source}]`);

  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }

  return dailySaint;
}

// ─── DATABASE CACHE ──────────────────────────────────────────────────────────

async function saveSaintToDatabase(saintObj) {
  try {
    if (!saintObj || !saintObj.date) return;
    // Validation guard: never overwrite cache with empty/invalid payload
    if (!saintObj.saintName || typeof saintObj.saintName !== 'string' || saintObj.saintName.trim().length < 2) {
      console.warn('⚠️ [SaintService] Refusing to overwrite cache with empty/invalid saint payload.');
      return;
    }
    const SiteSettings = require('../models/SiteSettings');
    await SiteSettings.findOneAndUpdate(
      { key: 'daily_saint_cache' },
      { value: JSON.stringify(saintObj), label: 'Daily Saint Cache', type: 'text' },
      { upsert: true, new: true }
    );
    await SiteSettings.findOneAndUpdate(
      { key: `daily_saint_cache_${saintObj.date}` },
      { value: JSON.stringify(saintObj), label: `Daily Saint Cache for ${saintObj.date}`, type: 'text' },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('Failed to save daily saint cache to database:', err.message);
  }
}

async function loadCachedSaint() {
  try {
    const SiteSettings = require('../models/SiteSettings');
    const { dateKey, dt } = getISTDateParts();
    const todayStr = dateKey;

    let cacheSetting = await SiteSettings.findOne({ key: `daily_saint_cache_${dateKey}` }).lean();
    if (!cacheSetting) {
      cacheSetting = await SiteSettings.findOne({ key: 'daily_saint_cache' }).lean();
    }

    if (cacheSetting && cacheSetting.value) {
      const parsed = JSON.parse(cacheSetting.value);
      const isBrokenVirginMary = parsed.image && parsed.image.includes('Virgin_Mary_by_Giovanni_Battista_Salvi_da_Sassoferrato');
      // Valid cache: matches today's date AND has a valid image
      if (parsed && parsed.date === todayStr && (parsed.saintName || parsed.name) && parsed.image && !isBrokenVirginMary) {
        dailySaint = parsed;
        if (dailySaint.lastSynced) {
          dailySaint.lastSynced = new Date(dailySaint.lastSynced);
        }
        console.log(" Loaded today's daily saint from database cache:", dailySaint.saintName || dailySaint.name);
        return;
      }
    }

    // No valid cache — set a calendar fallback while the live fetch runs
    const fallbackSaint = getSaintForDate(dateKey);
    dailySaint = {
      date: todayStr,
      saintName: fallbackSaint.name,
      englishName: fallbackSaint.name,
      tamilName: fallbackSaint.nameTa,
      name: fallbackSaint.name,
      nameTa: fallbackSaint.nameTa,
      description: fallbackSaint.description,
      descriptionTa: fallbackSaint.descriptionTa,
      image: fallbackSaint.image,
      imageSource: "liturgical_calendar",
      imageSourceUrl: fallbackSaint.link,
      imageFallback: true,
      feastDay: dt.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'long', day: 'numeric' }),
      source: "Catholic Liturgical Calendar",
      sourceUrl: SAINT_OF_THE_DAY_URL,
      link: fallbackSaint.link,
      status: "Synced",
      lastSynced: new Date()
    };
  } catch (err) {
    console.error('Failed to load daily saint cache from database:', err.message);
  }
}

// ─── STARTUP: Load cache then trigger live fetch ─────────────────────────────
loadCachedSaint().then(() => {
  fetchDailySaint();
});

// ─── 12:00 AM IST DAILY SYNC CRON ────────────────────────────────────────────
cron.schedule('0 0 * * *', async () => {
  const { dateKey } = getISTDateParts();
  console.log(`🔄 [CRON 12:00 AM IST] Updating Saint of the Day for ${dateKey} (catholicreadings.org)...`);
  dailySaint = null; // Invalidate previous day in memory immediately
  try {
    await fetchDailySaint();
    console.log(`✅ [CRON 12:00 AM IST] Saint of the Day synchronized for ${dateKey}`);
  } catch (err) {
    console.error(`❌ [CRON 12:00 AM IST] Saint sync failed for ${dateKey}:`, err.message);
  }
}, {
  timezone: 'Asia/Kolkata'
});

// ─── ADMIN: Search and apply a saint image manually ──────────────────────────
async function searchAndApplySaintImage(saintName) {
  if (!saintName) return null;
  const { searchSaintFallback } = require('./saintImageResolver');
  const found = await searchSaintFallback(saintName);
  if (found && found.url) {
    if (dailySaint) {
      dailySaint.image = found.url;
      dailySaint.imageSource = found.source || 'google_web_search';
      dailySaint.imageSourceUrl = found.sourceUrl;
      dailySaint.imageFallback = false;
      await saveSaintToDatabase(dailySaint);
    }
    return found;
  }
  return null;
}

// ─── SYNCHRONOUS GETTER (used by controllers) ────────────────────────────────
const getDailySaint = (targetDate = new Date()) => {
  const { dateKey, dt } = getISTDateParts(targetDate);
  const todayStr = dateKey;

  if (!dailySaint || dailySaint.date !== todayStr) {
    const fallbackSaint = getSaintForDate(dateKey);
    dailySaint = {
      date: todayStr,
      saintName: fallbackSaint.name,
      englishName: fallbackSaint.name,
      tamilName: fallbackSaint.nameTa,
      name: fallbackSaint.name,
      nameTa: fallbackSaint.nameTa,
      description: fallbackSaint.description,
      descriptionTa: fallbackSaint.descriptionTa,
      image: fallbackSaint.image,
      imageSource: "liturgical_calendar",
      imageSourceUrl: fallbackSaint.link,
      imageFallback: true,
      feastDay: dt.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'long', day: 'numeric' }),
      source: "Catholic Liturgical Calendar",
      sourceUrl: SAINT_OF_THE_DAY_URL,
      link: fallbackSaint.link,
      status: "Synced",
      lastSynced: new Date()
    };
  }
  return dailySaint;
};

module.exports = { getDailySaint, fetchDailySaint, searchAndApplySaintImage, getISTDateParts, saveSaintToDatabase };
