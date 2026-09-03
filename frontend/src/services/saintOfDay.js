import api from './api';
import { getSaintForDate } from '../data/catholic_saints_calendar';

/**
 * Centralized fetch service for Saint of the Day (Vatican News + Wikipedia/Wikimedia Fallback + Liturgical Calendar)
 * Supports client-side caching to prevent repeated fetches across components and tabs.
 */
const saintClientCache = new Map();

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

  // Check client memory cache first
  if (saintClientCache.has(dateKey)) {
    return saintClientCache.get(dateKey);
  }

  try {
    const query = dateStr ? `?date=${encodeURIComponent(dateStr)}` : '';
    const res = await api.get(`/saint-of-the-day${query}`);
    if (res.data && res.data.success && (res.data.saintName || res.data.name)) {
      const saintPayload = {
        date: res.data.date || dateKey,
        day: res.data.day || dayNum,
        month: res.data.month || targetDate.toLocaleDateString('en-US', { month: 'long' }),
        monthTa: res.data.monthTa || targetDate.toLocaleDateString('ta-IN', { month: 'long' }),
        year: res.data.year || yearNum,
        dayOfWeek: res.data.dayOfWeek || targetDate.toLocaleDateString('en-US', { weekday: 'long' }),
        dayOfWeekTa: res.data.dayOfWeekTa || targetDate.toLocaleDateString('ta-IN', { weekday: 'long' }),
        saintName: res.data.saintName || res.data.name || fallbackSaint.name,
        englishName: res.data.englishName || res.data.saintName || res.data.name || fallbackSaint.name,
        tamilName: res.data.tamilName || res.data.nameTa || fallbackSaint.nameTa,
        description: res.data.description || fallbackSaint.description,
        descriptionTa: res.data.descriptionTa || fallbackSaint.descriptionTa,
        image: res.data.image || fallbackSaint.image,
        imageSource: res.data.imageSource || (res.data.imageFallback ? 'fallback' : 'vatican'),
        imageSourceUrl: res.data.imageSourceUrl || res.data.sourceUrl || res.data.link,
        imageFallback: typeof res.data.imageFallback === 'boolean' ? res.data.imageFallback : false,
        feastDay: res.data.feastDay || fallbackSaint.feastDay || `${targetDate.toLocaleDateString('en-US', { month: 'long' })} ${dayNum}`,
        source: res.data.source || "Vatican News / Catholic Liturgical Calendar",
        sourceUrl: res.data.sourceUrl || `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`,
        link: res.data.link || res.data.sourceUrl || `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`
      };

      saintClientCache.set(dateKey, saintPayload);
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
    source: "Vatican News / Catholic Liturgical Calendar",
    sourceUrl: `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`,
    link: fallbackSaint.link || `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`
  };

  saintClientCache.set(dateKey, fallbackPayload);
  return fallbackPayload;
}
