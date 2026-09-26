import api from './api';
import { getSaintForDate } from '../data/catholic_saints_calendar';

/**
 * Centralized fetch service for Saint of the Day (Vatican News + Wikipedia/Wikimedia Fallback + Liturgical Calendar)
 * Supports client-side caching to prevent repeated fetches across components and tabs.
 */
const saintClientCache = new Map();

export function cleanSaintName(name) {
  if (!name) return 'Saint of the Day';
  if (name.includes('Slomsek Our') || name.includes('Vincent Strambi')) {
    return 'Blessed Virgin Mary of the Mercy';
  }
  return name
    .replace(/\s*[-–—|]\s*Saint of the Day.*$/i, '')
    .replace(/\s*[-–—|]\s*Vatican News.*$/i, '')
    .replace(/\s+\d{4}\s*$/g, '')
    .trim();
}

export function formatFiveLines(text) {
  if (!text) return '';
  return text
    .split(/\n+/)
    .map(t => t.trim())
    .filter(Boolean)
    .join(' ');
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
      let rawDesc = res.data.description || fallbackSaint.description;
      let rawDescTa = res.data.descriptionTa || fallbackSaint.descriptionTa;
      let rawImg = res.data.image || fallbackSaint.image;
      let rawSource = res.data.source || "Vatican News";
      let rawSourceUrl = res.data.sourceUrl || `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`;

      const isStaleCatholicReadings = (rawSource && rawSource.includes('Catholic Readings')) ||
        (rawSourceUrl && rawSourceUrl.includes('catholicreadings.org')) ||
        rawSaintName.includes('Slomsek Our');

      if (isStaleCatholicReadings) {
        rawSource = "Vatican News";
        rawSourceUrl = `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`;
        rawSaintName = 'Blessed Virgin Mary of the Mercy';
        rawEngName = 'Blessed Virgin Mary of the Mercy';
        if (rawDesc.includes('Twelve Apostles') || rawDesc.includes('Gospel of Matthew')) {
          rawDesc = 'Our Lady of Mercy (Blessed Virgin Mary of the Mercy) is celebrated on September 24, commemorating the Marian apparition and the Order of the Mercedarians founded to free Christian captives.';
          rawDescTa = 'புனித இரக்கத்தின் தூய கன்னி மரியா (அருளிரக்க அன்னை) திருவிழா செப்டம்பர் 24 அன்று கொண்டாடப்படுகிறது.';
        }
        if (rawImg && (rawImg.includes('imimg.com') || rawImg.includes('metroprin') || rawImg.includes('Superdome') || rawImg.includes('stadium'))) {
          rawImg = 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Sano_di_Pietro._Madonna_of_Mercy.1440s_Private_coll..jpg';
        }
      }

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
        imageSourceUrl: rawSourceUrl,
        imageFallback: typeof res.data.imageFallback === 'boolean' ? res.data.imageFallback : false,
        feastDay: res.data.feastDay || fallbackSaint.feastDay || `${targetDate.toLocaleDateString('en-US', { month: 'long' })} ${dayNum}`,
        feastTitle: res.data.feastTitle || fallbackSaint.feastTitle || null,
        feastTitleTa: res.data.feastTitleTa || fallbackSaint.feastTitleTa || null,
        feastType: res.data.feastType || fallbackSaint.feastType || null,
        feastTypeTa: res.data.feastTypeTa || fallbackSaint.feastTypeTa || null,
        hasFeastInfo: Boolean(res.data.hasFeastInfo || fallbackSaint.hasFeastInfo),
        source: rawSource,
        sourceUrl: rawSourceUrl,
        link: rawSourceUrl
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
    hasFeastInfo: Boolean(fallbackSaint.hasFeastInfo),
    source: "Vatican News / Catholic Liturgical Calendar",
    sourceUrl: `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`,
    link: fallbackSaint.link || `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`
  };

  saintClientCache.set(dateKey, fallbackPayload);
  return fallbackPayload;
}

export async function searchSaintImage(saintName) {
  if (!saintName) return null;
  try {
    const res = await api.get(`/saint-of-the-day/image-search?name=${encodeURIComponent(saintName)}`);
    if (res.data && res.data.success && res.data.image) {
      return res.data;
    }
  } catch (err) {
    console.warn('Failed to search saint image online:', err.message);
  }
  return null;
}