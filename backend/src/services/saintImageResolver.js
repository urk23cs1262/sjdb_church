const axios = require('axios');
const { getSaintForDate } = require('../data/catholic_saints_calendar');

/**
 * Universal Saint Image Resolver
 * Priority: Vatican News Content Image → Verified External Fallback Search → Liturgical Calendar → Placeholder
 */

const HTTP_HEADERS = {
  'User-Agent': 'SJDBChurchApp/1.0 (Catholic Parish Management; contact: info@sjdbchurch.org)',
  'Accept': 'application/json, text/html, */*'
};

/**
 * Clean saint name by removing prefixes and ecclesiastical titles for accurate search
 */
function cleanSaintName(name) {
  if (!name) return '';
  return name
    .replace(/^Sts?\.\s+/i, '')
    .replace(/^Saint\s+/i, '')
    .replace(/^Saints\s+/i, '')
    .replace(/,\s*(Pope|Bishop|Martyr|Priest|Doctor|Doctor of the Church|Virgin|Apostle|Confessor|Widow|Abbot|Deacon|Religious|King|Queen|Evangelist).*$/i, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
    if (width < 250 || height < 250) return false;
    const ratio = width / height;
    // Reject extreme panoramic banners (> 2.5) or narrow strips (< 0.4)
    if (ratio > 2.5 || ratio < 0.4) return false;
  }

  return true;
}

/**
 * Score candidate images based on saint name match, Catholic relevance, and resolution
 */
function scoreCandidate(candidate, rawSaintName) {
  let score = 0;
  const cleanName = cleanSaintName(rawSaintName).toLowerCase();
  const rawLower = rawSaintName.toLowerCase();
  const title = (candidate.title || '').toLowerCase();
  const desc = (candidate.description || candidate.extract || '').toLowerCase();
  const url = (candidate.url || '').toLowerCase();
  const text = `${title} ${desc} ${url}`;

  // 1. Direct name matching
  if (title.includes(cleanName)) {
    score += 60;
  } else if (text.includes(cleanName)) {
    score += 35;
  } else {
    // If neither title nor text contains the clean saint name, reject
    return -100;
  }

  // Exact title match bonus
  if (title === cleanName || title === `saint ${cleanName}` || title === `pope ${cleanName}`) {
    score += 30;
  }

  // 2. Catholic & Saint attributes
  if (text.includes('saint') || title.startsWith('saint ') || title.startsWith('st. ')) score += 25;
  if (rawLower.includes('pope') && text.includes('pope')) score += 30;
  if (rawLower.includes('bishop') && text.includes('bishop')) score += 20;
  if (rawLower.includes('martyr') && text.includes('martyr')) score += 20;
  if (rawLower.includes('apostle') && text.includes('apostle')) score += 20;
  if (text.includes('catholic') || text.includes('vatican') || text.includes('christian')) score += 20;
  if (text.includes('portrait') || text.includes('painting') || text.includes('icon') || text.includes('fresco') || text.includes('statue')) score += 20;

  // 3. Penalties for institutions, places, or events instead of the saint
  if (text.includes('disambiguation')) score -= 100;
  if (text.includes('society of') || text.includes('church in') || text.includes('parish') || text.includes('cathedral') || text.includes('basilica') || text.includes('archdiocese')) score -= 50;
  if (text.includes('order of') || text.includes('film') || text.includes('book') || text.includes('album') || text.includes('song')) score -= 40;
  if (url.includes('.svg') || url.includes('logo') || url.includes('coat_of_arms')) score -= 80;

  // 4. Resolution scoring
  const width = candidate.width || 0;
  const height = candidate.height || 0;
  if (width >= 800 && height >= 800) score += 20;
  else if (width >= 600 && height >= 600) score += 15;
  else if (width >= 400 && height >= 400) score += 10;

  // Portrait aspect ratio bonus (taller than wide or square)
  if (width > 0 && height > 0) {
    const ratio = width / height;
    if (ratio >= 0.6 && ratio <= 1.25) score += 15;
  }

  return score;
}

