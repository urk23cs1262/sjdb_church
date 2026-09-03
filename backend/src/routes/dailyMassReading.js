const express = require('express');
const router = express.Router();
const { 
  getReadingForDate, 
  fetchAndStoreTamilReading, 
  getOrGenerateEnglishTranslation, 
  getDateKey 
} = require('../services/dailyMassReadingService');
const { protect, adminOnly } = require('../middleware/auth');

// @GET /api/mass-readings/today
router.get('/today', async (req, res) => {
  try {
    const today = getDateKey(new Date());
    const lang = req.query.lang || 'ta';
    
    if (lang === 'en') {
      const translated = await getOrGenerateEnglishTranslation(today);
      return res.json({ success: true, date: today, data: translated, isTranslated: true });
    }

    const reading = await getReadingForDate(today);
    if (!reading) {
      return res.status(404).json({ success: false, message: 'Mass reading not found for today' });
    }
    res.json({ success: true, date: today, data: reading, isTranslated: false });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/mass-readings?date=YYYY-MM-DD&lang=ta|en
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/mass-readings/refresh-today (Admin manual trigger)
router.post('/refresh-today', protect, adminOnly, async (req, res) => {
  try {
    const targetDate = req.body.date || getDateKey(new Date());
    const doc = await fetchAndStoreTamilReading(targetDate);
    res.json({ success: true, message: `Successfully refreshed Mass reading for ${targetDate}`, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
