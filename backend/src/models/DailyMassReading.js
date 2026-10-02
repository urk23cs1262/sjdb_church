const mongoose = require('mongoose');

const ReadingSectionSchema = new mongoose.Schema({
  heading: { type: String, trim: true },
  title: { type: String, trim: true },
  subtitle: { type: String, trim: true },
  reference: { type: String, trim: true },
  introduction: { type: String, trim: true },
  text: { type: String, trim: true },
  paragraphs: [{ type: String, trim: true }],
  conclusion: { type: String, trim: true }
}, { _id: false });

const PsalmVerseSchema = new mongoose.Schema({
  numbers: { type: String, trim: true },
  text: { type: String, trim: true }
}, { _id: false });

const ResponsorialPsalmSchema = new mongoose.Schema({
  heading: { type: String, default: 'பதிலுரைப் பாடல்' },
  title: { type: String, default: 'பதிலுரைப் பாடல்' },
  reference: { type: String, trim: true },
  response: { type: String, trim: true }, // பல்லவி
  refrain: { type: String, trim: true },
  verses: [PsalmVerseSchema]
}, { _id: false });

const AlleluiaSchema = new mongoose.Schema({
  heading: { type: String, default: 'நற்செய்திக்கு முன் வாழ்த்தொலி' },
  title: { type: String, default: 'நற்செய்திக்கு முன் வாழ்த்தொலி' },
  reference: { type: String, trim: true },
  text: { type: String, trim: true }
}, { _id: false });

const GeneralSectionSchema = new mongoose.Schema({
  heading: { type: String, trim: true },
  reference: { type: String, trim: true },
  subtitle: { type: String, trim: true },
  paragraphs: [{ type: String, trim: true }],
  verses: [PsalmVerseSchema],
  refrain: { type: String, trim: true }
}, { _id: false });

const ReflectionSchema = new mongoose.Schema({
  heading: { type: String, default: 'இன்றைய சிந்தனை' },
  title: { type: String, trim: true },
  content: { type: String, trim: true },
  paragraphs: [{ type: String, trim: true }],
  prayer: { type: String, trim: true },
  sourceUrl: { type: String, trim: true }
}, { _id: false });

const DailyMassReadingSchema = new mongoose.Schema({
  date: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true // e.g. "2026-10-02"
  },
  dateFormatted: { type: String, trim: true },
  title: { type: String, trim: true },
  liturgicalDay: { type: String, trim: true }, // e.g. "பொதுக்காலம் 26ஆம் வாரம் – வெள்ளி"
  celebration: { type: String, trim: true },   // e.g. "தூய காவல் தூதர்கள் (நினைவு)"
  liturgicalInfo: {
    day: { type: String, trim: true },
    celebration: { type: String, trim: true },
    notices: [{ type: String, trim: true }]
  },
  lectionary: { type: String, trim: true },
  pageTitle: { type: String, trim: true },
  originalLanguage: { type: String, default: 'ta' },
  
  // Structured Liturgical Fields (Original Tamil)
  firstReading: { type: ReadingSectionSchema },
  responsorialPsalm: { type: ResponsorialPsalmSchema },
  secondReading: { type: ReadingSectionSchema },
  gospelAcclamation: { type: AlleluiaSchema },
  alleluia: { type: AlleluiaSchema },
  gospel: { type: ReadingSectionSchema },

  // Array of sections for standard UI rendering
  sections: [GeneralSectionSchema],

  // Structured Reflection ("இன்றைய சிந்தனை")
  reflection: { type: ReflectionSchema },

  // Translation cache for on-demand translations without altering original Tamil
  translation: { 
    type: mongoose.Schema.Types.Mixed, 
    default: {} 
  },

  sourceUrl: { type: String, trim: true },
  fetchedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('DailyMassReading', DailyMassReadingSchema);
