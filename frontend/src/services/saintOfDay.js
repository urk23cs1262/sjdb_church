import api, { getMediaUrl, getFileUrl } from './api';
import { getSaintForDate } from '../data/catholic_saints_calendar';

/**
 * Centralized fetch service for Saint of the Day (Vatican News + Wikipedia/Wikimedia Fallback + Liturgical Calendar)
 * Supports client-side caching to prevent repeated fetches across components and tabs.
 */
const saintClientCache = new Map();


export function cleanSaintName(name) {
  if (!name) return 'Saint of the Day';
  return name
    .replace(/\s*[-–—|]\s*Saint of the Day.*$/i, '')
    .replace(/\s*[-–—|]\s*Vatican News.*$/i, '')
    .replace(/\s+\d{4}\s*$/g, '')
    .trim();
}

export function cleanBioParagraphs(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/\n+/)
    .map(t => t.trim())
    .filter(t => {
      if (!t || t.length < 5) return false;
      if (/^https?:\/\//i.test(t)) return false;
      if (/http:\/\/|https:\/\//i.test(t)) return false;
      if (/^(angelus address|regina coeli address|general audience|message of pope|letter to the superior)/i.test(t)) return false;
      return true;
    });
}

export function formatFiveLines(text) {
  if (!text) return '';
  const clean = cleanBioParagraphs(text);
  return clean.length > 0 ? clean.join('\n\n') : text.trim();
}

export function formatSaintSummary(text, maxChars = 380) {
  if (!text) return '';
  const clean = cleanBioParagraphs(text);
  if (clean.length === 0) return '';
  const fullText = clean.join(' ').replace(/\s+/g, ' ').trim();
  if (fullText.length <= maxChars) return fullText;

  // Split into sentences cleanly
  const sentenceRegex = /[^.!?]+[.!?]+(\s|$)/g;
  const sentences = fullText.match(sentenceRegex) || [fullText];
  let result = '';
  for (const s of sentences) {
    if ((result + s).length <= maxChars || result.length === 0) {
      result += s;
    } else {
      break;
    }
  }
  return result.trim() || (fullText.slice(0, maxChars) + '...');
}

export async function fetchSaintOfTheDay(dateStr) {
  let targetDate = new Date();
  if (dateStr) {
    const parts = String(dateStr).split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }

  const monthNum = String(targetDate.getMonth() + 1).padStart(2, "0");
  const dayNum = String(targetDate.getDate()).padStart(2, "0");
  const yearNum = targetDate.getFullYear();
  const dateKey = `${yearNum}-${monthNum}-${dayNum}`;
  const fallbackSaint = getSaintForDate(targetDate);

  // Check client memory cache first (only valid for 60 seconds)
  if (saintClientCache.has(dateKey)) {
    const entry = saintClientCache.get(dateKey);
    if (entry && entry._cachedAt && (Date.now() - entry._cachedAt < 60000)) {
      return entry.data;
    }
  }

  try {
    const query = dateStr ? `?date=${encodeURIComponent(dateStr)}` : '';
    const res = await api.get(`/saint-of-the-day${query}`);
    if (res.data && res.data.success && (res.data.saintName || res.data.name)) {
      let rawSaintName = res.data.saintName || res.data.name || fallbackSaint.name;
      let rawEngName = res.data.englishName || res.data.saintName || res.data.name || fallbackSaint.name;
      let rawDesc = formatFiveLines(res.data.description || fallbackSaint.description);
      let rawDescTa = formatFiveLines(res.data.descriptionTa || fallbackSaint.descriptionTa);
      let rawImg = res.data.image || fallbackSaint.image;
      let rawSource = res.data.source || "Vatican News";
      let rawSourceUrl = res.data.sourceUrl || `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`;

      // Completely reject any Catholic Readings links or images
      const isStaleCatholicReadings = (rawSource && rawSource.includes('Catholic Readings')) ||
        (rawSourceUrl && rawSourceUrl.includes('catholicreadings.org')) ||
        (rawImg && rawImg.includes('catholicreadings.org'));

      if (isStaleCatholicReadings) {
        rawSource = "Vatican News";
        rawSourceUrl = `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`;
        rawImg = null;
      }

      if (rawImg && rawImg.startsWith('/uploads')) {
        rawImg = getFileUrl(rawImg);
      }

      const rawSaints = res.data.saints || res.data.allSaints || [];
      const normalizedSaints = rawSaints.map(s => ({
        ...s,
        description: formatFiveLines(s.description || ''),
        descriptionTa: formatFiveLines(s.descriptionTa || ''),
        image: s.image && s.image.startsWith('/uploads') ? getFileUrl(s.image) : s.image
      }));

      const rawPrimary = res.data.primaryCelebration || res.data.primarySaint || null;
      const normalizedPrimary = rawPrimary ? {
        ...rawPrimary,
        name: cleanSaintName(rawPrimary.name || rawPrimary.englishName),
        englishName: cleanSaintName(rawPrimary.englishName || rawPrimary.name),
        description: formatFiveLines(rawPrimary.description || rawDesc),
        descriptionTa: formatFiveLines(rawPrimary.descriptionTa || rawDescTa),
        image: rawPrimary.image && rawPrimary.image.startsWith('/uploads') ? getFileUrl(rawPrimary.image) : rawPrimary.image,
        sourceUrl: rawPrimary.sourceUrl || rawSourceUrl,
        detailUrl: rawPrimary.detailUrl || rawPrimary.sourceUrl || rawSourceUrl
      } : {
        name: cleanSaintName(rawSaintName),
        englishName: cleanSaintName(rawEngName),
        tamilName: res.data.tamilName || rawSaintName,
        title: res.data.feastTitle || rawSaintName,
        celebrationType: res.data.celebrationType || res.data.feastType || 'Feast',
        feastName: cleanSaintName(rawSaintName),
        description: rawDesc,
        descriptionTa: rawDescTa,
        image: rawImg,
        source: rawSource,
        sourceUrl: rawSourceUrl,
        detailUrl: rawSourceUrl
      };

      const rawOtherSaints = res.data.otherSaints || [];
      const normalizedOtherSaints = rawOtherSaints.map(s => ({
        ...s,
        name: cleanSaintName(s.name || s.englishName),
        englishName: cleanSaintName(s.englishName || s.name),
        description: formatFiveLines(s.description || ''),
        descriptionTa: formatFiveLines(s.descriptionTa || ''),
        image: s.image && s.image.startsWith('/uploads') ? getFileUrl(s.image) : s.image,
        sourceUrl: s.sourceUrl || rawSourceUrl,
        detailUrl: s.detailUrl || s.sourceUrl || rawSourceUrl
      }));

      const resolvedPrimaryUrl = res.data.primaryCelebration?.sourceUrl || normalizedPrimary.sourceUrl || rawSourceUrl;

      const saintPayload = {
        date: res.data.date || dateKey,
        day: res.data.day || dayNum,
        month: res.data.month || targetDate.toLocaleDateString('en-US', { month: 'long' }),
        monthTa: res.data.monthTa || targetDate.toLocaleDateString('ta-IN', { month: 'long' }),
        year: res.data.year || yearNum,
        dayOfWeek: res.data.dayOfWeek || targetDate.toLocaleDateString('en-US', { weekday: 'long' }),
        dayOfWeekTa: res.data.dayOfWeekTa || targetDate.toLocaleDateString('ta-IN', { weekday: 'long' }),
        saintName: cleanSaintName(rawSaintName),
        englishName: cleanSaintName(rawEngName),
        tamilName: res.data.tamilName || res.data.nameTa || rawSaintName,
        description: rawDesc,
        descriptionTa: rawDescTa,
        image: rawImg,
        imageSource: res.data.imageSource || (res.data.imageFallback ? 'fallback' : 'vatican'),
        imageSourceUrl: resolvedPrimaryUrl,
        imageFallback: typeof res.data.imageFallback === 'boolean' ? res.data.imageFallback : false,
        feastDay: res.data.feastDay || fallbackSaint.feastDay || `${targetDate.toLocaleDateString('en-US', { month: 'long' })} ${dayNum}`,
        feastTitle: res.data.feastTitle || fallbackSaint.feastTitle || null,
        feastTitleTa: res.data.feastTitleTa || fallbackSaint.feastTitleTa || null,
        feastType: res.data.feastType || fallbackSaint.feastType || null,
        feastTypeTa: res.data.feastTypeTa || fallbackSaint.feastTypeTa || null,
        celebrationType: res.data.celebrationType || res.data.feastType || normalizedPrimary?.celebrationType || null,
        celebrationTypeTa: res.data.celebrationTypeTa || res.data.feastTypeTa || null,
        primaryCelebration: res.data.primaryCelebration || normalizedPrimary,
        primarySaint: normalizedPrimary,
        otherSaints: normalizedOtherSaints,
        hasFeastInfo: Boolean(res.data.hasFeastInfo || fallbackSaint.hasFeastInfo),
        source: rawSource,
        sourceUrl: resolvedPrimaryUrl,
        link: resolvedPrimaryUrl,
        saints: normalizedSaints.length > 0 ? normalizedSaints : [
          {
            name: rawSaintName,
            englishName: rawEngName,
            tamilName: res.data.tamilName || res.data.nameTa || rawSaintName,
            description: rawDesc,
            descriptionTa: rawDescTa,
            image: rawImg,
            sourceUrl: resolvedPrimaryUrl
          }
        ],
        allSaints: normalizedSaints.length > 0 ? normalizedSaints : [
          {
            name: rawSaintName,
            englishName: rawEngName,
            tamilName: res.data.tamilName || res.data.nameTa || rawSaintName,
            description: rawDesc,
            descriptionTa: rawDescTa,
            image: rawImg,
            sourceUrl: resolvedPrimaryUrl
          }
        ]
      };

      saintClientCache.set(dateKey, { data: saintPayload, _cachedAt: Date.now() });
      return saintPayload;
    }
  } catch (err) {
    console.warn('Could not fetch Saint of the Day from server, using local Catholic Liturgical Calendar:', err.message);
  }

  // Instant offline / network-error safe fallback
  const fallbackPayload = {
    date: dateKey,
    day: dayNum,
    month: targetDate.toLocaleDateString('en-US', { month: 'long' }),
    monthTa: targetDate.toLocaleDateString('ta-IN', { month: 'long' }),
    year: yearNum,
    dayOfWeek: targetDate.toLocaleDateString('en-US', { weekday: 'long' }),
    dayOfWeekTa: targetDate.toLocaleDateString('ta-IN', { weekday: 'long' }),
    saintName: fallbackSaint.name,
    englishName: fallbackSaint.name,
    tamilName: fallbackSaint.nameTa,
    description: fallbackSaint.description,
    descriptionTa: fallbackSaint.descriptionTa,
    image: fallbackSaint.image,
    imageSource: "liturgical_calendar",
    imageSourceUrl: fallbackSaint.link || `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`,
    imageFallback: true,
    feastDay: fallbackSaint.feastDay || `${targetDate.toLocaleDateString('en-US', { month: 'long' })} ${dayNum}`,
    feastTitle: fallbackSaint.feastTitle || null,
    feastTitleTa: fallbackSaint.feastTitleTa || null,
    feastType: fallbackSaint.feastType || null,
    feastTypeTa: fallbackSaint.feastTypeTa || null,
    celebrationType: fallbackSaint.feastType || 'Memorial',
    celebrationTypeTa: fallbackSaint.feastTypeTa || 'நினைவுநாள்',
    primarySaint: {
      name: fallbackSaint.name,
      englishName: fallbackSaint.name,
      tamilName: fallbackSaint.nameTa,
      title: fallbackSaint.feastTitle || fallbackSaint.name,
      celebrationType: fallbackSaint.feastType || 'Memorial',
      feastName: fallbackSaint.name,
      description: fallbackSaint.description,
      descriptionTa: fallbackSaint.descriptionTa,
      image: fallbackSaint.image,
      source: "Vatican News / Catholic Liturgical Calendar",
      sourceUrl: `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`
    },
    otherSaints: [],
    hasFeastInfo: Boolean(fallbackSaint.hasFeastInfo),
    source: "Vatican News / Catholic Liturgical Calendar",
    sourceUrl: `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`,
    link: fallbackSaint.link || `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`
  };

  saintClientCache.set(dateKey, fallbackPayload);
  return fallbackPayload;
}

export async function searchSaintImage(saintName, date = null) {
  if (!saintName) return null;
  try {
    const dateParam = date ? `&date=${encodeURIComponent(date)}` : '';
    const res = await api.get(`/saint-of-the-day/image-search?name=${encodeURIComponent(saintName)}${dateParam}`);
    if (res.data && res.data.success && res.data.image) {
      return res.data;
    }
  } catch (err) {
    console.warn('Failed to search saint image online:', err.message);
  }
  return null;
}