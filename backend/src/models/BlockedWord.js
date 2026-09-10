const mongoose = require('mongoose');

const blockedWordSchema = new mongoose.Schema({
  word: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  language: {
    type: String,
    enum: ['en', 'ta', 'tanglish', 'ml', 'hi', 'universal'],
    default: 'universal'
  },
  category: {
    type: String,
    enum: ['profanity', 'harassment', 'threat', 'sexual', 'other'],
    default: 'profanity'
  },
  severity: {
    type: Number,
    enum: [1, 2, 3], // 1: Mild (Warning), 2: Standard (Violation strike), 3: Extreme (Instant Block)
    default: 2
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BlockedWord', blockedWordSchema);
