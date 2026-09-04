const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  getStatus,
  sendTestEmail,
  triggerBroadcast,
  recoverMissed,
  getMyHistory
} = require('../controllers/dailyNotificationController');

// User history endpoint
router.get('/my-history', protect, getMyHistory);

// Admin endpoints
router.get('/status', protect, adminOnly, getStatus);
router.post('/send-test', protect, adminOnly, sendTestEmail);
router.post('/trigger-now', protect, adminOnly, triggerBroadcast);

// Admin: Safely recover a missed midnight broadcast (idempotent — safe to call multiple times)
router.post('/recover-missed', protect, adminOnly, recoverMissed);

module.exports = router;

