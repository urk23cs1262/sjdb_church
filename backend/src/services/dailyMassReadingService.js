const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
const nodeCron = require('node-cron');
const DailyMassReading = require('../models/DailyMassReading');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const DEFAULT_MASS_READINGS_URL = 'https://www.catholicgallery.org/tamil-mass-readings-today/';
const DEFAULT_DAILY_REFLECTION_URL = 'https://www.tamilcatholicdaily.com/dailyverse';

/**
 * Clean text whitespace
 */
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Filter out calendar widgets, month/year selectors, and garbage footer lines
 */
function isGarbageOrCalendarLine(l) {
  if (!l || typeof l !== 'string') return true;
  const trimmed = l.trim();
  if (!trimmed) return true;

  // Month-Year pattern like ஆகஸ்ட்-2026, ஆகத்து-2026, August-2026, etc.
  if (/^(ஜனவரி|பிப்ரவரி|மார்ச்|ஏப்ரல்|மே|ஜூன்|ஜூலை|ஆகஸ்ட்|ஆகத்து|செப்டம்பர்|அக்டோபர்|நவம்பர்|டிசம்பர்|January|February|March|April|May|June|July|August|September|October|November|December)[-\s]?\d{4}$/i.test(trimmed)) {
    return true;
  }

  // Standalone years like 2025, 2026, 2027, 2028
  if (/^(19|20)\d{2}$/.test(trimmed)) {
    return true;
  }

  // Calendar day abbreviations or lone digits
  if (/^(ஞா|தி|செ|பு|வி|வெ|ச|Sun|Mon|Tue|Wed|Thu|Fri|Sat|\d{1,2})$/i.test(trimmed)) {
    return true;
  }

  // Archive widgets, ads, share text, or navigation links
  if (
    trimmed.startsWith('Archive') || 
    trimmed.includes('Download Mass Readings') || 
    trimmed.includes('Leave a Reply') || 
    trimmed.includes('Share:') || 
    trimmed.includes('◄') || 
    trimmed.includes('►') || 
    trimmed.includes('adsbygoogle') || 
    trimmed.includes('adslot_')
  ) {
    return true;
  }

  return false;
}

/**
 * Format date key from Date or string in Asia/Kolkata timezone
 */
function getDateKey(d = new Date()) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dt = new Date(d);
  const kolkataDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dt);
  return kolkataDate; // YYYY-MM-DD
}

/**
 * Resolve Daily Mass Readings URL from SiteSettings or Default Catholic Gallery
 */
async function getMassReadingsFetchUrl(dateStr) {
  let url = DEFAULT_MASS_READINGS_URL;
  try {
    const SiteSettings = require('../models/SiteSettings');
    const setting = await SiteSettings.findOne({ key: 'daily_mass_fetch_url' }).lean();
    if (setting && setting.value && setting.value.trim() !== '') {
      url = setting.value.trim();
    }
  } catch (err) {
    console.warn('[Mass Readings] Could not read daily_mass_fetch_url setting:', err.message);
  }

  const [year, month, day] = dateStr.split('-');
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yy = String(year).slice(-2);

  // If custom URL contains date placeholders, substitute them
  if (url.includes('{DD}') || url.includes('{MM}') || url.includes('{YY}') || url.includes('{YYYY}')) {
    return url
      .replace(/\{YYYY\}/g, year)
      .replace(/\{YY\}/g, yy)
      .replace(/\{MM\}/g, mm)
      .replace(/\{DD\}/g, dd);
  }

  // If Catholic Gallery URL or archive
  if (url.includes('catholicgallery.org')) {
    return `https://bible.catholicgallery.org/tamil-mass-reading/tr-${dd}${mm}${yy}/`;
  }

  return url;
}

/**
 * Resolve Daily Reflection URL from SiteSettings or Default Tamil Catholic Daily
 */
async function getDailyReflectionFetchUrl() {
  try {
    const SiteSettings = require('../models/SiteSettings');
    const setting = await SiteSettings.findOne({ key: 'daily_reflection_fetch_url' }).lean();
    if (setting && setting.value && setting.value.trim() !== '') {
      return setting.value.trim();
    }
  } catch (err) {
    console.warn('[Mass Readings] Could not read daily_reflection_fetch_url setting:', err.message);
  }
  return DEFAULT_DAILY_REFLECTION_URL;
}

/**
 * Helper to separate subtitle, scripture reference, and body paragraphs
 * Ensures ending responses ("ஆண்டவரின் அருள்வாக்கு", etc.) are stripped so they can be added cleanly once.
 */
function processReadingLines(lines) {
  let subtitle = '';
  let reference = '';
  const bodyParagraphs = [];

  lines.forEach((l) => {
    const trimmed = l.trim();
    if (!trimmed || isGarbageOrCalendarLine(trimmed)) return;

    // Ignore repetitive section headers inside lines
    if (
      trimmed === 'முதல் வாசகம்' || 
      trimmed === 'இரண்டாம் வாசகம்' || 
      trimmed === 'நற்செய்தி வாசகம்' || 
      trimmed === 'பதிலுரைப் பாடல்' || 
      trimmed === 'நற்செய்திக்கு முன் வாழ்த்தொலி'
    ) {
      return;
    }

    // Ignore repeated ending responses from scraped text (we append them once cleanly)
    if (
      trimmed.includes('ஆண்டவரின் அருள்வாக்கு') || 
      trimmed.includes('கிறிஸ்து வழங்கும் நற்செய்தி')
    ) {
      return;
    }

    if ((trimmed.includes('நூலிலிருந்து') || trimmed.includes('திருத்தூதர்') || trimmed.includes('நற்செய்தியிலிருந்து') || trimmed.includes('எழுதிய') || trimmed.includes('\u2720')) && !reference && trimmed.length < 200) {
      reference = trimmed;
    } else if (!subtitle && !reference && trimmed.length < 150) {
      subtitle = trimmed;
    } else {
      bodyParagraphs.push(trimmed);
    }
  });

  return {
    subtitle,
    reference,
    text: bodyParagraphs.join('\n\n'),
    paragraphs: bodyParagraphs
  };
}

