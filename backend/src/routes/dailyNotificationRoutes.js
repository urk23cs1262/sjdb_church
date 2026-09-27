const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  getStatus,
  sendTestEmail,
  triggerBroadcast,
  getMyHistory,
  getBirthdayMonitoringStatus,
  triggerBirthdayCheckNow
} = require('../controllers/dailyNotificationController');

// User history endpoint
router.get('/my-history', protect, getMyHistory);

// Admin endpoints
router.get('/status', protect, adminOnly, getStatus);
router.post('/send-test', protect, adminOnly, sendTestEmail);
router.post('/trigger-now', protect, adminOnly, triggerBroadcast);

// Birthday monitoring endpoints
router.get('/birthdays/status', protect, adminOnly, getBirthdayMonitoringStatus);
router.post('/birthdays/trigger', protect, adminOnly, triggerBirthdayCheckNow);

module.exports = router;
