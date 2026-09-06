const express = require('express');
const router = express.Router();
const {
  getTodayContent,
  getContentByDate,
  triggerSyncNow,
  getStatus
} = require('../controllers/dailyContentController');
const { protect, adminOnly } = require('../middleware/auth');

// Public endpoints for Church Website
router.get('/today', getTodayContent);
router.get('/', getContentByDate);
router.get('/monitor-status', getStatus);

// Protected endpoint to force immediate re-sync from original Catholic sources
router.post('/sync-now', protect, adminOnly, triggerSyncNow);

module.exports = router;
