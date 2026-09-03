const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const { getSaintForDate } = require('../data/catholic_saints_calendar');
const { resolveSaintImage } = require('./saintImageResolver');

let dailySaint = null;
let retryTimeout = null;

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
        headers: { 'User-Agent': 'SJDBChurchApp/1.0 (Catholic Parish Management; contact: info@sjdbchurch.org)' },
        timeout: 5000
      });
      if (res.data && res.data.extract && res.data.extract.length > 30) {
        const sentences = splitIntoSentences(res.data.extract);
        return sentences.slice(0, 3).join(' ').trim();
      }
    } catch (e) {
      // 404 or network skip
    }
  }
  return '';
}

/**
 * Fetch Saint of the Day dynamically for today's date
 * and ensures 100% internal coherence (Title, Description, Image, Feast Day match the same saint).
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
  
  // February 4th is the Parish Patron Saint Feast Day - force override to St. John de Britto
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

  // Construct default Vatican News Date URL: https://www.vaticannews.va/en/saints/MM/DD.html
  let fetchUrl = `https://www.vaticannews.va/en/saints/${month}/${day}.html`;
  try {
    const SiteSettings = require('../models/SiteSettings');
    const urlSetting = await SiteSettings.findOne({ key: 'daily_saint_fetch_url' }).lean();
    if (urlSetting && urlSetting.value && urlSetting.value.trim() !== '') {
      let custom = urlSetting.value.trim();
      custom = custom
        .replace(/\{MM\}/g, month)
        .replace(/\{DD\}/g, day)
        .replace(/MM\/DD/g, `${month}/${day}`);
      if (custom === 'https://www.vaticannews.va/en/saints.html' || custom === 'https://www.vaticannews.va/en/saints') {
        custom = `https://www.vaticannews.va/en/saints/${month}/${day}.html`;
      }
      fetchUrl = custom;
    }
  } catch (err) {
    console.error('Failed to lookup daily_saint_fetch_url setting:', err.message);
  }

  const fallbackSaint = getSaintForDate(dateKey);
  const formattedFeastDay = dt.toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  try {
    console.log(` Fetching Saint of the Day from: ${fetchUrl}`);
    const response = await axios.get(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract first saint title: usually in h2, .teaser__title, or article headers
    let scrapedName = '';
    $('h2').each((i, el) => {
      const text = $(el).text().trim();
      if (text && !['menu', 'search', 'daily readings', 'all prayers', 'liturgical feasts', 'subscribe to our newsletters'].includes(text.toLowerCase())) {
        scrapedName = text;
        return false; // Break loop
      }
    });

    if (!scrapedName) {
      $('.section__head, .teaser__title, .page-title, .title').each((i, el) => {
        const text = $(el).text().trim();
        if (text && !['saint of the day', 'menu', 'search'].includes(text.toLowerCase())) {
          scrapedName = text;
          return false;
        }
      });
    }

    // Extract first saint description
    let bio = '';
    $('p').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 40 && 
          !text.startsWith('The Saint of the day presents') && 
          !text.includes('Subscribe') && 
          !text.includes('Useful Information') && 
          !text.includes('Pope\'s Activities')) {
        bio += text + ' ';
      }
    });

    const cleanBio = bio.replace(/\s+/g, ' ').trim();
    const sentences = splitIntoSentences(cleanBio);
    const shortBio = sentences.slice(0, 4).join(' ').trim();

    let saintName = '';
    let description = '';
    let tamilName = '';
    let descriptionTa = '';

    // ZERO MISMATCH COHERENCE LOGIC:
    // 1. If Vatican News returned both name and a legitimate biography
    if (scrapedName && shortBio && shortBio.length >= 40) {
      saintName = scrapedName;
      description = shortBio;
    } 
    // 2. If Vatican News returned a name but no biography
    else if (scrapedName) {
      const cleanScraped = scrapedName.toLowerCase().replace(/[^a-z]/g, '');
      const cleanFallback = fallbackSaint.name.toLowerCase().replace(/[^a-z]/g, '');
      
      // If scraped saint is the same as liturgical calendar saint, use calendar description
      if (cleanScraped.includes(cleanFallback) || cleanFallback.includes(cleanScraped)) {
        saintName = fallbackSaint.name;
        description = fallbackSaint.description;
        tamilName = fallbackSaint.nameTa;
        descriptionTa = fallbackSaint.descriptionTa;
      } else {
        // Scraped saint is different: fetch specific Wikipedia summary for this exact saint
        const wikiBio = await fetchWikipediaSummary(scrapedName);
        if (wikiBio && wikiBio.length >= 30) {
          saintName = scrapedName;
          description = wikiBio;
        } else {
          // If no bio can be verified for scraped saint, adopt the fully verified liturgical calendar saint
          saintName = fallbackSaint.name;
          description = fallbackSaint.description;
          tamilName = fallbackSaint.nameTa;
          descriptionTa = fallbackSaint.descriptionTa;
        }
      }
    } 
    // 3. Fallback to liturgical calendar
    else {
      saintName = fallbackSaint.name;
      description = fallbackSaint.description;
      tamilName = fallbackSaint.nameTa;
      descriptionTa = fallbackSaint.descriptionTa;
    }

    // Resolve Saint Image specifically for the chosen saintName
    const imageResult = await resolveSaintImage(saintName, fetchUrl, $, dt);

    // Translate name & description to Tamil if not already available
    if (!tamilName) {
      const translated = await translateText(saintName);
      tamilName = translated || saintName;
    }

    if (!descriptionTa) {
      const translatedBio = await translateText(description);
      descriptionTa = translatedBio || description;
    }

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
      source: "Vatican News / Catholic Liturgical Calendar",
      sourceUrl: fetchUrl,
      link: fetchUrl,
      status: "Synced",
      lastSynced: new Date()
    };
    
    await saveSaintToDatabase(dailySaint);
    console.log(` Saint of the Day successfully synced (${dateKey}): ${saintName} [Image: ${imageResult.source}]`);
    
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    return dailySaint;
  } catch (error) {
    console.error(' Error fetching from online Vatican News, using Saint Resolver fallback:', error.message);
    
    const imageResult = await resolveSaintImage(fallbackSaint.name, fetchUrl, null, dt);

    dailySaint = {
      date: dateKey,
      saintName: fallbackSaint.name,
      englishName: fallbackSaint.name,
      tamilName: fallbackSaint.nameTa,
      name: fallbackSaint.name,
      nameTa: fallbackSaint.nameTa,
      description: fallbackSaint.description,
      descriptionTa: fallbackSaint.descriptionTa,
      image: imageResult.url,
      imageSource: imageResult.source,
      imageSourceUrl: imageResult.sourceUrl,
      imageFallback: imageResult.fallback,
      feastDay: formattedFeastDay,
      source: "Vatican News / Catholic Liturgical Calendar",
      sourceUrl: fetchUrl,
      link: fallbackSaint.link || fetchUrl,
      status: "Synced",
      lastSynced: new Date()
    };

    await saveSaintToDatabase(dailySaint);
    console.log(` Today's Catholic Saint loaded (${dailySaint.date}):`, dailySaint.saintName);
    return dailySaint;
  }
}

async function saveSaintToDatabase(saintObj) {
  try {
    const SiteSettings = require('../models/SiteSettings');
    await SiteSettings.findOneAndUpdate(
      { key: 'daily_saint_cache' },
      {
        value: JSON.stringify(saintObj),
        label: 'Daily Saint Cache',
        type: 'text'
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('Failed to save daily saint cache to database:', err.message);
  }
}

async function loadCachedSaint() {
  try {
    const SiteSettings = require('../models/SiteSettings');
    const cacheSetting = await SiteSettings.findOne({ key: 'daily_saint_cache' }).lean();
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${today.getFullYear()}-${month}-${day}`;
    
    if (cacheSetting && cacheSetting.value) {
      const parsed = JSON.parse(cacheSetting.value);
      // Valid cache must match today's date and have a non-empty image
      if (parsed && parsed.date === todayStr && (parsed.saintName || parsed.name) && parsed.image) {
        dailySaint = parsed;
        if (dailySaint.lastSynced) {
          dailySaint.lastSynced = new Date(dailySaint.lastSynced);
        }
        console.log(' Loaded today\'s daily saint from database cache:', dailySaint.saintName || dailySaint.name);
        return;
      }
    }
    
    const fallbackSaint = getSaintForDate(today);
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
      feastDay: today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
      source: "Vatican News",
      sourceUrl: `https://www.vaticannews.va/en/saints/${month}/${day}.html`,
      link: fallbackSaint.link,
      status: "Synced",
      lastSynced: new Date()
    };
  } catch (err) {
    console.error('Failed to load daily saint cache from database:', err.message);
  }
}

// Load cache and trigger Vatican News fetch on startup
loadCachedSaint().then(() => {
  fetchDailySaint();
});

// Midnight cron job (12:00 AM IST)
cron.schedule('0 0 * * *', () => {
  console.log(' Running midnight Vatican News saint update (12:00 AM IST)...');
  fetchDailySaint();
}, {
  timezone: 'Asia/Kolkata'
});

const getDailySaint = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${month}-${day}`;

  if (!dailySaint || dailySaint.date !== todayStr) {
    const fallbackSaint = getSaintForDate(today);
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
      feastDay: today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
      source: "Vatican News",
      sourceUrl: `https://www.vaticannews.va/en/saints/${month}/${day}.html`,
      link: fallbackSaint.link,
      status: "Synced",
      lastSynced: new Date()
    };
  }
  return dailySaint;
};

module.exports = { getDailySaint, fetchDailySaint };
