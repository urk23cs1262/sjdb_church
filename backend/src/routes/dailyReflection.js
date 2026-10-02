const express = require('express');
const router = express.Router();
const { getTodayReflection, syncDailyTamilReflection, getIndiaDate } = require('../services/dailyReflectionService');

/**
 * GET /api/daily-reflection
 * Optional query parameter: ?date=YYYY-MM-DD
 * Returns today's active reflection in Asia/Kolkata or specific date
 */
router.get('/', async (req, res) => {
  try {
    const requestedDate = req.query.date ? getIndiaDate(req.query.date) : getIndiaDate(new Date());
    const doc = await getTodayReflection(requestedDate);

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: `Daily reflection for ${requestedDate} is not available.`
      });
    }

    return res.json({
      success: true,
      date: doc.date,
      source: doc.source || 'Tamil Catholic Daily',
      sourceUrl: doc.sourceUrl,
      reflection: {
        heading: doc.heading || 'இன்றைய சிந்தனை',
        title: doc.title,
        scriptureQuote: doc.scriptureQuote,
        text: doc.reflection,
        paragraphs: doc.paragraphs || [],
        prayer: doc.prayer || null
      }
    });
  } catch (err) {
    console.error('[API /api/daily-reflection] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve daily reflection',
      error: err.message
    });
  }
});

/**
 * POST /api/daily-reflection/sync
 * Admin or internal trigger to force refresh/sync for a date
 */
router.post('/sync', async (req, res) => {
  try {
    const targetDate = req.body.date ? getIndiaDate(req.body.date) : getIndiaDate(new Date());
    const doc = await syncDailyTamilReflection(targetDate);
    if (!doc) {
      return res.status(500).json({
        success: false,
        message: `Sync failed for ${targetDate}`
      });
    }
    return res.json({
      success: true,
      message: `Successfully synchronized daily reflection for ${targetDate}`,
      data: doc
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;
