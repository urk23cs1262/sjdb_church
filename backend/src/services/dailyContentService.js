const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { fetchDailyVerse } = require('./bibleVerseService');
const { getDailySaint, fetchDailySaint } = require('./saintService');
const { 
  getReadingForDate, 
  fetchAndStoreTamilReading, 
  getOrGenerateEnglishTranslation, 
  getDateKey 
} = require('./dailyMassReadingService');

const DailyCatholicContent = require('../models/DailyCatholicContent');
const DEFAULT_BIBLE_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/b/b6/Gutenberg_Bible%2C_Lenox_Copy%2C_New_York_Public_Library%2C_2009._Pic_01.jpg';

/**
 * Safely download image as a Buffer for email CID attachment
 */
async function fetchImageBuffer(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;

  try {
    // If it's a local file path
    if (imageUrl.startsWith('/') || imageUrl.startsWith('file:') || fs.existsSync(imageUrl)) {
      const cleanPath = imageUrl.replace(/^file:\/\//, '');
      if (fs.existsSync(cleanPath)) {
        const buffer = fs.readFileSync(cleanPath);
        const ext = path.extname(cleanPath).toLowerCase();
        const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        return { buffer, contentType };
      }
    }

    // Remote HTTP / HTTPS URL
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'SJDBChurchApp/1.0 (Catholic Parish Management; contact: parish@sjdb.org)',
          'Accept': '*/*'
        },
        timeout: 10000
      });

      let contentType = response.headers['content-type'];
      if (!contentType || contentType === 'application/octet-stream') {
        const cleanUrl = imageUrl.split('?')[0].toLowerCase();
        contentType = cleanUrl.endsWith('.png') ? 'image/png' : cleanUrl.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      }

      return {
        buffer: Buffer.from(response.data),
        contentType
      };
    }
  } catch (err) {
    console.warn(`[DailyContentService] Could not fetch image buffer for CID from ${imageUrl}:`, err.message);
  }
  return null;
}

/**
 * Format date nicely in English and Tamil
 */
function getFormattedDates(targetDate = new Date()) {
  let dt;
  if (typeof targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    const [y, m, d] = targetDate.split('-').map(Number);
    dt = new Date(Date.UTC(y, m - 1, d, 6, 0, 0));
  } else {
    dt = new Date(targetDate);
  }

  const optionsEn = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  };
  const formattedEn = dt.toLocaleDateString('en-GB', optionsEn);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric'
  }).formatToParts(dt);

  const dayVal = parts.find(p => p.type === 'day')?.value || '1';
  const monthVal = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10);
  const yearVal = parts.find(p => p.type === 'year')?.value || '2026';

  const monthsTa = [
    'ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்',
    'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'
  ];
  const formattedTa = `${dayVal} ${monthsTa[monthVal - 1]} ${yearVal}`;

  return { formattedEn, formattedTa };
}

/**
 * Aggregates all daily spiritual content in a single structured object
 */
