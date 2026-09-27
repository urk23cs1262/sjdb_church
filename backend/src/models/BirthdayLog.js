const mongoose = require('mongoose');

const channelStatusSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['sent', 'failed', 'skipped', 'disabled', 'pending'],
    default: 'pending'
  },
  sentAt: {
    type: Date,
    default: null
  },
  target: {
    type: String,
    default: null
  },
  notificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification',
    default: null
  },
  error: {
    type: String,
    default: null
  }
}, { _id: false });

const birthdayLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  year: {
    type: Number,
    required: true,
    index: true
  },
  birthdayDate: {
    type: String, // e.g. "09-27"
    required: true,
    index: true
  },
  executionDate: {
    type: String, // e.g. "2026-09-27" (Asia/Kolkata date key)
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true,
    trim: true
  },
  userEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },
  userPhone: {
    type: String,
    trim: true,
    default: null
  },
  preferredLanguage: {
    type: String,
    enum: ['ta', 'en', 'both'],
    default: 'ta'
  },
  channels: {
    whatsapp: { type: channelStatusSchema, default: () => ({ status: 'pending' }) },
    email: { type: channelStatusSchema, default: () => ({ status: 'pending' }) },
    inApp: { type: channelStatusSchema, default: () => ({ status: 'pending' }) },
    push: { type: channelStatusSchema, default: () => ({ status: 'pending' }) }
  },
  overallStatus: {
    type: String,
    enum: ['sent', 'partially_sent', 'failed', 'skipped'],
    default: 'sent',
    index: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Guarantee that only ONE birthday log is created per user per calendar year
birthdayLogSchema.index({ userId: 1, year: 1 }, { unique: true });
birthdayLogSchema.index({ executionDate: 1, overallStatus: 1 });
birthdayLogSchema.index({ year: 1, birthdayDate: 1 });

module.exports = mongoose.model('BirthdayLog', birthdayLogSchema);
