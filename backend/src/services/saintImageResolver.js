const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getSaintForDate } = require('../data/catholic_saints_calendar');
const { getChurchEmail } = require('../config/contactConfig');

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
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,application/json,text/html,*/*;q=0.8'
};

const PATRON_SAINT_BRITTO_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/b/bf/St._John_De_Britto.jpg';
const UNIVERSAL_SAINT_DEVOTIONAL_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Holy_Spirit_in_the_form_of_a_dove.jpg/500px-Holy_Spirit_in_the_form_of_a_dove.jpg';
const DIGNIFIED_FALLBACK_IMAGE = UNIVERSAL_SAINT_DEVOTIONAL_IMAGE;

function getDignifiedFallbackImage(saintName = '') {
  const lower = String(saintName || '').toLowerCase();
  if (lower.includes('britto') || lower.includes('arulanandar') || lower.includes('arulanandhar')) {
    return PATRON_SAINT_BRITTO_IMAGE;
  }
  return UNIVERSAL_SAINT_DEVOTIONAL_IMAGE;
}

/**
 * Downloads and stores saint image locally in backend /uploads/saints/ directory.
 * Returns { localUrl, localPath, remoteUrl, buffer }
 */
async function cacheSaintImageFile(remoteUrl, baseName = 'saint') {
  if (!remoteUrl || typeof remoteUrl !== 'string' || !remoteUrl.startsWith('http')) {
    return { localUrl: remoteUrl, localPath: null, remoteUrl, buffer: null };
  }
  try {
    const uploadsDir = path.join(__dirname, '../../uploads/saints');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    let ext = '.jpg';
    try {
      const parsedPath = new URL(remoteUrl).pathname;
      const parsedExt = path.extname(parsedPath).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(parsedExt)) {
        ext = parsedExt;
      }
    } catch (e) {}

    const safeName = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 50)
      .replace(/^_|_$/g, '');

    const filename = `${safeName || 'saint'}${ext}`;
    const filePath = path.join(uploadsDir, filename);
    const localUrl = `/uploads/saints/${filename}`;

    // If file already exists and is non-empty, use existing cached file
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > 1000) {
        let buffer = null;
        try { buffer = fs.readFileSync(filePath); } catch (e) {}
        return { localUrl, localPath: filePath, remoteUrl, buffer };
      }
    }

    const response = await axios.get(remoteUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: HTTP_HEADERS
    });

    if (response.status === 200 && response.data && response.data.length > 500) {
      const buffer = Buffer.from(response.data);
      fs.writeFileSync(filePath, buffer);
      console.log(`[Saint Image Resolver] Cached image locally: ${localUrl} (${buffer.length} bytes)`);
      return { localUrl, localPath: filePath, remoteUrl, buffer };
    }
  } catch (err) {
    console.warn(`[Saint Image Resolver] Local cache notice for ${baseName}: ${err.message}. Using remote URL.`);
  }
  return { localUrl: remoteUrl, localPath: null, remoteUrl, buffer: null };
}

/**
 * Backward compatible wrapper returning string URL
 */
async function cacheImageLocally(remoteUrl, baseName = 'saint') {
  const result = await cacheSaintImageFile(remoteUrl, baseName);
  return result.localUrl || remoteUrl;
}

const CHRISTIAN_SAINT_KEYWORDS = [
  'saint', 'catholic', 'christian', 'priest', 'monk', 'martyr', 'pope',
  'bishop', 'friar', 'nun', 'abbess', 'virgin', 'deacon', 'apostle',
  'hermit', 'church', 'religious', 'blessed', 'venerated', 'canonized',
  'beatified', 'feast', 'mother of god', 'virgin mary', 'jesuit',
  'franciscan', 'dominican', 'benedictine', 'carmelite', 'missionary',
  'ascetic', 'theologian', 'mystic', 'stigmata', 'padre',
  'evangelist', 'disciple', 'presbyter', 'cardinal', 'archbishop'
];

const UNRELATED_KEYWORDS = [
  'patriarch of constantinople', 'ecumenical patriarch', 'patriarchate', 'byzantine',
  'cathedral', 'church in', 'basilica', 'monument', 'shrine in', 'chapel',
  'football', 'cricket', 'baseball', 'basketball', 'politician',
  'album', 'song', 'film', 'movie', 'actor', 'actress', 'television',
  'municipality', 'commune', 'city in', 'town in', 'village in',
  'province', 'railway', 'airport', 'company', 'corporation', 'school',
  'high school', 'university', 'stadium', 'district', 'county'
];

