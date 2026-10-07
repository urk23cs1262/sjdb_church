const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const { getChurchEmail } = require('../config/contactConfig');
const { getSaintForDate } = require('../data/catholic_saints_calendar');
const { 
  resolveSaintImage, 
  getVaticanSaintImage, 
  searchWikipediaSaintImage, 
  resolveAndCacheRemoteSaintImage,
  cacheSaintImageFile,
  searchSaintFallback, 
  cleanSaintName, 
  verifyImageUrl 
} = require('./saintImageResolver');

// ─── SOURCE CONFIGURATION ────────────────────────────────────────────────────
// Primary source: Catholic Readings (https://catholicreadings.org/catholic-saint-of-the-day/)
// Secondary source: Vatican News — dynamic month/day URL structure
const CATHOLIC_READINGS_BASE = "https://catholicreadings.org";
const CATHOLIC_READINGS_URL = "https://catholicreadings.org/catholic-saint-of-the-day/";
const VATICAN_NEWS_BASE = "https://www.vaticannews.va";
const VATICAN_SAINTS_BASE_URL = "https://www.vaticannews.va/en/saints";

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

let dailySaint = null;
let retryTimeout = null;

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
  const year = parts.find(p => p.type === 'year')?.value || String(dt.getFullYear());
  const dateKey = `${year}-${month}-${day}`;

  return { dt, day, month, year, dateKey };
}

// ─── DYNAMIC VATICAN NEWS URL BUILDER ─────────────────────────────────────────

/**
 * Builds dynamic Vatican News Saint of the Day calendar URL using zero-padded MM and DD.
 * Example: month='09', day='24' -> https://www.vaticannews.va/en/saints/09/24.html
 * Example: month='01', day='01' -> https://www.vaticannews.va/en/saints/01/01.html
 * No year component is included, ensuring it functions seamlessly for all future years.
 */
function buildVaticanNewsUrl(month, day) {
  const padMonth = String(month).padStart(2, '0');
  const padDay = String(day).padStart(2, '0');
  return `${VATICAN_SAINTS_BASE_URL}/${padMonth}/${padDay}.html`;
}

// ─── PARISH PATRON SAINT (FEBRUARY 4) ───────────────────────────────────────

const ST_JOHN_DE_BRITTO = {
  name: "St. John de Britto (Patron Saint)",
  saintName: "St. John de Britto (Patron Saint)",
  englishName: "St. John de Britto (Patron Saint)",
  tamilName: "புனித அருளானந்தர் (ஜான் டி பிரிட்டோ)",
  nameTa: "புனித அருளானந்தர் (ஜான் டி பிரிட்டோ)",
  description: "St. John de Britto, also known as Arul Anandar, was a Portuguese Jesuit missionary and martyr. He was the first European to adopt the dress and lifestyle of a Pandarasamy (Hindu ascetic) to preach the Gospel in Tamil Nadu. He traveled extensively across the Madurai Mission, converting thousands to Christianity. He was arrested, tortured, and eventually beheaded for his faith in Kalayarkoil in 1693. Patron of our parish!",
  descriptionTa: "புனித அருளானந்தர் (ஜான் டி பிரிட்டோ) ஒரு போர்த்துகீசிய இயேசு சபை துறவி மற்றும் தியாகி ஆவார். இவர் தமிழ்நாட்டில் நற்செய்தியைப் போதிப்பதற்காக ஒரு இந்து சன்னியாசியின் ஆடை மற்றும் வாழ்க்கை முறையை ஏற்றுக்கொண்ட முதல் ஐரோப்பியர் ஆவார். மதுரை தூதுக்குழுவின் கீழ் விரிவாகப் பயணம் செய்து, ஆயிரக்கணக்கானோரை கிறிஸ்தவ விசுவாசத்திற்கு ஈர்த்தார். தனது விசுவாசத்திற்காகக் கைது செய்யப்பட்டு, சித்திரவதைக்கு உட்படுத்தப்பட்டு, இறுதியாக 1693 இல் கலையார்கோவிலில் மறைசாட்சியாக உயிர் நீத்தார். நமது ஆலயத்தின் பாதுகாவலர்!",
  image: "https://upload.wikimedia.org/wikipedia/commons/b/bf/St._John_De_Britto.jpg",
  imageSource: "parish_patron",
  imageSourceUrl: "https://www.catholic.org/saints/saint.php?saint_id=4025",
  imageFallback: false,
  feastDay: "February 4",
  feastTitle: "Parish Patron Feast of St. John de Britto",
  feastTitleTa: "புனித அருளானந்தர் ஆலயப் பாதுகாவலர் பெருவிழா",
  feastType: "Parish Patron Feast",
  feastTypeTa: "ஆலயப் பாதுகாவலர் பெருவிழா",
  hasFeastInfo: true,
  source: "Parish Patron Feast",
  link: "https://www.catholic.org/saints/saint.php?saint_id=4025",
  sourceUrl: "https://www.catholic.org/saints/saint.php?saint_id=4025",
  updatedAt: new Date()
};

// ─── TEXT UTILITIES ──────────────────────────────────────────────────────────

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

/**
 * Natural Catholic Tamil Post-Processor
 * Ensures proper Catholic ecclesiastical vocabulary instead of crude or secular machine translations.
 */
function postProcessCatholicTamil(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\bசெயிண்ட்\b/g, 'புனித')
    .replace(/\bசெயின்ட்ஸ்\b/g, 'புனிதர்கள்')
    .replace(/நினைவுச்சின்னம்/g, 'நினைவுநாள்')
    .replace(/நினைவு விழா/g, 'நினைவுநாள்')
    .replace(/நினைவு நாள்/g, 'நினைவுநாள்')
    .replace(/தியாகிகள்/g, 'மறைசாட்சிகள்')
    .replace(/தியாகி/g, 'மறைசாட்சி')
    .replace(/இரத்தசாட்சிகள்/g, 'மறைசாட்சிகள்')
    .replace(/இரத்தசாட்சி/g, 'மறைசாட்சி')
    .replace(/போஹேமியா பிரபு/g, 'போஹீமியாவின் டியூக்')
    .replace(/போமியா டியூக்/g, 'போஹீமியாவின் டியூக்')
    .replace(/போஹேமியாவின் டியூக்/g, 'போஹீமியாவின் டியூக்')
    .replace(/புரவலர் துறவி/g, 'பாதுகாவலர்')
    .replace(/புரவலர் புனிதர்/g, 'பாதுகாவலர் புனிதர்')
    .replace(/வீரமரணம் அடைந்தனர்/g, 'மறைசாட்சியாய் உயிர்நீத்தனர்')
    .replace(/வீரமரணம் அடைந்தார்/g, 'மறைசாட்சியாய் உயிர்நீத்தார்')
    .replace(/வீரமரணம்/g, 'மறைசாட்சி மரணம்')
    .trim();
}

/**
 * Multi-tier English -> Tamil Translation Engine
 * Tier 1: Clients5 Dict Chrome Extension (fast, high concurrency, zero 429 rate limit)
 * Tier 2: Google Translate GTX endpoint
 * Tier 3: MyMemory API
 */
