const express = require('express');
const router = express.Router();
const {
  getStatus,
  reconnect,
  getQR,
  resetSession,
  getPairingCode,
  getSubscribers,
  clearAllBotSubscribers,
  deleteSubscriber,
  toggleSubscriberOptIn,
  getStats,
  getTodayPreview,
  getBroadcastHistory,
  triggerBroadcast,
  sendCustomMessage,
  testDirectMessage,
  testBotMessage,
  getChannelStatus,
  sendTestChannelUpdate,
  publishChannelDailyContent,
  updateChannelSettings,
  getChannelLogs,
  publishAnnouncementToChannel,
  publishEventToChannel,
  publishReminderToChannel
} = require('../controllers/botController');
const { protect, adminOnly } = require('../middleware/auth');

// All endpoints are admin-protected
router.get('/status', protect, adminOnly, getStatus);
router.post('/reconnect', protect, adminOnly, reconnect);
router.get('/qr', protect, adminOnly, getQR);
router.post('/reset', protect, adminOnly, resetSession);
router.post('/pairing-code', protect, adminOnly, getPairingCode);
router.get('/subscribers', protect, adminOnly, getSubscribers);
router.post('/subscribers/clear-all', protect, adminOnly, clearAllBotSubscribers);
router.post('/clear-start-fresh', protect, adminOnly, clearAllBotSubscribers);
router.delete('/subscriber/:phone', protect, adminOnly, deleteSubscriber);
router.post('/subscriber/delete', protect, adminOnly, deleteSubscriber);
router.post('/subscriber/toggle-optin', protect, adminOnly, toggleSubscriberOptIn);
router.get('/stats', protect, adminOnly, getStats);
router.get('/preview-today', protect, adminOnly, getTodayPreview);
router.get('/history', protect, adminOnly, getBroadcastHistory);
router.post('/broadcast/now', protect, adminOnly, triggerBroadcast);
router.post('/send', protect, adminOnly, sendCustomMessage);
router.post('/test-direct', protect, adminOnly, testDirectMessage);
router.post('/test-message', protect, adminOnly, testBotMessage);

// WhatsApp Channel Management (Strictly separated from private bot)
router.get('/channel/status', protect, adminOnly, getChannelStatus);
router.post('/channel/test', protect, adminOnly, sendTestChannelUpdate);
router.post('/channel/publish-daily', protect, adminOnly, publishChannelDailyContent);
router.post('/channel/settings', protect, adminOnly, updateChannelSettings);
router.get('/channel/logs', protect, adminOnly, getChannelLogs);
router.post('/channel/announcement', protect, adminOnly, publishAnnouncementToChannel);
router.post('/channel/event', protect, adminOnly, publishEventToChannel);
router.post('/channel/reminder', protect, adminOnly, publishReminderToChannel);

module.exports = router;
