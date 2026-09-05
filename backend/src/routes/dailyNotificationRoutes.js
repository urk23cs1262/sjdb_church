const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  getStatus,
  getJobStatus,
  sendTestEmail,
  triggerBroadcast,
  triggerSchedulerCron,
  recoverMissed,
  getMyHistory
} = require('../controllers/dailyNotificationController');

// ─── User Endpoints ─────────────────────────────────────────────────────────
router.get('/my-history', protect, getMyHistory);

// ─── External Webhook / Cron Trigger (04:00 AM IST) ─────────────────────────
// Authenticated via CRON_SECRET token (no browser session needed)
router.all('/scheduler-trigger', triggerSchedulerCron);

// ─── Admin Monitoring & Control Endpoints ───────────────────────────────────
router.get('/status', protect, adminOnly, getStatus);
router.get('/job-status', protect, adminOnly, getJobStatus);
router.post('/send-test', protect, adminOnly, sendTestEmail);
router.post('/trigger-now', protect, adminOnly, triggerBroadcast);
router.post('/recover-missed', protect, adminOnly, recoverMissed);

module.exports = router;
