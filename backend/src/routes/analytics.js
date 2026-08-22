const router = require('express').Router();
const { 
  trackPageView, 
  getAnalyticsStats,
  getAnalyticsSummary,
  getAnalyticsVisitors,
  getAnalyticsPageViews,
  getAnalyticsDevices,
  getAnalyticsSubmissions
} = require('../controllers/analyticsController');
const { protect, adminOnly } = require('../middleware/auth');

// Public beacon tracking endpoint (open for all public visitors and members)
router.post('/track', trackPageView);

// Admin-only metrics endpoints (100% database calculated)
router.get('/stats', protect, adminOnly, getAnalyticsStats);
router.get('/summary', protect, adminOnly, getAnalyticsSummary);
router.get('/visitors', protect, adminOnly, getAnalyticsVisitors);
router.get('/page-views', protect, adminOnly, getAnalyticsPageViews);
router.get('/devices', protect, adminOnly, getAnalyticsDevices);
router.get('/submissions', protect, adminOnly, getAnalyticsSubmissions);

module.exports = router;
