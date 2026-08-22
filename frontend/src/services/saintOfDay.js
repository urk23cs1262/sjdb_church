import api from './api';
import { getSaintForDate } from '../data/catholic_saints_calendar';

/**
 * Centralized fetch service for Saint of the Day (Vatican News + Liturgical Calendar)
 */
export async function fetchSaintOfTheDay() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const fallbackSaint = getSaintForDate(today);

  try {
    const res = await api.get('/saint-of-the-day');
    if (res.data && res.data.success && (res.data.saintName || res.data.name)) {
      return {
        date: res.data.date || `${today.getFullYear()}-${month}-${day}`,
        saintName: res.data.saintName || res.data.name || fallbackSaint.name,
        englishName: res.data.englishName || res.data.saintName || res.data.name || fallbackSaint.name,
        tamilName: res.data.tamilName || res.data.nameTa || fallbackSaint.nameTa,
        description: res.data.description || fallbackSaint.description,
        descriptionTa: res.data.descriptionTa || fallbackSaint.descriptionTa,
        image: res.data.image || fallbackSaint.image,
        imageSource: res.data.imageSource || (res.data.imageFallback ? 'fallback' : 'vatican'),
        imageSourceUrl: res.data.imageSourceUrl || res.data.sourceUrl || res.data.link,
        imageFallback: typeof res.data.imageFallback === 'boolean' ? res.data.imageFallback : false,
        feastDay: res.data.feastDay || fallbackSaint.feastDay,
        source: res.data.source || "Vatican News",
        sourceUrl: res.data.sourceUrl || `https://www.vaticannews.va/en/saints/${month}/${day}.html`,
        link: res.data.link || res.data.sourceUrl || `https://www.vaticannews.va/en/saints/${month}/${day}.html`
      };
    }
  } catch (err) {
    console.warn('Could not fetch Saint of the Day from server, using local Catholic Liturgical Calendar:', err.message);
  }

  // Instant offline / network-error safe fallback
  return {
    date: `${today.getFullYear()}-${month}-${day}`,
    saintName: fallbackSaint.name,
    englishName: fallbackSaint.name,
    tamilName: fallbackSaint.nameTa,
    description: fallbackSaint.description,
    descriptionTa: fallbackSaint.descriptionTa,
    image: fallbackSaint.image,
    imageSource: "liturgical_calendar",
    imageSourceUrl: fallbackSaint.link || `https://www.vaticannews.va/en/saints/${month}/${day}.html`,
    imageFallback: true,
    feastDay: fallbackSaint.feastDay,
    source: "Vatican News / Catholic Liturgical Calendar",
    sourceUrl: `https://www.vaticannews.va/en/saints/${month}/${day}.html`,
    link: fallbackSaint.link || `https://www.vaticannews.va/en/saints/${month}/${day}.html`
  };
}