async function translateText(text, targetLang = 'ta') {
  if (!text || typeof text !== 'string' || text.trim() === '') return '';
  const trimmed = text.trim();
  const cacheKey = `${targetLang}:${trimmed}`;

  if (saintTranslationCache.has(cacheKey)) {
    return saintTranslationCache.get(cacheKey);
  }

  // Check known feast/saint dictionary first
  if (targetLang === 'ta') {
    if (KNOWN_FEAST_TRANSLATIONS[trimmed]) {
      saintTranslationCache.set(cacheKey, KNOWN_FEAST_TRANSLATIONS[trimmed]);
      return KNOWN_FEAST_TRANSLATIONS[trimmed];
    }
    const cleanT = trimmed.toLowerCase();
    if (cleanT === 'saint of the day') return 'இன்றைய புனிதர்';
    if (cleanT === 'martyr') return 'மறைசாட்சி';
    if (cleanT === 'martyrs') return 'மறைசாட்சிகள்';
  }

  // Tier 1: Clients5 Dict Chrome Extension (reliable, does not return 429)
  try {
    const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=${targetLang}&q=${encodeURIComponent(trimmed)}`;
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });
    if (response.data) {
      let translated = '';
      if (Array.isArray(response.data)) {
        translated = response.data.join(' ').trim();
      } else if (typeof response.data === 'string') {
        translated = response.data.trim();
      }
      if (translated && (targetLang !== 'ta' || /[\u0B80-\u0BFF]/.test(translated))) {
        const polished = targetLang === 'ta' ? postProcessCatholicTamil(translated) : translated;
        saintTranslationCache.set(cacheKey, polished);
        return polished;
      }
    }
  } catch (err) {
    // Continue to Tier 2
  }

  // Tier 2: Google Translate GTX endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(trimmed)}`;
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (response.data && response.data[0]) {
      const translated = response.data[0].map(item => item[0]).join('').trim();
      if (translated && (targetLang !== 'ta' || /[\u0B80-\u0BFF]/.test(translated))) {
        const polished = targetLang === 'ta' ? postProcessCatholicTamil(translated) : translated;
        saintTranslationCache.set(cacheKey, polished);
        return polished;
      }
    }
  } catch (error) {
    // Continue to Tier 3
  }

  // Tier 3: MyMemory API Fallback
  try {
    const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|${targetLang}`;
    const response = await axios.get(myMemoryUrl, { timeout: 7000 });
    const trans = response.data?.responseData?.translatedText?.trim();
    if (trans && (targetLang !== 'ta' || /[\u0B80-\u0BFF]/.test(trans))) {
      const polished = targetLang === 'ta' ? postProcessCatholicTamil(trans) : trans;
      saintTranslationCache.set(cacheKey, polished);
      return polished;
    }
  } catch (mmErr) {
    console.warn(`[Saint Service] Translation Tier 3 notice: ${mmErr.message}`);
  }

  return '';
}

/**
 * Cleans a saint name for Wikipedia querying.
 * Strips ecclesiastical titles, qualifiers, prefixes, and suffixes.
 */
function cleanSaintNameForWiki(rawName) {
  if (!rawName) return '';
  const lowerRaw = rawName.toLowerCase();
  if (lowerRaw.includes('candida') && (lowerRaw.includes('portuense') || lowerRaw.includes('martyr') || lowerRaw.includes('rome'))) {
    // Candida, Martyr on the Via Portuense does not have a standalone Wikipedia page.
    return '';
  }
  if (lowerRaw.includes('eustachius') && (lowerRaw.includes('paula') || lowerRaw.includes('virgin'))) {
    return 'Eustochium';
  }
  if (lowerRaw.includes('mark') && lowerRaw.includes('pope')) {
    return 'Pope Mark';
  }
  if (lowerRaw.includes('sergius') && (lowerRaw.includes('bacchus') || lowerRaw.includes('bacco'))) {
    return 'Sergius and Bacchus';
  }
  if (lowerRaw.includes('rosary')) {
    return 'Our Lady of the Rosary';
  }
  let name = rawName
    // Strip everything after first comma or dash (e.g. ", priest...", ", Apostle...", " - Martyr")
    .replace(/,.*$/, '')
    .replace(/\s*[-–—]\s*.*$/, '')
    // Strip parenthetical text like (Patron Saint)
    .replace(/\s*\([^)]*\)/g, '')
    // Replace St. / Sts. / Saint / Saints / Blessed / Pope / s.
    .replace(/^Sts?[\s\.]+/i, '')
    .replace(/^Saint[\s\.]+/i, '')
    .replace(/^Blessed[\s\.]+/i, '')
    .replace(/^Pope[\s\.]+/i, '')
    .replace(/^s\.[\s]+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Common spelling corrections on Vatican News (e.g., Mattew -> Matthew)
  if (/^mattew$/i.test(name)) name = 'Matthew';
  return name;
}

/**
 * Validates that the fetched Wikipedia article corresponds to the displayed saint
 * to avoid duplicate or mismatched saint biographies.
 */
function validateWikiMatch(displayedSaintName, wikiTitle) {
  if (!displayedSaintName || !wikiTitle) return false;
  const cleanDisplay = cleanSaintNameForWiki(displayedSaintName).toLowerCase();
  const cleanWiki = cleanSaintNameForWiki(wikiTitle).toLowerCase();

  if (cleanDisplay.includes('candida') && (cleanWiki.includes('elder') || cleanWiki.includes('vecchia') || cleanWiki.includes('carthage') || cleanWiki.includes('film'))) {
    return false;
  }

  if (cleanDisplay.includes(cleanWiki) || cleanWiki.includes(cleanDisplay)) return true;
  if (cleanDisplay.includes('mark') && cleanWiki.includes('mark')) return true;
  if (cleanDisplay.includes('sergius') && cleanWiki.includes('sergius')) return true;
  if (cleanDisplay.includes('rosary') && cleanWiki.includes('rosary')) return true;
  if (cleanDisplay.includes('vincent') && cleanWiki.includes('vincent')) return true;
  if (cleanDisplay.includes('jerome') && cleanWiki.includes('jerome')) return true;
  if (cleanDisplay.includes('pietrelcina') || cleanDisplay.includes('pio') || cleanWiki.includes('pio')) return true;
  if (cleanDisplay.includes('cosmas') && cleanWiki.includes('cosmas')) return true;
  if (cleanDisplay.includes('matthew') && cleanWiki.includes('matthew')) return true;
  if (cleanDisplay.includes('therese') && cleanWiki.includes('lisieux')) return true;
  if (cleanDisplay.includes('francis') && cleanWiki.includes('francis')) return true;
  if (cleanDisplay.includes('wenceslaus') && cleanWiki.includes('wenceslaus')) return true;
  if ((cleanDisplay.includes('eustachius') || cleanDisplay.includes('eustochium')) && (cleanWiki.includes('eustochium') || cleanWiki.includes('eustachius'))) return true;

  const displayTokens = cleanDisplay.split(/\s+/).filter(w => w.length > 3 && !['saint', 'blessed', 'pope', 'martyr'].includes(w));
  const wikiTokens = cleanWiki.split(/\s+/).filter(w => w.length > 3 && !['saint', 'blessed', 'pope', 'martyr'].includes(w));
  return displayTokens.some(t => wikiTokens.includes(t));
}

/**
 * Checks if a biography has sufficient detail (at least 3-4 readable lines, ~180+ chars, 2+ sentences).
 */
function isSufficientBio(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < 180) return false;
  const sentences = splitIntoSentences(trimmed);
  if (sentences.length >= 2) return true;
  const paras = trimmed.split(/\n\s*\n/).filter(p => p.trim().length > 30);
  return paras.length >= 2;
}

/**
 * Generates an authoritative, comprehensive Catholic biography (at least 4-6 lines)
 * when neither Vatican News nor Wikipedia contains sufficient text for this specific saint.
 */
function generateComprehensiveCatholicBio(saintName, dateKey = '') {
  const clean = cleanSaintNameForWiki(saintName);
  const lower = (saintName || '').toLowerCase();
  
  if (lower.includes('candida')) {
    return "Saint Candida was an early Christian martyr of Rome who laid down her life for Christ along the ancient Via Portuense during the imperial persecutions.\n\nSteadfast in her devotion despite immense trials, she bore heroic witness to the Gospel before the Roman authorities, choosing suffering and martyrdom over renouncing her Lord.\n\nThe early Christian faithful venerated her tomb outside Rome as a sacred sanctuary of holiness and perseverance. In the ninth century, Pope Paschal I solemnly translated her holy relics to the Basilica of Saint Praxedes in Rome, where her memory continues to inspire the faithful with her luminous example of courage, purity, and enduring faith in Jesus Christ.";
  }

  const isMartyr = lower.includes('martyr') || lower.includes('mar');
  const isBishop = lower.includes('bishop') || lower.includes('pope');
  const isPriest = lower.includes('priest') || lower.includes('abbot') || lower.includes('father');
  const isVirgin = lower.includes('virgin') || lower.includes('nun') || lower.includes('sister');

  let roleDesc = "holy witness of the Catholic faith";
  if (isMartyr && isVirgin) roleDesc = "virgin and martyr who offered her life in supreme love for Jesus Christ";
  else if (isMartyr && isBishop) roleDesc = "bishop and martyr who shepherded the flock of Christ with courage and sealed his testimony with his blood";
  else if (isMartyr) roleDesc = "courageous martyr who steadfastly confessed Christ amidst severe persecutions";
  else if (isBishop) roleDesc = "dedicated bishop and pastor who zealously guided the faithful according to the Gospel";
  else if (isPriest) roleDesc = "faithful priest and servant of God dedicated to prayer, the Sacraments, and the pastoral care of souls";
  else if (isVirgin) roleDesc = "consecrated virgin who dedicated her entire heart and life to Christ in purity and ceaseless prayer";

  return `Saint ${clean} is venerated in the Catholic Church as a ${roleDesc}.\n\nLiving a life marked by deep humility, sacrificial charity, and steadfast fidelity to the Gospel, Saint ${clean} stood as an enduring light of holiness in the Christian community.\n\nCelebrated on this feast day in the Roman liturgical calendar, their heroic virtues and spiritual legacy continue to intercede for the Church, inspiring all believers to walk faithfully in the footsteps of Our Lord Jesus Christ.`;
}

/**
 * Dynamically fetches a comprehensive multi-paragraph biography for any Saint from Wikipedia.
 * Uses MediaWiki extract API with intro paragraphs, falling back to search if needed.
 */
async function fetchWikipediaBio(saintName) {
  if (!saintName) return null;
  const cleanName = cleanSaintNameForWiki(saintName);
  if (!cleanName || cleanName.length < 2) return null;

  const slugs = [
    cleanName.replace(/\s+/g, '_'),
    `Saint_${cleanName.replace(/\s+/g, '_')}`,
    `Pope_${cleanName.replace(/\s+/g, '_')}`
  ];

  const lower = cleanName.toLowerCase();
  const rawLower = (saintName || '').toLowerCase();
  if (lower.includes('mark') && (lower.includes('pope') || rawLower.includes('pope'))) {
    slugs.unshift('Pope_Mark');
  } else if (lower.includes('sergius') && (lower.includes('bacchus') || rawLower.includes('bacchus') || lower.includes('bacco') || rawLower.includes('bacco'))) {
    slugs.unshift('Sergius_and_Bacchus', 'Saints_Sergius_and_Bacchus');
  } else if (lower.includes('vincent de paul')) {
    slugs.unshift('Vincent_de_Paul');
  } else if (lower.includes('pius of pietrelcina') || lower.includes('padre pio')) {
    slugs.unshift('Padre_Pio');
  } else if (lower.includes('cosmas and damian')) {
    slugs.unshift('Cosmas_and_Damian', 'Saints_Cosmas_and_Damian');
  } else if (lower.includes('wenceslaus') || rawLower.includes('wenceslaus')) {
    slugs.unshift('Wenceslaus_I,_Duke_of_Bohemia', 'Wenceslaus_I', 'Saint_Wenceslaus');
  } else if (lower.includes('eustachius') || lower.includes('eustochium') || rawLower.includes('eustachius')) {
    slugs.unshift('Eustochium', 'Saint_Eustochium');
  } else if (lower === 'matthew') {
    slugs.unshift('Matthew_the_Apostle', 'Saint_Matthew');
  } else if (lower.includes('therese')) {
    slugs.unshift('Thérèse_of_Lisieux', 'Therese_of_Lisieux');
  } else if (lower.includes('francis of assisi')) {
    slugs.unshift('Francis_of_Assisi');
  } else if (lower.includes('mercy') && (lower.includes('mary') || lower.includes('lady'))) {
    slugs.unshift('Virgin_of_Mercy', 'Our_Lady_of_Mercy');
  } else if (lower.includes('sorrow')) {
    slugs.unshift('Our_Lady_of_Sorrows');
  } else if (lower.includes('rosary')) {
    slugs.unshift('Our_Lady_of_the_Rosary');
  } else if (lower.includes('carmel')) {
    slugs.unshift('Our_Lady_of_Mount_Carmel');
  } else if (lower.includes('lourdes')) {
    slugs.unshift('Our_Lady_of_Lourdes');
  } else if (lower.includes('fatima')) {
    slugs.unshift('Our_Lady_of_Fatima');
  } else if (lower.includes('guadalupe')) {
    slugs.unshift('Our_Lady_of_Guadalupe');
  } else if (lower.includes('mother of god')) {
    slugs.unshift('Mary,_Mother_of_God', 'Theotokos');
  } else if (lower.includes('archangel') || (lower.includes('michael') && lower.includes('gabriel'))) {
    slugs.unshift('Michael_(archangel)');
  }

  // 1. Direct candidate slugs via MediaWiki extracts API
  for (const slug of slugs) {
    try {
      const wikiUserAgent = `SJDBChurchApp/1.0 (Catholic Parish Management; contact: ${getChurchEmail() || 'office@example.com'})`;
      const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(slug)}&format=json`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': wikiUserAgent },
        timeout: 6000
      });
      const pages = res.data?.query?.pages || {};
      for (const pageId in pages) {
        if (pageId !== '-1' && pages[pageId].extract && pages[pageId].extract.length >= 250) {
          const text = pages[pageId].extract.trim().replace(/\n+/g, '\n\n');
          if (validateWikiMatch(saintName, pages[pageId].title)) {
            return {
              title: pages[pageId].title,
              text,
              url: `https://en.wikipedia.org/wiki/${encodeURIComponent(pages[pageId].title.replace(/\s+/g, '_'))}`
            };
          }
        }
      }
    } catch (e) {}
  }

  // 2. Search fallback via Wikipedia search API
  try {
    const wikiUserAgent = `SJDBChurchApp/1.0 (Catholic Parish Management; contact: ${getChurchEmail() || 'office@example.com'})`;
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent('Saint ' + cleanName)}&format=json&origin=*`;
    const searchRes = await axios.get(searchUrl, {
      headers: { 'User-Agent': wikiUserAgent },
      timeout: 6000
    });
    const hits = searchRes.data?.query?.search || [];
    for (const h of hits.slice(0, 4)) {
      if (/disambiguation|list of|church|basilica|cathedral|parish|shrine|order of|congregation of/i.test(h.title)) continue;
      const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(h.title)}&format=json`;
      const exRes = await axios.get(extractUrl, {
        headers: { 'User-Agent': wikiUserAgent },
        timeout: 6000
      });
      const pages = exRes.data?.query?.pages || {};
      for (const pageId in pages) {
        if (pageId !== '-1' && pages[pageId].extract && pages[pageId].extract.length >= 250) {
          const text = pages[pageId].extract.trim().replace(/\n+/g, '\n\n');
          if (validateWikiMatch(saintName, pages[pageId].title)) {
            return {
              title: pages[pageId].title,
              text,
              url: `https://en.wikipedia.org/wiki/${encodeURIComponent(pages[pageId].title.replace(/\s+/g, '_'))}`
            };
          }
        }
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Translates multi-paragraph biography into Tamil, preserving paragraph breaks
 * and cleaning post-nominals that confuse machine translation.
 */
async function translateBiography(text, targetLang = 'ta') {
  if (!text || typeof text !== 'string' || text.trim() === '') return '';
  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return '';

  const translatedParas = [];
  for (const para of paragraphs) {
    const cleanPara = para.replace(/,\s*[A-Z]{2,5}(?=\s*[\(,])/g, '');
    let trans = await translateText(cleanPara, targetLang);

    // If paragraph translation failed, split into sentences and translate each
    if (!trans && cleanPara.length > 150) {
      const sentences = splitIntoSentences(cleanPara);
      const transSentences = [];
      for (const sent of sentences) {
        const sTrans = await translateText(sent, targetLang);
        if (sTrans && (targetLang !== 'ta' || /[\u0B80-\u0BFF]/.test(sTrans))) {
          transSentences.push(sTrans);
        }
      }
      if (transSentences.length > 0) {
        trans = transSentences.join(' ');
      }
    }

    if (trans && (targetLang !== 'ta' || /[\u0B80-\u0BFF]/.test(trans))) {
      translatedParas.push(trans);
    }
  }

  // Never return raw untranslated English when target is Tamil
  return translatedParas.join('\n\n');
}

// ─── FEAST & LITURGICAL CELEBRATION EXTRACTION ──────────────────────────────

const SOLEMNITY_PATTERNS = [
  /mother of god/i,
  /birth of st\.? john the baptist/i,
  /nativity of (the lord|john the baptist)/i,
  /saint joseph, spouse/i,
  /annunciation/i,
  /saints? peter and paul/i,
  /assumption/i,
  /all saints/i,
  /immaculate conception/i,
  /resurrection/i,
  /epiphany/i,
  /ascension/i,
  /pentecost/i,
  /trinity/i,
  /corpus christi/i,
  /sacred heart/i,
  /christ the king/i
];

const FEAST_PATTERNS = [
  /archangel/i,
  /apostle/i,
  /evangelist/i,
  /b\.\s*v\.\s*mary of the mercy/i,
  /our lady of mercy/i,
  /visitation/i,
  /transfiguration/i,
  /exaltation of the holy cross/i,
  /holy innocents/i,
  /first martyr/i,
  /conversion of st\.? paul/i,
  /chair of st\.? peter/i,
  /presentation/i,
  /baptism of the lord/i
];

const MEMORIAL_PATTERNS = [
  /pius of pietrelcina|padre pio/i,
  /cosmas and damian/i,
  /martyr/i,
  /vincent de paul/i,
  /jerome/i,
  /guardian angels/i,
  /our lady of the rosary/i,
  /our lady of sorrows/i,
  /our lady of mount carmel/i,
  /our lady of lourdes/i,
  /our lady of fatima/i,
  /doctor of the church/i,
  /st\.? therese/i,
  /st\.? francis of assisi/i,
  /st\.? anthony/i,
  /st\.? ignatius/i,
  /st\.? dominic/i,
  /st\.? benedict/i,
  /st\.? thomas aquinas/i,
  /st\.? augustine/i
];

const KNOWN_FEAST_TRANSLATIONS = {
  "Parish Patron Feast of St. John de Britto": "புனித அருளானந்தர் ஆலயப் பாதுகாவலர் பெருவிழா",
  "Blessed Virgin Mary of the Mercy": "இரக்கத்தின் தூய கன்னி மரியா திருவிழா",
  "Memorial of Saint Pio of Pietrelcina": "பியட்ரல்சினாவின் புனித பியோ நினைவுநாள்",
  "Memorial of Saints Cosmas and Damian, Martyrs": "புனிதர்கள் கோஸ்மாஸ் மற்றும் தமியானஸ் மறைசாட்சியர் நினைவுநாள்",
  "Memorial of Saint Vincent de Paul": "புனித வின்சென்ட் தே பவுல் நினைவுநாள்",
  "Memorial of Saint Jerome, Priest and Doctor of the Church": "புனித ஜெரோம் (மறைவல்லுநர்) நினைவுநாள்",
  "Feast of Saints Michael, Gabriel and Raphael, Archangels": "புனித மிக்கேல், கபிரியேல், ரபேல் அதிதூதர்கள் திருவிழா",
  "Feast of the Holy Archangels": "தூய அதிதூதர்கள் திருவிழா",
  "Solemnity of Mary, Mother of God": "மரியாவின் இறைத்தாய்மை பெருவிழா",
  "Solemnity of St. Joseph, Spouse of the Blessed Virgin Mary": "தூய கன்னி மரியாவின் கணவரான புனித யோசேப்பு பெருவிழா",
  "Birth of st. John the Baptist": "புனித திருமுழுக்கு யோவானின் பிறப்பு பெருவிழா",
  "Solemnity of Saints Peter and Paul, Apostles": "திருத்தூதர்களான புனித பேதுரு, புனித பவுல் பெருவிழா",
  "Memorial of Sts. Lorenzo Ruiz and Companions, Martyrs": "புனித லோரென்சோ ரூயிஸ் மற்றும் தோழர்கள் நினைவுநாள்",
  "Memorial of Saint Lorenzo Ruiz and Companions": "புனித லோரென்சோ ரூயிஸ் மற்றும் தோழர்கள் நினைவுநாள்",
  "Memorial of Sts. Lorenzo Ruiz and Companions": "புனித லோரென்சோ ரூயிஸ் மற்றும் தோழர்கள் நினைவுநாள்",
  "Memorial of Saint Wenceslaus, Duke of Boemia": "போஹீமியாவின் டியூக் புனித வென்செஸ்லாஸ் நினைவுநாள்",
  "Memorial of Saint Wenceslaus, Duke of Bohemia": "போஹீமியாவின் டியூக் புனித வென்செஸ்லாஸ் நினைவுநாள்",
  "Memorial of Saint Wenceslaus, Duke of Boemia, Martyr": "போஹீமியாவின் டியூக் புனித வென்செஸ்லாஸ் நினைவுநாள்",
  "Memorial of Saint Wenceslaus, Duke of Bohemia, Martyr": "போஹீமியாவின் டியூக் புனித வென்செஸ்லாஸ் நினைவுநாள்",
  "Memorial of Our Lady of the Rosary": "ஜெபமாலை அன்னை நினைவுநாள்",
  "Our Lady of the Rosary": "ஜெபமாலை அன்னை",
  "St. Mark, Pope": "புனித மாற்கு (திருத்தந்தை)",
  "Sts. Sergius and Bacchus, Martyrs of Syria": "சிரியாவின் மறைசாட்சியரான புனிதர்கள் செர்ஜியஸ் மற்றும் பாக்கஸ்",
  "Sts. Sergius e Bacchus, Martyrs of Syria": "சிரியாவின் மறைசாட்சியரான புனிதர்கள் செர்ஜியஸ் மற்றும் பாக்கஸ்",
  "Saint of the Day": "இன்றைய புனிதர்"
};


/**
 * Extracts feast, solemnity, memorial, or liturgical celebration information
 * associated with the Saint of the Day from Vatican News page content.
 */
function extractFeastInfo($, saints = [], month, day, dateKey) {
  // 1. February 4 — Parish Patron Feast
  if (month === '02' && day === '04') {
    return {
      feastTitle: "Parish Patron Feast of St. John de Britto",
      feastTitleTa: "புனித அருளானந்தர் ஆலயப் பாதுகாவலர் பெருவிழா",
      feastType: "Parish Patron Feast",
      feastTypeTa: "ஆலயப் பாதுகாவலர் பெருவிழா",
      hasFeastInfo: true,
      feastSaintObj: ST_JOHN_DE_BRITTO,
      feastSaintName: ST_JOHN_DE_BRITTO.saintName
    };
  }

  let detectedTitle = null;
  let detectedType = null;
  let detectedTypeTa = null;
  let feastSaintObj = null;
  let feastSaintName = null;

  // Helper to get clean saint title without ecclesiastical rank suffixes for feast titles
  const cleanTitle = (str) => {
    return str
      .replace(/^B\.\s*V\.\s*/i, 'Blessed Virgin ')
      .replace(/,\s*(priest|bishop|pope|friar|martyr|abbess|doctor|virgin|religious|deacon|franciscan friar).*$/i, '')
      .replace(/^Sts?[\s\.]+/i, 'Saint ')
      .trim();
  };

  // 2. Check each saint entry on the page
  for (const s of saints) {
    const rawName = (s.name || '').trim();
    if (!rawName) continue;

    // Check if the title itself is an explicit Marian feast or celebration
    if (/^b\.\s*v\.\s*mary/i.test(rawName) || /^our lady/i.test(rawName) || /^birth of/i.test(rawName) || /^most holy/i.test(rawName)) {
      detectedTitle = rawName.replace(/^B\.\s*V\.\s*/i, 'Blessed Virgin ');
      feastSaintObj = s;
      feastSaintName = detectedTitle;
      if (SOLEMNITY_PATTERNS.some(p => p.test(rawName))) {
        detectedType = "Solemnity";
        detectedTypeTa = "பெருவிழா";
      } else {
        detectedType = "Feast";
        detectedTypeTa = "திருவிழா";
      }
      break;
    }

    // Check for Solemnity
    if (SOLEMNITY_PATTERNS.some(p => p.test(rawName))) {
      detectedTitle = `Solemnity of ${cleanTitle(rawName)}`;
      feastSaintObj = s;
      feastSaintName = cleanTitle(rawName);
      detectedType = "Solemnity";
      detectedTypeTa = "பெருவிழா";
      break;
    }

    // Check for Archangels / Feasts
    if (FEAST_PATTERNS.some(p => p.test(rawName))) {
      if (/archangel/i.test(rawName)) {
        detectedTitle = "Feast of Saints Michael, Gabriel and Raphael, Archangels";
        feastSaintObj = s;
        feastSaintName = cleanTitle(rawName);
      } else {
        detectedTitle = `Feast of ${cleanTitle(rawName)}`;
        feastSaintObj = s;
        feastSaintName = cleanTitle(rawName);
      }
      detectedType = "Feast";
      detectedTypeTa = "திருவிழா";
      break;
    }

    // Check for Memorial
    if (MEMORIAL_PATTERNS.some(p => p.test(rawName))) {
      const cName = cleanTitle(rawName);
      let mName = cName;
      if (cName.includes('Pietrelcina')) {
        mName = 'Saint Pio of Pietrelcina';
      } else if (/cosmas and damian/i.test(rawName)) {
        mName = 'Saints Cosmas and Damian, Martyrs';
      } else if (/vincent de paul/i.test(rawName)) {
        mName = 'Saint Vincent de Paul';
      } else if (/jerome/i.test(rawName)) {
        mName = 'Saint Jerome, Priest and Doctor of the Church';
      }
      detectedTitle = `Memorial of ${mName}`;
      feastSaintObj = s;
      feastSaintName = mName;
      detectedType = "Memorial";
      detectedTypeTa = "நினைவு நாள்";
      break;
    }

    // Check if the biography text explicitly mentions a feast celebration
    if (s.description) {
      const feastMatch = s.description.match(/\b(whose feast is celebrated[^\.\,\;\n]*|his feast day is celebrated[^\.\,\;\n]*|celebrated on [^\.\,\;\n]*)/i);
      if (feastMatch) {
        detectedTitle = `Feast of ${cleanTitle(rawName)}`;
        feastSaintObj = s;
        feastSaintName = cleanTitle(rawName);
        detectedType = "Feast";
        detectedTypeTa = "திருவிழா";
        break;
      }
    }
  }

  // 3. Check page title or intro for any celebration mention
  if (!detectedTitle && $) {
    const pageTitle = $('title').text() || '';
    if (/solemnity/i.test(pageTitle)) {
      detectedType = "Solemnity";
      detectedTypeTa = "பெருவிழா";
    } else if (/memorial/i.test(pageTitle)) {
      detectedType = "Memorial";
      detectedTypeTa = "நினைவு நாள்";
    } else if (/feast/i.test(pageTitle)) {
      detectedType = "Feast";
      detectedTypeTa = "திருவிழா";
    }
  }

  if (detectedTitle) {
    const knownTa = KNOWN_FEAST_TRANSLATIONS[detectedTitle] || '';
    return {
      feastTitle: detectedTitle,
      feastTitleTa: knownTa,
      feastType: detectedType || 'Feast',
      feastTypeTa: detectedTypeTa || 'திருவிழா',
      hasFeastInfo: true,
      feastSaintObj,
      feastSaintName: feastSaintName || detectedTitle
    };
  }

  return {
    feastTitle: null,
    feastTitleTa: null,
    feastType: null,
    feastTypeTa: null,
    hasFeastInfo: false,
    feastSaintObj: null,
    feastSaintName: null
  };
}

// ─── VATICAN NEWS PARSER ─────────────────────────────────────────────────────

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache'
};

/**
 * Parses the Vatican News Saint of the Day calendar page for the given month & day.
 * 
 * Vatican News HTML page structure:
 * - Saints are organized under <section class="section ...">
 * - Section header contains the saint's name in <div class="section__head"><h2>Saint Name</h2></div>
 * - Featured/primary saint has class `section--evidence`
 * - Saint biography is in <div class="section__content"><p>...</p></div> (excluding the intro banner)
 * - Official saint portrait, if available, is in <img data-original="/content/dam/vaticannews/santi/...">
 * 
 * Returns: {
 *   primarySaint: { name, description, imageUrl, isEvidence, sectionEl },
 *   allSaints: [ { name, description, imageUrl, isEvidence } ],
 *   sourceUrl
 * } or null
 */
async function fetchFromCatholicReadings(month, day, year = new Date().getFullYear()) {
  const mIdx = parseInt(month, 10) - 1;
  const monthName = MONTH_NAMES[mIdx] || 'september';
  const dayNum = parseInt(day, 10);
  const directDayUrl = `${CATHOLIC_READINGS_BASE}/saint-of-the-day-for-${monthName}-${dayNum}/`;
  console.log(`[Saint Service] Fetching Catholic Readings Saint of the Day: ${directDayUrl}`);

  try {
    let dayRes = null;
    try {
      dayRes = await axios.get(directDayUrl, { headers: FETCH_HEADERS, timeout: 8000 });
    } catch (e) {
      console.warn(`[Saint Service] Direct day URL failed (${directDayUrl}), trying main page...`);
      dayRes = await axios.get(CATHOLIC_READINGS_URL, { headers: FETCH_HEADERS, timeout: 8000 });
    }

    if (!dayRes || !dayRes.data) return null;

    const $ = cheerio.load(dayRes.data);
    let saintArticleUrl = null;
    let saintNameCandidate = null;

    $('article a, .entry-content a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      const lowerHref = href.toLowerCase();
      const lowerText = text.toLowerCase();
      if (
        !lowerHref.includes('whatsapp') && 
        !lowerHref.includes('category') && 
        !lowerHref.includes('tag') &&
        !lowerHref.includes('feed') &&
        !lowerHref.includes('daily-readings') &&
        !lowerHref.includes('saint-of-the-day-for-') &&
        !lowerHref.includes('catholic-saint-of-the-day') &&
        !lowerHref.includes('all-saints') &&
        !lowerText.includes('saint of the day') &&
        !lowerText.includes('today’s saint') &&
        !lowerText.includes('catholic saint of the day') &&
        text.length > 2 &&
        !saintArticleUrl
      ) {
        saintArticleUrl = href;
        saintNameCandidate = text.replace(/^[👉\s*]+/, '').trim();
      }
    });

    if (!saintArticleUrl) {
      console.warn(`[Saint Service] Could not find specific saint article link on Catholic Readings for ${monthName} ${dayNum}`);
      return null;
    }

    console.log(`[Saint Service] Found Catholic Readings Saint article: "${saintNameCandidate}" -> ${saintArticleUrl}`);
    const articleRes = await axios.get(saintArticleUrl, { headers: FETCH_HEADERS, timeout: 8000 });
    const $art = cheerio.load(articleRes.data);

    let pageTitle = $art('h1.entry-title, .entry-title, h1').first().text().trim();
    if (!pageTitle) pageTitle = saintNameCandidate;
    
    let cleanName = pageTitle
      .replace(/\s*[-–—|]\s*Feast Day.*$/i, '')
      .replace(/\s*[-–—|]\s*Today.*$/i, '')
      .replace(/\s+\d{4}\s*$/g, '')
      .trim();
    if (!cleanName) cleanName = saintNameCandidate;

    const isGenericName = !cleanName || 
      /^(saint of the day|today's catholic saint|catholic saint of the day|today's saint|saints)$/i.test(cleanName.trim()) ||
      cleanName.trim().length < 3;
    if (isGenericName) {
      console.warn(`[Saint Service] Catholic Readings returned generic title: "${cleanName}". Rejecting.`);
      return null;
    }

    let rawImageUrl = null;
    $art('article img, .entry-content img').each((i, el) => {
      const src = $art(el).attr('src') || $art(el).attr('data-src') || '';
      if (src.includes('/uploads/') && !src.includes('Whatsapp') && !src.includes('50x50') && !src.includes('avatar') && !rawImageUrl) {
        rawImageUrl = src;
      }
    });

    let paragraphs = [];
    $art('.entry-content p, article p').each((i, el) => {
      const p = $art(el).text().trim();
      if (p.length > 30 && !p.includes('Follow the Catholic Daily Readings') && !p.includes('WhatsApp Channel') && !p.includes('Today’s Catholic Saint of the Day')) {
        paragraphs.push(p);
      }
    });
    let bioText = paragraphs.slice(0, 5).join('\n\n');

    const isBoilerplate = /Every day, we will|Other Sts whose feast day|December 31|டிசம்பர் 31|ஒவ்வொரு நாளும்|பீடிகாபிகேஷன்|Saints are special people in the Catholic faith|beacons of light/i.test(bioText);
    if (isBoilerplate || bioText.length < 50) {
      console.warn(`[Saint Service] Catholic Readings returned generic boilerplate text. Rejecting.`);
      return null;
    }

    return {
      name: cleanName,
      description: bioText,
      imageUrl: rawImageUrl,
      sourceUrl: saintArticleUrl,
      source: 'Catholic Readings'
    };
  } catch (err) {
    console.warn(`[Saint Service] Catholic Readings fetch error:`, err.message);
    return null;
  }
}

