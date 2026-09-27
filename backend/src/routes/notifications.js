const router = require('express').Router();
const {
  getMyNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  togglePin,
  deleteOne,
  deleteAll,
  deleteAllAdmin,
  getAdminNotifications,
  getAdminUnreadCount,
  markAllAdminRead,
  broadcast,
  getVapidKey,
  subscribePush,
  getActiveCelebrations,
  acknowledgeCelebrationModal
} = require('../controllers/notificationController');
const { protect, optionalAuth, adminOnly } = require('../middleware/auth');

// ── Web Push endpoints ───────────────────────────────────────────────────────
router.get('/vapid-key', getVapidKey);
router.post('/subscribe-push', protect, subscribePush);

// ── Celebration Popup endpoints (Public for Feast/Christmas/Easter/NewYear, Personalized for Birthday) ──
router.get('/active-celebrations', optionalAuth, getActiveCelebrations);
router.post('/acknowledge-celebration', optionalAuth, acknowledgeCelebrationModal);

// ── User routes ──────────────────────────────────────────────────────────────
router.get('/', protect, getMyNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.put('/read-all', protect, markAllRead);
router.delete('/delete-all', protect, deleteAll);
router.put('/:id/read', protect, markRead);
router.put('/:id/pin', protect, togglePin);
router.delete('/:id', protect, deleteOne);

// ── Admin routes ─────────────────────────────────────────────────────────────
router.get('/admin', protect, adminOnly, getAdminNotifications);
router.get('/admin/unread-count', protect, adminOnly, getAdminUnreadCount);
router.put('/admin/read-all', protect, adminOnly, markAllAdminRead);
router.delete('/admin/clear-all', protect, adminOnly, deleteAllAdmin);
router.post('/broadcast', protect, adminOnly, broadcast);

module.exports = router;