async function getTodayDailyContent(targetDate = new Date()) {
  const dateKey = getDateKey(targetDate);
  const { formattedEn, formattedTa } = getFormattedDates(targetDate);

  console.log(`[DailyContentService] Aggregating daily content for ${dateKey}...`);

  // Check canonical DailyCatholicContent collection first
  let canonicalDoc = null;
  try {
    canonicalDoc = await DailyCatholicContent.findOne({ date: dateKey });
  } catch (dbErr) {
    console.warn('[DailyContentService] DB lookup notice:', dbErr.message);
  }

  // If canonical document is missing or not fully synchronized, trigger synchronization
  if (!canonicalDoc || !canonicalDoc.syncStatus?.massReadings || !canonicalDoc.syncStatus?.saint) {
    try {
      const { checkAndSyncDailyContent } = require('./contentMonitoringService');
      canonicalDoc = await checkAndSyncDailyContent(targetDate);
    } catch (syncErr) {
      console.warn('[DailyContentService] Autonomous monitoring sync notice:', syncErr.message);
    }
  }

  // 1. Bible Verse
  let bible = canonicalDoc?.bible;
  if (!bible || !bible.ref) {
    let verseData = await fetchDailyVerse();
    if (!verseData) {
      verseData = {
        verseTa: 'கர்த்தர் என் வெளிச்சமும் என் இரட்சிப்புமானவர், யாருக்கு அஞ்சுவேன்?',
        verseEn: 'The Lord is my light and my salvation; whom shall I fear?',
        ref: 'சங்கீதம் / Psalm 27:1',
        image: DEFAULT_BIBLE_IMAGE
      };
    }
    bible = {
      ref: verseData.ref || verseData.reference || 'சங்கீதம் / Psalm 27:1',
      tamil: verseData.verseTa || verseData.verseTextTa || verseData.tamil || '',
      english: verseData.verseEn || verseData.verseTextEn || verseData.english || '',
      imageUrl: verseData.image || verseData.imageUrl || DEFAULT_BIBLE_IMAGE
    };
  }

  const bibleImageUrl = bible.imageUrl || DEFAULT_BIBLE_IMAGE;
  const bibleImgBuffer = await fetchImageBuffer(bibleImageUrl);

  // 2. Mass Readings
  let massReadings = canonicalDoc?.massReadings;
  if (!massReadings || !massReadings.tamil?.readings?.length) {
    let massReadingDoc = await getReadingForDate(dateKey);
    if (!massReadingDoc) {
      try {
        massReadingDoc = await fetchAndStoreTamilReading(dateKey);
      } catch (e) {
        console.warn('[DailyContentService] Error fetching Tamil mass reading:', e.message);
      }
    }

    let englishDoc = null;
    if (massReadingDoc) {
      try {
        englishDoc = await getOrGenerateEnglishTranslation(dateKey);
      } catch (e) {
        console.warn('[DailyContentService] Error getting English mass translation:', e.message);
      }
    }

    let tamilReadingsList = [];
    if (massReadingDoc?.sections && massReadingDoc.sections.length > 0) {
      tamilReadingsList = massReadingDoc.sections.map(s => ({
        type: s.heading || 'வாசகம்',
        reference: s.reference || '',
        text: (s.paragraphs && s.paragraphs.length > 0)
          ? s.paragraphs.join('\n\n')
          : (s.text || '')
      }));
    }

    let englishReadingsList = [];
    if (englishDoc?.sections && englishDoc.sections.length > 0) {
      englishReadingsList = englishDoc.sections.map(s => ({
        type: s.heading || 'Reading',
        reference: s.reference || '',
        text: (s.paragraphs && s.paragraphs.length > 0)
          ? s.paragraphs.join('\n\n')
          : (s.text || '')
      }));
    }

    massReadings = {
      tamil: {
        title: massReadingDoc?.celebration || massReadingDoc?.title || massReadingDoc?.pageTitle || massReadingDoc?.liturgicalDay || 'இன்றைய திருப்பலி வாசகங்கள்',
        readings: tamilReadingsList,
        fullText: tamilReadingsList.map(r => `${r.type} ${r.reference ? `(${r.reference})` : ''}\n${r.text}`).join('\n\n')
      },
      english: {
        title: englishDoc?.celebration || englishDoc?.title || englishDoc?.liturgicalDay || 'Daily Mass Readings',
        readings: englishReadingsList,
        fullText: englishReadingsList.map(r => `${r.type} ${r.reference ? `(${r.reference})` : ''}\n${r.text}`).join('\n\n')
      }
    };
  }

  // 3. Daily Reflection
  let reflection = canonicalDoc?.reflection;
  if (!reflection || !reflection.tamil) {
    let massReadingDoc = await getReadingForDate(dateKey);
    let tamilReflectionText = '';
    if (massReadingDoc?.reflection) {
      const r = massReadingDoc.reflection;
      const parts = [];
      if (r.title && r.title.trim()) parts.push(`${r.title.trim()}`);
      if (r.paragraphs && r.paragraphs.length > 0) {
        parts.push(r.paragraphs.map(p => p.trim()).filter(Boolean).join('\n\n'));
      } else if (r.content && r.content.trim()) {
        parts.push(r.content.trim());
      }
      if (r.prayer && r.prayer.trim()) {
        parts.push(`மன்றாட்டு:\n${r.prayer.trim()}`);
      }
      tamilReflectionText = parts.join('\n\n');
    }
    if (!tamilReflectionText) {
      tamilReflectionText = 'இறைவனின் வார்த்தை நம் வாழ்வின் வழிகாட்டி. இன்றைய நாளில் இறைவனின் அன்பிலும் இரக்கத்திலும் திளைப்போம்.';
    }

    reflection = {
      tamil: tamilReflectionText,
      english: 'The Word of God is a lamp to our feet and a light to our path. May God bless and guide you today.'
    };
  }

  // 4. Saint of the Day
  let saintData = canonicalDoc?.saint;
  if (!saintData || !saintData.nameEnglish) {
    let rawSaint = getDailySaint();
    if (!rawSaint || rawSaint.date !== dateKey) {
      try {
        await fetchDailySaint(targetDate);
        rawSaint = getDailySaint();
      } catch (e) {
        console.warn('[DailyContentService] Error fetching saint:', e.message);
      }
    }
    saintData = {
      nameTamil: rawSaint?.tamilName || rawSaint?.nameTa || rawSaint?.saintName || 'இன்றைய புனிதர்',
      nameEnglish: rawSaint?.englishName || rawSaint?.saintName || rawSaint?.name || 'Saint of the Day',
      descriptionTamil: rawSaint?.descriptionTa || rawSaint?.description || '',
      descriptionEnglish: rawSaint?.description || '',
      feastDay: rawSaint?.feastDay || formattedEn,
      image: rawSaint?.image || null,
      imageSource: rawSaint?.imageSource || 'Vatican News',
      sourceUrl: rawSaint?.sourceUrl || rawSaint?.link || 'https://www.vaticannews.va/en/saints.html'
    };
  }

  const saintImageUrl = saintData.image || null;
  const saintImgBuffer = saintImageUrl ? await fetchImageBuffer(saintImageUrl) : null;

  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const readingsUrl = `${frontendUrl.replace(/\/$/, '')}/bible-verse`;

  return {
    dateKey,
    formattedDate: formattedEn,
    formattedDateTa: formattedTa,
    bible: {
      tamil: bible.tamil || '',
      english: bible.english || '',
      ref: bible.ref || '',
      imageUrl: bibleImageUrl,
      imageAttachment: bibleImgBuffer ? {
        filename: 'daily-bible.jpg',
        content: bibleImgBuffer.buffer,
        contentType: bibleImgBuffer.contentType,
        cid: 'dailyBibleImage'
      } : null
    },
    massReadings,
    reflection,
    saint: {
      ...saintData,
      imageAttachment: saintImgBuffer ? {
        filename: 'saint-of-the-day.jpg',
        content: saintImgBuffer.buffer,
        contentType: saintImgBuffer.contentType,
        cid: 'saintOfTheDayImage'
      } : null
    },
    readingsUrl
  };
}

module.exports = {
  getTodayDailyContent,
  fetchImageBuffer,
  getFormattedDates
};