/**
 * Intelligent multi-query fallback search via Wikipedia REST & Wikimedia Commons APIs
 */
async function searchSaintFallback(saintName) {
  const cleanName = cleanSaintName(saintName);
  if (!cleanName) return null;

  const candidates = [];
  const seenUrls = new Set();

  const addCandidate = (c) => {
    if (!c || !c.url || seenUrls.has(c.url)) return;
    if (isValidImage(c)) {
      c.score = scoreCandidate(c, saintName);
      if (c.score >= 35) {
        seenUrls.add(c.url);
        candidates.push(c);
      }
    }
  };

  // 1. Direct Wikipedia Summary Lookup
  const directSlugs = [
    saintName.replace(/\s+/g, '_'),
    cleanName.replace(/\s+/g, '_'),
    `Saint_${cleanName.replace(/\s+/g, '_')}`,
    `Pope_${cleanName.replace(/\s+/g, '_')}`,
    `St._${cleanName.replace(/\s+/g, '_')}`
  ];

  for (const slug of directSlugs) {
    try {
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
      const res = await axios.get(summaryUrl, { headers: HTTP_HEADERS, timeout: 5000 });
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
            sourceType: 'wikipedia'
          });
        }
      }
    } catch (e) {
      // 404 or network skip
    }
  }

  // 2. Wikipedia MediaWiki Search
  const searchQueries = [
    `"${saintName}"`,
    `"${cleanName}" saint portrait`,
    `"Saint ${cleanName}"`,
    `"${cleanName}" icon`,
    `"${cleanName}" Catholic`
  ];

  for (const q of searchQueries) {
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
              sourceType: 'wikimedia'
            });
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // 3. Wikimedia Commons Direct File Search (if still no high-score candidate)
  if (candidates.length === 0 || Math.max(...candidates.map(c => c.score)) < 80) {
    try {
      const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`"${cleanName}" saint portrait OR icon`)}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1200&format=json&origin=*`;
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
              sourceType: 'commons'
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
    const best = candidates[0];
    return {
      url: best.url,
      source: 'fallback',
      sourceUrl: best.sourceUrl,
      fallback: true
    };
  }

  return null;
}

/**
 * Universal Master Resolver
 * Executes strict pipeline: Vatican News → Fallback Search → Liturgical Calendar → Placeholder
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

  // 2. Try Verified Fallback Search
  console.log(` Saint Image Resolver: No Vatican image found. Performing verified fallback search for "${saintName}"...`);
  try {
    const fallbackResult = await searchSaintFallback(saintName);
    if (fallbackResult && fallbackResult.url) {
      console.log(` Saint Image Resolver: Found high-quality verified portrait for "${saintName}" from ${fallbackResult.sourceUrl}`);
      return fallbackResult;
    }
  } catch (err) {
    console.error(' Saint Image Resolver: Fallback search encountered error:', err.message);
  }

  // 3. Liturgical Calendar Fallback (Only if names match to prevent cross-contamination)
  const calendarSaint = getSaintForDate(todayDate);
  const cleanTarget = cleanSaintName(saintName).toLowerCase();
  const cleanCal = cleanSaintName(calendarSaint?.name || '').toLowerCase();

  if (calendarSaint && calendarSaint.image && (cleanTarget === cleanCal || cleanTarget.includes(cleanCal) || cleanCal.includes(cleanTarget))) {
    console.log(` Saint Image Resolver: Using Catholic Liturgical Calendar preset image for "${saintName}"`);
    return {
      url: calendarSaint.image,
      source: 'liturgical_calendar',
      sourceUrl: calendarSaint.link || vaticanUrl,
      fallback: true
    };
  }

  // 4. Default Dignified Catholic Placeholder
  return {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Virgin_Mary_by_Giovanni_Battista_Salvi_da_Sassoferrato.jpg/500px-Virgin_Mary_by_Giovanni_Battista_Salvi_da_Sassoferrato.jpg',
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
  isValidImage,
  scoreCandidate
};
