const mongoose = require('mongoose');

const channelStatusSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['sent', 'partially_sent', 'failed', 'disabled', 'skipped', 'pending'],
    default: 'pending'
  },
  messageId: { type: String, default: null },
  notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', default: null },
  phone: { type: String, default: null },
  error: { type: String, default: null },
  messagesSent: { type: [String], default: [] },
  stepsCompleted: { type: Number, default: 0 },
  sentAt: { type: Date, default: null }
}, { _id: false });

const dailyNotificationLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  recipientPhone10: {
    type: String,
    index: true,
    default: null
  },
  userEmail: {
    type: String,
    required: false,
    trim: true,
    lowercase: true,
    default: null
  },
  userName: {
    type: String,
    trim: true
  },
  userPhone: {
    type: String,
    trim: true,
    default: null
  },
  dateKey: {
    type: String, // e.g. "2026-08-21"
    required: true,
    index: true
  },
  language: {
    type: String,
    enum: ['ta', 'en', 'both'],
    default: 'ta'
  },
  status: {
    type: String,
    enum: ['sent', 'partially_sent', 'failed', 'skipped', 'claiming'],
    default: 'sent'
  },
  channels: {
    email: { type: channelStatusSchema, default: () => ({ status: 'disabled' }) },
    inApp: { type: channelStatusSchema, default: () => ({ status: 'disabled' }) },
    push: { type: channelStatusSchema, default: () => ({ status: 'disabled' }) },
    whatsapp: { type: channelStatusSchema, default: () => ({ status: 'disabled' }) }
  },
  summary: {
    bibleRef: String,
    saintName: String,
    massTitle: String
  },
  sentAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound unique indexes to guarantee strictly zero duplicate deliveries per user / recipient per date
dailyNotificationLogSchema.index({ userId: 1, dateKey: 1 }, { unique: true, sparse: true });
dailyNotificationLogSchema.index({ recipientPhone10: 1, dateKey: 1 }, { sparse: true });
dailyNotificationLogSchema.index({ dateKey: 1, status: 1 });
dailyNotificationLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('DailyNotificationLog', dailyNotificationLogSchema);