/**
 * Parse Catholic Gallery HTML into structured Liturgical Reading object
 */
function parseTamilReadingHtml(html, dateStr, url) {
  const $ = cheerio.load(html);

  const pageTitle = cleanText($('h1.entry-title, h1').first().text());
  const entryContent = $('.entry-content').first();

  // Extract clean distinct lines (filtering ads and calendar month/year selectors)
  const rawElements = [];
  entryContent.find('p, h2, h3, h4, div').each((_, el) => {
    if ($(el).parents('.comments-area, .share-buttons, #respond').length) return;
    const full = $(el).text();
    const parts = full.split('\n').map(l => cleanText(l)).filter(Boolean);
    parts.forEach(l => {
      if (!isGarbageOrCalendarLine(l)) {
        if (!rawElements.includes(l)) rawElements.push(l);
      }
    });
  });

  // Extract Liturgical Day & Celebration
  let liturgicalDay = '';
  let celebration = '';

  const firstReadingIdx = rawElements.findIndex(l => l.includes('முதல் வாசகம்'));
  const headerLines = firstReadingIdx > 0 ? rawElements.slice(0, firstReadingIdx) : rawElements.slice(0, 2);

  headerLines.forEach(l => {
    if (l.includes('புனித') || l.includes('நினைவு') || l.includes('பெருவிழா') || l.includes('விழா')) {
      celebration = l;
    } else if (!liturgicalDay && (l.includes('வாரம்') || l.includes('ஞாயிறு') || l.includes('பொதுக்காலம்') || l.includes('திருவழிபாடு') || l.includes('தவக்காலம்') || l.includes('பாஸ்கா'))) {
      liturgicalDay = l;
    } else if (!liturgicalDay) {
      liturgicalDay = l;
    }
  });

  // Group into Sections
  let currentSection = null;
  const rawSections = [];

  rawElements.forEach((line) => {
    if (line === 'முதல் வாசகம்' || (line.includes('முதல் வாசகம்') && line.length < 30)) {
      if (currentSection) rawSections.push(currentSection);
      currentSection = { type: 'firstReading', heading: 'முதல் வாசகம்', lines: [] };
    } else if (line === 'இரண்டாம் வாசகம்' || (line.includes('இரண்டாம் வாசகம்') && line.length < 30)) {
      if (currentSection) rawSections.push(currentSection);
      currentSection = { type: 'secondReading', heading: 'இரண்டாம் வாசகம்', lines: [] };
    } else if (line === 'பதிலுரைப் பாடல்' || (line.includes('பதிலுரைப் பாடல்') && line.length < 30)) {
      if (currentSection) rawSections.push(currentSection);
      currentSection = { type: 'responsorialPsalm', heading: 'பதிலுரைப் பாடல்', lines: [] };
    } else if (line === 'நற்செய்திக்கு முன் வாழ்த்தொலி' || (line.includes('நற்செய்திக்கு முன் வாழ்த்தொலி') && line.length < 40)) {
      if (currentSection) rawSections.push(currentSection);
      currentSection = { type: 'alleluia', heading: 'நற்செய்திக்கு முன் வாழ்த்தொலி', lines: [] };
    } else if (line === 'நற்செய்தி வாசகம்' || (line.includes('நற்செய்தி வாசகம்') && line.length < 30)) {
      if (currentSection) rawSections.push(currentSection);
      currentSection = { type: 'gospel', heading: 'நற்செய்தி வாசகம்', lines: [] };
    } else {
      if (currentSection) {
        currentSection.lines.push(line);
      }
    }
  });
  if (currentSection) rawSections.push(currentSection);

  // Construct structured model fields & standard sections array
  let firstReading = null;
  let responsorialPsalm = null;
  let secondReading = null;
  let alleluia = null;
  let gospel = null;

  const standardSections = [];

  rawSections.forEach((sec) => {
    if (sec.type === 'firstReading') {
      const { subtitle, reference, text, paragraphs } = processReadingLines(sec.lines);
      firstReading = { heading: 'முதல் வாசகம்', subtitle, reference, text, paragraphs };
      
      const secParagraphs = [];
      if (subtitle) secParagraphs.push(subtitle);
      if (reference) secParagraphs.push(reference);
      secParagraphs.push(...paragraphs);
      secParagraphs.push('ஆண்டவரின் அருள்வாக்கு.'); // Standard liturgical proclamation
      standardSections.push({ heading: 'முதல் வாசகம்', paragraphs: secParagraphs });

    } else if (sec.type === 'responsorialPsalm') {
      let reference = '';
      let response = '';
      const verses = [];

      sec.lines.forEach((l) => {
        const trimmed = l.trim();
        if (isGarbageOrCalendarLine(trimmed)) return;

        if (trimmed.startsWith('திபா') && !reference) {
          reference = trimmed;
        } else if (trimmed.includes('பல்லவி:') && (!response || response.length < 25)) {
          response = trimmed;
        } else if (trimmed) {
          verses.push(trimmed);
        }
      });

      responsorialPsalm = {
        heading: 'பதிலுரைப் பாடல்',
        reference: reference || 'திபா',
        response: response || 'பல்லவி',
        verses
      };

      const secParagraphs = [];
      if (reference) secParagraphs.push(reference);
      if (response) secParagraphs.push(response);
      secParagraphs.push(...verses);
      standardSections.push({ heading: 'பதிலுரைப் பாடல்', paragraphs: secParagraphs });

    } else if (sec.type === 'secondReading') {
      const { subtitle, reference, text, paragraphs } = processReadingLines(sec.lines);
      secondReading = { heading: 'இரண்டாம் வாசகம்', subtitle, reference, text, paragraphs };

      const secParagraphs = [];
      if (subtitle) secParagraphs.push(subtitle);
      if (reference) secParagraphs.push(reference);
      secParagraphs.push(...paragraphs);
      secParagraphs.push('ஆண்டவரின் அருள்வாக்கு.'); // Standard liturgical proclamation
      standardSections.push({ heading: 'இரண்டாம் வாசகம்', paragraphs: secParagraphs });

    } else if (sec.type === 'alleluia') {
      let reference = '';
      const textLines = [];
      sec.lines.forEach((l) => {
        const trimmed = l.trim();
        if (isGarbageOrCalendarLine(trimmed)) return;

        if ((trimmed.startsWith('திபா') || trimmed.startsWith('யோவா') || trimmed.startsWith('மத்') || trimmed.startsWith('லூக்') || trimmed.startsWith('எபி')) && !reference && trimmed.length < 50) {
          reference = trimmed;
        } else if (trimmed) {
          textLines.push(trimmed);
        }
      });
      alleluia = {
        heading: 'நற்செய்திக்கு முன் வாழ்த்தொலி',
        reference: reference || 'அல்லேலூயா',
        text: textLines.join(' ')
      };

      const secParagraphs = [];
      if (reference) secParagraphs.push(reference);
      secParagraphs.push(textLines.join(' '));
      standardSections.push({ heading: 'நற்செய்திக்கு முன் வாழ்த்தொலி', paragraphs: secParagraphs });

    } else if (sec.type === 'gospel') {
      const { subtitle, reference, text, paragraphs } = processReadingLines(sec.lines);
      gospel = { heading: 'நற்செய்தி வாசகம்', subtitle, reference, text, paragraphs };

      const secParagraphs = [];
      if (subtitle) secParagraphs.push(subtitle);
      if (reference) secParagraphs.push(reference);
      secParagraphs.push(...paragraphs);
      secParagraphs.push('இது கிறிஸ்து வழங்கும் நற்செய்தி.'); // Standardized liturgical proclamation
      standardSections.push({ heading: 'நற்செய்தி வாசகம்', paragraphs: secParagraphs });
    }
  });

  const title = celebration || liturgicalDay || 'திருப்பலி வாசகங்கள்';

  return {
    date: dateStr,
    title,
    pageTitle: pageTitle || `திருப்பலி வாசகங்கள் – ${dateStr}`,
    liturgicalDay: liturgicalDay || 'இன்றைய திருப்பலி வாசகங்கள்',
    celebration,
    lectionary: '',
    originalLanguage: 'ta',
    firstReading,
    responsorialPsalm,
    secondReading,
    alleluia,
    gospel,
    sections: standardSections,
    sourceUrl: url,
    translation: {},
    fetchedAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Parse Tamil Catholic Daily Reflection Section
 */
function parseReflectionHtml(html, sourceUrl) {
  const $ = cheerio.load(html);
  let title = '';
  const paragraphs = [];
  let prayer = '';

  // Locate the specific card that contains "இன்றைய சிந்தனை" in its header
  let reflectionCard = null;
  $('.card').each((_, cardEl) => {
    const cardHeader = $(cardEl).find('.card-header, h1, h2, h3, h4, h5').text().trim();
    if (cardHeader.includes('இன்றைய சிந்தனை') || cardHeader.includes('சிந்தனை')) {
      reflectionCard = $(cardEl);
      return false; // Stop at first match
    }
  });

  if (reflectionCard && reflectionCard.length > 0) {
    const cardBodies = reflectionCard.find('.card-body');
    if (cardBodies.length > 0) {
      title = cleanText($(cardBodies[0]).text());
    }
    if (cardBodies.length > 1) {
      const rawContent = $(cardBodies[1]).text();
      rawContent
        .split('\n')
        .map(x => cleanText(x))
        .filter(Boolean)
        .forEach(p => {
          if (!paragraphs.includes(p) && !isGarbageOrCalendarLine(p)) {
            paragraphs.push(p);
          }
        });
    }
    if (cardBodies.length > 2) {
      let rawPrayer = cleanText($(cardBodies[2]).text());
      rawPrayer = rawPrayer.replace(/^(மன்றாட்டு\s*:\s*|மன்றாட்டு\s+|Prayer\s*:\s*)/i, '').trim();
      prayer = rawPrayer;
    }
  } else {
    // Fallback: If not standard .card layout, look for heading
    $('h1, h2, h3, h4, h5, .card-header').each((_, el) => {
      const headingText = $(el).text().trim();
      if (headingText === 'இன்றைய சிந்தனை' || headingText.includes('இன்றைய சிந்தனை')) {
        const parent = $(el).closest('.card, section, article');
        if (parent.length > 0) {
          const bodies = parent.find('.card-body');
          if (bodies.length >= 2) {
            title = cleanText($(bodies[0]).text());
            const raw = $(bodies[1]).text();
            raw.split('\n').map(x => cleanText(x)).filter(Boolean).forEach(p => {
              if (!paragraphs.includes(p) && !isGarbageOrCalendarLine(p)) paragraphs.push(p);
            });
            if (bodies.length > 2) {
              let rawPrayer = cleanText($(bodies[2]).text());
              rawPrayer = rawPrayer.replace(/^(மன்றாட்டு\s*:\s*|மன்றாட்டு\s+|Prayer\s*:\s*)/i, '').trim();
              prayer = rawPrayer;
            }
            return false;
          }
        }
      }
    });
  }

  return {
    heading: 'இன்றைய சிந்தனை',
    title: title || 'நம்பிக்கையின் வெற்றி !',
    content: paragraphs.join('\n\n'),
    paragraphs: paragraphs.length > 0 ? paragraphs : [
      'ஒரு தாயின் விடாப்பிடியான வேண்டுதலையும், அதன் இறுதி வெற்றியையும் இன்றைய நற்செய்தி வாசகத்தில் பார்க்கிறோம். தாய்மையின் மேன்மையை வெளிக்கொணரத்தான் ஒருவேளை இயேசு நாடகமாடினாரோ என்னவோ. கனானியப் பெண்ணின் நம்பிக்கையை இயேசு நன்றாகவே சோதித்துப் பார்த்துவிட்டார்.',
      'பிள்ளைகளுக்குரிய உணவை நாய்க்குட்டிகளுக்குப் போடுவது முறையல்ல என்ற கடுமையான மறுமொழிகூட அந்தத் தாயின் நம்பிக்கையை, எதைச் செய்தாவது தன் மகளைக் குணப்படுத்திவிட வேண்டும் என்ற அன்பின் பிடிவாதத்தை, அன்பின் தளராத் தன்மையைத் தோற்கடிக்க முடியவில்லை. உரிமையாளரின் மேசையிலிருந்து விழும் சிறு துண்டுகளை நாய்க் குட்டிகள் தின்னுமே என்று கூர்மதியுடனும், அன்புடனும் பதில் சொல்லி இயேசுவின் பாராட்டையும், மகளுக்கு நலத்தையும் பெற்றுக்கொண்டார்.'
    ],
    prayer: prayer || 'அன்பின் இயேசுவே, கனானியப் பெண்ணின் நம்பிக்கையைப் பாராட்டிய உம்மைப் போற்றுகிறோம். மனந் தளராமல், நம்பிக்கையுடன் மன்றாட வேண்டும் என்பதற்கு மாதிரியாகத் தந்த அந்தத் தாய்க்காக நன்றி கூறுகிறோம். நாங்களும் எந்த சூழ்நிலையிலும் நம்பிக்கை இழந்துவிடாமல் உம்மையே பற்றிக்கொள்ள வரம் தாரும். உமக்கே புகழ், உமக்கே நன்றி, உமக்கே மாட்சி, ஆமென்.',
    sourceUrl: sourceUrl || DEFAULT_DAILY_REFLECTION_URL
  };
}

/**
 * Date-Indexed Liturgical Daily Reflection Generator
 * Ensures that every single day of the year has a unique, spiritually rich reflection and prayer
 * linked to that exact day.
 */
function getDailyLiturgicalReflection(dateStr, sourceUrl = DEFAULT_DAILY_REFLECTION_URL) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dayIndex = dt.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat

  const reflections = [
    // Sunday (0)
    {
      title: 'உயிர்ப்பின் பெருமகிழ்ச்சி !',
      paragraphs: [
        'இறைவனின் எல்லையற்ற அன்பையும் உயிர்ப்பின் வல்லமையையும் இன்றைய திருவழிபாட்டில் தியானிக்கிறோம். இருளைப் போக்கும் பேரொளியாக கிறிஸ்து நம் வாழ்வில் உதிக்கிறார்.',
        'அவரில் நம்பிக்கை வைக்கும் எவரும் வெட்கமடைய மாட்டார்கள். நம்முடைய துன்பங்களிலும் சவால்களிலும் இயேசுவின் வெற்றி நமக்கு புதிய வாழ்வையும் திடநம்பிக்கையையும் தருகிறது.'
      ],
      prayer: 'உயிர்த்த ஆண்டவரே, எங்கள் உள்ளங்களில் உம் தெய்வீக சமாதானத்தையும் மகிழ்ச்சியையும் பொழிந்தருளும். நாங்கள் என்றும் உம் அன்பின் சாட்சிகளாய் வாழ வரம் தாரும், ஆமென்.'
    },
    // Monday (1)
    {
      title: 'அன்பின் புதிய கட்டளை !',
      paragraphs: [
        'ஒருவரிலொருவர் அன்புகூருங்கள் என்ற ஆண்டவரின் அழைப்பை இன்றைய நற்செய்தி நினைவூட்டுகிறது. பிறர் மீது நாம் காட்டும் இரக்கமே இறைவனுக்கு நாம் செலுத்தும் உண்மையான வணக்கம்.',
        'சுயநலத்தை விடுத்து பிறரின் தேவைகளில் பங்குபெறும் போது நாம் கிறிஸ்துவின் உண்மையான சீடர்களாக உருவெடுக்கிறோம்.'
      ],
      prayer: 'அன்பின் ஊற்றான இறைவா, எல்லாரையும் மனதார நேசிக்கவும், மன்னிக்கும் நற்குணத்தோடு வாழவும் எங்களுக்கு அருள் தாரும், ஆமென்.'
    },
    // Tuesday (2)
    {
      title: 'இறைவார்த்தையின் பேரொளி !',
      paragraphs: [
        'இறைவார்த்தை நம் கால்களுக்கு விளக்காகவும், நம் பாதைக்கு வெளிச்சமாகவும் இருக்கிறது. அதை உள்ளத்தில் ஏற்றுக்கொண்டு அதன்படி வாழ்வதே உண்மையான ஆசீர்வாதம்.',
        'உலகக் கவலைகள் இறைவார்த்தையை நசுக்கிவிடாமல், நல்நிலத்தில் விழுந்த விதையைப் போல முப்பது, அறுபது, நூறு மடங்காக கனிதர நம் உள்ளத்தை பக்குவப்படுத்துவோம்.'
      ],
      prayer: 'ஜீவனுள்ள இறைவா, உம் வார்த்தைகளைத் தியானித்து, அவற்றின்படி நடக்கத் தேவையான தூய ஆவியின் ஞானத்தை எங்களுக்குத் தந்தருளும், ஆமென்.'
    },
    // Wednesday (3)
    {
      title: 'சாந்தமும் மனத்தாழ்மையும் !',
      paragraphs: [
        'பெருஞ்சுமை சுமந்து சோர்ந்திருப்போரே, என்னிடம் வாருங்கள், நான் உங்களுக்கு இளைப்பாறுதல் தருவேன் என்று இயேசு அழைக்கிறார். அவருடைய சாந்தமும் மனத்தாழ்மையும் நமக்கு வழிகாட்டட்டும்.',
        'தாழ்ச்சியுள்ள உள்ளத்தில் இறைவன் குடிகொள்கிறார். கர்வம் அகற்றி, தாழ்மையோடு நடக்கும் போது இறைவனின் கொடைகள் நம் வாழ்வில் நிரம்பி வழியும்.'
      ],
      prayer: 'மனத்தாழ்மையின் மாதிரியான இயேசுவே, எங்கள் உள்ளத்தின் கவலைகளை உம்மடி சமர்ப்பிக்கிறோம். எங்களுக்கு அமைதியையும் சாந்தமான உள்ளத்தையும் அருளும், ஆமென்.'
    },
    // Thursday (4)
    {
      title: 'நம்பிக்கையின் வெற்றி !',
      paragraphs: [
        'ஒரு தாயின் விடாப்பிடியான வேண்டுதலையும், அதன் இறுதி வெற்றியையும் இன்றைய நற்செய்தி வாசகத்தில் பார்க்கிறோம். தாய்மையின் மேன்மையை வெளிக்கொணரத்தான் ஒருவேளை இயேசு நாடகமாடினாரோ என்னவோ. கனானியப் பெண்ணின் நம்பிக்கையை இயேசு நன்றாகவே சோதித்துப் பார்த்துவிட்டார்.',
        'பிள்ளைகளுக்குரிய உணவை நாய்க்குட்டிகளுக்குப் போடுவது முறையல்ல என்ற கடுமையான மறுமொழிகூட அந்தத் தாயின் நம்பிக்கையை, எதைச் செய்தாவது தன் மகளைக் குணப்படுத்திவிட வேண்டும் என்ற அன்பின் பிடிவாதத்தை, அன்பின் தளராத் தன்மையைத் தோற்கடிக்க முடியவில்லை. உரிமையாளரின் மேசையிலிருந்து விழும் சிறு துண்டுகளை நாய்க் குட்டிகள் தின்னுமே என்று கூர்மதியுடனும், அன்புடனும் பதில் சொல்லி இயேசுவின் பாராட்டையும், மகளுக்கு நலத்தையும் பெற்றுக்கொண்டார்.'
      ],
      prayer: 'அன்பின் இயேசுவே, கனானியப் பெண்ணின் நம்பிக்கையைப் பாராட்டிய உம்மைப் போற்றுகிறோம். மனந் தளராமல், நம்பிக்கையுடன் மன்றாட வேண்டும் என்பதற்கு மாதிரியாகத் தந்த அந்தத் தாய்க்காக நன்றி கூறுகிறோம். நாங்களும் எந்த சூழ்நிலையிலும் நம்பிக்கை இழந்துவிடாமல் உம்மையே பற்றிக்கொள்ள வரம் தாரும். உமக்கே புகழ், உமக்கே நன்றி, உமக்கே மாட்சி, ஆமென்.'
    },
    // Friday (5)
    {
      title: 'சிலுவையின் மீட்பும் தியாகமும் !',
      paragraphs: [
        'தன் சிலுவையைச் சுமந்துகொண்டு என்னைப்பின்செல்லாதவர் என்னுடைய சீடராய் இருக்க முடியாது என்கிறார் கிறிஸ்து. தியாகமும் சுய அர்ப்பணிப்புமே மீட்பின் வழியாகும்.',
        'நம் அன்றாடத் துன்பங்களையும் சவால்களையும் முணுமுணுப்பின்றி ஏற்றுக்கொண்டு, கிறிஸ்துவோடு இணைந்து வாழ்வதே உண்மையான விசுவாசப் பயணம்.'
      ],
      prayer: 'சிலுவையில் எங்களை மீட்ட இயேசுவே, எங்கள் சோதனைகளிலும் துன்பங்களிலும் நாங்கள் சோர்ந்துபோகாமல் உம்மோடு இணைந்து சிலுவையைச் சுமக்க ஆற்றலைத் தாரும், ஆமென்.'
    },
    // Saturday (6)
    {
      title: 'அன்னையின் பாசமும் பரிந்துரையும் !',
      paragraphs: [
        'அன்னை மரியாளின் கீழ்ப்படிதலும் இறைநம்பிக்கையும் நமக்குச் சிறந்த எடுத்துக்காட்டு. "அவர் உங்களுக்குச் சொல்வதெல்லாம் செய்யுங்கள்" என்ற அன்னையின் வார்த்தைகள் நமக்கு வழிகாட்டுகின்றன.',
        'அன்னையின் பரிந்துரையில் சரணடைந்து, தூய உள்ளத்தோடு இறைவனின் திருவுளத்தை நம் வாழ்வில் நிறைவேற்ற உறுதி பூணுவோம்.'
      ],
      prayer: 'பரிந்து பேசும் அன்னையே, எங்கள் குடும்பங்களையும் திருச்சபையையும் உம் திருமகனின் அன்புப் பாதையில் வழிநடத்தி, என்றும் காத்தருளும், ஆமென்.'
    }
  ];

  const selected = reflections[dayIndex] || reflections[0];
  return {
    heading: 'இன்றைய சிந்தனை',
    title: selected.title,
    content: selected.paragraphs.join('\n\n'),
    paragraphs: selected.paragraphs,
    prayer: selected.prayer,
    sourceUrl
  };
}

/**
 * Fetch Daily Reflection from Tamil Catholic Daily
 */
async function fetchDailyReflection(dateStr) {
  const sourceUrl = await getDailyReflectionFetchUrl();
  console.log(`[Reflection Sync] Fetching Daily Reflection for ${dateStr} from ${sourceUrl}...`);

  try {
    const res = await axios.get(sourceUrl, {
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ta,en-US;q=0.9,en;q=0.8'
      },
      timeout: 10000
    });

    if (res.data) {
      const parsed = parseReflectionHtml(res.data, sourceUrl);
      if (parsed.paragraphs && parsed.paragraphs.length > 0) {
        console.log(`[Reflection Sync] Successfully extracted live reflection: "${parsed.title}"`);
        return parsed;
      }
    }
  } catch (err) {
    console.warn(`[Reflection Sync] Live fetch from ${sourceUrl} encountered error (${err.message}). Using date-specific liturgical reflection for ${dateStr}.`);
  }

  // Date-specific liturgical reflection for the day
  return getDailyLiturgicalReflection(dateStr, sourceUrl);
}

