const mongoose = require('mongoose');

const ReadingItemSchema = new mongoose.Schema({
  type: { type: String, trim: true },
  reference: { type: String, trim: true },
  text: { type: String, trim: true }
}, { _id: false });

const DailyCatholicContentSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
    index: true // "YYYY-MM-DD" in Asia/Kolkata
  },
  formattedDate: { type: String, trim: true },
  formattedDateTa: { type: String, trim: true },

  // 1. Saint of the Day
  saint: {
    nameEnglish: { type: String, trim: true },
    nameTamil: { type: String, trim: true },
    descriptionEnglish: { type: String, trim: true },
    descriptionTamil: { type: String, trim: true },
    feastDay: { type: String, trim: true },
    image: { type: String, trim: true },
    imageSource: { type: String, trim: true, default: 'Vatican News' },
    sourceUrl: { type: String, trim: true }
  },

  // 2. Daily Mass Readings
  massReadings: {
    tamil: {
      title: { type: String, trim: true },
      celebration: { type: String, trim: true },
      liturgicalDay: { type: String, trim: true },
      readings: [ReadingItemSchema],
      fullText: { type: String, trim: true }
    },
    english: {
      title: { type: String, trim: true },
      celebration: { type: String, trim: true },
      liturgicalDay: { type: String, trim: true },
      readings: [ReadingItemSchema],
      fullText: { type: String, trim: true }
    }
  },

  // 3. Daily Reflection
  reflection: {
    tamil: { type: String, trim: true },
    english: { type: String, trim: true },
    titleTamil: { type: String, trim: true },
    titleEnglish: { type: String, trim: true },
    prayer: { type: String, trim: true }
  },

  // 4. Daily Bible Verse
  bible: {
    ref: { type: String, trim: true },
    tamil: { type: String, trim: true },
    english: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    category: { type: String, trim: true }
  },

  // Monitoring & Synchronization metadata
  sourceHashes: {
    saint: { type: String, default: '' },
    massReadings: { type: String, default: '' },
    reflection: { type: String, default: '' },
    verse: { type: String, default: '' }
  },
  syncStatus: {
    saint: { type: Boolean, default: false },
    massReadings: { type: Boolean, default: false },
    reflection: { type: Boolean, default: false },
    verse: { type: Boolean, default: false }
  },
  lastSourceUpdateAt: { type: Date, default: Date.now },
  lastCheckedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('DailyCatholicContent', DailyCatholicContentSchema);
