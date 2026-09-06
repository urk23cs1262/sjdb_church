/**
 * Daily Catholic Content Controller
 * Serves canonical daily Catholic content for the church website and applications.
 */

const DailyCatholicContent = require('../models/DailyCatholicContent');
const { getTodayDailyContent } = require('../services/dailyContentService');
const { checkAndSyncDailyContent, getMonitoringStatus } = require('../services/contentMonitoringService');
const { getDateKey } = require('../services/dailyMassReadingService');

/**
 * Get canonical daily content for today
 */
const getTodayContent = async (req, res) => {
  try {
    const todayKey = getDateKey(new Date());
    let doc = await DailyCatholicContent.findOne({ date: todayKey }).lean();

    if (!doc || !doc.syncStatus?.massReadings) {
      doc = await checkAndSyncDailyContent(new Date());
    }

    res.json({
      success: true,
      date: todayKey,
      data: doc
    });
  } catch (err) {
    console.error('[DailyContentController] Error getting today content:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get canonical content for a specific date (YYYY-MM-DD)
 */
const getContentByDate = async (req, res) => {
  try {
    const targetDate = req.query.date || getDateKey(new Date());
    let doc = await DailyCatholicContent.findOne({ date: targetDate }).lean();

    if (!doc) {
      doc = await checkAndSyncDailyContent(targetDate);
    }

    res.json({
      success: true,
      date: targetDate,
      data: doc
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Manually trigger immediate source sync (Admin / Scheduler)
 */
const triggerSyncNow = async (req, res) => {
  try {
    const targetDate = req.body?.date || getDateKey(new Date());
    const force = req.body?.force === true;

    console.log(`[DailyContentController] Immediate sync triggered for ${targetDate} (force: ${force})`);
    const doc = await checkAndSyncDailyContent(targetDate, force);

    res.json({
      success: true,
      message: `Daily Catholic content successfully synchronized from original sources for ${targetDate}.`,
      data: doc
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get monitoring status
 */
const getStatus = async (req, res) => {
  try {
    const status = getMonitoringStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getTodayContent,
  getContentByDate,
  triggerSyncNow,
  getStatus
};
