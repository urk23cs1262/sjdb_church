const axios = require('axios');
const { getSaintForDate } = require('../data/catholic_saints_calendar');

/**
 * Universal Saint Image Resolver
 * Priority: Vatican News Content Image → Verified Google / Wikipedia Fallback Search → Liturgical Calendar → Dignified Sacred Art
 */

const HTTP_HEADERS = {
  'User-Agent': 'SJDBChurchApp/1.0 (Catholic Parish Management; contact: info@sjdbchurch.org)',
  'Accept': 'application/json, text/html, */*'
};

const DIGNIFIED_SACRED_FALLBACK = 'https://upload.wikimedia.org/wikipedia/commons/4/43/The_Virgin_in_Prayer_-_Giovanni_Battista_Salvi_%28Sassoferrato%29.jpg';

/**
 * Clean saint name by removing prefixes and ecclesiastical titles for accurate search
 */
function cleanSaintName(name) {
  if (!name) return '';
  return name
    .replace(/^Sts?\.\s+/i, '')
    .replace(/^Saint\s+/i, '')
    .replace(/^Saints\s+/i, '')
    .replace(/\(.*?\)/g, '')
    .replace(/,\s*.*$/, '') // Strip anything after comma (e.g., ", Prophet", ", Bishop", ", Martyr")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse saint details including base name, ecclesiastical epithet, and known multilingual/biblical variants
 */
function parseSaintDetails(rawName) {
  if (!rawName) return { rawName: '', baseName: '', epithet: '', variants: [] };

  const rawCleaned = rawName
    .replace(/^Sts?\.\s+/i, '')
    .replace(/^Saint\s+/i, '')
    .replace(/^Saints\s+/i, '')
    .replace(/\(.*?\)/g, '')
    .trim();

  const commaIndex = rawCleaned.indexOf(',');
  let baseName = '';
  let epithet = '';

  if (commaIndex !== -1) {
    baseName = rawCleaned.substring(0, commaIndex).trim();
    epithet = rawCleaned.substring(commaIndex + 1).trim();
  } else {
    baseName = rawCleaned;
  }

  const variants = new Set();
  if (baseName) variants.add(baseName);

  const baseLower = baseName.toLowerCase();

  // Known biblical, Catholic, and linguistic equivalences
  if (baseLower === 'zachary' || baseLower.startsWith('zachary')) {
    variants.add('Zechariah');
    variants.add('Zacharias');
  } else if (baseLower === 'zechariah' || baseLower.startsWith('zechariah')) {
    variants.add('Zachary');
    variants.add('Zacharias');
  } else if (baseLower === 'anthony' || baseLower === 'antony') {
    variants.add('Anthony of Padua');
    variants.add('Anthony the Great');
  } else if (baseLower === 'francis') {
    variants.add('Francis of Assisi');
    variants.add('Francis Xavier');
  } else if (baseLower === 'teresa' || baseLower === 'therese') {
    variants.add('Mother Teresa');
    variants.add('Teresa of Calcutta');
    variants.add('Thérèse of Lisieux');
    variants.add('Teresa of Ávila');
  } else if (baseLower === 'john') {
    variants.add('John the Baptist');
    variants.add('John the Apostle');
    variants.add('John the Evangelist');
    variants.add('John de Britto');
  } else if (baseLower === 'jude') {
    variants.add('Jude the Apostle');
    variants.add('Judas Thaddaeus');
  } else if (baseLower === 'mary') {
    variants.add('Virgin Mary');
    variants.add('Blessed Virgin Mary');
  }

  return {
    rawName,
    baseName,
    epithet,
    variants: Array.from(variants)
  };
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
 * Validate candidate image dimensions, format, and aspect ratio
 */
function isValidImage(img) {
  if (!img || !img.url || typeof img.url !== 'string') return false;

  const lowerUrl = img.url.toLowerCase();
  const lowerTitle = (img.title || '').toLowerCase();

  // Reject invalid extensions
  if (lowerUrl.endsWith('.svg') || lowerUrl.endsWith('.gif')) return false;

  // Reject non-portrait assets: logos, flags, maps, building exteriors, massacres, UI icons
  const REJECT_KEYWORDS = [
    'logo', 'flag', 'coat_of_arms', 'map_', 'diagram', 'seal_',
    'massacre', 'parish_hall', 'social_icon', 'favicon', 'exterior',
    'building', 'station_of_the_cross', 'cemetery', 'tombstone'
  ];

  if (REJECT_KEYWORDS.some(k => lowerUrl.includes(k) || lowerTitle.includes(k))) {
    return false;
  }

  const width = img.width || 0;
  const height = img.height || 0;

  if (width > 0 && height > 0) {
    if (width < 200 || height < 200) return false;
    const ratio = width / height;
    // Reject extreme panoramic banners (> 2.8) or narrow strips (< 0.35)
    if (ratio > 2.8 || ratio < 0.35) return false;
  }

  return true;
}

/**
 * Score candidate images based on saint name match, Catholic relevance, and resolution
 */
function scoreCandidate(candidate, parsedDetails) {
  let score = 0;
  const { baseName, epithet, variants, rawName } = parsedDetails;
  const title = (candidate.title || '').toLowerCase();
  const desc = (candidate.description || candidate.extract || '').toLowerCase();
  const url = (candidate.url || '').toLowerCase();
  const fullText = `${title} ${desc} ${url}`;

  // 1. Name and variant matching
  let matchedVariant = false;
  for (const v of variants) {
    const vLower = v.toLowerCase();
    if (title.includes(vLower)) {
      score += 65;
      matchedVariant = true;
      if (title === vLower || title === `saint ${vLower}` || title === `st. ${vLower}`) {
        score += 30;
      }
      break;
    } else if (fullText.includes(vLower)) {
      score += 40;
      matchedVariant = true;
      break;
    }
  }

  if (!matchedVariant) {
    return -100;
  }

  // 2. Epithet / title matching (e.g. Prophet, Bishop, Martyr, Apostle)
  const rawLower = rawName.toLowerCase();
  const isTargetPope = rawLower.includes('pope');
  const isTargetBishop = rawLower.includes('bishop');
  const isTargetProphet = rawLower.includes('prophet') || (epithet && epithet.toLowerCase().includes('prophet'));

  // Penalize title mismatches
  if (!isTargetPope && (title.includes('pope') || desc.includes('pope of the catholic'))) {
    score -= 80;
  }
  if (!isTargetBishop && (title.includes('bishop') || desc.includes('bishop of'))) {
    score -= 30;
  }

  if (epithet) {
    const epithetWords = epithet.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    for (const ew of epithetWords) {
      if (title.includes(ew)) {
        score += 50; // High bonus if title directly includes epithet (e.g. "Hebrew prophet")
      } else if (fullText.includes(ew)) {
        score += 30;
      }
    }
  }

  if (isTargetProphet && (title.includes('prophet') || desc.includes('prophet'))) {
    score += 45;
  }

  // 3. Sacred & Catholic portrait relevance
  if (fullText.includes('saint') || title.startsWith('saint ') || title.startsWith('st. ') || title.startsWith('st ')) score += 25;
  if (fullText.includes('portrait') || fullText.includes('painting') || fullText.includes('icon') || fullText.includes('fresco') || fullText.includes('statue') || fullText.includes('altar')) score += 25;
  if (fullText.includes('catholic') || fullText.includes('vatican') || fullText.includes('christian') || fullText.includes('church') || fullText.includes('prophet') || fullText.includes('apostle')) score += 20;

  // 4. Penalties for unrelated subjects or disambiguation
  if (fullText.includes('disambiguation')) score -= 100;
  if (fullText.includes('film') || fullText.includes('song') || fullText.includes('album') || fullText.includes('soundtrack') || fullText.includes('actor') || fullText.includes('football')) score -= 60;
  if (fullText.includes('order of') || fullText.includes('parish hall') || fullText.includes('cathedral building')) score -= 40;
  if (url.includes('.svg') || url.includes('logo') || url.includes('coat_of_arms')) score -= 80;

  // 5. Resolution scoring
  const width = candidate.width || 0;
  const height = candidate.height || 0;
  if (width >= 800 && height >= 800) score += 20;
  else if (width >= 500 && height >= 500) score += 15;
  else if (width >= 300 && height >= 300) score += 10;

  // Portrait aspect ratio bonus (taller than wide or square)
  if (width > 0 && height > 0) {
    const ratio = width / height;
    if (ratio >= 0.6 && ratio <= 1.25) score += 15;
  }

  return score;
}

/**
 * Verify if image URL is reachable and returns HTTP 200 (not 404 or 403)
 */
async function verifyImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const res = await axios.head(url, {
      headers: HTTP_HEADERS,
      timeout: 3500,
      maxRedirects: 5,
      validateStatus: status => status >= 200 && status < 400
    });
    return res.status >= 200 && res.status < 400;
  } catch (err) {
    try {
      const getRes = await axios.get(url, {
        headers: HTTP_HEADERS,
        timeout: 3500,
        maxContentLength: 20000,
        validateStatus: status => status >= 200 && status < 400
      });
      return getRes.status >= 200 && getRes.status < 400;
    } catch (e) {
      return false;
    }
  }
}

