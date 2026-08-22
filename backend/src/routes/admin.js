const router = require('express').Router();
const { 
  getDashboardStats, 
  resetTimeline, 
  forceGlobalOtpReverification,
  getPendingOtpUsers,
  remindPendingOtpUsers
} = require('../controllers/adminController');
const { 
  getAnalyticsStats,
  getAnalyticsSummary,
  getAnalyticsVisitors,
  getAnalyticsPageViews,
  getAnalyticsDevices,
  getAnalyticsSubmissions
} = require('../controllers/analyticsController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/dashboard', protect, adminOnly, getDashboardStats);
router.get('/analytics', protect, adminOnly, getAnalyticsStats);
router.get('/analytics/summary', protect, adminOnly, getAnalyticsSummary);
router.get('/analytics/visitors', protect, adminOnly, getAnalyticsVisitors);
router.get('/analytics/page-views', protect, adminOnly, getAnalyticsPageViews);
router.get('/analytics/devices', protect, adminOnly, getAnalyticsDevices);
router.get('/analytics/submissions', protect, adminOnly, getAnalyticsSubmissions);
router.post('/reset-timeline', protect, adminOnly, resetTimeline);
router.post('/force-otp-reverification', protect, adminOnly, forceGlobalOtpReverification);
router.get('/pending-otp-users', protect, adminOnly, getPendingOtpUsers);
router.post('/remind-pending-otp', protect, adminOnly, remindPendingOtpUsers);

module.exports = router;
