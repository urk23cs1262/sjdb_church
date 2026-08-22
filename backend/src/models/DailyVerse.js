const mongoose = require('mongoose');

const dailyVerseSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true, index: true },
  ref: { type: String, required: true, trim: true },
  category: { type: String, default: 'General', trim: true },
  verseTextEn: { type: String, default: '', trim: true },
  verseTextTa: { type: String, default: '', trim: true },
  date: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('DailyVerse', dailyVerseSchema);