/**
 * Resolves a Tamil saint query into its canonical English name using calendar dictionary & transliteration
 */
function resolveEnglishSaintName(inputName) {
  if (!inputName || typeof inputName !== 'string') return '';
  if (!/[\u0B80-\u0BFF]/.test(inputName)) return inputName;

  try {
    const { SAINTS_CALENDAR } = require('../data/catholic_saints_calendar');
    for (const s of Object.values(SAINTS_CALENDAR)) {
      if (s.nameTa && (inputName.includes(s.nameTa) || s.nameTa.includes(inputName))) {
        return s.name;
      }
    }
  } catch (e) {}

  let mapped = inputName
    .replace(/செயிண்ட்|புனிதர்|புனித/g, 'Saint ')
    .replace(/போப்/g, 'Pope ')
    .replace(/மறைசாட்சி/g, 'Martyr ')
    .replace(/மறைவல்லுநர்/g, 'Doctor of the Church ')
    .replace(/கன்னியர்/g, 'Virgin ')
    .replace(/காலிஸ்டஸ்|கால்லிஸ்டஸ்/g, 'Callixtus ')
    .replace(/தெரேசா|திரேசா/g, 'Teresa ')
    .replace(/அவிலா நகர்/g, 'of Avila ')
    .replace(/அருளானந்தர்/g, 'John de Britto ')
    .replace(/அந்தோனியார்|அந்தோனி/g, 'Anthony ')
    .replace(/பிரான்சிஸ்/g, 'Francis ')
    .replace(/யோவான்/g, 'John ')
    .replace(/பேதுரு/g, 'Peter ')
    .replace(/பவுல்/g, 'Paul ')
    .replace(/\s+/g, ' ')
    .trim();

  return mapped;
}

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
 * Validates that a Wikipedia page corresponds to a Catholic/Christian saint and not a secular figure or Eastern Orthodox Patriarch of Constantinople
 */
function isValidSaintPage(data, baseVariants = []) {
  if (!data) return false;
  const title = (data.title || '').toLowerCase();
  const desc = (data.description || '').toLowerCase();
  const extract = (data.extract || '').toLowerCase();
  const combined = `${title} ${desc} ${extract}`;

  // Reject Patriarch of Constantinople / Byzantine figures when searching for Roman Catholic saints/popes
  if (
    combined.includes('patriarch of constantinople') ||
    combined.includes('ecumenical patriarch') ||
    (desc.includes('byzantine') && !combined.includes('catholic'))
  ) {
    return false;
  }

  if (UNRELATED_KEYWORDS.some(k => desc.includes(k) || title.includes(k))) {
    return false;
  }

  const hasSaintContext = CHRISTIAN_SAINT_KEYWORDS.some(k => combined.includes(k));
  if (!hasSaintContext) return false;

  return true;
}

/**
 * Directly queries MediaWiki API for a slug/title with &redirects=1 and prop=pageimages
 */
async function fetchMediaWikiImage(slug, variants = []) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages|extracts&exintro=1&explaintext=1&piprop=thumbnail|original&pithumbsize=600&redirects=1&titles=${encodeURIComponent(slug)}&format=json`;
    const res = await axios.get(url, { headers: HTTP_HEADERS, timeout: 6000 });
    const pages = res.data?.query?.pages || {};
    const page = Object.values(pages)[0];
    if (!page || page.pageid === -1) return null;

    const extract = (page.extract || '').toLowerCase();
    const title = (page.title || '').toLowerCase();
    const combined = `${title} ${extract}`;

    if (combined.includes('patriarch of constantinople') || combined.includes('ecumenical patriarch')) return null;
    if (UNRELATED_KEYWORDS.some(k => extract.includes(k) || title.includes(k))) return null;

    const isSaint = CHRISTIAN_SAINT_KEYWORDS.some(k => combined.includes(k));
    if (!isSaint && !title.includes('saint') && !title.includes('pope')) return null;

    let img = page.thumbnail?.source || page.original?.source;
    if (img && !isBlacklistedImage(img)) {
      const cleanUrl = img.split('?')[0].replace(/\/\d+px-/i, '/500px-');
      return {
        url: cleanUrl,
        title: page.title,
        pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/\s+/g, '_'))}`
      };
    }
  } catch (e) {}
  return null;
}

/**
 * Searches Wikimedia Commons for authentic portraits, icons, and paintings of the saint
 */
