const mongoose = require('mongoose');

const DailyReflectionSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
    index: true // e.g. "2026-10-02"
  },
  heading: {
    type: String,
    default: 'இன்றைய சிந்தனை',
    trim: true
  },
  title: {
    type: String,
    trim: true
  },
  scriptureQuote: {
    type: String,
    trim: true
  },
  reflection: {
    type: String,
    required: true,
    trim: true
  },
  paragraphs: [{
    type: String,
    trim: true
  }],
  prayer: {
    type: String,
    trim: true,
    default: null
  },
  sourceUrl: {
    type: String,
    required: true,
    trim: true
  },
  source: {
    type: String,
    default: 'Tamil Catholic Daily',
    trim: true
  },
  fetchedAt: {
    type: Date,
    default: Date.now
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DailyReflection', DailyReflectionSchema);