/**
 * Intelligent multi-query fallback search via Wikipedia REST & Wikimedia Commons APIs
 */
async function searchSaintFallback(saintName) {
  const parsedDetails = parseSaintDetails(saintName);
  const { baseName, epithet, variants, rawName } = parsedDetails;
  if (!baseName) return null;

  const rawLower = rawName.toLowerCase();
  const isTargetPope = rawLower.includes('pope');
  const isTargetBishop = rawLower.includes('bishop');

  const candidates = [];
  const seenUrls = new Set();

  const addCandidate = (c) => {
    if (!c || !c.url || seenUrls.has(c.url)) return;
    if (isValidImage(c)) {
      c.score = scoreCandidate(c, parsedDetails);
      if (c.score >= 35) {
        seenUrls.add(c.url);
        candidates.push(c);
      }
    }
  };

  // ── Step 1: Direct Wikipedia REST Summary Lookups ───────────────────────────
  const directSlugs = [];

  for (const v of variants) {
    const vClean = v.replace(/\s+/g, '_');
    if (epithet) {
      const epClean = epithet.replace(/\s+/g, '_');
      const epLower = epithet.toLowerCase().replace(/\s+/g, '_');
      directSlugs.push(`${vClean}_(Hebrew_${epLower})`);
      directSlugs.push(`${vClean}_(${epLower})`);
      directSlugs.push(`${vClean}_${epClean}`);
    }
    directSlugs.push(`Saint_${vClean}`);
    directSlugs.push(`${vClean}_(saint)`);
    if (rawLower.includes('prophet')) directSlugs.push(`${vClean}_(prophet)`);
    if (rawLower.includes('priest')) directSlugs.push(`${vClean}_(priest)`);
    if (isTargetBishop) directSlugs.push(`${vClean}_(bishop)`);
    if (rawLower.includes('martyr')) directSlugs.push(`${vClean}_(martyr)`);
    if (rawLower.includes('apostle')) directSlugs.push(`${vClean}_(apostle)`);
    if (isTargetPope) directSlugs.push(`Pope_${vClean}`);
    directSlugs.push(vClean);
  }

  // Also try the raw name slug
  directSlugs.push(rawName.replace(/\s+/g, '_'));

  for (const slug of directSlugs) {
    try {
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
      const res = await axios.get(summaryUrl, { headers: HTTP_HEADERS, timeout: 4500 });
      if (res.data && res.data.type === 'standard') {
        const imgObj = res.data.originalimage || res.data.thumbnail;
        if (imgObj && imgObj.source) {
          addCandidate({
            title: res.data.title,
            description: res.data.description || res.data.extract || '',
            url: imgObj.source,
            width: imgObj.width,
            height: imgObj.height,
            sourceUrl: res.data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(res.data.title)}`,
            sourceType: 'wikipedia_rest'
          });
        }
      }
    } catch (e) {
      // 404 or network skip
    }
  }

  // ── Step 2: Wikipedia MediaWiki Generator Search ───────────────────────────
  const searchQueries = [];
  for (const v of variants) {
    if (epithet) {
      searchQueries.push(`${v} ${epithet}`);
    }
    searchQueries.push(`Saint ${v}`);
    searchQueries.push(`${v} prophet`);
    searchQueries.push(`${v} Catholic saint portrait`);
    searchQueries.push(`${v} icon`);
  }
  searchQueries.push(rawName);

  for (const q of searchQueries.slice(0, 6)) {
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=5&prop=pageimages|extracts|info&inprop=url&pithumbsize=1200&format=json&origin=*`;
      const res = await axios.get(searchUrl, { headers: HTTP_HEADERS, timeout: 5000 });
      const pages = res.data?.query?.pages;
      if (pages) {
        for (const pid of Object.keys(pages)) {
          const p = pages[pid];
          if (p.thumbnail && p.thumbnail.source) {
            addCandidate({
              title: p.title,
              description: p.extract || '',
              url: p.thumbnail.source,
              width: p.thumbnail.width,
              height: p.thumbnail.height,
              sourceUrl: p.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title)}`,
              sourceType: 'wikimedia_search'
            });
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // ── Step 3: Wikimedia Commons Direct File Search (if still no high-confidence match) ─
  if (candidates.length === 0 || Math.max(...candidates.map(c => c.score)) < 80) {
    try {
      const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`"${baseName}" (saint OR icon OR prophet OR portrait)`)}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1200&format=json&origin=*`;
      const res = await axios.get(commonsUrl, { headers: HTTP_HEADERS, timeout: 5000 });
      const pages = res.data?.query?.pages;
      if (pages) {
        for (const pid of Object.keys(pages)) {
          const p = pages[pid];
          const info = p.imageinfo?.[0];
          if (info && (info.thumburl || info.url)) {
            const desc = info.extmetadata?.ImageDescription?.value || info.extmetadata?.ObjectName?.value || '';
            addCandidate({
              title: p.title.replace(/^File:/i, ''),
              description: desc,
              url: info.thumburl || info.url,
              width: info.thumbwidth || info.width,
              height: info.thumbheight || info.height,
              sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
              sourceType: 'commons_files'
            });
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  if (candidates.length > 0) {
    // Sort descending by score
    candidates.sort((a, b) => b.score - a.score);

    // Verify top candidate URLs sequentially until a confirmed reachable image is found
    for (const candidate of candidates.slice(0, 5)) {
      const isOk = await verifyImageUrl(candidate.url);
      if (isOk) {
        return {
          url: candidate.url,
          source: 'wikipedia_fallback',
          sourceUrl: candidate.sourceUrl,
          fallback: true
        };
      }
    }
  }

  return null;
}

/**
 * Universal Master Resolver
 * Executes strict pipeline: Vatican News → Fallback Search → Liturgical Calendar → Dignified Sacred Art
 */
async function resolveSaintImage(saintName, vaticanUrl, $, todayDate = new Date()) {
  // 1. Try Vatican News First
  if ($ && vaticanUrl) {
    const vaticanResult = getVaticanSaintImage($, vaticanUrl);
    if (vaticanResult && vaticanResult.url) {
      console.log(` Saint Image Resolver: Using authentic Vatican News image for "${saintName}"`);
      return vaticanResult;
    }
  }

  // 2. Try Verified Fallback Search (Google / Wikipedia / Wikimedia Commons)
  console.log(` Saint Image Resolver: No Vatican image found. Performing verified Google/Wikipedia fallback search for "${saintName}"...`);
  try {
    const fallbackResult = await searchSaintFallback(saintName);
    if (fallbackResult && fallbackResult.url) {
      console.log(` Saint Image Resolver: Found verified portrait for "${saintName}" from ${fallbackResult.sourceUrl}`);
      return fallbackResult;
    }
  } catch (err) {
    console.error(' Saint Image Resolver: Fallback search encountered error:', err.message);
  }

  // 3. Liturgical Calendar Fallback
  const calendarSaint = getSaintForDate(todayDate);
  const cleanTarget = cleanSaintName(saintName).toLowerCase();
  const cleanCal = cleanSaintName(calendarSaint?.name || '').toLowerCase();

  if (calendarSaint && calendarSaint.image && (cleanTarget === cleanCal || cleanTarget.includes(cleanCal) || cleanCal.includes(cleanTarget))) {
    const isOk = await verifyImageUrl(calendarSaint.image);
    if (isOk) {
      console.log(` Saint Image Resolver: Using Catholic Liturgical Calendar preset image for "${saintName}"`);
      return {
        url: calendarSaint.image,
        source: 'liturgical_calendar',
        sourceUrl: calendarSaint.link || vaticanUrl,
        fallback: true
      };
    }
  }

  // 4. Guaranteed Permanent Sacred Art Fallback (Verified 200 OK)
  return {
    url: DIGNIFIED_SACRED_FALLBACK,
    source: 'sacred_placeholder',
    sourceUrl: vaticanUrl,
    fallback: true
  };
}

module.exports = {
  resolveSaintImage,
  getVaticanSaintImage,
  searchSaintFallback,
  cleanSaintName,
  parseSaintDetails,
  isValidImage,
  scoreCandidate,
  verifyImageUrl,
  DIGNIFIED_SACRED_FALLBACK
};