function normalizeSaintName(raw) {
  if (!raw) return '';
  let cleaned = raw.replace(/\s+/g, ' ').trim();
  // Title-casing if ALL CAPS
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    cleaned = cleaned.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
  }
  // Standardize St. and Sts. without double periods
  cleaned = cleaned.replace(/\bSts?\.?/gi, (m) => m.toLowerCase().startsWith('sts') ? 'Sts.' : 'St.');
  cleaned = cleaned.replace(/\.+/g, '.');
  cleaned = cleaned.replace(/,\s*pope\b/i, ', Pope');
  cleaned = cleaned.replace(/\bE\s+Bacchus\b/i, 'e Bacchus');
  cleaned = cleaned.replace(/,\s*martyrs\s+of\s+syria\b/i, ', Martyrs of Syria');
  return cleaned;
}

async function fetchVaticanLiturgicalHoliday(month, day) {
  const padMonth = String(month).padStart(2, '0');
  const padDay = String(day).padStart(2, '0');
  const mNum = parseInt(padMonth, 10);
  const url = `https://www.vaticannews.va/content/vaticannews/en/liturgical-holidays.list.month.${mNum}.js`;

  try {
    const res = await axios.get(url, { headers: FETCH_HEADERS, timeout: 8000 });
    if (res.data && typeof res.data === 'object') {
      const targetPattern = `-${padMonth}-${padDay}`;
      for (const [k, item] of Object.entries(res.data)) {
        if (k === 'totalMatches' || !item) continue;
        if ((item.date && item.date.includes(targetPattern)) || k.includes(targetPattern)) {
          return item;
        }
      }
    }
  } catch (err) {
    console.warn(`[Saint Service] Liturgical holidays API note (${padMonth}/${padDay}):`, err.message);
  }
  return null;
}

