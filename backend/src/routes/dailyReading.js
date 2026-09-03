const express = require('express');
const router = express.Router();
const { 
  getReadingForDate, 
  getOrGenerateEnglishTranslation, 
  getDateKey 
} = require('../services/dailyMassReadingService');

// @GET /api/daily-reading?date=YYYY-MM-DD&lang=ta|en
router.get('/', async (req, res) => {
  try {
    const targetDate = req.query.date || getDateKey(new Date());
    const lang = req.query.lang || 'ta';

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
    console.error('[dailyReading Route] Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch Catholic daily readings', error: err.message });
  }
});

module.exports = router;