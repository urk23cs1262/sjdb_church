const axios = require('axios');
const { getSaintForDate } = require('../data/catholic_saints_calendar');

/**
 * Universal Saint Image Resolver
 * Priority:
 * 1. Vatican News Official Saint Image ("Original Website")
 * 2. Wikipedia Official Search & Summary API (Identity-Validated Saint Portrait)
 * 3. Online Image Search (Google Custom Search / Web Search)
 * 4. Catholic Liturgical Calendar Fallback
 * 5. Guaranteed Authentic Catholic Sacred Art (St. John de Britto)
 */

const HTTP_HEADERS = {
  'User-Agent': 'SJDBChurchApp/1.0 (Catholic Parish Management; contact: stjdbchurch@gmail.com)',
  'Accept': 'application/json, text/html, */*'
};

const DIGNIFIED_FALLBACK_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/b/bf/St._John_De_Britto.jpg';

const CHRISTIAN_SAINT_KEYWORDS = [
  'saint', 'catholic', 'christian', 'priest', 'monk', 'martyr', 'pope',
  'bishop', 'friar', 'nun', 'abbess', 'virgin', 'deacon', 'apostle',
  'hermit', 'church', 'religious', 'blessed', 'venerated', 'canonized',
  'beatified', 'feast', 'mother of god', 'virgin mary', 'jesuit',
  'franciscan', 'dominican', 'benedictine', 'carmelite', 'missionary',
  'ascetic', 'theologian', 'mystic', 'stigmata', 'padre', 'patriarch',
  'evangelist', 'disciple', 'presbyter', 'cardinal', 'archbishop'
];

const UNRELATED_KEYWORDS = [
  'cathedral', 'church in', 'basilica', 'monument', 'shrine in', 'chapel',
  'football', 'cricket', 'baseball', 'basketball', 'politician',
  'album', 'song', 'film', 'movie', 'actor', 'actress', 'television',
  'municipality', 'commune', 'city in', 'town in', 'village in',
  'province', 'railway', 'airport', 'company', 'corporation', 'school',
  'high school', 'university', 'stadium', 'district', 'county'
];

/**
 * Clean saint name by removing prefixes, titles, and clerical designations for accurate search
 */
function cleanSaintName(name) {
  if (!name) return '';
  let cleaned = name
    .replace(/\s*[-–—|]\s*Saint of the Day.*$/i, '')
    .replace(/\s*[-–—|]\s*Vatican News.*$/i, '')
    .replace(/\s+\d{4}\s*$/g, '')
    .replace(/^(Parish Patron Feast|Feast|Solemnity|Memorial)\s+of\s+/i, '')
    .replace(/^B\.\s*V\.\s*Mary/i, 'Virgin Mary')
    .replace(/^B\.\s*V\.\s*/i, 'Blessed Virgin ')
    .replace(/^B\.\s*/i, 'Blessed ')
    .replace(/^Sts?\.\s*/i, '')
    .replace(/^Saint\s*/i, '')
    .replace(/^Saints\s*/i, '')
    .replace(/^Blessed\s*/i, '')
    .replace(/^Holy\s*/i, '')
    .replace(/\(.*?\)/g, '')
    .trim();

  // If there are comma-separated titles (e.g. "St.Pacific of San Severino, Franciscan friar"), keep primary name
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
      timeout: 4000
    });
    const cType = (res.headers['content-type'] || '').toLowerCase();
    return res.status >= 200 && res.status < 300 && (!cType || cType.includes('image') || cType.includes('octet-stream'));
  } catch (e) {
    // If HEAD is blocked by CDN or CORS, try GET with Range header
    try {
      const getRes = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Range': 'bytes=0-100'
        },
        timeout: 4000
      });
      return getRes.status >= 200 && getRes.status < 300;
    } catch (err2) {
      return false;
    }
  }
}

/**
 * Inspect Vatican News Cheerio DOM specifically for genuine saint portraits
 * and ignore site layout/template banners, logos, and 1x1 gif spacers.
 */
function getVaticanSaintImage($, vaticanUrl, sectionEl = null) {
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
  const context = sectionEl ? $(sectionEl) : $('body');

  // 1. Check for genuine saint archive image inside /content/dam/vaticannews/santi/
  context.find('img').each((i, el) => {
    const rawSrc = $(el).attr('data-original') || $(el).attr('data-src') || $(el).attr('src') || '';
    const alt = ($(el).attr('alt') || '').toLowerCase();

    if (!rawSrc || rawSrc.startsWith('data:image')) return;

    const isIgnored = IGNORED_PATTERNS.some(p => rawSrc.toLowerCase().includes(p) || alt.includes(p));
    if (isIgnored) return;

    if (rawSrc.includes('/content/dam/vaticannews/santi/')) {
      candidateUrl = rawSrc;
      return false; // Found direct match
    }
  });

  // 2. Check for image inside .section__content or article body within section
  if (!candidateUrl) {
    context.find('.section__content img, article img, .page__content img').each((i, el) => {
      const rawSrc = $(el).attr('data-original') || $(el).attr('data-src') || $(el).attr('src') || '';
      const alt = ($(el).attr('alt') || '').toLowerCase();

      if (!rawSrc || rawSrc.startsWith('data:image')) return;

      const isIgnored = IGNORED_PATTERNS.some(p => rawSrc.toLowerCase().includes(p) || alt.includes(p));
      if (!isIgnored) {
        candidateUrl = rawSrc;
        return false;
      }
    });
  }

  if (candidateUrl) {
    let fullUrl = candidateUrl.startsWith('http')
      ? candidateUrl
      : `https://www.vaticannews.va${candidateUrl.startsWith('/') ? '' : '/'}${candidateUrl}`;

    // Upgrade low-res thumbnail renditions (e.g. 250x141) to high-resolution (750x422)
    fullUrl = fullUrl.replace(/cq5dam\.thumbnail\.cropped\.\d+\.\d+\.jpeg/i, 'cq5dam.thumbnail.cropped.750.422.jpeg');
    fullUrl = fullUrl.split('#')[0];

    return {
      url: fullUrl,
      source: 'vatican',
      sourceUrl: vaticanUrl || 'https://www.vaticannews.va/en/saints.html',
      fallback: false
    };
  }

  return null;
}