async function searchWikimediaCommonsImage(saintName, cleanName) {
  try {
    const query = `"Saint ${cleanName}" OR "${cleanName}" portrait icon fresco painting`;
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&prop=imageinfo&iiprop=url|mime&format=json`;
    const res = await axios.get(url, { headers: HTTP_HEADERS, timeout: 6000 });
    const pages = res.data?.query?.pages || {};
    const cleanTokens = cleanName.toLowerCase().split(/\s+/).filter(t => t.length > 2 && !['saint', 'first', 'great', 'pope'].includes(t));

    for (const page of Object.values(pages)) {
      const fileTitle = (page.title || '').toLowerCase();
      if (isBlacklistedImage(fileTitle)) continue;
      if (UNRELATED_KEYWORDS.some(k => fileTitle.includes(k))) continue;

      const matchesToken = cleanTokens.some(tok => fileTitle.includes(tok));
      if (!matchesToken) continue;

      const fileUrl = page.imageinfo?.[0]?.url;
      if (fileUrl && !isBlacklistedImage(fileUrl)) {
        return {
          url: fileUrl.split('?')[0],
          title: page.title,
          pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/\s+/g, '_'))}`
        };
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Search Wikipedia & Wikimedia for the exact canonical saint portrait by saint name.
 * Reliable, fast, and completely free of secular collages or wrong persons.
 */
async function searchWikipediaSaintImage(rawSaintName) {
  if (!rawSaintName) return null;
  const englishSaintName = resolveEnglishSaintName(rawSaintName);
  const cleanName = cleanSaintName(englishSaintName);
  if (!cleanName) return null;

  const rawWithoutTitle = englishSaintName
    .replace(/,\s*.*$/, '')
    .replace(/^(Parish Patron Feast|Feast|Solemnity|Memorial)\s+of\s+/i, '')
    .trim();

  const lowerRaw = englishSaintName.toLowerCase();
  const isPope = lowerRaw.includes('pope');

  // Generate spelling & transliteration variants (e.g. Callistus <-> Callixtus)
  const getVariants = (base) => {
    const list = [base];
    if (/callistus/i.test(base)) list.push(base.replace(/callistus/gi, 'Callixtus'), base.replace(/callistus/gi, 'Calixtus'));
    if (/callixtus/i.test(base)) list.push(base.replace(/callixtus/gi, 'Callistus'));
    if (/therese/i.test(base)) list.push(base.replace(/therese/gi, 'Teresa'), base.replace(/therese/gi, 'Thérèse'), base.replace(/therese/gi, 'Theresa'));
    if (/teresa/i.test(base)) list.push(base.replace(/teresa/gi, 'Theresa'), base.replace(/teresa/gi, 'Thérèse'));
    if (/matthew/i.test(base)) list.push(base.replace(/matthew/gi, 'Matteo'));
    if (/francis/i.test(base)) list.push(base.replace(/francis/gi, 'Francesco'));
    if (/wenceslaus/i.test(base)) list.push(base.replace(/wenceslaus/gi, 'Wenceslas'));
    if (/anthony/i.test(base)) list.push(base.replace(/anthony/gi, 'Antony'));
    if (/laurence/i.test(base)) list.push(base.replace(/laurence/gi, 'Lorenzo'), base.replace(/laurence/gi, 'Lawrence'));
    return [...new Set(list)];
  };

  const baseName = cleanName.split(/[,–—-]/)[0].trim();
  const baseVariants = getVariants(baseName);

  // 1. Direct Wikipedia Canonical Slugs
  const directSlugs = [];

  if (lowerRaw.includes('mark') && isPope) {
    directSlugs.push('Pope_Mark');
  } else if (lowerRaw.includes('sergius') && (lowerRaw.includes('bacchus') || lowerRaw.includes('bacco'))) {
    directSlugs.push('Sergius_and_Bacchus');
  } else if (lowerRaw.includes('cosmas') && lowerRaw.includes('damian')) {
    directSlugs.push('Cosmas_and_Damian');
  } else if (lowerRaw.includes('vincent de paul')) {
    directSlugs.push('Vincent_de_Paul');
  } else if (lowerRaw.includes('wenceslaus')) {
    directSlugs.push('Wenceslaus_I,_Duke_of_Bohemia');
  } else if (lowerRaw.includes('eustachius') || lowerRaw.includes('eustochium')) {
    directSlugs.push('Eustochium', 'Saint_Eustochium');
  } else if (lowerRaw.includes('jerome')) {
    directSlugs.push('Jerome');
  } else if (lowerRaw.includes('therese') || lowerRaw.includes('thérèse')) {
    directSlugs.push('Thérèse_of_Lisieux', 'Saint_Thérèse_of_Lisieux');
  } else if (lowerRaw.includes('guardian angel')) {
    directSlugs.push('Guardian_angel', 'Memorial_of_the_Holy_Guardian_Angels');
  } else if (lowerRaw.includes('archangel') || (lowerRaw.includes('michael') && lowerRaw.includes('gabriel'))) {
    directSlugs.push('Michael_(archangel)');
  } else if (lowerRaw.includes('francis of assisi')) {
    directSlugs.push('Francis_of_Assisi');
  } else if (lowerRaw.includes('pius of pietrelcina') || lowerRaw.includes('padre pio')) {
    directSlugs.push('Padre_Pio');
  } else if (lowerRaw.includes('mercy') && (lowerRaw.includes('mary') || lowerRaw.includes('lady'))) {
    directSlugs.push('Virgin_of_Mercy', 'Our_Lady_of_Mercy');
  } else if (lowerRaw.includes('sorrow')) {
    directSlugs.push('Our_Lady_of_Sorrows');
  } else if (lowerRaw.includes('rosary')) {
    directSlugs.push('Our_Lady_of_the_Rosary');
  } else if (lowerRaw.includes('carmel')) {
    directSlugs.push('Our_Lady_of_Mount_Carmel');
  } else if (lowerRaw.includes('lourdes')) {
    directSlugs.push('Our_Lady_of_Lourdes');
  } else if (lowerRaw.includes('fatima')) {
    directSlugs.push('Our_Lady_of_Fatima');
  } else if (lowerRaw.includes('daniel') && (lowerRaw.includes('samuel') || lowerRaw.includes('franciscan') || lowerRaw.includes('ceuta'))) {
    directSlugs.push('Daniel_and_companions', 'Saints_Daniel_and_companions');
  } else if (lowerRaw.includes('paulinus') && (lowerRaw.includes('york') || lowerRaw.includes('gregory'))) {
    directSlugs.push('Paulinus_of_York', 'Saint_Paulinus_of_York');
  }

  // Handle "and companions"
  if (lowerRaw.includes('companion') || lowerRaw.includes('martyr')) {
    const firstPerson = cleanName.split(/,|\band\b/i)[0].trim().replace(/\s+/g, '_');
    if (firstPerson) {
      directSlugs.push(`${firstPerson}_and_companions`, `Saints_${firstPerson}_and_companions`);
    }
  }

  // Handle "Bishop of X", "Archbishop of X", "Duke of X", "of X"
  const ofMatch = englishSaintName.match(/(?:Bishop|Archbishop|Duke|Pope|Abbot|King|Queen)?\s*of\s+([A-Za-z\s]+?)(?:,|$)/i);
  const location = (ofMatch && ofMatch[1]) ? ofMatch[1].trim().replace(/\s+/g, '_') : null;

  for (const b of baseVariants) {
    const cleanB = b.replace(/\s+/g, '_');
    if (isPope) {
      directSlugs.push(`Pope_${cleanB}`);
      directSlugs.push(`Pope_Saint_${cleanB}`);
    }
    directSlugs.push(`Saint_${cleanB}`);
    directSlugs.push(cleanB);
    if (location) {
      directSlugs.push(`${cleanB}_of_${location}`);
      directSlugs.push(`Saint_${cleanB}_of_${location}`);
    }
  }
  directSlugs.push(rawWithoutTitle.replace(/\s+/g, '_'));

  // STEP 1: Query MediaWiki Action API with &redirects=1 and prop=pageimages
  for (const slug of [...new Set(directSlugs)]) {
    const mwImg = await fetchMediaWikiImage(slug, baseVariants);
    if (mwImg && mwImg.url) {
      console.log(`[Saint Image Resolver] Found verified MediaWiki portrait for "${rawSaintName}" -> "${mwImg.title}": ${mwImg.url}`);
      const cached = await cacheSaintImageFile(mwImg.url, rawSaintName);
      return {
        url: mwImg.url,
        imageUrl: mwImg.url,
        remoteUrl: mwImg.url,
        localUrl: cached.localUrl,
        localPath: cached.localPath,
        buffer: cached.buffer,
        source: 'wikipedia',
        sourceUrl: mwImg.pageUrl,
        fallback: false
      };
    }

    // Try Wikipedia REST API summary
    try {
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
      const sumRes = await axios.get(summaryUrl, { headers: HTTP_HEADERS, timeout: 5000 });
      const data = sumRes.data;
      if (data && data.type !== 'disambiguation' && isValidSaintPage(data, baseVariants)) {
        const imageUrl = extractWikipediaImageUrl(data);
        if (imageUrl) {
          console.log(`[Saint Image Resolver] Found direct Wikipedia image for "${rawSaintName}" -> "${data.title}": ${imageUrl}`);
          const cached = await cacheSaintImageFile(imageUrl, rawSaintName);
          return {
            url: imageUrl,
            imageUrl: imageUrl,
            remoteUrl: imageUrl,
            localUrl: cached.localUrl,
            localPath: cached.localPath,
            buffer: cached.buffer,
            source: 'wikipedia',
            sourceUrl: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`,
            fallback: false
          };
        }
      }
    } catch (e) {}
  }

  // STEP 2: Full-text search on Wikipedia
  const queries = [];
  for (const b of baseVariants) {
    if (isPope) {
      queries.push(`Pope ${b}`);
      queries.push(`Pope Saint ${b}`);
    }
    queries.push(`Saint ${b}`);
    queries.push(b);
  }
  queries.push(rawWithoutTitle);

  const uniqueQueries = [...new Set(queries.filter(Boolean))];

  for (const q of uniqueQueries) {
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*`;
      const searchRes = await axios.get(searchUrl, { headers: HTTP_HEADERS, timeout: 5000 });
      const hits = searchRes.data?.query?.search || [];

      for (const hit of hits.slice(0, 5)) {
        const titleLower = hit.title.toLowerCase();
        if (
          titleLower.includes('disambiguation') ||
          titleLower.includes('list of') ||
          titleLower.includes('cathedral') ||
          titleLower.includes('basilica') ||
          titleLower.includes('monument') ||
          titleLower.includes('patriarch of constantinople') ||
          titleLower.includes('ecumenical patriarch')
        ) continue;

        const mwImg = await fetchMediaWikiImage(hit.title, baseVariants);
        if (mwImg && mwImg.url) {
          console.log(`[Saint Image Resolver] Found search hit MediaWiki image for "${rawSaintName}" -> "${mwImg.title}": ${mwImg.url}`);
          const cached = await cacheSaintImageFile(mwImg.url, rawSaintName);
          return {
            url: mwImg.url,
            imageUrl: mwImg.url,
            remoteUrl: mwImg.url,
            localUrl: cached.localUrl,
            localPath: cached.localPath,
            buffer: cached.buffer,
            source: 'wikipedia',
            sourceUrl: mwImg.pageUrl,
            fallback: false
          };
        }

        // Try page summary
        try {
          const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`;
          const sumRes = await axios.get(summaryUrl, { headers: HTTP_HEADERS, timeout: 5000 });
          const data = sumRes.data;
          if (data && data.type !== 'disambiguation' && isValidSaintPage(data, baseVariants)) {
            const imageUrl = extractWikipediaImageUrl(data);
            if (imageUrl) {
              console.log(`[Saint Image Resolver] Found verified search portrait for "${rawSaintName}" -> "${data.title}": ${imageUrl}`);
              const cached = await cacheSaintImageFile(imageUrl, rawSaintName);
              return {
                url: imageUrl,
                imageUrl: imageUrl,
                remoteUrl: imageUrl,
                localUrl: cached.localUrl,
                localPath: cached.localPath,
                buffer: cached.buffer,
                source: 'wikipedia',
                sourceUrl: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`,
                fallback: false
              };
            }
          }
        } catch (sumErr) {}
      }
    } catch (err) {
      console.warn(`[Saint Image Resolver] Wikipedia search notice for query "${q}":`, err.message);
    }
  }

  // STEP 3: Wikimedia Commons High-Res Sacred Art Search
  for (const b of baseVariants) {
    const commonsImg = await searchWikimediaCommonsImage(englishSaintName, b);
    if (commonsImg && commonsImg.url) {
      console.log(`[Saint Image Resolver] Found verified Wikimedia Commons portrait for "${rawSaintName}" -> "${commonsImg.title}": ${commonsImg.url}`);
      const cached = await cacheSaintImageFile(commonsImg.url, rawSaintName);
      return {
        url: commonsImg.url,
        imageUrl: commonsImg.url,
        remoteUrl: commonsImg.url,
        localUrl: cached.localUrl,
        localPath: cached.localPath,
        buffer: cached.buffer,
        source: 'wikimedia_commons',
        sourceUrl: commonsImg.pageUrl,
        fallback: false
      };
    }
  }

  return null;
}

/**
 * Validates, downloads, and caches remote image URL from Catholic Readings or another source
 */
async function resolveAndCacheRemoteSaintImage(remoteUrl, saintName, sourceName = 'catholic_readings', sourceUrl = '') {
  if (!remoteUrl || isBlacklistedImage(remoteUrl)) {
    return null;
  }
  const cached = await cacheSaintImageFile(remoteUrl, saintName);
  return {
    url: remoteUrl, // Public HTTPS URL
    imageUrl: remoteUrl,
    remoteUrl: remoteUrl,
    localUrl: cached.localUrl,
    localPath: cached.localPath,
    buffer: cached.buffer,
    source: sourceName,
    sourceUrl: sourceUrl || remoteUrl,
    fallback: false
  };
}

/**
 * Master Saint Image Resolver
 * Executes strict priority pipeline:
 * 1. Vatican News Official Saint Image
 * 2. Wikipedia Official Canonical Saint Portrait (by Saint Name)
 * 3. Catholic Liturgical Calendar Curated Preset
 * 4. Guaranteed Respectful Sacred Art Fallback (Patron St. John de Britto ONLY on Feb 4 / for Britto; Universal Dove/Halo for others)
 */
async function resolveSaintImage(saintName, vaticanUrl, $, todayDate = new Date(), sectionEl = null) {
  // 1. Try Vatican News ("Original Website") First
  if ($ && vaticanUrl) {
    const vaticanResult = getVaticanSaintImage($, vaticanUrl, sectionEl);
    if (vaticanResult && vaticanResult.url && !isBlacklistedImage(vaticanResult.url)) {
      console.log(` Saint Image Resolver: Using authentic Vatican News image for "${saintName}": ${vaticanResult.url}`);
      const cached = await cacheSaintImageFile(vaticanResult.url, saintName);
      return {
        url: vaticanResult.url,
        imageUrl: vaticanResult.url,
        remoteUrl: vaticanResult.url,
        localUrl: cached.localUrl,
        localPath: cached.localPath,
        buffer: cached.buffer,
        source: 'vatican',
        sourceUrl: vaticanResult.sourceUrl,
        fallback: false
      };
    }
  }

  // 2. Try Wikipedia exact saint article portrait by saint name
  console.log(` Saint Image Resolver: Checking Wikipedia & Wikimedia for verified portrait of "${saintName}"...`);
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
      const cached = await cacheSaintImageFile(calendarSaint.image, saintName);
      return {
        url: calendarSaint.image,
        imageUrl: calendarSaint.image,
        remoteUrl: calendarSaint.image,
        localUrl: cached.localUrl,
        localPath: cached.localPath,
        buffer: cached.buffer,
        source: 'liturgical_calendar',
        sourceUrl: calendarSaint.link || vaticanUrl,
        fallback: false
      };
    }
  }

  // 4. Dignified Sacred Art Fallback (St. John de Britto ONLY if feast or Britto; Universal for other saints)
  const fallbackImgUrl = getDignifiedFallbackImage(saintName);
  const cachedFallback = await cacheSaintImageFile(fallbackImgUrl, saintName || 'saint_sacred_portrait');
  return {
    url: fallbackImgUrl,
    imageUrl: fallbackImgUrl,
    remoteUrl: fallbackImgUrl,
    localUrl: cachedFallback.localUrl,
    localPath: cachedFallback.localPath,
    buffer: cachedFallback.buffer,
    source: 'liturgical_fallback',
    sourceUrl: vaticanUrl || 'https://www.vaticannews.va/en/saints.html',
    fallback: true
  };
}

module.exports = {
  resolveSaintImage,
  getVaticanSaintImage,
  searchWikipediaSaintImage,
  resolveAndCacheRemoteSaintImage,
  cacheImageLocally,
  cacheSaintImageFile,
  cleanSaintName,
  resolveEnglishSaintName,
  getDignifiedFallbackImage,
  DIGNIFIED_FALLBACK_IMAGE,
  PATRON_SAINT_BRITTO_IMAGE,
  UNIVERSAL_SAINT_DEVOTIONAL_IMAGE
};

