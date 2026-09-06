const mongoose = require('mongoose');

// Tracks each WhatsApp user's current step in the bot onboarding conversation & state
const botSessionSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, unique: true }, // e.g. "919876543210"
  step: {
    type: String,
    enum: [
      'language_selection',
      'bot_language',
      'welcome',
      'ask_phone',
      'ask_phone_manual',
      'phone_verification',
      'otp_verification',
      'select_preferences',
      'preferences',
      'catholic_language',
      'bot_language_change',
      'catholic_language_change',
      'select_language',
      'language',
      'reading_pref',
      'send_links',
      'link_phone',
      'stopped',
      'done'
    ],
    default: 'language_selection'
  },
  isVerified: { type: Boolean, default: false },
  isOnboarded: { type: Boolean, default: false },
  providedPhone: { type: String, default: '' },
  tempOtp: { type: String, default: null },
  tempOtpExpires: { type: Date, default: null },
  preferences: [{
    type: String,
    enum: ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday', 'maintenance', 'info']
  }],
  language: { type: String, enum: ['en', 'ta', 'both', 'ml'], default: null }, // Bot Language
  catholicLanguage: { type: String, enum: ['en', 'ta', 'both'], default: 'ta' }, // Daily Catholic Content Language
  waitingForReply: { type: Boolean, default: false },
  pendingStep: { type: String, default: null },
  readingPreference: { type: String, enum: ['full', 'short', 'verse-reflection', 'complete'], default: 'full' },
  sendLinks: { type: Boolean, default: true },
  lastMessage: { type: Date, default: Date.now },
  firstInteractionEmailSent: { type: Boolean, default: false },
  firstInteractionAt: { type: Date },
  pushName: { type: String, default: '' },
  linkedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  moderationFlags: [{
    detectedWords: [String],
    timestamp: { type: Date, default: Date.now },
    rawText: String
  }],
  processedMessageIds: [{ type: String }],
  lastProcessedMessageId: { type: String, default: '' },
  lastSentResponseHash: { type: String, default: '' },
  lastSentAt: { type: Date },
  currentMenu: { type: String, default: 'main' }
}, { timestamps: true });

module.exports = mongoose.model('BotSession', botSessionSchema);
