const express = require('express');
const router = express.Router();
const { 
  getReadingForDate, 
  fetchAndStoreTamilReading, 
  getOrGenerateEnglishTranslation, 
  getDateKey 
} = require('../services/dailyMassReadingService');

// GET /api/mass-reading/sync?date=YYYY-MM-DD
router.get('/sync', async (req, res) => {
  try {
    const targetDate = req.query.date || getDateKey(new Date());
    console.log(`[massReading Route] On-demand sync requested for ${targetDate}`);
    const doc = await fetchAndStoreTamilReading(targetDate);
    res.json({ success: true, message: `Successfully fetched and stored reading for ${targetDate}`, date: targetDate, data: doc });
  } catch (err) {
    console.error(`[massReading Route] On-demand sync error for ${req.query.date}:`, err.message);
    res.status(500).json({ success: false, message: `Sync failed for ${req.query.date || 'today'}: ${err.message}`, error: err.message });
  }
});

// GET /api/mass-reading?date=YYYY-MM-DD&lang=ta|en&refresh=true
router.get('/', async (req, res) => {
  try {
    const targetDate = req.query.date || getDateKey(new Date());
    const lang = req.query.lang || 'ta';
    const forceRefresh = req.query.refresh === 'true';

    if (forceRefresh && lang === 'ta') {
      try {
        console.log(`[massReading Route] Force-refreshing ${targetDate}...`);
        await fetchAndStoreTamilReading(targetDate);
      } catch (fErr) {
        console.warn(`[massReading Route] Force-refresh fetch failed (${fErr.message}), falling back to cache.`);
      }
    }

    if (lang === 'en') {
      const translated = await getOrGenerateEnglishTranslation(targetDate);
      return res.json({ success: true, date: targetDate, data: translated, isTranslated: true });
    }

    const reading = await getReadingForDate(targetDate);
    if (!reading) {
      return res.status(404).json({ success: false, message: `Mass reading not found for ${targetDate}` });
    }
    res.json({ success: true, date: targetDate, data: reading, isTranslated: false });
  } catch (err) {
    console.error('[massReading Route] Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch Catholic daily readings', error: err.message });
  }
});

module.exports = router;