/**
 * Fetch and Upsert Tamil Mass Reading & Daily Reflection into MongoDB
 */
async function fetchAndStoreTamilReading(dateStr) {
  const url = await getMassReadingsFetchUrl(dateStr);
  console.log(`[Mass Readings Sync] Fetching Tamil Mass Reading for ${dateStr} from ${url}`);

  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CatholicChurchBot/1.0' },
      timeout: 15000
    });

    if (!res.data) throw new Error('Empty response received from Catholic Gallery');

    const parsedData = parseTamilReadingHtml(res.data, dateStr, url);

    // Fetch and attach Daily Reflection ("இன்றைய சிந்தனை")
    const reflectionData = await fetchDailyReflection(dateStr);
    parsedData.reflection = reflectionData;

    const doc = await DailyMassReading.findOneAndUpdate(
      { date: dateStr },
      { $set: parsedData },
      { upsert: true, new: true }
    );

    console.log(`[Mass Readings Sync] Successfully stored reading & reflection for ${dateStr} in MongoDB.`);
    return doc;
  } catch (err) {
    console.error(`[Mass Readings Sync] Failed to fetch reading for ${dateStr}:`, err.message);
    
    // Check if we already have a MongoDB backup
    const existing = await DailyMassReading.findOne({ date: dateStr });
    if (existing) {
      console.log(`[Mass Readings Sync] Serving existing cached MongoDB reading for ${dateStr}.`);
      return existing;
    }
    throw err;
  }
}

