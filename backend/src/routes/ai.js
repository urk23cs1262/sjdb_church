const express = require('express');
const router = express.Router();
const { generateAIContent } = require('../controllers/aiController');
const { protect, adminOnly } = require('../middleware/auth');

// POST /api/ai/generate-content (Admin route for AI content generation)
router.post('/generate-content', protect, adminOnly, generateAIContent);

module.exports = router;

