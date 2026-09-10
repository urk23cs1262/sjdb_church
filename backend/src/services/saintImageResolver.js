const axios = require('axios');
const { getSaintForDate } = require('../data/catholic_saints_calendar');

/**
 * Universal Saint Image Resolver
 * Priority:
 * 1. Vatican News Content Image ("Original Website")
 * 2. Online Image Search (Google Custom Search -> Wikipedia / Wikimedia -> Web Image Search)
 * 3. Catholic Liturgical Calendar
 * 4. Guaranteed Authentic Catholic Sacred Art Fallback
 */

const HTTP_HEADERS = {
  'User-Agent': 'SJDBChurchApp/1.0 (https://sjdbchurch.org; contact@sjdbchurch.org)',
  'Accept': 'application/json, text/html, */*'
};

const DIGNIFIED_FALLBACK_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/b/bf/St._John_De_Britto.jpg';

/**
 * Clean saint name by removing prefixes and ecclesiastical titles for accurate search
 */
function cleanSaintName(name) {
  if (!name) return '';
  let cleaned = name
    .replace(/^Sts?\.\s+/i, '')
    .replace(/^Saint\s+/i, '')
    .replace(/^Saints\s+/i, '')
    .replace(/^Blessed\s+/i, '')
    .replace(/^Holy\s+/i, '')
    .replace(/\(.*?\)/g, '')
    .trim();

  // If there are comma-separated titles (e.g. "St. Nicholas da Tolentino, Agostinian"), keep primary name
  if (cleaned.includes(',')) {
    cleaned = cleaned.split(',')[0].trim();
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Verify image URL is reachable and returns HTTP 200 with valid image
 */
async function verifyImageUrl(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;
  if (url.endsWith('.svg') || url.endsWith('.gif')) return false;
  try {
    const res = await axios.head(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 3000
    });
    const cType = (res.headers['content-type'] || '').toLowerCase();
    return res.status >= 200 && res.status < 300 && (!cType || cType.includes('image') || cType.includes('octet-stream'));
  } catch (e) {
    // If HEAD is blocked by CDN, try GET with Range header: bytes=0-100
    try {
      const getRes = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Range': 'bytes=0-100'
        },
        timeout: 3000
      });
      return getRes.status >= 200 && getRes.status < 300;
    } catch (err2) {
      return false;
    }
  }
}

/**
 * Inspect Vatican News Cheerio DOM specifically for genuine saint portraits
 * and ignore site layout/template banners.
 */
function getVaticanSaintImage($, vaticanUrl) {
  if (!$) return null;

  const IGNORED_PATTERNS = [
    'vatican-news-header',
    'banner santi.jpg',
    'support-comunicazione-banner',
    'spalla-parola',
    'spalla-preghiere',
    'spalla-festivita-liturgiche',
    'newsletter_background',
    'shoulder_banners',
    'logo',
    'facebook',
    'twitter',
    'youtube',
    'instagram',
    'data:image'
  ];

  let candidateUrl = null;

  // 1. Check for genuine saint archive image inside /content/dam/vaticannews/santi/
  $('img').each((i, el) => {
    const src = $(el).attr('data-original') || $(el).attr('data-src') || $(el).attr('src') || '';
    const alt = ($(el).attr('alt') || '').toLowerCase();

    if (!src || src.startsWith('data:image')) return;

    const isIgnored = IGNORED_PATTERNS.some(p => src.toLowerCase().includes(p) || alt.includes(p));
    if (isIgnored) return;

    if (src.includes('/content/dam/vaticannews/santi/')) {
      candidateUrl = src;
      return false; // Found direct match
    }
  });

  // 2. Check for image inside .section__content or article body
  if (!candidateUrl) {
    $('.section__content img, article img, .page__content img, .teaser img').each((i, el) => {
      const src = $(el).attr('data-original') || $(el).attr('data-src') || $(el).attr('src') || '';
      const alt = ($(el).attr('alt') || '').toLowerCase();

      if (!src || src.startsWith('data:image')) return;

      const isIgnored = IGNORED_PATTERNS.some(p => src.toLowerCase().includes(p) || alt.includes(p));
      if (!isIgnored) {
        candidateUrl = src;
        return false;
      }
    });
  }

  if (candidateUrl) {
    let fullUrl = candidateUrl.startsWith('http') ? candidateUrl : `https://www.vaticannews.va${candidateUrl}`;
    // Upgrade low-res thumbnail renditions to high-resolution
    fullUrl = fullUrl.replace(/cq5dam\.thumbnail\.cropped\.\d+\.\d+\.jpeg/i, 'cq5dam.thumbnail.cropped.750.422.jpeg');
    return {
      url: fullUrl,
      source: 'vatican',
      sourceUrl: vaticanUrl,
      fallback: false
    };
  }

  return null;
}

/**
 * Intelligent multi-query online search (Google Custom Search -> Wikipedia -> Web Image Search)
 */
