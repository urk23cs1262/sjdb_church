const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  getPublicStatus,
  getMaintenanceSettings,
  toggleMaintenanceMode,
  triggerEmergencyShutdown,
  updateMaintenanceSettings,
  sendMaintenanceNotices,
  getMaintenanceHistory,
  trackAccessAttempt,
  showcaseNoticeBanner
} = require('../controllers/maintenanceController');

// Public endpoints
router.get('/status', getPublicStatus);
router.post('/track-attempt', trackAccessAttempt);

// Protected Admin / Technical Team Management endpoints
router.get('/settings', protect, adminOnly, getMaintenanceSettings);
router.post('/toggle', protect, adminOnly, toggleMaintenanceMode);
router.post('/emergency', protect, adminOnly, triggerEmergencyShutdown);
router.post('/showcase-banner', protect, adminOnly, showcaseNoticeBanner);
router.put('/settings', protect, adminOnly, updateMaintenanceSettings);
router.post('/notify', protect, adminOnly, sendMaintenanceNotices);
router.get('/history', protect, adminOnly, getMaintenanceHistory);

module.exports = router;
