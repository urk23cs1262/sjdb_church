const axios = require('axios');
const { getSaintForDate } = require('../data/catholic_saints_calendar');

/**
 * Universal Saint Image Resolver
 * 
 * Strict Catholic Sacred Art Priority:
 * 1. Vatican News Official Saint Image ("Original Website")
 * 2. Wikipedia Official Canonical Saint Portrait (Fetched by Saint Name via Wikipedia API)
 * 3. Catholic Liturgical Calendar Curated Preset
 * 4. Guaranteed Authentic Catholic Sacred Art (St. John de Britto)
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
    .replace(/^Sts?[\s\.]+/i, '')
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
 * Filter out non-sacred graphics, stock photos, generic collages, logos, and maps
 */
function isBlacklistedImage(url) {
  if (!url || typeof url !== 'string') return true;
  const l = url.toLowerCase();
  return (
    l.endsWith('.svg') ||
    l.endsWith('.gif') ||
    l.includes('logo') ||
    l.includes('emblem') ||
    l.includes('badge') ||
    l.includes('flag') ||
    l.includes('shutterstock') ||
    l.includes('collage') ||
    l.includes('icon_collection') ||
    l.includes('map') ||
    l.includes('symbol') ||
    l.includes('signature') ||
    l.includes('commons-logo') ||
    l.includes('wikimedia-button') ||
    l.includes('teachingcatholickids') ||
    l.includes('istockphoto') ||
    l.includes('imimg.com') ||
    l.includes('metroprin') ||
    l.includes('stadium')
  );
}

/**
 * Extract the best Wikipedia image URL, preferring scaled, fast CDN thumbnails
 */
function extractWikipediaImageUrl(data) {
  if (!data) return null;
  // If thumbnail exists, upgrade from low-res (e.g. 330px) to crisp 500px width
  if (data.thumbnail?.source) {
    const raw = data.thumbnail.source.split('?')[0];
    const scaled = raw.replace(/\/\d+px-/i, '/500px-');
    if (!isBlacklistedImage(scaled)) return scaled;
  }
  if (data.originalimage?.source) {
    const raw = data.originalimage.source.split('?')[0];
    if (!isBlacklistedImage(raw)) return raw;
  }
  return null;
}

/**
 * Inspect Vatican News Cheerio DOM specifically for genuine saint portraits
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
 * Search Wikipedia for the exact canonical saint portrait by saint name.
 * Reliable, fast, and completely free of secular collages.
 */
async function searchWikipediaSaintImage(rawSaintName) {
  if (!rawSaintName) return null;
  const cleanName = cleanSaintName(rawSaintName);
  if (!cleanName) return null;

  const rawWithoutTitle = rawSaintName
    .replace(/,\s*.*$/, '')
    .replace(/^(Parish Patron Feast|Feast|Solemnity|Memorial)\s+of\s+/i, '')
    .trim();

  // 1. Direct Wikipedia Canonical Slugs for known saints
  const directSlugs = [];
  const lower = rawSaintName.toLowerCase();

  if (lower.includes('cosmas') && lower.includes('damian')) {
    directSlugs.push('Cosmas_and_Damian');
  } else if (lower.includes('vincent de paul')) {
    directSlugs.push('Vincent_de_Paul');
  } else if (lower.includes('wenceslaus')) {
    directSlugs.push('Wenceslaus_I,_Duke_of_Bohemia');
  } else if (lower.includes('jerome')) {
    directSlugs.push('Jerome');
  } else if (lower.includes('therese') || lower.includes('thérèse')) {
    directSlugs.push('Thérèse_of_Lisieux', 'Saint_Thérèse_of_Lisieux');
  } else if (lower.includes('guardian angel')) {
    directSlugs.push('Guardian_angel', 'Memorial_of_the_Holy_Guardian_Angels');
  } else if (lower.includes('archangel') || (lower.includes('michael') && lower.includes('gabriel'))) {
    directSlugs.push('Michael_(archangel)');
  } else if (lower.includes('francis of assisi')) {
    directSlugs.push('Francis_of_Assisi');
  } else if (lower.includes('pius of pietrelcina') || lower.includes('padre pio')) {
    directSlugs.push('Padre_Pio');
  } else if (lower.includes('mercy') && (lower.includes('mary') || lower.includes('lady'))) {
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
        const imageUrl = extractWikipediaImageUrl(data);
        if (imageUrl) {
          console.log(`[Saint Image Resolver] Found direct Wikipedia image for "${rawSaintName}" -> "${data.title}": ${imageUrl}`);
          return {
            url: imageUrl,
            source: 'wikipedia',
            sourceUrl: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`,
            fallback: false
          };
        }
      }
    } catch (e) {
      // try next slug
    }
  }

  // 2. Full-text search on Wikipedia if direct slugs did not hit
  const queries = [
    `Saint ${cleanName}`,
    cleanName,
    rawWithoutTitle
  ];

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

        if (!isSaintContext || isUnrelated) continue;

        const imageUrl = extractWikipediaImageUrl(data);
        if (imageUrl) {
          console.log(`[Saint Image Resolver] Found verified Wikipedia portrait for "${rawSaintName}" -> "${data.title}" (${data.description}): ${imageUrl}`);
          return {
            url: imageUrl,
            source: 'wikipedia',
            sourceUrl: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`,
            fallback: false
          };
        }
      }
    } catch (err) {
      console.warn(`[Saint Image Resolver] Wikipedia search notice for query "${q}":`, err.message);
    }
  }

  return null;
}

/**
 * Master Saint Image Resolver
 * Executes strict priority pipeline:
 * 1. Vatican News Official Saint Image ("Original Website")
 * 2. Wikipedia Official Canonical Saint Portrait (by Saint Name)
 * 3. Catholic Liturgical Calendar Curated Preset
 * 4. Guaranteed Authentic Catholic Sacred Art (St. John de Britto)
 */
async function resolveSaintImage(saintName, vaticanUrl, $, todayDate = new Date(), sectionEl = null) {
  // 1. Try Vatican News ("Original Website") First
  if ($ && vaticanUrl) {
    const vaticanResult = getVaticanSaintImage($, vaticanUrl, sectionEl);
    if (vaticanResult && vaticanResult.url && !isBlacklistedImage(vaticanResult.url)) {
      console.log(` Saint Image Resolver: Using authentic Vatican News image for "${saintName}": ${vaticanResult.url}`);
      return vaticanResult;
    }
  }

  // 2. Try Wikipedia exact saint article portrait by saint name
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

  // 3. Liturgical Calendar Fallback (curated Catholic portraits)
  const calendarSaint = getSaintForDate(todayDate);
  const cleanTarget = cleanSaintName(saintName).toLowerCase();
  const cleanCal = cleanSaintName(calendarSaint?.name || '').toLowerCase();

  if (calendarSaint && calendarSaint.image && (cleanTarget === cleanCal || cleanTarget.includes(cleanCal) || cleanCal.includes(cleanTarget))) {
    if (!isBlacklistedImage(calendarSaint.image)) {
      console.log(` Saint Image Resolver: Using Catholic Liturgical Calendar preset image for "${saintName}"`);
      return {
        url: calendarSaint.image,
        source: 'liturgical_calendar',
        sourceUrl: calendarSaint.link || vaticanUrl,
        fallback: false
      };
    }
  }

  // 4. Default Dignified Catholic Sacred Art (St. John de Britto)
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
  cleanSaintName,
  DIGNIFIED_FALLBACK_IMAGE
};