/**
 * Fetches the dedicated Vatican News Memorial page when a liturgical holiday is detected.
 * Extracts the authentic description (1-2 main paragraphs) and authentic image from Vatican News.
 * Uses NO AI generation, NO paraphrasing, and NO Wikipedia when dedicated page exists.
 */
async function fetchVaticanMemorialPage(holidayItem) {
  if (!holidayItem) return null;
  let holidayPath = holidayItem.path || '';
  if (holidayPath.startsWith('/content/vaticannews')) {
    holidayPath = holidayPath.replace('/content/vaticannews', '');
  }
  if (!holidayPath.endsWith('.html')) {
    holidayPath += '.html';
  }
  const holidayUrl = holidayPath.startsWith('http') ? holidayPath : `https://www.vaticannews.va${holidayPath}`;

  try {
    const pageRes = await axios.get(holidayUrl, { headers: FETCH_HEADERS, timeout: 9000 });
    const $ = cheerio.load(pageRes.data);

    // Extract authentic image from dedicated page
    let pageImg = null;
    $('img.cq-dd-image, .figure img, article img').each((i, el) => {
      const orig = $(el).attr('data-original') || $(el).attr('src');
      if (orig && !orig.startsWith('data:') && !orig.includes('logo') && !orig.includes('banner')) {
        pageImg = orig.startsWith('http') ? orig : `https://www.vaticannews.va${orig}`;
        return false;
      }
    });

    if (!pageImg && holidayItem.image) {
      const baseImg = holidayItem.image.startsWith('http') ? holidayItem.image : `https://www.vaticannews.va${holidayItem.image}`;
      pageImg = `${baseImg}/_jcr_content/renditions/cq5dam.thumbnail.cropped.750.422.png`;
    }

    // Extract 1-2 main descriptive paragraphs explaining the Memorial
    let paragraphs = [];
    $('article p, .section__content p').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length > 50 && !text.includes('cookie') && !text.includes('Radio Vaticana') && !text.includes('The Saint of the day presents') && !text.includes('Your contribution for a great mission')) {
        paragraphs.push(text);
      }
    });

    if (paragraphs.length === 0 && holidayItem.subTitle) {
      const $sub = cheerio.load(holidayItem.subTitle);
      $sub('p').each((i, el) => {
        const text = $sub(el).text().replace(/\s+/g, ' ').trim();
        if (text.length > 40) paragraphs.push(text);
      });
    }

    // Requirement 3 & 12: Extract approximately 1-2 main paragraphs
    const mainParagraphs = paragraphs.slice(0, 2);
    const description = mainParagraphs.join('\n\n').trim();

    console.log(`[Saint Service] Fetched dedicated Vatican Memorial page: ${holidayUrl}`);
    console.log(`[Saint Service] Extracted ${mainParagraphs.length} paragraphs (${description.length} chars), image: ${pageImg}`);

    return {
      title: holidayItem.title,
      url: holidayUrl,
      sourceUrl: holidayUrl,
      imageUrl: pageImg,
      description,
      paragraphs: mainParagraphs
    };
  } catch (err) {
    console.warn(`[Saint Service] Note on fetching dedicated Vatican Memorial page (${holidayUrl}):`, err.message);
    let paragraphs = [];
    if (holidayItem.subTitle) {
      const $sub = cheerio.load(holidayItem.subTitle);
      $sub('p').each((i, el) => {
        const text = $sub(el).text().replace(/\s+/g, ' ').trim();
        if (text.length > 40) paragraphs.push(text);
      });
    }
    let fallbackImg = null;
    if (holidayItem.image) {
      const baseImg = holidayItem.image.startsWith('http') ? holidayItem.image : `https://www.vaticannews.va${holidayItem.image}`;
      fallbackImg = `${baseImg}/_jcr_content/renditions/cq5dam.thumbnail.cropped.750.422.png`;
    }
    return {
      title: holidayItem.title,
      url: holidayUrl,
      sourceUrl: holidayUrl,
      imageUrl: fallbackImg,
      description: paragraphs.slice(0, 2).join('\n\n').trim(),
      paragraphs: paragraphs.slice(0, 2)
    };
  }
}

