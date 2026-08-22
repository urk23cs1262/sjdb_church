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

async function translateText(text, targetLang = 'ta') {
  if (!text || text.trim() === '') return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await axios.get(url, { timeout: 8000 });
    if (response.data && response.data[0]) {
      return response.data[0].map(item => item[0]).join('').trim();
    }
  } catch (error) {
    console.error('Translation error:', error.message);
  }
  return '';
}

/**
 * Fetch Saint of the Day dynamically from Vatican News for today's date (MM/DD.html)
 * and resolve the highest-quality authentic saint portrait via Saint Image Resolver.
 */
async function fetchDailySaint() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const dateKey = `${today.getFullYear()}-${month}-${day}`;
  
  // February 4th is the Parish Patron Saint Feast Day - force override to St. John de Britto
  if (today.getMonth() === 1 && today.getDate() === 4) {
    dailySaint = {
      ...ST_JOHN_DE_BRITTO,
      date: dateKey,
      status: "Synced",
      lastSynced: new Date()
    };
    await saveSaintToDatabase(dailySaint);
    console.log(' Saint of the Day forced to Patron Saint St. John de Britto (Feb 4th)');
    return;
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

  const fallbackSaint = getSaintForDate(today);

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
    let saintName = '';
    $('h2').each((i, el) => {
      const text = $(el).text().trim();
      if (text && !['menu', 'search', 'daily readings', 'all prayers', 'liturgical feasts', 'subscribe to our newsletters'].includes(text.toLowerCase())) {
        saintName = text;
        return false; // Break loop
      }
    });

    if (!saintName) {
      $('.section__head, .teaser__title, .page-title, .title').each((i, el) => {
        const text = $(el).text().trim();
        if (text && !['saint of the day', 'menu', 'search'].includes(text.toLowerCase())) {
          saintName = text;
          return false;
        }
      });
    }

    if (!saintName) {
      saintName = fallbackSaint.name;
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
    const description = shortBio || fallbackSaint.description;

    // Resolve Saint Image: Vatican First → Verified Fallback Search → Calendar → Placeholder
    const imageResult = await resolveSaintImage(saintName, fetchUrl, $, today);

    // Translate to Tamil
    let tamilName = fallbackSaint.nameTa;
    if (!tamilName || saintName !== fallbackSaint.name) {
      const translated = await translateText(saintName);
      if (translated) tamilName = translated;
    }

    let descriptionTa = fallbackSaint.descriptionTa;
    if (!descriptionTa || description !== fallbackSaint.description) {
      const translatedBio = await translateText(description);
      if (translatedBio) descriptionTa = translatedBio;
    }

    const feastDay = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

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
      feastDay,
      source: "Vatican News",
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
  } catch (error) {
    console.error(' Error fetching from online Vatican News, using Saint Resolver fallback:', error.message);
    
    const imageResult = await resolveSaintImage(fallbackSaint.name, fetchUrl, null, today);

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
      feastDay: today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
      source: "Vatican News / Catholic Liturgical Calendar",
      sourceUrl: fetchUrl,
      link: fallbackSaint.link || fetchUrl,
      status: "Synced",
      lastSynced: new Date()
    };

    await saveSaintToDatabase(dailySaint);
    console.log(` Today's Catholic Saint loaded (${dailySaint.date}):`, dailySaint.saintName);
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