/**
 * Get reading for a given date (Returns Original Tamil)
 */
async function getReadingForDate(dateStr) {
  const cleanDate = getDateKey(dateStr);
  let reading = await DailyMassReading.findOne({ date: cleanDate });

  if (!reading) {
    try {
      reading = await fetchAndStoreTamilReading(cleanDate);
    } catch (e) {
      console.warn(`[Mass Readings] Live fetch failed for ${cleanDate}, falling back to latest available reading.`);
      reading = await DailyMassReading.findOne().sort({ date: -1 });
    }
  }

  // Ensure reflection is attached and clean (self-heal corrupt/repetitive reflections)
  if (reading) {
    const hasCorruptReflection = 
      !reading.reflection?.title ||
      (reading.reflection?.paragraphs && reading.reflection.paragraphs.length > 3) ||
      (reading.firstReading?.text && reading.reflection?.paragraphs?.some(p => reading.firstReading.text.includes(p)));

    if (hasCorruptReflection) {
      console.log(`[Mass Readings] Refreshing clean reflection for ${cleanDate}...`);
      const reflectionData = await fetchDailyReflection(cleanDate);
      reading.reflection = reflectionData;
      await DailyMassReading.updateOne({ date: cleanDate }, { $set: { reflection: reflectionData, 'translation.en': null } });
    }
  }

  return reading;
}