async function fetchFromVaticanNews(month, day, year = new Date().getFullYear()) {
  const vaticanUrl = buildVaticanNewsUrl(month, day);
  console.log(`[Saint Service] Fetching Vatican News Saint of the Day: ${vaticanUrl}`);

  try {
    // 1. Fetch liturgical holiday from Vatican News API
    const holidayFound = await fetchVaticanLiturgicalHoliday(month, day);

    // 2. Fetch Vatican Saints page
    const response = await axios.get(vaticanUrl, {
      headers: FETCH_HEADERS,
      timeout: 12000
    });

    if (response.status !== 200 || !response.data) {
      console.warn(`[Saint Service] Vatican News responded with status ${response.status} for ${vaticanUrl}`);
      return null;
    }

    const $ = cheerio.load(response.data);

    // Validate page content corresponds to calendar
    const pageTitle = $('title').text().trim();
    console.log(`[Saint Service] Vatican News Page Title: "${pageTitle}"`);

    const parsedSaints = [];
    const sectionEls = $('section.section').toArray();

    // Parse each saint section displayed on that day's page
    for (const el of sectionEls) {
      // Exclude introduction block
      if ($(el).find('.intro--saint').length > 0) continue;

      let h2 = $(el).find('.section__head h2, h2').text().replace(/\s+/g, ' ').trim();
      if (!h2) continue;
      const normalizedName = normalizeSaintName(h2);

      // Extract biography paragraphs from the section
      const paragraphs = [];
      $(el).find('.section__content p').each((pi, pel) => {
        const text = $(pel).text().replace(/\s+/g, ' ').trim();
        if (text && !text.includes('The Saint of the day presents a daily calendar') && text.length > 20) {
          paragraphs.push(text);
        }
      });

      let bio = paragraphs.join('\n\n').trim();
      const isEvidence = $(el).hasClass('section--evidence');
      const isRed = !isEvidence;

      // Extract detail page URL for this specific saint
      const detailLink = $(el).find('a[href^="/en/saints/"]').first().attr('href');
      let saintDetailUrl = vaticanUrl;
      if (detailLink && detailLink.endsWith('.html') && detailLink !== vaticanUrl) {
        saintDetailUrl = detailLink.startsWith('http') ? detailLink : `https://www.vaticannews.va${detailLink}`;
      }

      // Extract image associated with this specific saint from the Vatican News section HTML
      const vaticanImgObj = getVaticanSaintImage($, vaticanUrl, el);
      let imageUrl = vaticanImgObj ? vaticanImgObj.url : null;

      // If biography is short and section has deep detail link, fetch full article from Vatican News
      if (saintDetailUrl !== vaticanUrl && (!bio || bio.length < 300)) {
        try {
          const detailRes = await axios.get(saintDetailUrl, { headers: FETCH_HEADERS, timeout: 7000 });
          if (detailRes.status === 200 && detailRes.data) {
            const $$ = cheerio.load(detailRes.data);
            const deepParas = [];
            $$('article p, .section__content p').each((dpi, dpel) => {
              const dt = $$(dpel).text().replace(/\s+/g, ' ').trim();
              if (dt && !dt.includes('The Saint of the day presents a daily calendar') && dt.length > 20) {
                deepParas.push(dt);
              }
            });
            if (deepParas.length > 0) {
              bio = deepParas.join('\n\n').trim();
              console.log(`[Saint Service] Fetched full Vatican News deep article for "${normalizedName}" (${bio.length} chars)`);
            }
            if (!imageUrl) {
              const deepImg = getVaticanSaintImage($$, saintDetailUrl);
              if (deepImg && deepImg.url) {
                imageUrl = deepImg.url;
                console.log(`[Saint Service] Found Vatican News image in deep article for "${normalizedName}": ${imageUrl}`);
              }
            }
          }
        } catch (de) {
          console.warn(`[Saint Service] Deep article fetch notice for ${normalizedName}: ${de.message}`);
        }
      }

      parsedSaints.push({
        name: normalizedName,
        rawName: h2,
        description: bio,
        imageUrl,
        sourceUrl: saintDetailUrl,
        detailUrl: saintDetailUrl,
        isEvidence,
        isRed,
        sectionEl: el
      });
    }

    if (parsedSaints.length === 0 && !holidayFound) {
      console.warn(`[Saint Service] No saint sections found on Vatican News page for ${month}/${day}`);
      return null;
    }

    console.log(`[Saint Service] Found ${parsedSaints.length} saints on Vatican News (${month}/${day}):`, 
      parsedSaints.map(s => `"${s.name}" (bioLen=${s.description.length}, hasImg=${!!s.imageUrl})`).join('; ')
    );

    // ── LITURGICAL CELEBRATION & PRIMARY SAINT SELECTION ─────────────────
    let primarySaintCandidate = null;
    let otherSaintsCandidates = [];
    let detectedCelebrationType = null;
    let detectedFeastTitle = null;
    let detectedFeastName = null;

    if (holidayFound && holidayFound.title) {
      detectedFeastTitle = holidayFound.title.trim();
      if (/solemnity/i.test(detectedFeastTitle)) detectedCelebrationType = 'Solemnity';
      else if (/feast/i.test(detectedFeastTitle)) detectedCelebrationType = 'Feast';
      else if (/optional memorial/i.test(detectedFeastTitle)) detectedCelebrationType = 'Optional Memorial';
      else if (/memorial/i.test(detectedFeastTitle)) detectedCelebrationType = 'Memorial';
      else if (/commemoration/i.test(detectedFeastTitle)) detectedCelebrationType = 'Commemoration';
      else detectedCelebrationType = 'Memorial';

      detectedFeastName = detectedFeastTitle
        .replace(/^(Solemnity|Feast|Optional Memorial|Memorial|Commemoration)\s+of\s+(the\s+|Saint\s+|Sts\.\s+|St\.\s+)?/i, '')
        .trim();

      // Fetch dedicated Vatican Memorial page content & image
      const memorialDetails = await fetchVaticanMemorialPage(holidayFound);

      // Check if any parsed saint on this page matches this celebration name
      const cleanFeastName = detectedFeastName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchIdx = parsedSaints.findIndex(s => {
        const cleanS = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanS.includes(cleanFeastName) || cleanFeastName.includes(cleanS);
      });

      if (matchIdx >= 0) {
        // Matched a saint in the list! That saint is primary, remainder are other saints
        const matchedSaint = parsedSaints[matchIdx];
        primarySaintCandidate = {
          ...matchedSaint,
          name: detectedFeastName,
          rawName: detectedFeastTitle,
          description: memorialDetails?.description || matchedSaint.description,
          imageUrl: memorialDetails?.imageUrl || matchedSaint.imageUrl,
          sourceUrl: memorialDetails?.url || matchedSaint.sourceUrl,
          detailUrl: memorialDetails?.url || matchedSaint.detailUrl,
          isDedicatedMemorial: Boolean(memorialDetails?.description)
        };
        otherSaintsCandidates = parsedSaints.filter((_, idx) => idx !== matchIdx);
      } else {
        // Did not match a saint in the parsed list (e.g. October 7: Memorial of Our Lady of the Rosary,
        // while saints on page are St. Mark, Pope and Sts. Sergius e Bacchus, Martyrs of Syria).
        // Primary celebration is Our Lady of the Rosary!
        // All parsed saints on Vatican page become other saints!
        let holidayUrl = vaticanUrl;
        if (holidayFound.path) {
          let p = holidayFound.path.replace('/content/vaticannews', '');
          if (!p.endsWith('.html')) p += '.html';
          holidayUrl = `https://www.vaticannews.va${p}`;
        }
        primarySaintCandidate = {
          name: detectedFeastName,
          rawName: detectedFeastTitle,
          description: memorialDetails?.description || '',
          imageUrl: memorialDetails?.imageUrl || null,
          sourceUrl: memorialDetails?.url || holidayUrl,
          detailUrl: memorialDetails?.url || holidayUrl,
          isCelebrationOnly: true,
          isDedicatedMemorial: Boolean(memorialDetails?.description)
        };
        otherSaintsCandidates = [...parsedSaints];
      }
    } else {
      // Check page content / parsed saints for Solemnity, Feast, or Memorial
      const dateKey = `${year}-${month}-${day}`;
      const feastInfo = extractFeastInfo($, parsedSaints, month, day, dateKey);
      if (feastInfo && feastInfo.hasFeastInfo && feastInfo.feastSaintObj) {
        detectedCelebrationType = feastInfo.feastType || 'Feast';
        detectedFeastTitle = feastInfo.feastTitle;
        detectedFeastName = feastInfo.feastSaintName || feastInfo.feastTitle;
        primarySaintCandidate = { ...feastInfo.feastSaintObj };
        otherSaintsCandidates = parsedSaints.filter(s => s.name !== feastInfo.feastSaintObj.name);
      } else {
        // Fallback: choose red saint or evidence saint or first saint
        const redSaint = parsedSaints.find(s => s.isRed && s.description.length > 0);
        const evidenceSaint = parsedSaints.find(s => s.isEvidence && s.description.length > 0);
        const chosen = redSaint || evidenceSaint || parsedSaints[0];
        primarySaintCandidate = chosen ? { ...chosen } : null;
        otherSaintsCandidates = parsedSaints.filter(s => s !== chosen);
        detectedCelebrationType = null;
        detectedFeastTitle = primarySaintCandidate?.name || null;
        detectedFeastName = primarySaintCandidate?.name || null;
      }
    }

    return {
      primarySaint: primarySaintCandidate,
      otherSaints: otherSaintsCandidates,
      allSaints: primarySaintCandidate ? [primarySaintCandidate, ...otherSaintsCandidates] : otherSaintsCandidates,
      celebrationType: detectedCelebrationType,
      feastTitle: detectedFeastTitle,
      feastName: detectedFeastName,
      liturgicalHoliday: holidayFound,
      sourceUrl: vaticanUrl,
      $
    };

  } catch (err) {
    if (err.response?.status === 404) {
      console.warn(`[Saint Service] Vatican News 404 for ${month}/${day} (e.g. leap year Feb 29). Will use fallback.`);
    } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      console.warn(`[Saint Service] Vatican News request timed out for ${month}/${day}. Will use fallback.`);
    } else {
      console.warn(`[Saint Service] Vatican News request failed for ${month}/${day}: ${err.message}`);
    }
    return null;
  }
}

