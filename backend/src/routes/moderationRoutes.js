const express = require('express');
const router = express.Router();
const {
  getModerationStats,
  getModeratedUsers,
  getModeratedUserDetails,
  unblockUserAction,
  blockUserAction,
  getBlockedWordsList,
  addBlockedWord,
  deleteBlockedWord,
  restoreAllUsersAction
} = require('../controllers/moderationController');
const { protect, adminOnly } = require('../middleware/auth');

// All moderation routes require admin authorization
router.use(protect, adminOnly);

router.get('/stats', getModerationStats);
router.get('/users', getModeratedUsers);
router.get('/users/:id', getModeratedUserDetails);
router.post('/unblock', unblockUserAction);
router.post('/block', blockUserAction);
router.post('/restore-all', restoreAllUsersAction);
router.get('/words', getBlockedWordsList);
router.post('/words', addBlockedWord);
router.delete('/words/:id', deleteBlockedWord);

module.exports = router;