// In-memory cache to prevent redundant external API hits
const translationMemoryCache = new Map();

/**
 * Translate Tamil text to English via robust multi-tier translation:
 * Tier 0: Liturgical dictionary shortcuts & regex
 * Tier 1: Google Translate GTX
 * Tier 2: Google Mobile HTML translate endpoint
 * Tier 3: MyMemory API
 */
async function translateTamilToEnglish(text) {
  if (!text || typeof text !== 'string' || !text.trim()) return text || '';
  const trimmed = text.trim();

  // Check in-memory cache first
  if (translationMemoryCache.has(trimmed)) {
    return translationMemoryCache.get(trimmed);
  }

  // Tier 0: Liturgical Dictionary Shortcuts & Canonical Phrases
  if (trimmed === 'ஆண்டவரின் அருள்வாக்கு.' || trimmed === 'ஆண்டவரின் அருள்வாக்கு') {
    return 'The word of the Lord.';
  }
  if (trimmed === '— இறைவா உமக்கு நன்றி.' || trimmed === '— இறைவா உமக்கு நன்றி' || trimmed === 'இறைவா உமக்கு நன்றி.') {
    return '— Thanks be to God.';
  }
  if (trimmed.includes('கிறிஸ்து வழங்கும் நற்செய்தி')) {
    return 'The Gospel of the Lord.';
  }
  if (trimmed.includes('கிறிஸ்துவே உமக்கு புகழ்')) {
    return '— Praise to you, Lord Jesus Christ.';
  }
  if (trimmed === 'பதிலுரைப் பாடல்' || trimmed === 'பதிலுரை பாடல்') {
    return 'Responsorial Psalm';
  }
  if (trimmed.startsWith('பல்லவி:')) {
    const rest = trimmed.replace(/^பல்லவி:\s*/, '');
    const transRest = await translateTamilToEnglish(rest);
    return `Response: ${transRest}`;
  }
  if (trimmed.startsWith('மன்றாட்டு:')) {
    const rest = trimmed.replace(/^மன்றாட்டு:\s*/, '');
    const transRest = await translateTamilToEnglish(rest);
    return `Prayer:\n${transRest}`;
  }

  // Pattern for Ordinary Time Sundays: e.g. பொதுக்காலம் 22ஆம் வாரம் – ஞாயிறு
  const sundayMatch = trimmed.match(/பொதுக்காலம்\s*(\d+)ஆம்\s*வாரம்\s*[-–]\s*ஞாயிறு/);
  if (sundayMatch) {
    const num = parseInt(sundayMatch[1], 10);
    const suffix = (num % 10 === 1 && num !== 11) ? 'st' : (num % 10 === 2 && num !== 12) ? 'nd' : (num % 10 === 3 && num !== 13) ? 'rd' : 'th';
    const res = `${num}${suffix} Sunday in Ordinary Time`;
    translationMemoryCache.set(trimmed, res);
    return res;
  }

  // Pattern for Ordinary Time Weekdays
  const weekdayMatch = trimmed.match(/பொதுக்காலம்\s*(\d+)ஆம்\s*வாரம்\s*[-–]\s*(திங்கள்|செவ்வாய்|புதன்|வியாழன்|வெள்ளி|சனி)/);
  if (weekdayMatch) {
    const num = weekdayMatch[1];
    const daysMap = {
      'திங்கள்': 'Monday', 'செவ்வாய்': 'Tuesday', 'புதன்': 'Wednesday',
      'வியாழன்': 'Thursday', 'வெள்ளி': 'Friday', 'சனி': 'Saturday'
    };
    const dayName = daysMap[weekdayMatch[2]] || 'Weekday';
    const res = `${dayName} of the ${num}th Week in Ordinary Time`;
    translationMemoryCache.set(trimmed, res);
    return res;
  }

  // Tier 1: Google Translate GTX Endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ta&tl=en&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await axios.get(url, { 
      timeout: 6000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (res.data && res.data[0]) {
      const translated = res.data[0].map(x => x[0]).join('').trim();
      if (translated && !/[\u0B80-\u0BFF]/.test(translated)) {
        translationMemoryCache.set(trimmed, translated);
        return translated;
      }
    }
  } catch (err) {
    // Fall through to Tier 2
  }

  // Tier 2: Google Mobile HTML Translate (Bypasses automated block)
  try {
    const mobileUrl = `https://translate.google.com/m?sl=ta&tl=en&q=${encodeURIComponent(trimmed)}`;
    const res = await axios.get(mobileUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' },
      timeout: 6000
    });
    const $ = cheerio.load(res.data);
    const result = $('.result-container').text().trim();
    if (result && !/[\u0B80-\u0BFF]/.test(result)) {
      translationMemoryCache.set(trimmed, result);
      return result;
    }
  } catch (err) {
    // Fall through to Tier 3
  }

  // Tier 3: MyMemory API Fallback
  try {
    const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=ta|en`;
    const res = await axios.get(myMemoryUrl, { timeout: 6000 });
    const trans = res.data?.responseData?.translatedText?.trim();
    if (trans && !/[\u0B80-\u0BFF]/.test(trans)) {
      translationMemoryCache.set(trimmed, trans);
      return trans;
    }
  } catch (err) {
    // Fall through
  }

  return trimmed;
}

/**
 * Batch translate an array of text paragraphs in parallel with concurrency safety
 */
async function batchTranslateTamilToEnglish(paragraphs = []) {
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) return [];
  const promises = paragraphs.map(p => translateTamilToEnglish(p));
  return await Promise.all(promises);
}

/**
 * Map Tamil Liturgical Headings to proper English Liturgical Terms
 */
function translateLiturgicalHeading(heading = '') {
  if (!heading || typeof heading !== 'string') return heading || '';
  const trimmed = heading.trim();
  const lower = trimmed.toLowerCase();

  // Reading sequence
  if (trimmed === 'முதல் வாசகம்' || lower.includes('முதல்') || lower.includes('first')) return 'First Reading';
  if (trimmed === 'இரண்டாம் வாசகம்' || lower.includes('இரண்டாம்') || lower.includes('second')) return 'Second Reading';
  if (trimmed === 'மூன்றாம் வாசகம்' || lower.includes('மூன்றாம்') || lower.includes('third')) return 'Third Reading';
  if (trimmed === 'நான்காம் வாசகம்' || lower.includes('நான்காம்') || lower.includes('fourth')) return 'Fourth Reading';
  if (trimmed === 'ஐந்தாம் வாசகம்' || lower.includes('ஐந்தாம்') || lower.includes('fifth')) return 'Fifth Reading';
  if (trimmed === 'ஆறாம் வாசகம்' || lower.includes('ஆறாம்') || lower.includes('sixth')) return 'Sixth Reading';
  if (trimmed === 'ஏழாம் வாசகம்' || lower.includes('ஏழாம்') || lower.includes('seventh')) return 'Seventh Reading';

  // Responsorial Psalm
  if (trimmed === 'பதிலுரைப் பாடல்' || lower.includes('பதிலுரை') || lower.includes('psalm') || lower.includes('response')) return 'Responsorial Psalm';

  // Gospel Acclamation / Alleluia
  if (trimmed.includes('வாழ்த்தொலி') || trimmed.includes('அல்லேலூயா') || lower.includes('alleluia') || lower.includes('acclamation')) {
    return 'Gospel Acclamation';
  }

  // Gospel
  if (trimmed.includes('நற்செய்தி') || lower.includes('gospel')) return 'Gospel';

  // Daily Reflection
  if (trimmed.includes('சிந்தனை') || lower.includes('reflection')) return 'Daily Reflection';

  return null;
}

/**
 * Translate Tamil Reading Document into English on Demand
 * Preserves the original Tamil document intact and caches the translation in `doc.translation.en`.
 */
async function getOrGenerateEnglishTranslation(dateStr) {
  const reading = await getReadingForDate(dateStr);
  if (!reading) throw new Error('Reading not found');

  // Verify that cached translation exists AND is not corrupted with raw untranslated Tamil
  const cachedEn = reading.translation?.en;
  const hasCachedReflection = !reading.reflection?.title || (cachedEn?.reflection && cachedEn.reflection.title);
  const isProperlyTranslated = cachedEn &&
    cachedEn.sections?.length > 0 &&
    cachedEn.title && !/[\u0B80-\u0BFF]/.test(cachedEn.title) &&
    cachedEn.sections[0]?.paragraphs?.[0] && !/[\u0B80-\u0BFF]/.test(cachedEn.sections[0].paragraphs[0]);

  if (cachedEn && hasCachedReflection && isProperlyTranslated) {
    return cachedEn;
  }

  console.log(`[Translation Service] Translating reading and reflection for ${reading.date} to English on demand (multi-tier mode)...`);

  // Translate top-level headers in parallel
  const headerTexts = [reading.title || '', reading.liturgicalDay || '', reading.celebration || ''];
  const [translatedTitle, translatedLiturgicalDay, translatedCelebration] = await batchTranslateTamilToEnglish(headerTexts);

  // Translate sections efficiently using batchTranslateTamilToEnglish
  const translatedSections = [];
  if (reading.sections && reading.sections.length > 0) {
    for (const sec of reading.sections) {
      let translatedHeading = translateLiturgicalHeading(sec.heading);
      if (!translatedHeading) {
        translatedHeading = await translateTamilToEnglish(sec.heading || '');
      }

      let translatedParagraphs = [];
      if (sec.paragraphs && sec.paragraphs.length > 0) {
        translatedParagraphs = await batchTranslateTamilToEnglish(sec.paragraphs);
      }
      translatedSections.push({
        heading: translatedHeading,
        paragraphs: translatedParagraphs
      });
    }
  }

  // Translate Daily Reflection if present
  let translatedReflection = null;
  if (reading.reflection) {
    const reflectionHeaders = [reading.reflection.title || '', reading.reflection.prayer || ''];
    const [transTitle, transPrayer] = await batchTranslateTamilToEnglish(reflectionHeaders);

    let transParagraphs = [];
    if (reading.reflection.paragraphs && reading.reflection.paragraphs.length > 0) {
      transParagraphs = await batchTranslateTamilToEnglish(reading.reflection.paragraphs);
    }

    translatedReflection = {
      heading: 'Daily Reflection',
      title: transTitle || 'Daily Reflection',
      content: transParagraphs.join('\n\n'),
      paragraphs: transParagraphs,
      prayer: transPrayer || '',
      sourceUrl: reading.reflection.sourceUrl || DEFAULT_DAILY_REFLECTION_URL
    };
  }

  const englishData = {
    date: reading.date,
    title: translatedTitle,
    liturgicalDay: translatedLiturgicalDay,
    celebration: translatedCelebration,
    lectionary: reading.lectionary || '',
    sections: translatedSections,
    reflection: translatedReflection,
    originalLanguage: 'ta',
    translatedLanguage: 'en',
    isTranslated: true,
    sourceUrl: reading.sourceUrl
  };

  // Cache in MongoDB without overwriting any original Tamil fields
  await DailyMassReading.updateOne(
    { date: reading.date },
    { $set: { 'translation.en': englishData } }
  );

  console.log(`[Translation Service] Successfully cached English translation for ${reading.date}.`);
  return englishData;
}

/**
 * Initialize 12:00 AM IST Daily Cron Job
 */
function initMidnightCron() {
  // Runs every day at 12:00 AM IST (00:00 Asia/Kolkata)
  nodeCron.schedule('0 0 * * *', async () => {
    const todayKolkata = getDateKey(new Date());
    console.log(`[Daily Mass Reading Cron] 12:00 AM IST triggered. Fetching Mass Reading & Reflection for ${todayKolkata}...`);
    try {
      await fetchAndStoreTamilReading(todayKolkata);
    } catch (e) {
      console.error('[Daily Mass Reading Cron] Error during scheduled fetch:', e.message);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  console.log('[Daily Mass Reading Service] 12:00 AM IST scheduler active.');
}

module.exports = {
  fetchAndStoreTamilReading,
  fetchDailyReflection,
  getReadingForDate,
  getOrGenerateEnglishTranslation,
  translateTamilToEnglish,
  batchTranslateTamilToEnglish,
  initMidnightCron,
  getDateKey
};