// ─── MAIN DAILY SAINT FETCH ──────────────────────────────────────────────────

/**
 * Fetch Saint of the Day for the current (or given) IST date.
 *
 * Priority:
 *   1. Vatican News official calendar page (dynamic MM/DD.html URL)
 *   2. Vatican Liturgical Celebration (Memorial / Feast / Solemnity) takes priority as primary celebration
 *   3. All other saints commemorated that day are retained in otherSaints
 *   4. Image priority:
 *        a) Vatican News official portrait
 *        b) Wikipedia exact saint portrait (identity validated)
 *        c) Dignified sacred portrait (St. John de Britto)
 *   5. Wikipedia biography enhancement if Vatican bio is short
 *   6. Catholic Liturgical Calendar fallback
 *
 * February 4 always returns Parish Patron St. John de Britto.
 * Validates fetched content belongs to current date and never overwrites with empty data.
 */
async function fetchDailySaint(targetDate = new Date(), forceRefresh = false) {
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
  const year = parts.find(p => p.type === 'year')?.value || String(dt.getFullYear());
  const dateKey = `${year}-${month}-${day}`;
  const isCurrentToday = (dateKey === getISTDateParts().dateKey);

  // February 4 — Parish Patron Feast Day override
  if (month === '02' && day === '04') {
    const patronSaintObj = {
      ...ST_JOHN_DE_BRITTO,
      date: dateKey,
      primarySaint: {
        name: ST_JOHN_DE_BRITTO.name,
        englishName: ST_JOHN_DE_BRITTO.englishName,
        tamilName: ST_JOHN_DE_BRITTO.tamilName,
        title: ST_JOHN_DE_BRITTO.feastTitle,
        celebrationType: ST_JOHN_DE_BRITTO.feastType,
        feastName: ST_JOHN_DE_BRITTO.name,
        description: ST_JOHN_DE_BRITTO.description,
        descriptionTa: ST_JOHN_DE_BRITTO.descriptionTa,
        image: ST_JOHN_DE_BRITTO.image,
        source: ST_JOHN_DE_BRITTO.source,
        sourceUrl: ST_JOHN_DE_BRITTO.sourceUrl
      },
      otherSaints: [],
      saints: [ST_JOHN_DE_BRITTO],
      allSaints: [ST_JOHN_DE_BRITTO],
      status: "Synced",
      lastSynced: new Date()
    };
    if (isCurrentToday) {
      dailySaint = patronSaintObj;
    }
    await saveSaintToDatabase(patronSaintObj, isCurrentToday);
    console.log(' Saint of the Day forced to Patron Saint St. John de Britto (Feb 4th)');
    return patronSaintObj;
  }

  // Check database cache for arbitrary requested date to avoid redundant scraping (bypassed if forceRefresh or stale)
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1 && !forceRefresh) {
      const SiteSettings = require('../models/SiteSettings');
      const cached = await SiteSettings.findOne({ key: `daily_saint_cache_${dateKey}` }).lean();
      if (cached && cached.value) {
        const parsed = JSON.parse(cached.value);
        const isStaleMissingStructure = !parsed.primarySaint || !parsed.otherSaints || !parsed.primaryCelebration;
        const isStaleRosaryOnOct07 = dateKey.endsWith('-10-07') && (
          !parsed.primarySaint?.name?.includes('Rosary') ||
          !parsed.saintName?.includes('Rosary') ||
          !parsed.description?.includes('Holy Rosary originated in 1212') ||
          !parsed.primarySaint?.sourceUrl?.includes('memorial-of-our-lady-of-the-rosary')
        );
        const isStaleNilusOnSep26 = dateKey.endsWith('-09-26') && (
          (parsed.saintName && parsed.saintName.includes('Nilus')) ||
          (parsed.name && parsed.name.includes('Nilus')) ||
          (parsed.englishName && parsed.englishName.includes('Nilus'))
        );
        const isStaleGuardianAngelsOnOtherDate = !dateKey.endsWith('-10-02') && (
          (parsed.description && parsed.description.includes('celestial protectors')) ||
          (parsed.descriptionTa && parsed.descriptionTa.includes('பரலோக பாதுகாவலர்'))
        );
        const hasShortBio = !parsed.description || parsed.description.length < 250;
        const hasMissingSecondaryImages = parsed.saints && parsed.saints.length > 1 && parsed.saints.some(s => !s.image && !s.imageUrl);
        const hasMissingSecondaryBio = parsed.saints && parsed.saints.length > 1 && parsed.saints.some(s => !s.description || s.description.length < 200);

        if (!isStaleMissingStructure && !isStaleRosaryOnOct07 && !isStaleNilusOnSep26 && !isStaleGuardianAngelsOnOtherDate && !hasShortBio && !hasMissingSecondaryImages && !hasMissingSecondaryBio && parsed && parsed.date === dateKey && (parsed.saintName || parsed.name) && parsed.image && !parsed.imageFallback) {
          if (isCurrentToday) {
            dailySaint = parsed;
          }
          return parsed;
        }
      }
    }
  } catch (e) {}

  const fallbackSaint = getSaintForDate(dateKey);
  const formattedFeastDay = dt.toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const vaticanUrl = buildVaticanNewsUrl(month, day);
  console.log(`[Saint Service] Fetching Saint of the Day for ${dateKey} (IST) from Vatican News: ${vaticanUrl}`);
  const vaticanResult = await fetchFromVaticanNews(month, day, year);

  let primaryCandidate = null;
  let otherCandidates = [];
  let celebrationType = null;
  let feastTitle = null;
  let feastName = null;

  if (vaticanResult && vaticanResult.primarySaint) {
    primaryCandidate = vaticanResult.primarySaint;
    otherCandidates = vaticanResult.otherSaints || [];
    celebrationType = vaticanResult.celebrationType;
    feastTitle = vaticanResult.feastTitle;
    feastName = vaticanResult.feastName;
  } else {
    // Tertiary Fallback: Catholic Liturgical Calendar
    console.log(`[Saint Service] Vatican News unavailable for ${dateKey} → using Catholic Liturgical Calendar`);
    primaryCandidate = {
      name: fallbackSaint.name,
      rawName: fallbackSaint.name,
      description: fallbackSaint.description,
      descriptionTa: fallbackSaint.descriptionTa,
      imageUrl: fallbackSaint.image,
      sourceUrl: fallbackSaint.link || vaticanUrl,
      detailUrl: fallbackSaint.link || vaticanUrl
    };
    celebrationType = fallbackSaint.feastType || null;
    feastTitle = fallbackSaint.feastTitle || null;
    feastName = fallbackSaint.name;
    otherCandidates = [];
  }

  const primaryName = primaryCandidate.name;
  let primaryBio = primaryCandidate.description || '';
  let primarySourceUrl = primaryCandidate.sourceUrl || vaticanUrl;
  let primaryContentSource = 'Vatican News';

  const isDedicatedMemorial = Boolean(primaryCandidate.isDedicatedMemorial && primaryBio && primaryBio.length >= 100);

  // If dedicated Vatican Memorial page was fetched, use its actual text directly (NO AI, NO Wikipedia)
  if (isDedicatedMemorial) {
    console.log(`[Saint Service] Using authoritative Vatican News Memorial description for "${primaryName}" (${primaryBio.length} chars)`);
    primaryContentSource = 'Vatican News';
    primarySourceUrl = primaryCandidate.sourceUrl || vaticanUrl;
  } else if (!isSufficientBio(primaryBio)) {
    console.log(`[Saint Service] Fetching biography from Wikipedia for primary saint "${primaryName}"...`);
    try {
      const wikiBio = await fetchWikipediaBio(primaryName);
      if (wikiBio && isSufficientBio(wikiBio.text)) {
        primaryBio = wikiBio.text;
        primarySourceUrl = wikiBio.url;
        primaryContentSource = 'Wikipedia';
      } else if (wikiBio && wikiBio.text && wikiBio.text.length >= 150) {
        primaryBio = wikiBio.text;
        primarySourceUrl = wikiBio.url;
        primaryContentSource = 'Wikipedia';
      } else {
        primaryBio = generateComprehensiveCatholicBio(primaryName, dateKey);
        primarySourceUrl = vaticanUrl;
        primaryContentSource = 'Vatican News';
      }
    } catch (e) {
      primaryBio = generateComprehensiveCatholicBio(primaryName, dateKey);
    }
  }

  // Primary image handling (Vatican first, then Wikipedia fallback)
  let primaryImageResult = null;
  if (primaryCandidate.imageUrl) {
    console.log(`[Saint Service] Using authentic Vatican News image for "${primaryName}": ${primaryCandidate.imageUrl}`);
    const cached = await cacheSaintImageFile(primaryCandidate.imageUrl, primaryName);
    primaryImageResult = {
      url: primaryCandidate.imageUrl,
      imageUrl: primaryCandidate.imageUrl,
      remoteUrl: primaryCandidate.imageUrl,
      localUrl: cached.localUrl,
      localPath: cached.localPath,
      buffer: cached.buffer,
      source: 'vatican',
      sourceUrl: primaryCandidate.sourceUrl || vaticanUrl,
      fallback: false
    };
  } else {
    console.log(`[Saint Service] Searching Wikipedia image fallback for primary saint "${primaryName}"...`);
    try {
      const wikiImg = await searchWikipediaSaintImage(primaryName);
      if (wikiImg && wikiImg.url) {
        primaryImageResult = wikiImg;
      }
    } catch (e) {
      console.warn(`[Saint Service] Wikipedia image search note for "${primaryName}":`, e.message);
    }
  }

  if (!primaryImageResult || !primaryImageResult.url) {
    const cachedFallback = await cacheSaintImageFile(DIGNIFIED_FALLBACK_IMAGE, 'saint_sacred_portrait');
    primaryImageResult = {
      url: DIGNIFIED_FALLBACK_IMAGE,
      imageUrl: DIGNIFIED_FALLBACK_IMAGE,
      remoteUrl: DIGNIFIED_FALLBACK_IMAGE,
      localUrl: cachedFallback.localUrl,
      localPath: cachedFallback.localPath,
      buffer: cachedFallback.buffer,
      source: 'liturgical_fallback',
      sourceUrl: vaticanUrl,
      fallback: true
    };
  }

  const primaryImageUrl = primaryImageResult.remoteUrl || primaryImageResult.url || DIGNIFIED_FALLBACK_IMAGE;

  // Primary Tamil translation
  let primaryTamilName = '';
  if (KNOWN_FEAST_TRANSLATIONS[primaryName]) {
    primaryTamilName = KNOWN_FEAST_TRANSLATIONS[primaryName];
  } else if (cleanSaintName(primaryName).toLowerCase().includes('lorenzo ruiz')) {
    primaryTamilName = 'புனித லோரென்சோ ரூயிஸ் மற்றும் தோழர்கள்';
  } else if (cleanSaintName(primaryName).toLowerCase().includes('wenceslaus')) {
    primaryTamilName = 'புனித வென்செஸ்லாஸ்';
  } else if (fallbackSaint && cleanSaintName(primaryName).toLowerCase().includes(cleanSaintName(fallbackSaint.name).toLowerCase())) {
    primaryTamilName = fallbackSaint.nameTa;
  } else {
    try {
      primaryTamilName = await translateText(primaryName, 'ta');
    } catch (e) {}
  }
  if (!primaryTamilName) primaryTamilName = primaryName;

  let primaryTitleTa = null;
  if (feastTitle && KNOWN_FEAST_TRANSLATIONS[feastTitle]) {
    primaryTitleTa = KNOWN_FEAST_TRANSLATIONS[feastTitle];
  } else if (feastTitle) {
    try {
      primaryTitleTa = await translateText(feastTitle, 'ta');
    } catch (e) {}
  }
  if (!primaryTitleTa) primaryTitleTa = primaryTamilName;

  let celebrationTypeTa = null;
  if (celebrationType) {
    if (/solemnity/i.test(celebrationType)) celebrationTypeTa = 'பெருவிழா';
    else if (/feast/i.test(celebrationType)) celebrationTypeTa = 'திருவிழா';
    else if (/memorial/i.test(celebrationType)) celebrationTypeTa = 'நினைவுநாள்';
    else celebrationTypeTa = 'நினைவுநாள்';
  }

  let primaryBioTa = '';
  try {
    primaryBioTa = await translateBiography(primaryBio, 'ta');
  } catch (e) {}

  const primarySaintObj = {
    name: primaryName,
    englishName: primaryName,
    nameEn: primaryName,
    tamilName: primaryTamilName,
    nameTa: primaryTamilName,
    title: feastTitle || primaryName,
    titleEn: feastTitle || primaryName,
    titleTa: primaryTitleTa,
    celebrationType: celebrationType || null,
    celebrationTypeTa: celebrationTypeTa || null,
    feastName: feastName || primaryName,
    description: primaryBio,
    descriptionEn: primaryBio,
    descriptionTa: primaryBioTa,
    image: primaryImageUrl,
    imageUrl: primaryImageUrl,
    imageSource: primaryImageResult.source || 'vatican',
    imageSourceUrl: primaryImageResult.sourceUrl || vaticanUrl,
    source: "Vatican News",
    sourceUrl: primarySourceUrl,
    detailUrl: primarySourceUrl,
    contentSource: primaryContentSource
  };

  // ── PROCESS OTHER SAINTS ─────────────────────────────────────────────
  const formattedOtherSaints = [];
  for (const s of otherCandidates) {
    let sBio = s.description || '';
    let sSourceUrl = s.sourceUrl || s.detailUrl || vaticanUrl;
    let sContentSource = 'Vatican News';

    // Enhance biography from Wikipedia if Vatican bio is short
    if (!isSufficientBio(sBio)) {
      console.log(`[Saint Service] Fetching biography from Wikipedia for other saint "${s.name}"...`);
      try {
        const wikiBio = await fetchWikipediaBio(s.name);
        if (wikiBio && isSufficientBio(wikiBio.text)) {
          sBio = wikiBio.text;
          sSourceUrl = wikiBio.url;
          sContentSource = 'Wikipedia';
        } else if (wikiBio && wikiBio.text && wikiBio.text.length >= 150) {
          sBio = wikiBio.text;
          sSourceUrl = wikiBio.url;
          sContentSource = 'Wikipedia';
        } else {
          sBio = generateComprehensiveCatholicBio(s.name, dateKey);
        }
      } catch (wbErr) {
        sBio = generateComprehensiveCatholicBio(s.name, dateKey);
      }
    }

    // Image for other saint
    let sImageUrl = s.imageUrl || null;
    let sImageSource = s.imageUrl ? 'vatican' : 'wikipedia';
    let sImageSourceUrl = s.imageUrl ? (s.sourceUrl || vaticanUrl) : null;

    if (s.imageUrl) {
      try {
        const cached = await cacheSaintImageFile(s.imageUrl, s.name);
        sImageUrl = s.imageUrl;
      } catch (e) {}
    } else {
      console.log(`[Saint Service] Searching Wikipedia image fallback for other saint "${s.name}"...`);
      try {
        const wikiImg = await searchWikipediaSaintImage(s.name);
        if (wikiImg && wikiImg.url) {
          sImageUrl = wikiImg.url;
          sImageSource = 'wikipedia';
          sImageSourceUrl = wikiImg.sourceUrl;
        }
      } catch (imgErr) {}
    }

    if (!sImageUrl) {
      sImageUrl = DIGNIFIED_FALLBACK_IMAGE;
      sImageSource = 'liturgical_fallback';
      sImageSourceUrl = vaticanUrl;
    }

    // Tamil translations for other saint
    let sTamilName = '';
    if (KNOWN_FEAST_TRANSLATIONS[s.name]) {
      sTamilName = KNOWN_FEAST_TRANSLATIONS[s.name];
    } else {
      try {
        sTamilName = await translateText(s.name, 'ta');
      } catch (e) {}
    }
    if (!sTamilName) sTamilName = s.name;

    let sDescTa = '';
    try {
      sDescTa = await translateBiography(sBio, 'ta');
    } catch (e) {}

    formattedOtherSaints.push({
      name: s.name,
      englishName: s.name,
      nameEn: s.name,
      tamilName: sTamilName,
      nameTa: sTamilName,
      title: s.name,
      titleEn: s.name,
      titleTa: sTamilName,
      description: sBio,
      descriptionEn: sBio,
      descriptionTa: sDescTa,
      image: sImageUrl,
      imageUrl: sImageUrl,
      imageSource: sImageSource,
      imageSourceUrl: sImageSourceUrl,
      source: "Vatican News",
      sourceUrl: sSourceUrl,
      detailUrl: sSourceUrl,
      contentSource: sContentSource
    });
  }

  // Combined saints list for backward compatibility (primary saint first, then other saints)
  const allSaintsList = [primarySaintObj, ...formattedOtherSaints];

  let imageBuffer = primaryImageResult?.buffer || null;
  if (!imageBuffer && primaryImageResult?.localPath && fs.existsSync(primaryImageResult.localPath)) {
    try { imageBuffer = fs.readFileSync(primaryImageResult.localPath); } catch (e) {}
  }
  const imageAttachment = imageBuffer ? {
    filename: 'saint_of_the_day.jpg',
    content: imageBuffer,
    cid: 'saintOfTheDayImage',
    contentType: 'image/jpeg'
  } : null;

  const primaryCelebrationObj = {
    name: primaryName,
    type: celebrationType || "Memorial",
    celebrationType: celebrationType || "Memorial",
    description: primaryBio,
    image: primaryImageUrl,
    sourceUrl: primarySourceUrl,
    source: "Vatican News",
    englishName: primaryName,
    tamilName: primaryTamilName,
    nameTa: primaryTamilName,
    title: feastTitle || primaryName,
    titleTa: primaryTitleTa,
    descriptionTa: primaryBioTa
  };

  const saintPayload = {
    date: dateKey,
    source: "Vatican News",
    sourceUrl: primarySourceUrl,
    link: primarySourceUrl,
    nameEn: primaryName,
    titleEn: feastTitle || primaryName,
    descriptionEn: primaryBio,
    nameTa: primaryTamilName,
    titleTa: primaryTitleTa,
    descriptionTa: primaryBioTa,
    imageUrl: primaryImageUrl,
    image: primaryImageUrl,
    remoteUrl: primaryImageUrl,
    localUrl: primaryImageResult?.localUrl || null,
    localPath: primaryImageResult?.localPath || null,
    imageAttachment,
    imageSource: primaryImageResult?.source || 'vatican',
    imageSourceUrl: primaryImageResult?.sourceUrl || primarySourceUrl,
    imageFallback: Boolean(primaryImageResult?.fallback),
    saintName: primaryName,
    englishName: primaryName,
    tamilName: primaryTamilName,
    name: primaryName,
    nameTa: primaryTamilName,
    description: primaryBio,
    feastDay: formattedFeastDay,
    feastDayEn: formattedFeastDay,
    feastTitle: feastTitle || null,
    feastTitleTa: primaryTitleTa || null,
    feastType: celebrationType || null,
    feastTypeTa: celebrationTypeTa || null,
    hasFeastInfo: Boolean(celebrationType),
    primaryCelebration: primaryCelebrationObj,
    primarySaint: primarySaintObj,
    otherSaints: formattedOtherSaints,
    saints: allSaintsList,
    allSaints: allSaintsList,
    status: "Synced",
    lastSynced: new Date()
  };

  if (isCurrentToday) {
    dailySaint = saintPayload;
  }

  await saveSaintToDatabase(saintPayload, isCurrentToday);

  // ── DETAILED LOGGING (Requirement 9) ─────────────────────────────────
  console.log(`[SaintSync] Date: ${dateKey}`);
  console.log(`[SaintSync] Vatican URL: ${vaticanUrl}`);
  console.log(`[SaintSync] Liturgical celebration: ${feastName || primaryName}`);
  console.log(`[SaintSync] Celebration type: ${celebrationType || 'Memorial'}`);
  console.log(`[SaintSync] Primary saint: ${primaryName}`);
  console.log(`[SaintSync] Other saints: ${formattedOtherSaints.map(s => s.name).join('; ') || 'None'}`);
  console.log(`[SaintSync] Primary image: ${primaryImageUrl}`);
  console.log(`[SaintSync] Sync completed successfully`);

  if (retryTimeout && isCurrentToday) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }

  return saintPayload;
}

