const UserModeration = require('../models/UserModeration');
const BlockedWord = require('../models/BlockedWord');
const User = require('../models/User');
const {
  unblockUser,
  blockUserManually,
  getActiveBlockedWords
} = require('../services/userModerationService');

// @GET /api/moderation/stats
const getModerationStats = async (req, res) => {
  try {
    const totalMonitored = await UserModeration.countDocuments();
    const warningCount = await UserModeration.countDocuments({ status: 'warning' });
    const blockedCount = await UserModeration.countDocuments({ status: 'blocked' });
    const activeCount = await UserModeration.countDocuments({ status: 'active' });

    const totalViolationsResult = await UserModeration.aggregate([
      { $group: { _id: null, total: { $sum: '$violationCount' } } }
    ]);
    const totalViolations = totalViolationsResult[0]?.total || 0;

    const totalWords = await BlockedWord.countDocuments({ isActive: true });

    res.json({
      success: true,
      data: {
        totalMonitored,
        warningCount,
        blockedCount,
        activeCount,
        totalViolations,
        totalBlockedWords: totalWords
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/moderation/users
const getModeratedUsers = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      const cleanSearch = search.replace(/\D/g, '');
      query.$or = [
        { phoneNumber: new RegExp(search, 'i') },
        { whatsappDisplayName: new RegExp(search, 'i') },
        ...(cleanSearch ? [{ phoneNumber: new RegExp(cleanSearch) }] : [])
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [users, total] = await Promise.all([
      UserModeration.find(query)
        .populate('userId', 'name email phone avatar parishMemberId isActive')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      UserModeration.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        users,
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/moderation/users/:id
const getModeratedUserDetails = async (req, res) => {
  try {
    const record = await UserModeration.findById(req.params.id)
      .populate('userId', 'name email phone avatar parishMemberId isActive')
      .populate('unblockedBy', 'name email');

    if (!record) {
      return res.status(404).json({ success: false, message: 'Moderation record not found' });
    }

    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/moderation/unblock
const unblockUserAction = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const updated = await unblockUser(phoneNumber, req.user?._id);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'No moderation record found for this phone number' });
    }

    res.json({
      success: true,
      message: `Access restored successfully for ${phoneNumber}`,
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/moderation/block
const blockUserAction = async (req, res) => {
  try {
    const { phoneNumber, reason } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const updated = await blockUserManually(phoneNumber, reason || 'Manually blocked by administrator', req.user?._id);

    res.json({
      success: true,
      message: `User ${phoneNumber} has been blocked and access restricted`,
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/moderation/words
const getBlockedWordsList = async (req, res) => {
  try {
    const { language, category, search } = req.query;
    const query = {};

    if (language) query.language = language;
    if (category) query.category = category;
    if (search) query.word = new RegExp(search, 'i');

    const words = await BlockedWord.find(query).sort({ word: 1 }).lean();
    res.json({ success: true, data: words });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/moderation/words
const addBlockedWord = async (req, res) => {
  try {
    const { word, language = 'universal', category = 'profanity', severity = 2 } = req.body;
    if (!word || !word.trim()) {
      return res.status(400).json({ success: false, message: 'Word is required' });
    }

    const cleanWord = word.trim().toLowerCase();
    const existing = await BlockedWord.findOne({ word: cleanWord });

    if (existing) {
      existing.isActive = true;
      existing.language = language;
      existing.category = category;
      existing.severity = severity;
      await existing.save();
      return res.json({ success: true, message: 'Blocked word updated', data: existing });
    }

    const newDoc = await BlockedWord.create({
      word: cleanWord,
      language,
      category,
      severity,
      isActive: true
    });

    res.status(201).json({ success: true, message: 'Blocked word added', data: newDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @DELETE /api/moderation/words/:id
const deleteBlockedWord = async (req, res) => {
  try {
    const deleted = await BlockedWord.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Word not found' });
    }
    res.json({ success: true, message: 'Blocked word deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getModerationStats,
  getModeratedUsers,
  getModeratedUserDetails,
  unblockUserAction,
  blockUserAction,
  getBlockedWordsList,
  addBlockedWord,
  deleteBlockedWord
};
