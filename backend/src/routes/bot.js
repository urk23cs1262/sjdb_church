const express = require('express');
const router = express.Router();
const { getStatus, getQR, resetSession, getSubscribers, getStats, triggerBroadcast, sendCustomMessage, testBotMessage } = require('../controllers/botController');
const { protect, adminOnly } = require('../middleware/auth');

// All endpoints are admin-protected (no Twilio webhook needed — Baileys listens directly)
router.get('/status', protect, adminOnly, getStatus);
router.get('/qr', protect, adminOnly, getQR);
router.post('/reset', protect, adminOnly, resetSession);
router.get('/subscribers', protect, adminOnly, getSubscribers);
router.get('/stats', protect, adminOnly, getStats);
router.post('/broadcast/now', protect, adminOnly, triggerBroadcast);
router.post('/send', protect, adminOnly, sendCustomMessage);
router.post('/test-message', protect, adminOnly, testBotMessage);

module.exports = router;
