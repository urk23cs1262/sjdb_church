const mongoose = require('mongoose');

const ReadingSectionSchema = new mongoose.Schema({
  heading: { type: String, trim: true },
  subtitle: { type: String, trim: true },
  reference: { type: String, trim: true },
  text: { type: String, trim: true },
  paragraphs: [{ type: String, trim: true }]
}, { _id: false });

const ResponsorialPsalmSchema = new mongoose.Schema({
  heading: { type: String, default: 'பதிலுரைப் பாடல்' },
  reference: { type: String, trim: true },
  response: { type: String, trim: true }, // பல்லவி
  verses: [{ type: String, trim: true }]
}, { _id: false });

const AlleluiaSchema = new mongoose.Schema({
  heading: { type: String, default: 'நற்செய்திக்கு முன் வாழ்த்தொலி' },
  reference: { type: String, trim: true },
  text: { type: String, trim: true }
}, { _id: false });

const GeneralSectionSchema = new mongoose.Schema({
  heading: { type: String, trim: true },
  paragraphs: [{ type: String, trim: true }]
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
    index: true // e.g. "2026-08-20"
  },
  dateFormatted: { type: String, trim: true },
  title: { type: String, trim: true },
  liturgicalDay: { type: String, trim: true }, // e.g. "பொதுக்காலம் 20ஆம் வாரம் – வியாழன்"
  celebration: { type: String, trim: true },   // e.g. "புனித பெர்நார்ட் – ஆதீனத் தலைவர், மறைவல்லுநர் (நினைவு)"
  lectionary: { type: String, trim: true },
  pageTitle: { type: String, trim: true },
  originalLanguage: { type: String, default: 'ta' },
  
  // Structured Liturgical Fields (Original Tamil)
  firstReading: { type: ReadingSectionSchema },
  responsorialPsalm: { type: ResponsorialPsalmSchema },
  secondReading: { type: ReadingSectionSchema },
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