// ─── DATABASE CACHE ──────────────────────────────────────────────────────────

async function saveSaintToDatabase(saintObj, isToday = false) {
  try {
    if (!saintObj || !saintObj.date) return;
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) return;

    // Validation guard: never overwrite cache with empty/invalid saint payload
    if (!saintObj.saintName || typeof saintObj.saintName !== 'string' || saintObj.saintName.trim().length < 2) {
      console.warn('⚠️ [SaintService] Refusing to overwrite cache with empty/invalid saint payload.');
      return;
    }
    const SiteSettings = require('../models/SiteSettings');
    
    // Always persist in date-specific cache entry
    await SiteSettings.findOneAndUpdate(
      { key: `daily_saint_cache_${saintObj.date}` },
      { value: JSON.stringify(saintObj), label: `Daily Saint Cache for ${saintObj.date}`, type: 'text' },
      { upsert: true, new: true }
    );

    // Only update global daily_saint_cache if this is current IST today
    if (isToday) {
      await SiteSettings.findOneAndUpdate(
        { key: 'daily_saint_cache' },
        { value: JSON.stringify(saintObj), label: 'Daily Saint Cache', type: 'text' },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.error('Failed to save daily saint cache to database:', err.message);
  }
}

async function loadCachedSaint() {
  try {
    const mongoose = require('mongoose');
    const { dateKey, dt } = getISTDateParts();
    const todayStr = dateKey;

    if (mongoose.connection.readyState === 1) {
      const SiteSettings = require('../models/SiteSettings');
      let cacheSetting = await SiteSettings.findOne({ key: `daily_saint_cache_${dateKey}` }).lean();
      if (!cacheSetting) {
        cacheSetting = await SiteSettings.findOne({ key: 'daily_saint_cache' }).lean();
      }

      if (cacheSetting && cacheSetting.value) {
        const parsed = JSON.parse(cacheSetting.value);
        const isBrokenVirginMary = parsed.image && parsed.image.includes('Virgin_Mary_by_Giovanni_Battista_Salvi_da_Sassoferrato');
        const isGarbageImage = parsed.image && (
          parsed.image.includes('imimg.com') ||
          parsed.image.includes('metroprin') ||
          parsed.image.includes('Superdome') ||
          parsed.image.includes('stadium')
        );
        const isStaleMissingStructure = !parsed.primarySaint || !parsed.otherSaints;
        const isStaleRosaryOnOct07 = dateKey.endsWith('-10-07') && (
          !parsed.primarySaint?.name?.includes('Rosary') ||
          !parsed.saintName?.includes('Rosary')
        );
        const isStaleCatholicReadings = (parsed.source && parsed.source.includes('Catholic Readings')) ||
          (parsed.sourceUrl && parsed.sourceUrl.includes('catholicreadings.org'));

        const isGenericName = (parsed.saintName || parsed.name || '').toLowerCase().includes('saint of the day') ||
          (parsed.nameTa || parsed.tamilName || '') === 'இன்றைய புனிதர்';
        const isBoilerplateBio = /Every day, we will|Other Sts whose feast day|December 31|டிசம்பர் 31|ஒவ்வொரு நாளும்|பீடிகாபிகேஷன்|Saints are special people in the Catholic faith|beacons of light/i.test(
          (parsed.description || '') + ' ' + (parsed.descriptionTa || '')
        );

        const hasShortBio = !parsed.description || parsed.description.length < 250;

        // Valid cache: matches today's date AND has valid structure AND has valid image AND is not generic/boilerplate
        if (parsed && parsed.date === todayStr && !isStaleMissingStructure && !isStaleRosaryOnOct07 && (parsed.saintName || parsed.name) && parsed.image && !isBrokenVirginMary && !isGarbageImage && !isStaleCatholicReadings && !isGenericName && !isBoilerplateBio && !hasShortBio) {
          if (!parsed.imageAttachment && parsed.localPath) {
            try {
              const fs = require('fs');
              if (fs.existsSync(parsed.localPath)) {
                parsed.imageAttachment = {
                  filename: 'saint_of_the_day.jpg',
                  content: fs.readFileSync(parsed.localPath),
                  cid: 'saintOfTheDayImage',
                  contentType: 'image/jpeg'
                };
              }
            } catch (e) {}
          }

          dailySaint = parsed;
          if (dailySaint.lastSynced) {
            dailySaint.lastSynced = new Date(dailySaint.lastSynced);
          }
          console.log(" Loaded today's daily saint from database cache:", dailySaint.saintName || dailySaint.name);
          return;
        } else if (isGarbageImage) {
          console.warn("⚠️ Discarding obsolete/stale cache from database with invalid image. Fresh fetch will run immediately.");
        }
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
      feastTitle: fallbackSaint.feastTitle || null,
      feastTitleTa: fallbackSaint.feastTitleTa || null,
      feastType: fallbackSaint.feastType || null,
      feastTypeTa: fallbackSaint.feastTypeTa || null,
      source: "Vatican News",
      sourceUrl: buildVaticanNewsUrl(todayStr.split('-')[1], todayStr.split('-')[2]),
      link: buildVaticanNewsUrl(todayStr.split('-')[1], todayStr.split('-')[2]),
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

// Re-verify and sync when MongoDB connection is fully established
try {
  const mongoose = require('mongoose');
  mongoose.connection.on('connected', async () => {
    try {
      console.log('🔄 [Saint Service] MongoDB connection established. Checking daily saint cache...');
      await loadCachedSaint();
      if (!dailySaint || 
          dailySaint.source === 'Catholic Liturgical Calendar' || 
          dailySaint.imageFallback || 
          (dailySaint.date?.endsWith('-09-26') && (dailySaint.saintName?.includes('Nilus') || dailySaint.name?.includes('Nilus')))
      ) {
        await fetchDailySaint();
      }
    } catch (err) {
      console.warn('[Saint Service] DB connected sync notice:', err.message);
    }
  });
} catch (e) {}

// ─── 12:00 AM & 12:00 PM IST DAILY SYNC CRONS ────────────────────────────────
// Server-side schedulers explicitly configured with Asia/Kolkata timezone
cron.schedule('0 0 * * *', async () => {
  const { dateKey } = getISTDateParts();
  console.log(`🔄 [CRON 12:00 AM IST] Updating Saint of the Day for ${dateKey} from Vatican News...`);
  dailySaint = null; // Invalidate previous day in memory immediately
  try {
    await fetchDailySaint();
    console.log(`✅ [CRON 12:00 AM IST] Saint of the Day successfully synchronized from Vatican News for ${dateKey}`);
  } catch (err) {
    console.error(`❌ [CRON 12:00 AM IST] Saint sync failed for ${dateKey}:`, err.message);
  }
}, {
  timezone: 'Asia/Kolkata'
});

// Also run at 12:00 PM IST (Noon) to guarantee continuous synchronization
cron.schedule('0 12 * * *', async () => {
  const { dateKey } = getISTDateParts();
  console.log(`🔄 [CRON 12:00 PM IST] Midday refresh for Saint of the Day (${dateKey})...`);
  try {
    await fetchDailySaint();
    console.log(`✅ [CRON 12:00 PM IST] Saint of the Day synchronized for ${dateKey}`);
  } catch (err) {
    console.error(`❌ [CRON 12:00 PM IST] Saint sync failed for ${dateKey}:`, err.message);
  }
}, {
  timezone: 'Asia/Kolkata'
});

console.log('✅ [Saint Service] 12:00 AM & 12:00 PM IST Cron Schedulers registered (Asia/Kolkata).');

// ─── Search and apply verified Wikipedia saint image ──────────────────────────
async function searchAndApplySaintImage(saintName) {
  if (!saintName) return null;
  const { searchWikipediaSaintImage } = require('./saintImageResolver');
  
  const found = await searchWikipediaSaintImage(saintName);
  if (found && found.url) {
    if (dailySaint) {
      dailySaint.image = found.url;
      dailySaint.imageSource = found.source || 'wikipedia';
      dailySaint.imageSourceUrl = found.sourceUrl;
      dailySaint.imageFallback = false;
      await saveSaintToDatabase(dailySaint, true);
    }
    return found;
  }
  return null;
}

// ─── SYNCHRONOUS GETTER (used by controllers & content services) ────────────
const getDailySaint = (targetDate = new Date()) => {
  const { dateKey, dt } = getISTDateParts(targetDate);
  const todayStr = dateKey;

  const isGenericName = !dailySaint?.name || 
    (dailySaint.name || '').toLowerCase().includes('saint of the day') ||
    (dailySaint.nameTa || dailySaint.tamilName || '') === 'இன்றைய புனிதர்';
  const isBoilerplateBio = /Every day, we will|Other Sts whose feast day|December 31|டிசம்பர் 31|ஒவ்வொரு நாளும்|பீடிகாபிகேஷன்|Saints are special people in the Catholic faith|beacons of light/i.test(
    (dailySaint?.description || '') + ' ' + (dailySaint?.descriptionTa || '')
  );

  const isStaleMissingStructure = !dailySaint?.primarySaint || !dailySaint?.otherSaints;
  const isStaleRosaryOnOct07 = todayStr.endsWith('-10-07') && (
    !dailySaint?.primarySaint?.name?.includes('Rosary') ||
    !dailySaint?.saintName?.includes('Rosary')
  );

  if (!dailySaint || dailySaint.date !== todayStr || isStaleMissingStructure || isStaleRosaryOnOct07 || isGenericName || isBoilerplateBio) {
    const fallbackSaint = getSaintForDate(dateKey);
    const feastInfo = extractFeastInfo(null, [fallbackSaint], todayStr.split('-')[1], todayStr.split('-')[2], dateKey);
    const primaryFallback = {
      name: fallbackSaint.name,
      englishName: fallbackSaint.name,
      nameEn: fallbackSaint.name,
      tamilName: fallbackSaint.nameTa,
      nameTa: fallbackSaint.nameTa,
      title: feastInfo?.feastTitle || fallbackSaint.feastTitle || fallbackSaint.name,
      titleEn: feastInfo?.feastTitle || fallbackSaint.feastTitle || fallbackSaint.name,
      titleTa: feastInfo?.feastTitleTa || fallbackSaint.feastTitleTa || fallbackSaint.nameTa,
      celebrationType: feastInfo?.feastType || fallbackSaint.feastType || null,
      celebrationTypeTa: feastInfo?.feastTypeTa || fallbackSaint.feastTypeTa || null,
      feastName: fallbackSaint.name,
      description: fallbackSaint.description,
      descriptionEn: fallbackSaint.description,
      descriptionTa: fallbackSaint.descriptionTa,
      image: fallbackSaint.image,
      imageUrl: fallbackSaint.image,
      imageSource: "liturgical_calendar",
      imageSourceUrl: fallbackSaint.link,
      source: "Catholic Liturgical Calendar",
      sourceUrl: buildVaticanNewsUrl(todayStr.split('-')[1], todayStr.split('-')[2])
    };
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
      feastTitle: feastInfo?.feastTitle || fallbackSaint.feastTitle || null,
      feastTitleTa: feastInfo?.feastTitleTa || fallbackSaint.feastTitleTa || null,
      feastType: feastInfo?.feastType || fallbackSaint.feastType || null,
      feastTypeTa: feastInfo?.feastTypeTa || fallbackSaint.feastTypeTa || null,
      hasFeastInfo: Boolean(feastInfo?.hasFeastInfo || fallbackSaint.hasFeastInfo),
      primarySaint: primaryFallback,
      otherSaints: [],
      saints: [primaryFallback],
      allSaints: [primaryFallback],
      source: "Catholic Liturgical Calendar",
      sourceUrl: buildVaticanNewsUrl(todayStr.split('-')[1], todayStr.split('-')[2]),
      link: fallbackSaint.link,
      status: "Synced",
      lastSynced: new Date()
    };
  }
  return dailySaint;
};

module.exports = { 
  getDailySaint, 
  fetchDailySaint, 
  searchAndApplySaintImage, 
  getISTDateParts, 
  saveSaintToDatabase,
  buildVaticanNewsUrl,
  fetchWikipediaBio,
  fetchWikipediaSummary: fetchWikipediaBio
};
