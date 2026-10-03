const router = require('express').Router();
const { 
  getDashboardStats, 
  resetTimeline, 
  forceGlobalOtpReverification,
  getPendingOtpUsers,
  remindPendingOtpUsers
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/dashboard', protect, adminOnly, getDashboardStats);
router.post('/reset-timeline', protect, adminOnly, resetTimeline);
router.post('/force-otp-reverification', protect, adminOnly, forceGlobalOtpReverification);
router.get('/pending-otp-users', protect, adminOnly, getPendingOtpUsers);
router.post('/remind-pending-otp', protect, adminOnly, remindPendingOtpUsers);

module.exports = router;
