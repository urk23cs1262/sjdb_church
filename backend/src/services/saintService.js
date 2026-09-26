const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const { getSaintForDate } = require('../data/catholic_saints_calendar');
const { 
  resolveSaintImage, 
  getVaticanSaintImage, 
  searchWikipediaSaintImage, 
  searchSaintFallback, 
  cleanSaintName, 
  verifyImageUrl 
} = require('./saintImageResolver');

// ─── SOURCE CONFIGURATION ────────────────────────────────────────────────────
// Primary source: Vatican News — dynamic month/day URL structure (no year),
// so it automatically works for 2026, 2027, 2028, and all future years.
const VATICAN_NEWS_BASE = "https://www.vaticannews.va";
const VATICAN_SAINTS_BASE_URL = "https://www.vaticannews.va/en/saints";

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
  const cleanName = cleanSaintName(saintName);

  const slugs = [
    saintName.replace(/\s+/g, '_'),
    cleanName.replace(/\s+/g, '_'),
    `Saint_${cleanName.replace(/\s+/g, '_')}`,
    `Pope_${cleanName.replace(/\s+/g, '_')}`
  ];

  const lower = saintName.toLowerCase();
  if (lower.includes('mercy') && (lower.includes('mary') || lower.includes('lady'))) {
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
    slugs.unshift('Michael_(archangel)', 'Archangel');
  } else if (lower.includes('pius of pietrelcina') || lower.includes('padre pio')) {
    slugs.unshift('Padre_Pio');
  }

  for (const slug of slugs) {
    try {
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
      const res = await axios.get(summaryUrl, {
        headers: { 'User-Agent': 'SJDBChurchApp/1.0 (Catholic Parish Management; contact: stjdbchurch@gmail.com)' },
        timeout: 5000
      });
      if (res.data && res.data.extract && res.data.extract.length > 30) {
        const sentences = splitIntoSentences(res.data.extract);
        return sentences.slice(0, 4).join(' ').trim();
      }
    } catch (e) {
      // Try next slug
    }
  }

  // Fallback: search Wikipedia API if direct slugs didn't hit
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanName || saintName)}&format=json&origin=*`;
    const searchRes = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'SJDBChurchApp/1.0 (Catholic Parish Management; contact: stjdbchurch@gmail.com)' },
      timeout: 5000
    });
    const hits = searchRes.data?.query?.search || [];
    for (const h of hits.slice(0, 3)) {
      if (/disambiguation|list of/i.test(h.title)) continue;
      const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(h.title)}`;
      const sumRes = await axios.get(sumUrl, {
        headers: { 'User-Agent': 'SJDBChurchApp/1.0 (Catholic Parish Management; contact: stjdbchurch@gmail.com)' },
        timeout: 5000
      });
      if (sumRes.data?.extract && sumRes.data.extract.length > 40) {
        const sentences = splitIntoSentences(sumRes.data.extract);
        return sentences.slice(0, 4).join(' ').trim();
      }
    }
  } catch (e) {}

  return '';
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
  "Memorial of Saint Pio of Pietrelcina": "பியட்ரல்சினாவின் புனித பியோ நினைவு நாள்",
  "Memorial of Saints Cosmas and Damian, Martyrs": "புனிதர்கள் கோஸ்மாஸ் மற்றும் தமியானஸ் மறைசாட்சியர் நினைவு நாள்",
  "Memorial of Saint Vincent de Paul": "புனித வின்சென்ட் தே பவுல் நினைவு நாள்",
  "Memorial of Saint Jerome, Priest and Doctor of the Church": "புனித ஜெரோம் (மறைவல்லுநர்) நினைவு நாள்",
  "Feast of Saints Michael, Gabriel and Raphael, Archangels": "புனித மிக்கேல், கபிரியேல், ரபேல் அதிதூதர்கள் திருவிழா",
  "Feast of the Holy Archangels": "தூய அதிதூதர்கள் திருவிழா",
  "Solemnity of Mary, Mother of God": "மரியாவின் இறைத்தாய்மை பெருவிழா",
  "Solemnity of St. Joseph, Spouse of the Blessed Virgin Mary": "தூய கன்னி மரியாவின் கணவரான புனித யோசேப்பு பெருவிழா",
  "Birth of st. John the Baptist": "புனித திருமுழுக்கு யோவானின் பிறப்பு பெருவிழா",
  "Solemnity of Saints Peter and Paul, Apostles": "திருத்தூதர்களான புனித பேதுரு, புனித பவுல் பெருவிழா"
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
async function fetchFromVaticanNews(month, day, year = new Date().getFullYear()) {
  const vaticanUrl = buildVaticanNewsUrl(month, day);
  console.log(`[Saint Service] Fetching Vatican News Saint of the Day: ${vaticanUrl}`);

  try {
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

    const saints = [];

    // Parse each section
    $('section.section').each((idx, el) => {
      // Exclude introduction block
      if ($(el).find('.intro--saint').length > 0) return;

      const h2 = $(el).find('.section__head h2').text().replace(/\s+/g, ' ').trim();
      if (!h2) return;

      // Extract biography paragraphs
      const paragraphs = [];
      $(el).find('.section__content p').each((pi, pel) => {
        const text = $(pel).text().replace(/\s+/g, ' ').trim();
        if (text && !text.includes('The Saint of the day presents a daily calendar') && text.length > 20) {
          paragraphs.push(text);
        }
      });

      const bio = paragraphs.join('\n\n').trim();
      const isEvidence = $(el).hasClass('section--evidence');

      // In Vatican News CSS:
      // .page .section__head h2 { color: #c00 } (Liturgical RED)
      // .page .section--evidence .section__head h2 { color: #373737 } (Grey box)
      // Any section without `section--evidence` has a RED title (#c00), representing
      // the General Roman Calendar's feast/memorial/martyrs!
      const isRed = !isEvidence;

      // Check if this section has an official Vatican saint image
      const vaticanImgObj = getVaticanSaintImage($, vaticanUrl, el);
      const imageUrl = vaticanImgObj ? vaticanImgObj.url : null;

      saints.push({
        name: h2,
        description: bio,
        imageUrl,
        isEvidence,
        isRed,
        sectionEl: el
      });
    });

    if (saints.length === 0) {
      console.warn(`[Saint Service] No saint sections found on Vatican News page for ${month}/${day}`);
      return null;
    }

    console.log(`[Saint Service] Found ${saints.length} saints on Vatican News (${month}/${day}):`, 
      saints.map(s => `"${s.name}" (isRed=${s.isRed}, evidence=${s.isEvidence}, bioLen=${s.description.length}, hasImg=${!!s.imageUrl})`).join('; ')
    );

    // Extract feast and liturgical celebration information from the page
    const dateKey = `${year}-${month}-${day}`;
    const feastInfo = extractFeastInfo($, saints, month, day, dateKey);

    // Primary saint selection logic:
    // 1. If any feast saint or liturgical celebration is present on the page, prioritize that feast saint!
    // 2. If any saint has a RED title on Vatican News (isRed: true), prioritize that red-titled liturgical saint!
    //    On Vatican News, the universal Roman Calendar celebration (e.g. Sts. Cosmas and Damian) is styled with red text.
    // 3. Otherwise, any saint marked with section--evidence AND having a biography
    // 4. Otherwise, the first saint that has a non-empty biography
    // 5. Otherwise, the first saint listed
    let primarySaint = null;
    if (feastInfo && feastInfo.hasFeastInfo && feastInfo.feastSaintObj) {
      primarySaint = feastInfo.feastSaintObj;
      console.log(`[Saint Service] Feast Saint prioritized as primary: "${primarySaint.name}" (Feast: "${feastInfo.feastTitle}", Type: "${feastInfo.feastType}")`);
    } else {
      const redSaint = saints.find(s => s.isRed);
      if (redSaint) {
        primarySaint = redSaint;
        console.log(`[Saint Service] Red-titled Liturgical Saint prioritized as primary: "${primarySaint.name}"`);
      } else {
        primarySaint = saints.find(s => s.isEvidence && s.description.length > 0);
        if (!primarySaint) {
          primarySaint = saints.find(s => s.description.length > 0);
        }
        if (!primarySaint) {
          primarySaint = saints[0];
        }
      }
    }

    return {
      primarySaint,
      allSaints: saints,
      sourceUrl: vaticanUrl,
      feastInfo,
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
 *   2. Image priority:
 *        a) Vatican News official portrait
 *        b) Wikipedia exact saint portrait (identity validated)
 *        c) Online search / Liturgical Calendar fallback
 *        d) Dignified sacred portrait (St. John de Britto)
 *   3. Wikipedia biography enhancement if Vatican bio is short
 *   4. Catholic Liturgical Calendar (catholic_saints_calendar.js) fallback
 *
 * February 4 always returns Parish Patron St. John de Britto.
 * Validates fetched content belongs to current date and never overwrites with empty data.
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
  const year = parts.find(p => p.type === 'year')?.value || String(dt.getFullYear());
  const dateKey = `${year}-${month}-${day}`;
  const isCurrentToday = (dateKey === getISTDateParts().dateKey);

  // February 4 — Parish Patron Feast Day override
  if (month === '02' && day === '04') {
    const patronSaintObj = {
      ...ST_JOHN_DE_BRITTO,
      date: dateKey,
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

  // Check database cache for arbitrary requested date to avoid redundant scraping
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const SiteSettings = require('../models/SiteSettings');
      const cached = await SiteSettings.findOne({ key: `daily_saint_cache_${dateKey}` }).lean();
      if (cached && cached.value) {
        const parsed = JSON.parse(cached.value);
        if (parsed && parsed.date === dateKey && (parsed.saintName || parsed.name) && parsed.image && !parsed.imageFallback) {
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

  let saintName = '';
  let description = '';
  let tamilName = '';
  let descriptionTa = '';
  let detailUrl = buildVaticanNewsUrl(month, day);
  let usedVatican = false;
  let allSaintsList = [];
  let primarySectionEl = null;
  let cheerioDoc = null;
  let feastInfo = null;

  // ── PRIMARY FETCH: Vatican News ──────────────────────────────────────────
  console.log(`[Saint Service] Fetching Saint of the Day for ${dateKey} (IST) from Vatican News...`);
  const vaticanResult = await fetchFromVaticanNews(month, day, year);

  if (vaticanResult && vaticanResult.primarySaint) {
    usedVatican = true;
    const prim = vaticanResult.primarySaint;
    feastInfo = vaticanResult.feastInfo;

    // Use full/clean feast saint name if feast saint was prioritized (e.g. "Blessed Virgin Mary of the Mercy" instead of "B. V. Mary of the Mercy")
    saintName = (feastInfo?.hasFeastInfo && feastInfo?.feastSaintName)
      ? feastInfo.feastSaintName
      : prim.name;

    detailUrl = vaticanResult.sourceUrl;
    allSaintsList = vaticanResult.allSaints;
    primarySectionEl = prim.sectionEl;
    cheerioDoc = vaticanResult.$;

    if (prim.description && prim.description.length >= 40) {
      description = prim.description;
    } else {
      console.log(`[Saint Service] Vatican News bio short (${prim.description ? prim.description.length : 0} chars) for "${saintName}". Enhancing bio...`);
      
      // 1. Check local Catholic Liturgical Calendar first (authoritative curated Catholic content)
      const cleanFetched = cleanSaintName(saintName).toLowerCase();
      const cleanFallback = cleanSaintName(fallbackSaint?.name || '').toLowerCase();
      const isCalendarMatch = fallbackSaint && (
        cleanFetched.includes(cleanFallback) || 
        cleanFallback.includes(cleanFetched) || 
        (cleanFetched.includes('cosmas') && cleanFallback.includes('cosmas')) ||
        (cleanFetched.includes('vincent') && cleanFallback.includes('vincent')) ||
        (cleanFetched.includes('jerome') && cleanFallback.includes('jerome'))
      );

      if (isCalendarMatch) {
        description = fallbackSaint.description;
        if (!tamilName && fallbackSaint.nameTa) tamilName = fallbackSaint.nameTa;
        if (!descriptionTa && fallbackSaint.descriptionTa) descriptionTa = fallbackSaint.descriptionTa;
        console.log(`[Saint Service] Curated Catholic calendar biography applied for "${saintName}".`);
      }

      // 2. Wikipedia summary as secondary enrichment
      if (!description || description.length < 30) {
        const wikiBio = await fetchWikipediaSummary(saintName);
        if (wikiBio && wikiBio.length >= 30) {
          description = wikiBio;
          console.log(`[Saint Service] Wikipedia bio found for "${saintName}" (${wikiBio.length} chars).`);
        }
      }

      if (!description) {
        description = prim.description || fallbackSaint?.description || '';
      }
    }
  } else {
    // ── FALLBACK: Catholic Liturgical Calendar ─────────────────────────────
    console.log(`[Saint Service] Vatican News unavailable for ${dateKey}. Using Catholic Liturgical Calendar fallback.`);
    saintName = fallbackSaint.name;
    description = fallbackSaint.description;
    tamilName = fallbackSaint.nameTa;
    descriptionTa = fallbackSaint.descriptionTa;
    detailUrl = fallbackSaint.link || VATICAN_SAINTS_BASE_URL;
    allSaintsList = [{ name: fallbackSaint.name, description: fallbackSaint.description, imageUrl: fallbackSaint.image }];
    feastInfo = extractFeastInfo(null, allSaintsList, month, day, dateKey);
  }

  // Ensure feast info is extracted if not already
  if (!feastInfo) {
    feastInfo = extractFeastInfo(cheerioDoc, allSaintsList, month, day, dateKey);
  }

  // If feastInfo was not found on page, check if calendar entry has feast info
  if (!feastInfo?.hasFeastInfo && fallbackSaint?.hasFeastInfo) {
    const cleanFetched = cleanSaintName(saintName).toLowerCase();
    const cleanFallback = cleanSaintName(fallbackSaint.name).toLowerCase();
    if (cleanFetched.includes(cleanFallback) || cleanFallback.includes(cleanFetched) || cleanFetched.includes('cosmas')) {
      feastInfo = {
        feastTitle: fallbackSaint.feastTitle,
        feastTitleTa: fallbackSaint.feastTitleTa,
        feastType: fallbackSaint.feastType,
        feastTypeTa: fallbackSaint.feastTypeTa,
        hasFeastInfo: true,
        feastSaintName: saintName
      };
    }
  }

  if (feastInfo && feastInfo.hasFeastInfo) {
    if (!feastInfo.feastTitleTa) {
      if (KNOWN_FEAST_TRANSLATIONS[feastInfo.feastTitle]) {
        feastInfo.feastTitleTa = KNOWN_FEAST_TRANSLATIONS[feastInfo.feastTitle];
      } else {
        const trans = await translateText(feastInfo.feastTitle);
        feastInfo.feastTitleTa = trans || feastInfo.feastTitle;
      }
    }
  }

  // ── IMAGE RESOLUTION ─────────────────────────────────────────────────────
  // Pipeline: 
  // 1. Vatican News official saint image
  // 2. Wikipedia exact canonical saint portrait (identity validated)
  // 3. Liturgical calendar fallback
  // 4. Online image search (Google / Web)
  // 5. Dignified sacred art (St. John de Britto)
  let imageResult = await resolveSaintImage(saintName, detailUrl, cheerioDoc, dt, primarySectionEl);
  if ((!imageResult || imageResult.fallback) && fallbackSaint?.image) {
    const cleanFetched = cleanSaintName(saintName).toLowerCase();
    const cleanFallback = cleanSaintName(fallbackSaint.name).toLowerCase();
    if (cleanFetched.includes(cleanFallback) || cleanFallback.includes(cleanFetched) || cleanFetched.includes('cosmas')) {
      imageResult = {
        url: fallbackSaint.image,
        source: 'liturgical_calendar',
        sourceUrl: fallbackSaint.link || detailUrl,
        fallback: false
      };
    }
  }

  // ── TAMIL TRANSLATION ────────────────────────────────────────────────────
  if (!tamilName) {
    if (feastInfo?.hasFeastInfo && feastInfo?.feastTitleTa) {
      // Derive saint's Tamil name from known feast title if applicable
      const cleanTa = feastInfo.feastTitleTa
        .replace(/\s*(ஆலயப் பாதுகாவலர் பெருவிழா|பெருவிழா|திருவிழா|நினைவு நாள்)\s*$/i, '')
        .trim();
      if (cleanTa && cleanTa.length > 3) {
        tamilName = cleanTa;
      }
    }
    if (!tamilName) {
      const translated = await translateText(saintName);
      tamilName = translated || saintName;
    }
  }
  if (!descriptionTa) {
    const translatedBio = await translateText(description);
    descriptionTa = translatedBio || description;
  }

  // ── BUILD & SAVE SAINT OBJECT ────────────────────────────────────────────
  const saintPayload = {
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
    feastTitle: feastInfo?.feastTitle || null,
    feastTitleTa: feastInfo?.feastTitleTa || null,
    feastType: feastInfo?.feastType || null,
    feastTypeTa: feastInfo?.feastTypeTa || null,
    hasFeastInfo: Boolean(feastInfo?.hasFeastInfo),
    source: usedVatican ? "Vatican News" : "Catholic Liturgical Calendar",
    sourceUrl: detailUrl,
    link: detailUrl,
    allSaints: allSaintsList.map(s => ({
      name: s.name,
      description: s.description,
      image: s.imageUrl || null
    })),
    status: "Synced",
    lastSynced: new Date()
  };

  if (isCurrentToday) {
    dailySaint = saintPayload;
  }

  await saveSaintToDatabase(saintPayload, isCurrentToday);
  console.log(`✅ Saint of the Day synced (${dateKey}): ${saintName} [Source: ${saintPayload.source}] [Image: ${imageResult.source} -> ${imageResult.url}] [Feast: ${saintPayload.feastTitle || 'None'}]`);

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
        const isStaleCatholicReadings = (parsed.source && parsed.source.includes('Catholic Readings')) ||
          (parsed.sourceUrl && parsed.sourceUrl.includes('catholicreadings.org')) ||
          (parsed.link && parsed.link.includes('catholicreadings.org')) ||
          (parsed.saintName && parsed.saintName.includes('Slomsek Our'));
        const isGarbageImage = parsed.image && (
          parsed.image.includes('imimg.com') ||
          parsed.image.includes('metroprin') ||
          parsed.image.includes('Superdome') ||
          parsed.image.includes('stadium')
        );
        const isStaleNilusOnSep26 = todayStr.endsWith('-09-26') && (
          (parsed.saintName && parsed.saintName.includes('Nilus')) ||
          (parsed.name && parsed.name.includes('Nilus')) ||
          (parsed.englishName && parsed.englishName.includes('Nilus'))
        );

        // Valid cache: matches today's date AND has a valid image AND is not from obsolete Catholic Readings source AND not obsolete secondary saint
        if (parsed && parsed.date === todayStr && (parsed.saintName || parsed.name) && parsed.image && !isBrokenVirginMary && !isStaleCatholicReadings && !isGarbageImage && !isStaleNilusOnSep26) {
          dailySaint = parsed;
          if (dailySaint.lastSynced) {
            dailySaint.lastSynced = new Date(dailySaint.lastSynced);
          }
          console.log(" Loaded today's daily saint from database cache:", dailySaint.saintName || dailySaint.name);
          return;
        } else if (isStaleCatholicReadings || isGarbageImage || isStaleNilusOnSep26) {
          console.warn("⚠️ Discarding obsolete/stale cache from database (Nilus/Catholic Readings/Invalid image). Fresh Vatican News fetch will run immediately.");
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
      hasFeastInfo: Boolean(fallbackSaint.hasFeastInfo),
      source: "Catholic Liturgical Calendar",
      sourceUrl: buildVaticanNewsUrl(todayStr.split('-')[1], todayStr.split('-')[2]),
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

  if (!dailySaint || dailySaint.date !== todayStr) {
    const fallbackSaint = getSaintForDate(dateKey);
    const feastInfo = extractFeastInfo(null, [fallbackSaint], todayStr.split('-')[1], todayStr.split('-')[2], dateKey);
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
  fetchWikipediaSummary
};
