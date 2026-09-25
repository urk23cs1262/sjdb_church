const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// In-memory cache for fast lookup during mass broadcasts and interactive requests
const verseImageMemoryCache = new Map();

// Local cache directory
const CACHE_DIR = path.join(__dirname, '../../uploads/cache');
if (!fs.existsSync(CACHE_DIR)) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch (err) {
    console.warn('[BibleVerseImageService] Could not create cache directory:', err.message);
  }
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Word wrap for English and Tamil text
 */
function wrapText(text, maxCharsPerLine = 48) {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Server-side render of Daily Bible Verse Card to HD PNG Buffer
 * 1. Badge contains: DAILY BIBLE VERSE • date_month_year • day • Category (No date at bottom)
 * 2. Tamil chapter reference under Tamil Bible verses
 * 3. English chapter reference under English Bible verses
 * 4. High-Definition 1200x1200px vector graphics with crisp typography
 */
async function renderBibleVerseCard({ verseEn, verseTa, ref, dateKey, dateStr, category }) {
  const width = 1200;

  // Clean quotation marks if already supplied
  const cleanEn = (verseEn || '').replace(/^["'“”]+|["'“”]+$/g, '').trim();
  const cleanTa = (verseTa || '').replace(/^["'“”]+|["'“”]+$/g, '').trim();

  // Resolve chapter/verse in both Tamil and English
  const { getTamilBibleReference, getEnglishBibleReference } = require('../utils/bibleRefHelper');
  const refTa = getTamilBibleReference(ref);
  const refEn = getEnglishBibleReference(ref);

  // Dynamic font sizing & line length based on length
  const totalChars = cleanEn.length + cleanTa.length;
  let maxChars = 44;
  let taFontSize = 32;
  let enFontSize = 24;
  let lineHeightTa = 52;
  let lineHeightEn = 40;

  if (totalChars > 340) {
    maxChars = 52;
    taFontSize = 26;
    enFontSize = 20;
    lineHeightTa = 42;
    lineHeightEn = 32;
  } else if (totalChars > 200) {
    maxChars = 48;
    taFontSize = 29;
    enFontSize = 22;
    lineHeightTa = 46;
    lineHeightEn = 36;
  }

  const taLines = wrapText(`"${cleanTa}"`, maxChars);
  const enLines = wrapText(`"${cleanEn}"`, maxChars + 6);

  // Compute text block heights
  const taBlockHeight = taLines.length * lineHeightTa;
  const taRefHeight = 36;
  const dividerGap = 42;
  const enBlockHeight = enLines.length * lineHeightEn;
  const enRefHeight = 36;

  const totalContentHeight = taBlockHeight + 14 + taRefHeight + dividerGap + enBlockHeight + 14 + enRefHeight;

  // Outer bounds
  const headerHeight = 230;
  const footerHeight = 100;
  const minHeight = 1200;
  const neededHeight = headerHeight + totalContentHeight + footerHeight + 50;
  const height = Math.max(minHeight, neededHeight);

  // Card bounds
  const cardTop = 230;
  const cardBottom = height - 90;
  const cardHeight = cardBottom - cardTop;

  // Vertically center content inside the card
  const availablePadding = Math.max(36, (cardHeight - totalContentHeight) / 2);
  const taStartY = cardTop + availablePadding + (lineHeightTa * 0.7);
  const taRefY = taStartY + (taLines.length - 1) * lineHeightTa + 32;
  const dividerY = taRefY + 36;
  const enStartY = dividerY + 40 + (lineHeightEn * 0.7);
  const enRefY = enStartY + (enLines.length - 1) * lineHeightEn + 32;
  const footerY = height - 48;

  // Titles
  const churchTitleTa = "புனித ஜான் டி பிரிட்டோ திருத்தலம்";
  const churchTitleEn = "ST. JOHN DE BRITTO CHURCH, KALAYARKOIL";

  // Date and Badge: DAILY BIBLE VERSE • date_month_year • day • Category
  let formattedDate = '';
  let dayName = '';
  if (dateKey) {
    try {
      const [y, m, d] = dateKey.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      formattedDate = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      dayName = dt.toLocaleDateString('en-US', { weekday: 'long' });
    } catch (_) {}
  }
  if (!formattedDate) {
    formattedDate = dateStr || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
    try {
      dayName = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
    } catch (_) {}
  }
  const catText = (category || 'Hope').trim();
  const badgeTitle = `DAILY BIBLE VERSE • ${formattedDate} • ${dayName} • ${catText}`;

  // Build SVG tspans
  let taTspans = '';
  taLines.forEach((line, idx) => {
    taTspans += `<tspan x="600" dy="${idx === 0 ? 0 : lineHeightTa}">${escapeXml(line)}</tspan>`;
  });

  let enTspans = '';
  enLines.forEach((line, idx) => {
    enTspans += `<tspan x="600" dy="${idx === 0 ? 0 : lineHeightEn}">${escapeXml(line)}</tspan>`;
  });

  const svg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" text-rendering="geometricPrecision" shape-rendering="geometricPrecision">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#051329" />
        <stop offset="50%" stop-color="#0b1f48" />
        <stop offset="100%" stop-color="#06152e" />
      </linearGradient>

      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#c59b27" />
        <stop offset="30%" stop-color="#f5d77f" />
        <stop offset="70%" stop-color="#ffd700" />
        <stop offset="100%" stop-color="#d4af37" />
      </linearGradient>

      <linearGradient id="goldBorder" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#f5d77f" />
        <stop offset="50%" stop-color="#c59b27" />
        <stop offset="100%" stop-color="#e5c158" />
      </linearGradient>

      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000" flood-opacity="0.55"/>
      </filter>
    </defs>

    <!-- Background -->
    <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

    <!-- Outer Decorative Border -->
    <rect x="32" y="32" width="${width - 64}" height="${height - 64}" rx="26" fill="none" stroke="url(#goldBorder)" stroke-width="2.5" opacity="0.9" />
    <rect x="44" y="44" width="${width - 88}" height="${height - 88}" rx="20" fill="none" stroke="#d4af37" stroke-width="1.2" stroke-dasharray="8 6" opacity="0.45" />

    <!-- Corner Cross Ornaments -->
    <!-- Top Left -->
    <g transform="translate(68, 68)">
      <rect x="-2.5" y="-16" width="5" height="32" rx="2.5" fill="#f3d179"/>
      <rect x="-11" y="-7" width="22" height="5" rx="2.5" fill="#f3d179"/>
    </g>
    <!-- Top Right -->
    <g transform="translate(${width - 68}, 68)">
      <rect x="-2.5" y="-16" width="5" height="32" rx="2.5" fill="#f3d179"/>
      <rect x="-11" y="-7" width="22" height="5" rx="2.5" fill="#f3d179"/>
    </g>
    <!-- Bottom Left -->
    <g transform="translate(68, ${height - 68})">
      <rect x="-2.5" y="-16" width="5" height="32" rx="2.5" fill="#f3d179"/>
      <rect x="-11" y="-7" width="22" height="5" rx="2.5" fill="#f3d179"/>
    </g>
    <!-- Bottom Right -->
    <g transform="translate(${width - 68}, ${height - 68})">
      <rect x="-2.5" y="-16" width="5" height="32" rx="2.5" fill="#f3d179"/>
      <rect x="-11" y="-7" width="22" height="5" rx="2.5" fill="#f3d179"/>
    </g>

    <!-- Central Top Cross Motif -->
    <g transform="translate(600, 72)">
      <rect x="-3.5" y="-24" width="7" height="48" rx="3.5" fill="url(#goldGrad)"/>
      <rect x="-18" y="-11" width="36" height="7" rx="3.5" fill="url(#goldGrad)"/>
      <circle cx="0" cy="-8" r="18" fill="none" stroke="#f3d179" stroke-width="1.4" stroke-dasharray="3 3" opacity="0.7"/>
    </g>

    <!-- Church Header -->
    <text x="600" y="132" font-family="'Noto Sans Tamil', 'Latha', 'Tamil Sangam MN', 'Mukta Malar', 'Arial Unicode MS', sans-serif" font-size="30" font-weight="bold" fill="url(#goldGrad)" text-anchor="middle" letter-spacing="1">
      ${escapeXml(churchTitleTa)}
    </text>
    <text x="600" y="164" font-family="'Cinzel', 'Trajan Pro', 'Georgia', serif" font-size="17" font-weight="600" fill="#cbd5e1" text-anchor="middle" letter-spacing="3.5">
      ${escapeXml(churchTitleEn)}
    </text>

    <!-- Badge / Pill (DAILY BIBLE VERSE • date_month_year • day • Category) -->
    <g transform="translate(600, 202)">
      <rect x="-360" y="-16" width="720" height="32" rx="16" fill="#132f6b" stroke="#d4af37" stroke-width="1.5" opacity="0.95" />
      <text x="0" y="5" font-family="sans-serif" font-size="13" font-weight="bold" fill="#fde68a" text-anchor="middle" letter-spacing="1.2">
        ${escapeXml(badgeTitle)}
      </text>
    </g>

    <!-- Inner Card Background with Soft Glow -->
    <rect x="75" y="${cardTop}" width="${width - 150}" height="${cardHeight}" rx="20" fill="#ffffff" fill-opacity="0.04" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1.2" filter="url(#shadow)"/>

    <!-- 1. Tamil Bible Verse -->
    <text x="600" y="${taStartY}" font-family="'Noto Sans Tamil', 'Latha', 'Tamil Sangam MN', 'Mukta Malar', 'Arial Unicode MS', sans-serif" font-size="${taFontSize}" font-weight="bold" fill="#ffffff" text-anchor="middle">
      ${taTspans}
    </text>

    <!-- Tamil Chapter / Verse Reference (Under Tamil Bible Verses) -->
    <text x="600" y="${taRefY}" font-family="'Noto Sans Tamil', 'Latha', 'Tamil Sangam MN', sans-serif" font-size="22" font-weight="bold" fill="url(#goldGrad)" text-anchor="middle" letter-spacing="1">
      — ${escapeXml(refTa)} —
    </text>

    <!-- Decorative Gold Divider -->
    <g transform="translate(600, ${dividerY})">
      <line x1="-180" y1="0" x2="-36" y2="0" stroke="url(#goldGrad)" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>
      <polygon points="0,-8 8,0 0,8 -8,0" fill="url(#goldGrad)"/>
      <circle cx="-16" cy="0" r="3" fill="#ffd700"/>
      <circle cx="16" cy="0" r="3" fill="#ffd700"/>
      <line x1="36" y1="0" x2="180" y2="0" stroke="url(#goldGrad)" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>
    </g>

    <!-- 2. English Bible Verse -->
    <text x="600" y="${enStartY}" font-family="'Georgia', 'Times New Roman', serif" font-style="italic" font-size="${enFontSize}" fill="#dbeafe" text-anchor="middle">
      ${enTspans}
    </text>

    <!-- English Chapter / Verse Reference (Under English Bible Verses) -->
    <text x="600" y="${enRefY}" font-family="'Georgia', 'Times New Roman', serif" font-size="22" font-weight="bold" fill="url(#goldGrad)" text-anchor="middle" letter-spacing="1.5">
      — ${escapeXml(refEn)} —
    </text>

    <!-- Footer Branding (No date and day at bottom) -->
    <line x1="140" y1="${height - 68}" x2="${width - 140}" y2="${height - 68}" stroke="#d4af37" stroke-width="1" opacity="0.3"/>
    <text x="600" y="${footerY}" font-family="sans-serif" font-size="13.5" font-weight="600" fill="#94a3b8" text-anchor="middle" letter-spacing="1.8">
      ST. JOHN DE BRITTO CHURCH • KALAYARKOIL • SJDB CONNECT
    </text>
  </svg>
  `;

  return sharp(Buffer.from(svg))
    .png({ quality: 100, compressionLevel: 6 })
    .toBuffer();
}

const crypto = require('crypto');

/**
 * Invalidate memory and disk cache for verse images (called on admin update or daily rotation)
 */
function invalidateVerseImageCache(dateKey = null) {
  try {
    if (dateKey) {
      for (const key of verseImageMemoryCache.keys()) {
        if (key.startsWith(dateKey)) {
          verseImageMemoryCache.delete(key);
        }
      }
      if (fs.existsSync(CACHE_DIR)) {
        const files = fs.readdirSync(CACHE_DIR);
        for (const f of files) {
          if (f.startsWith(`verse_${dateKey}`)) {
            try {
              fs.unlinkSync(path.join(CACHE_DIR, f));
            } catch (_) {}
          }
        }
      }
    } else {
      verseImageMemoryCache.clear();
      if (fs.existsSync(CACHE_DIR)) {
        const files = fs.readdirSync(CACHE_DIR);
        for (const f of files) {
          if (f.startsWith('verse_')) {
            try {
              fs.unlinkSync(path.join(CACHE_DIR, f));
            } catch (_) {}
          }
        }
      }
    }
  } catch (err) {
    console.warn('[BibleVerseImageService] Cache invalidation warning:', err.message);
  }
}

/**
 * Retrieve cached or newly generated Bible Verse Image Buffer according to the day's Bible verse
 */
async function getDailyVerseImage({ dailyContent = null, dateKey = null } = {}) {
  // Format IST dateKey e.g. "2026-09-25"
  const istFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const dKey = dateKey || dailyContent?.dateKey || istFormatter.format(new Date());

  let content = dailyContent;

  // 1. If dailyContent not provided or missing bible data, load from dailyContentService
  if (!content || !content.bible || (!content.bible.english && !content.bible.tamil)) {
    try {
      const { getTodayDailyContent } = require('./dailyContentService');
      content = await getTodayDailyContent(new Date());
    } catch (dcErr) {
      console.warn('[BibleVerseImageService] Could not load getTodayDailyContent:', dcErr.message);
    }
  }

  // 2. Extract verse properties
  let verseEn = (content?.bible?.english || content?.bible?.verseTextEn || content?.verse?.english || '').trim();
  let verseTa = (content?.bible?.tamil || content?.bible?.verseTextTa || content?.verse?.tamil || '').trim();
  let ref = (content?.bible?.ref || content?.bible?.reference || content?.verse?.reference || '').trim();
  let category = (content?.bible?.category || content?.verse?.category || '').trim();
  let dateStr = content?.formattedDate || '';

  // 3. Fallback directly to the single source of truth for today's verse if any field is missing
  if (!verseEn || !verseTa || !ref) {
    try {
      const { getTodayVerseData } = require('../controllers/dailyVerseController');
      const todayVerse = await getTodayVerseData();
      if (todayVerse) {
        if (!verseEn) verseEn = (todayVerse.english || todayVerse.verseTextEn || '').trim();
        if (!verseTa) verseTa = (todayVerse.tamil || todayVerse.verseTextTa || '').trim();
        if (!ref) ref = (todayVerse.ref || todayVerse.reference || '').trim();
        if (!category) category = (todayVerse.category || '').trim();
      }
    } catch (vErr) {
      console.warn('[BibleVerseImageService] Fallback to getTodayVerseData warning:', vErr.message);
    }
  }

  // Final emergency defaults if database is completely empty
  if (!verseEn && !verseTa) {
    verseEn = 'The Lord is my shepherd; I shall not want.';
    verseTa = 'கர்த்தர் என் மேய்ப்பராயிருக்கிறார்; நான் தாழ்ச்சியடையேன்.';
    ref = 'சங்கீதம் / Psalm 23:1';
  } else if (!verseEn) {
    verseEn = verseTa;
  } else if (!verseTa) {
    verseTa = verseEn;
  }

  if (!ref) ref = 'Holy Scripture';
  if (!category) category = 'Word of God';
  if (!dateStr) {
    dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  }

  // 4. Generate unique hash based on today's dateKey and verse text/ref
  const verseHash = crypto.createHash('md5').update(`${dKey}|${ref}|${verseEn}|${verseTa}`).digest('hex').slice(0, 8);
  const cacheKey = `${dKey}_${verseHash}`;

  // 5. Check in-memory cache
  if (verseImageMemoryCache.has(cacheKey)) {
    return {
      buffer: verseImageMemoryCache.get(cacheKey),
      mimetype: 'image/png'
    };
  }

  // 6. Check disk cache
  const cacheFilePath = path.join(CACHE_DIR, `verse_${cacheKey}.png`);
  if (fs.existsSync(cacheFilePath)) {
    try {
      const diskBuf = fs.readFileSync(cacheFilePath);
      if (diskBuf && diskBuf.length > 5000) {
        verseImageMemoryCache.set(cacheKey, diskBuf);
        return {
          buffer: diskBuf,
          mimetype: 'image/png'
        };
      }
    } catch (e) {
      console.warn(`[BibleVerseImageService] Failed reading disk cache for ${cacheKey}:`, e.message);
    }
  }

  // 7. Render fresh image matching the exact day's Bible verse
  try {
    const buffer = await renderBibleVerseCard({
      verseEn,
      verseTa,
      ref,
      dateKey: dKey,
      dateStr,
      category
    });

    if (buffer && buffer.length > 0) {
      // Save to memory cache
      verseImageMemoryCache.set(cacheKey, buffer);

      // Save to disk cache
      try {
        fs.writeFileSync(cacheFilePath, buffer);
        // Also update standard verse_${dKey}.png alias
        const aliasPath = path.join(CACHE_DIR, `verse_${dKey}.png`);
        fs.writeFileSync(aliasPath, buffer);
      } catch (writeErr) {
        console.warn(`[BibleVerseImageService] Failed saving disk cache for ${cacheKey}:`, writeErr.message);
      }

      return {
        buffer,
        mimetype: 'image/png'
      };
    }
  } catch (renderErr) {
    console.error(`[BibleVerseImageService] Error rendering verse image for ${cacheKey}:`, renderErr.message);
  }

  return null;
}

module.exports = {
  renderBibleVerseCard,
  getDailyVerseImage,
  invalidateVerseImageCache
};

