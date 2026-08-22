const express = require('express');
const router = express.Router();
const {
  sendAdminMessage,
  getAdminUserThread,
  deleteAdminMessage,
  getUserMessages,
  getUserUnreadCount,
  markMessageAsRead,
  markAllMessagesAsRead,
  deleteUserMessage
} = require('../controllers/messageController');
const { protect, adminOnly } = require('../middleware/auth');

// ── Admin Routes ─────────────────────────────────────────────────────────────
router.post('/admin/send', protect, adminOnly, sendAdminMessage);
router.get('/admin/thread/:userId', protect, adminOnly, getAdminUserThread);
router.delete('/admin/:id', protect, adminOnly, deleteAdminMessage);

// ── User Inbox Routes ────────────────────────────────────────────────────────
router.get('/my-messages', protect, getUserMessages);
router.get('/unread-count', protect, getUserUnreadCount);
router.patch('/:id/read', protect, markMessageAsRead);
router.patch('/read-all', protect, markAllMessagesAsRead);
router.delete('/:id', protect, deleteUserMessage);

module.exports = router;