/**
 * Search Wikipedia for the exact canonical saint portrait with rigorous Catholic identity verification.
 */
async function searchWikipediaSaintImage(rawSaintName) {
  const cleanName = cleanSaintName(rawSaintName);
  if (!cleanName) return null;

  const rawWithoutTitle = rawSaintName
    .replace(/,\s*.*$/, '')
    .replace(/^(Parish Patron Feast|Feast|Solemnity|Memorial)\s+of\s+/i, '')
    .trim();

  // 1. Direct Wikipedia Page Summary Slugs by exact/canonical saint name
  const directSlugs = [];
  const lower = rawSaintName.toLowerCase();
  if (lower.includes('mercy') && (lower.includes('mary') || lower.includes('lady'))) {
    directSlugs.push('Virgin_of_Mercy', 'Our_Lady_of_Mercy');
  } else if (lower.includes('sorrow')) {
    directSlugs.push('Our_Lady_of_Sorrows');
  } else if (lower.includes('rosary')) {
    directSlugs.push('Our_Lady_of_the_Rosary');
  } else if (lower.includes('carmel')) {
    directSlugs.push('Our_Lady_of_Mount_Carmel');
  } else if (lower.includes('lourdes')) {
    directSlugs.push('Our_Lady_of_Lourdes');
  } else if (lower.includes('fatima')) {
    directSlugs.push('Our_Lady_of_Fatima');
  } else if (lower.includes('pius of pietrelcina') || lower.includes('padre pio')) {
    directSlugs.push('Padre_Pio');
  } else if (lower.includes('archangel') || (lower.includes('michael') && lower.includes('gabriel'))) {
    directSlugs.push('Michael_(archangel)');
  }
  directSlugs.push(cleanName.replace(/\s+/g, '_'));
  directSlugs.push(`Saint_${cleanName.replace(/\s+/g, '_')}`);
  directSlugs.push(rawWithoutTitle.replace(/\s+/g, '_'));

  for (const slug of directSlugs) {
    try {
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
      const sumRes = await axios.get(summaryUrl, { headers: HTTP_HEADERS, timeout: 5000 });
      const data = sumRes.data;
      if (data && data.type !== 'disambiguation') {
        let imageUrl = data.originalimage?.source || data.thumbnail?.source;
        if (imageUrl && !imageUrl.endsWith('.svg')) {
          imageUrl = imageUrl.split('?')[0];
          const isValid = await verifyImageUrl(imageUrl);
          if (isValid) {
            console.log(`[Saint Image Resolver] Found direct Wikipedia image for "${rawSaintName}" -> "${data.title}": ${imageUrl}`);
            return {
              url: imageUrl,
              source: 'wikipedia',
              sourceUrl: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`,
              fallback: false
            };
          }
        }
      }
    } catch (e) {
      // try next slug
    }
  }

  // 2. Full-text search on Wikipedia if direct slugs did not hit
  const queries = [];
  if (lower.includes('mercy') && (lower.includes('mary') || lower.includes('lady'))) {
    queries.push('Virgin of Mercy', 'Our Lady of Mercy', 'Blessed Virgin Mary of Mercy');
  } else if (lower.includes('sorrow')) {
    queries.push('Our Lady of Sorrows');
  } else if (lower.includes('rosary')) {
    queries.push('Our Lady of the Rosary');
  } else if (lower.includes('carmel')) {
    queries.push('Our Lady of Mount Carmel');
  } else if (lower.includes('lourdes')) {
    queries.push('Our Lady of Lourdes');
  } else if (lower.includes('fatima')) {
    queries.push('Our Lady of Fatima');
  } else if (lower.includes('pius of pietrelcina') || lower.includes('padre pio')) {
    queries.push('Padre Pio', 'Saint Pio of Pietrelcina');
  } else if (lower.includes('archangel') || (lower.includes('michael') && lower.includes('gabriel'))) {
    queries.push('Michael (archangel)', 'Saint Michael Archangel');
  }

  queries.push(
    `Saint ${cleanName}`,
    cleanName,
    rawWithoutTitle,
    `Blessed ${cleanName}`
  );

  const uniqueQueries = [...new Set(queries.filter(Boolean))];

  for (const q of uniqueQueries) {
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*`;
      const searchRes = await axios.get(searchUrl, { headers: HTTP_HEADERS, timeout: 5000 });
      const hits = searchRes.data?.query?.search || [];

      for (const hit of hits.slice(0, 4)) {
        const titleLower = hit.title.toLowerCase();
        if (
          titleLower.includes('disambiguation') ||
          titleLower.includes('list of') ||
          titleLower.includes('cathedral') ||
          titleLower.includes('basilica') ||
          titleLower.includes('monument')
        ) continue;

        // Fetch page summary
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`;
        const sumRes = await axios.get(summaryUrl, { headers: HTTP_HEADERS, timeout: 5000 });
        const data = sumRes.data;
        if (!data || data.type === 'disambiguation') continue;

        const description = (data.description || '').toLowerCase();
        const extract = (data.extract || '').toLowerCase();
        const combinedText = `${hit.title.toLowerCase()} ${description} ${extract}`;

        // Identity verification: Must have Christian / Catholic saint context
        const isSaintContext = CHRISTIAN_SAINT_KEYWORDS.some(kw => combinedText.includes(kw));
        const isUnrelated = UNRELATED_KEYWORDS.some(kw => description.includes(kw));

        if (!isSaintContext || isUnrelated) {
          continue;
        }

        // Prefer full-resolution original image, fallback to thumbnail
        let imageUrl = data.originalimage?.source || data.thumbnail?.source;
        if (imageUrl && !imageUrl.endsWith('.svg')) {
          imageUrl = imageUrl.split('?')[0];
          const isValid = await verifyImageUrl(imageUrl);
          if (isValid) {
            console.log(`[Saint Image Resolver] Found verified Wikipedia portrait for "${rawSaintName}" -> "${data.title}" (${data.description}): ${imageUrl}`);
            return {
              url: imageUrl,
              source: 'wikipedia',
              sourceUrl: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`,
              fallback: false
            };
          }
        }
      }
    } catch (err) {
      console.warn(`[Saint Image Resolver] Wikipedia search notice for query "${q}":`, err.message);
    }
  }

  return null;
}

/**
 * Intelligent multi-query online search (Google Custom Search -> Web Image Search)
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

  // 2. Web Image Search
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
 * Master Saint Image Resolver
 * Executes strict priority pipeline:
 * 1. Vatican News Official Saint Image ("Original Website")
 * 2. Wikipedia exact saint article image (verified authentic portrait)
 * 3. Online Google / Web Search Fallback
 * 4. Liturgical Calendar Fallback
 * 5. Guaranteed Verified Dignified Sacred Art (St. John de Britto)
 */
async function resolveSaintImage(saintName, vaticanUrl, $, todayDate = new Date(), sectionEl = null) {
  // 1. Try Vatican News ("Original Website") First
  if ($ && vaticanUrl) {
    const vaticanResult = getVaticanSaintImage($, vaticanUrl, sectionEl);
    if (vaticanResult && vaticanResult.url) {
      const isOk = await verifyImageUrl(vaticanResult.url);
      if (isOk) {
        console.log(` Saint Image Resolver: Using authentic Vatican News image for "${saintName}": ${vaticanResult.url}`);
        return vaticanResult;
      }
    }
  }

  // 2. Try Wikipedia exact saint article portrait with Catholic identity verification
  console.log(` Saint Image Resolver: Checking Wikipedia for verified portrait of "${saintName}"...`);
  try {
    const wikiResult = await searchWikipediaSaintImage(saintName);
    if (wikiResult && wikiResult.url) {
      console.log(` Saint Image Resolver: Successfully verified Wikipedia portrait for "${saintName}": ${wikiResult.url}`);
      return wikiResult;
    }
  } catch (err) {
    console.warn(` Saint Image Resolver: Wikipedia search error for "${saintName}":`, err.message);
  }

  // 3. Try Online Google / Web Image Search
  console.log(` Saint Image Resolver: Fetching image from online search for "${saintName}"...`);
  try {
    const onlineResult = await searchSaintFallback(saintName);
    if (onlineResult && onlineResult.url) {
      console.log(` Saint Image Resolver: Successfully fetched image from online search for "${saintName}"`);
      return onlineResult;
    }
  } catch (err) {
    console.error(' Saint Image Resolver: Online search error:', err.message);
  }

  // 4. Liturgical Calendar Fallback (Only if names match)
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

  // 5. Default Dignified Catholic Sacred Art (Guaranteed 200 OK)
  return {
    url: DIGNIFIED_FALLBACK_IMAGE,
    source: 'liturgical_fallback',
    sourceUrl: vaticanUrl || 'https://www.vaticannews.va/en/saints.html',
    fallback: true
  };
}

module.exports = {
  resolveSaintImage,
  getVaticanSaintImage,
  searchWikipediaSaintImage,
  searchSaintFallback,
  cleanSaintName,
  verifyImageUrl,
  DIGNIFIED_FALLBACK_IMAGE
};
