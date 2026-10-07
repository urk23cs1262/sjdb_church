const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getChurchEmail } = require('../config/contactConfig');
const { fetchDailyVerse } = require('./bibleVerseService');
const { getDailySaint, fetchDailySaint } = require('./saintService');
const { 
  getReadingForDate, 
  fetchAndStoreTamilReading, 
  getOrGenerateEnglishTranslation, 
  getDateKey 
} = require('./dailyMassReadingService');
const { cleanCatholicContent, deduplicateReadings } = require('../utils/cleanCatholicContent');

const DEFAULT_BIBLE_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/b/b6/Gutenberg_Bible%2C_Lenox_Copy%2C_New_York_Public_Library%2C_2009._Pic_01.jpg';

/**
 * Safely download image as a Buffer for email CID attachment
 */
async function fetchImageBuffer(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;

  try {
    // If it's a local file path
    if (imageUrl.startsWith('/') || imageUrl.startsWith('file:') || fs.existsSync(imageUrl)) {
      let cleanPath = imageUrl.replace(/^file:\/\//, '');
      if (cleanPath.startsWith('/uploads/')) {
        const potential = path.join(__dirname, '../../', cleanPath);
        if (fs.existsSync(potential)) {
          cleanPath = potential;
        } else {
          const pot2 = path.join(process.cwd(), cleanPath);
          if (fs.existsSync(pot2)) cleanPath = pot2;
        }
      }
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
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

  // 1. Bible Verse
  let verseData = await fetchDailyVerse();
  if (!verseData) {
    verseData = {
      verseTa: 'கர்த்தர் என் வெளிச்சமும் என் இரட்சிப்புமானவர், யாருக்கு அஞ்சுவேன்?',
      verseEn: 'The Lord is my light and my salvation; whom shall I fear?',
      ref: 'சங்கீதம் / Psalm 27:1',
      image: DEFAULT_BIBLE_IMAGE
    };
  }

  const bibleImageUrl = verseData.image || verseData.imageUrl || DEFAULT_BIBLE_IMAGE;
  const bibleImgBuffer = await fetchImageBuffer(bibleImageUrl);

  // 2. Mass Readings & Reflection
  let massReadingDoc = null;
  try {
    massReadingDoc = await getReadingForDate(dateKey);
    if (!massReadingDoc) {
      massReadingDoc = await fetchAndStoreTamilReading(dateKey);
    }
  } catch (e) {
    console.warn('[DailyContentService] Error fetching mass reading:', e.message);
  }

  // Ensure English translations exist
  let englishDoc = null;
  if (massReadingDoc) {
    try {
      englishDoc = await getOrGenerateEnglishTranslation(dateKey);
    } catch (e) {
      console.warn('[DailyContentService] Error getting English mass translation:', e.message);
    }
  }

  // Map Tamil sections to readings array (clean & deduplicated)
  let tamilReadingsList = [];
  if (massReadingDoc?.sections && massReadingDoc.sections.length > 0) {
    tamilReadingsList = massReadingDoc.sections.map(s => ({
      type: s.heading || 'வாசகம்',
      heading: s.heading || 'வாசகம்',
      reference: s.reference || '',
      subtitle: s.subtitle || '',
      refrain: s.refrain || '',
      response: s.response || '',
      verses: s.verses || null,
      paragraphs: s.paragraphs || [],
      text: cleanCatholicContent((s.paragraphs && s.paragraphs.length > 0)
        ? s.paragraphs.join('\n\n')
        : (s.text || ''))
    }));
  }
  tamilReadingsList = deduplicateReadings(tamilReadingsList);

  // Map English sections to readings array (clean & deduplicated)
  let englishReadingsList = [];
  if (englishDoc?.sections && englishDoc.sections.length > 0) {
    englishReadingsList = englishDoc.sections.map(s => ({
      type: s.heading || 'Reading',
      heading: s.heading || 'Reading',
      reference: s.reference || '',
      subtitle: s.subtitle || '',
      refrain: s.refrain || '',
      response: s.response || '',
      verses: s.verses || null,
      paragraphs: s.paragraphs || [],
      text: cleanCatholicContent((s.paragraphs && s.paragraphs.length > 0)
        ? s.paragraphs.join('\n\n')
        : (s.text || ''))
    }));
  }
  englishReadingsList = deduplicateReadings(englishReadingsList);

  let tamilTitle = massReadingDoc?.celebration || massReadingDoc?.title || massReadingDoc?.pageTitle || massReadingDoc?.liturgicalDay || 'இன்றைய திருப்பலி வாசகங்கள்';
  if (!tamilTitle || tamilTitle === 'New:' || tamilTitle.length < 4) {
    tamilTitle = 'இன்றைய திருப்பலி வாசகங்கள்';
  }

  let englishTitle = englishDoc?.celebration || englishDoc?.title || englishDoc?.liturgicalDay || 'Daily Mass Readings';
  if (!englishTitle || englishTitle === 'New:' || englishTitle.length < 4) {
    englishTitle = 'Daily Mass Readings';
  }

  const massReadings = {
    tamil: {
      title: tamilTitle,
      liturgicalDay: massReadingDoc?.liturgicalDay || massReadingDoc?.celebration || '',
      celebration: massReadingDoc?.celebration || '',
      readings: tamilReadingsList,
      sections: massReadingDoc?.sections || tamilReadingsList,
      firstReading: massReadingDoc?.firstReading,
      responsorialPsalm: massReadingDoc?.responsorialPsalm,
      secondReading: massReadingDoc?.secondReading,
      gospelAcclamation: massReadingDoc?.gospelAcclamation,
      gospel: massReadingDoc?.gospel,
      fullText: tamilReadingsList.map(r => `${r.type} ${r.reference ? `(${r.reference})` : ''}\n${cleanCatholicContent(r.text)}`).join('\n\n')
    },
    english: {
      title: englishTitle,
      liturgicalDay: englishDoc?.liturgicalDay || englishDoc?.celebration || '',
      celebration: englishDoc?.celebration || '',
      readings: englishReadingsList,
      sections: englishDoc?.sections || englishReadingsList,
      firstReading: englishDoc?.firstReading,
      responsorialPsalm: englishDoc?.responsorialPsalm,
      secondReading: englishDoc?.secondReading,
      gospelAcclamation: englishDoc?.gospelAcclamation,
      gospel: englishDoc?.gospel,
      fullText: englishReadingsList.map(r => `${r.type} ${r.reference ? `(${r.reference})` : ''}\n${cleanCatholicContent(r.text)}`).join('\n\n')
    }
  };

  // 2b. Daily Reflection from authoritative DailyReflection model / cache
  const { getTodayReflection } = require('./dailyReflectionService');
  let dailyRefDoc = null;
  try {
    dailyRefDoc = await getTodayReflection(dateKey);
  } catch (err) {
    console.warn('[DailyContentService] Could not retrieve daily reflection:', err.message);
  }

  // Format Tamil reflection text
  let tamilReflectionText = '';
  const refSource = dailyRefDoc || massReadingDoc?.reflection;
  if (refSource) {
    const parts = [];
    if (refSource.scriptureQuote && refSource.scriptureQuote.trim()) {
      parts.push(refSource.scriptureQuote.trim());
    } else if (refSource.title && refSource.title.trim()) {
      parts.push(refSource.title.trim());
    }
    if (refSource.paragraphs && refSource.paragraphs.length > 0) {
      parts.push(refSource.paragraphs.map(p => cleanCatholicContent(p.trim())).filter(Boolean).join('\n\n'));
    } else if ((refSource.reflection || refSource.content) && (refSource.reflection || refSource.content).trim()) {
      parts.push(cleanCatholicContent((refSource.reflection || refSource.content).trim()));
    }
    if (refSource.prayer && refSource.prayer.trim()) {
      const cleanPrayer = refSource.prayer.replace(/^மன்றாட்டு\s*:\s*/, '').trim();
      parts.push(`மன்றாட்டு:\n${cleanCatholicContent(cleanPrayer)}`);
    }
    tamilReflectionText = parts.join('\n\n');
  }
  if (!tamilReflectionText) {
    tamilReflectionText = 'இறைவனின் வார்த்தை நம் வாழ்வின் வழிகாட்டி. இன்றைய நாளில் இறைவனின் அன்பிலும் இரக்கத்திலும் திளைப்போம்.';
  }

  // Format English reflection text
  let englishReflectionText = '';
  if (englishDoc?.reflection) {
    const r = englishDoc.reflection;
    const parts = [];
    if (r.title && r.title.trim()) parts.push(`${r.title.trim()}`);
    if (r.paragraphs && r.paragraphs.length > 0) {
      parts.push(r.paragraphs.map(p => cleanCatholicContent(p.trim())).filter(Boolean).join('\n\n'));
    } else if (r.content && r.content.trim()) {
      parts.push(cleanCatholicContent(r.content.trim()));
    }
    if (r.prayer && r.prayer.trim()) {
      parts.push(`Prayer:\n${cleanCatholicContent(r.prayer.trim())}`);
    }
    englishReflectionText = parts.join('\n\n');
  }
  if (!englishReflectionText) {
    englishReflectionText = 'The Word of God is a lamp to our feet and a light to our path. May God bless and guide you today.';
  }

  const reflection = {
    tamil: tamilReflectionText,
    english: englishReflectionText,
    title: refSource?.title || '',
    scriptureQuote: refSource?.scriptureQuote || '',
    paragraphs: refSource?.paragraphs || [],
    prayer: refSource?.prayer || '',
    sourceUrl: refSource?.sourceUrl || 'https://www.tamilcatholicdaily.com/dailyverse',
    tamilStructured: refSource || null,
    englishStructured: englishDoc?.reflection || null
  };

  // 3. Saint of the Day
  let saintData = null;
  try {
    saintData = getDailySaint(targetDate);
    if (!saintData || saintData.date !== dateKey) {
      await fetchDailySaint(targetDate);
      saintData = getDailySaint(targetDate);
    }
  } catch (e) {
    console.warn('[DailyContentService] Error fetching saint:', e.message);
  }
  if (!saintData) {
    saintData = getDailySaint(targetDate);
  }

  const saintImageUrl = saintData?.remoteUrl || saintData?.imageUrl || saintData?.image || null;
  let saintImgBuffer = saintImageUrl ? await fetchImageBuffer(saintData?.localPath || saintData?.localUrl || saintImageUrl) : null;

  // Local fallback from uploads/saints/ directory if remote download failed or buffer missing
  if (!saintImgBuffer) {
    try {
      const candidates = [saintData?.localPath, saintData?.localUrl].filter(Boolean);
      for (const c of candidates) {
        let p = c;
        if (typeof c === 'string' && c.startsWith('/uploads/')) {
          p = path.join(__dirname, '../../', c);
        }
        if (fs.existsSync(p)) {
          saintImgBuffer = { buffer: fs.readFileSync(p), contentType: 'image/jpeg' };
          break;
        }
      }
      if (!saintImgBuffer) {
        const dir1 = path.join(__dirname, '../../uploads/saints');
        const dir2 = path.join(process.cwd(), 'uploads/saints');
        const sDir = fs.existsSync(dir1) ? dir1 : fs.existsSync(dir2) ? dir2 : null;
        if (sDir) {
          const files = fs.readdirSync(sDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
          const sName = (saintData?.nameEn || saintData?.saintName || saintData?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
          const matched = files.find(f => {
            const base = f.toLowerCase().replace(/\.[^/.]+$/, "");
            return sName.includes(base) || base.includes(sName) || (sName.includes('jerome') && base.includes('jerome'));
          }) || files[0];
          if (matched) {
            saintImgBuffer = { buffer: fs.readFileSync(path.join(sDir, matched)), contentType: 'image/jpeg' };
          }
        }
      }
    } catch (e) {
      console.warn('[DailyContentService] Local saint image fallback error:', e.message);
    }
  }

  const saintAttachment = saintData?.imageAttachment || (saintImgBuffer ? {
    filename: 'saint_of_the_day.jpg',
    content: saintImgBuffer.buffer,
    cid: 'saintOfTheDayImage',
    contentType: saintImgBuffer.contentType || 'image/jpeg'
  } : null);

  const { getSaintForDate } = require('../data/catholic_saints_calendar');
  const fallbackSaint = getSaintForDate(dateKey);

  let rawNameEn = saintData?.nameEn || saintData?.englishName || saintData?.saintName || saintData?.name;
  if (!rawNameEn || rawNameEn.toLowerCase().includes('saint of the day') || rawNameEn.toLowerCase().includes('today\'s saint')) {
    rawNameEn = fallbackSaint?.name || 'Saint of the Day';
  }

  let rawNameTa = saintData?.nameTa || saintData?.tamilName;
  if (!rawNameTa || rawNameTa.trim() === 'இன்றைய புனிதர்' || rawNameTa.trim() === 'புனிதர்') {
    rawNameTa = fallbackSaint?.nameTa || rawNameEn;
  }

  let rawDescEn = (saintData?.descriptionEn || saintData?.description || saintData?.descriptionEnglish || '').trim();
  if (!rawDescEn || rawDescEn.length < 50) {
    rawDescEn = fallbackSaint?.description || '';
  }

  let rawDescTa = (saintData?.descriptionTa || saintData?.descriptionTamil || '').trim();
  if (!rawDescTa || rawDescTa.length < 50 || !/[\u0B80-\u0BFF]/.test(rawDescTa)) {
    rawDescTa = fallbackSaint?.descriptionTa || 'இன்றைய புனிதரின் வாழ்க்கை வரலாறு மற்றும் அருளுரைகள் எமது ஆலய இணையதளத்தில் வாசிக்கலாம்.';
  }

  const finalSaintImage = saintImageUrl || fallbackSaint?.image || null;

  const saint = {
    date: saintData?.date || dateKey,
    nameEnglish: rawNameEn,
    nameTamil: rawNameTa,
    nameEn: rawNameEn,
    nameTa: rawNameTa,
    saintName: rawNameEn,
    englishName: rawNameEn,
    tamilName: rawNameTa,
    titleEn: saintData?.titleEn || saintData?.feastTitle || rawNameEn,
    titleTa: saintData?.titleTa || saintData?.feastTitleTa || rawNameTa,
    description: rawDescEn,
    descriptionEnglish: rawDescEn,
    descriptionEn: rawDescEn,
    descriptionTa: rawDescTa,
    descriptionTamil: rawDescTa,
    feastDay: saintData?.feastDay || formattedEn,
    feastDayEn: formattedEn,
    feastDayTa: formattedTa,
    feastTitle: saintData?.feastTitle || saintData?.titleEn || fallbackSaint?.feastTitle || null,
    feastTitleTa: saintData?.feastTitleTa || saintData?.titleTa || fallbackSaint?.feastTitleTa || null,
    feastType: saintData?.feastType || null,
    feastTypeTa: saintData?.feastTypeTa || null,
    celebrationType: saintData?.celebrationType || saintData?.feastType || null,
    celebrationTypeTa: saintData?.celebrationTypeTa || saintData?.feastTypeTa || null,
    hasFeastInfo: Boolean(saintData?.hasFeastInfo || fallbackSaint?.hasFeastInfo),
    image: finalSaintImage,
    imageUrl: finalSaintImage,
    remoteUrl: saintData?.remoteUrl || finalSaintImage,
    localUrl: saintData?.localUrl || null,
    localPath: saintData?.localPath || null,
    imageAttachment: saintAttachment,
    imageSource: saintData?.imageSource || 'vatican',
    source: saintData?.source || 'Vatican News',
    sourceUrl: saintData?.primaryCelebration?.sourceUrl || saintData?.primarySaint?.sourceUrl || saintData?.sourceUrl || saintData?.link || 'https://www.vaticannews.va/en/saints.html',
    link: saintData?.primaryCelebration?.sourceUrl || saintData?.primarySaint?.sourceUrl || saintData?.link || saintData?.sourceUrl || 'https://www.vaticannews.va/en/saints.html',
    saints: saintData?.saints || [],
    primaryCelebration: saintData?.primaryCelebration || null,
    primarySaint: saintData?.primarySaint || null,
    otherSaints: saintData?.otherSaints || []
  };

  const { getSiteUrl } = require('../config/siteRoutes');
  const readingsUrl = getSiteUrl('/bible-verse');

  return {
    dateKey,
    formattedDate: formattedEn,
    formattedDateTa: formattedTa,
    saintName: saint.nameEnglish,
    saintNameTa: saint.nameTamil,
    saintDescription: saint.descriptionEnglish,
    saintDescriptionTa: saint.descriptionTamil,
    saintImage: saintImageUrl,
    saintFeastDay: saint.feastDay,
    saintFeastDayTa: formattedTa,
    celebrationType: saint.celebrationType,
    celebrationTypeTa: saint.celebrationTypeTa,
    primarySaint: saint.primarySaint,
    otherSaints: saint.otherSaints,
    bible: {
      tamil: verseData.verseTa || verseData.verseTextTa || verseData.tamil || '',
      english: verseData.verseEn || verseData.verseTextEn || verseData.english || '',
      ref: verseData.ref || verseData.verseRef || verseData.reference || '',
      category: verseData.category || 'Word of God',
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
      ...saint,
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
