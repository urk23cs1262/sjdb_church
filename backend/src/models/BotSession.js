const mongoose = require('mongoose');

// Tracks each WhatsApp user's current step in the bot onboarding conversation
const botSessionSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, unique: true }, // e.g. "919876543210"
  step: {
    type: String,
    enum: ['welcome', 'preferences', 'language', 'link_phone', 'done'],
    default: 'welcome'
  },
  preferences: [{
    type: String,
    enum: ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday']
  }],
  language: { type: String, enum: ['en', 'ta', 'both'], default: 'en' },
  lastMessage: { type: Date, default: Date.now },
  linkedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('BotSession', botSessionSchema);