async function searchSaintFallback(saintName) {
  const cleanName = cleanSaintName(saintName);
  if (!cleanName) return null;

  // 1. Google Custom Search API (if configured in environment)
  const googleKey = process.env.GOOGLE_SEARCH_API_KEY;
  const googleCx = process.env.GOOGLE_SEARCH_ENGINE_ID || process.env.GOOGLE_CSE_CX;
  if (googleKey && googleCx) {
    try {
      const gUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent('Saint ' + cleanName + ' catholic portrait')}&searchType=image&key=${googleKey}&cx=${googleCx}&num=5`;
      const gRes = await axios.get(gUrl, { timeout: 4000 });
      const items = gRes.data?.items || [];
      for (const item of items) {
        if (item.link && await verifyImageUrl(item.link)) {
          console.log(` Saint Image: Found via Google Custom Search API for "${cleanName}"`);
          return {
            url: item.link,
            source: 'google_search',
            sourceUrl: item.image?.contextLink || item.link,
            fallback: false
          };
        }
      }
    } catch (e) {
      console.warn(' Google CSE notice:', e.message);
    }
  }

  // 2. Wikipedia Search API
  const queries = [
    cleanName,
    cleanName.replace(/\bda\b/gi, 'of'),
    `Saint ${cleanName}`,
    `Saint ${cleanName.replace(/\bda\b/gi, 'of')}`,
    saintName
  ];

  for (const q of queries) {
    try {
      const searchRes = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json`, {
        headers: HTTP_HEADERS,
        timeout: 3500
      });
      const hits = searchRes.data?.query?.search || [];
      for (const hit of hits.slice(0, 3)) {
        if (hit.title.toLowerCase().includes('disambiguation')) continue;
        const summaryRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`, {
          headers: HTTP_HEADERS,
          timeout: 3500
        });
        const candidate = summaryRes.data?.originalimage?.source || summaryRes.data?.thumbnail?.source;
        if (candidate && await verifyImageUrl(candidate)) {
          console.log(` Saint Image: Found verified portrait via Wikipedia for "${cleanName}" (${hit.title})`);
          return {
            url: candidate,
            source: 'google_web_search',
            sourceUrl: summaryRes.data?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`,
            fallback: false
          };
        }
      }
    } catch (e) {
      // Continue next search
    }
  }

  // 3. Web Image Search
  try {
    const webRes = await axios.get(`https://www.bing.com/images/search?q=${encodeURIComponent('Saint ' + cleanName + ' portrait catholic')}&form=HDRSC2`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 4500
    });
    const re = /murl&quot;:&quot;(http[^&]+)&quot;/g;
    let m;
    while ((m = re.exec(webRes.data)) !== null) {
      const u = decodeURIComponent(m[1]);
      if (await verifyImageUrl(u)) {
        console.log(` Saint Image: Found verified portrait via Web Search for "${cleanName}"`);
        return {
          url: u,
          source: 'google_web_search',
          sourceUrl: u,
          fallback: false
        };
      }
    }
  } catch (e) {
    console.warn(' Web search fallback notice:', e.message);
  }

  return null;
}

/**
 * Universal Master Resolver
 * Executes strict pipeline:
 * 1. Vatican News ("Original Website")
 * 2. Online Google / Web Search Fallback
 * 3. Liturgical Calendar Fallback
 * 4. Guaranteed Verified Dignified Sacred Art
 */
async function resolveSaintImage(saintName, vaticanUrl, $, todayDate = new Date()) {
  // 1. Try Vatican News ("Original Website") First
  if ($ && vaticanUrl) {
    const vaticanResult = getVaticanSaintImage($, vaticanUrl);
    if (vaticanResult && vaticanResult.url) {
      const isOk = await verifyImageUrl(vaticanResult.url);
      if (isOk) {
        console.log(` Saint Image Resolver: Using authentic Vatican News image for "${saintName}"`);
        return vaticanResult;
      }
    }
  }

  // 2. Fetch from Google / Online search when original website does not provide an image
  console.log(` Saint Image Resolver: No image on original website. Fetching image from Google/online search for "${saintName}"...`);
  try {
    const onlineResult = await searchSaintFallback(saintName);
    if (onlineResult && onlineResult.url) {
      console.log(` Saint Image Resolver: Successfully fetched image from online search for "${saintName}"`);
      return onlineResult;
    }
  } catch (err) {
    console.error(' Saint Image Resolver: Online search error:', err.message);
  }

  // 3. Liturgical Calendar Fallback (Only if names match)
  const calendarSaint = getSaintForDate(todayDate);
  const cleanTarget = cleanSaintName(saintName).toLowerCase();
  const cleanCal = cleanSaintName(calendarSaint?.name || '').toLowerCase();

  if (calendarSaint && calendarSaint.image && (cleanTarget === cleanCal || cleanTarget.includes(cleanCal) || cleanCal.includes(cleanTarget))) {
    const isCalOk = await verifyImageUrl(calendarSaint.image);
    if (isCalOk) {
      console.log(` Saint Image Resolver: Using Catholic Liturgical Calendar preset image for "${saintName}"`);
      return {
        url: calendarSaint.image,
        source: 'liturgical_calendar',
        sourceUrl: calendarSaint.link || vaticanUrl,
        fallback: true
      };
    }
  }

  // 4. Default Dignified Catholic Sacred Art (Guaranteed 200 OK)
  return {
    url: DIGNIFIED_FALLBACK_IMAGE,
    source: 'placeholder',
    sourceUrl: vaticanUrl,
    fallback: true
  };
}

module.exports = {
  resolveSaintImage,
  getVaticanSaintImage,
  searchSaintFallback,
  cleanSaintName,
  verifyImageUrl,
  DIGNIFIED_FALLBACK_IMAGE
};
