const mongoose = require('mongoose');

/**
 * NotificationDelivery Schema — SJDB Connect
 * 
 * Tracks individual delivery records per recipient, channel, and date.
 * Provides strict idempotency: { notificationDate, recipient, channel } is UNIQUE.
 * Supports retry tracking with attempt count and error states.
 */
const notificationDeliverySchema = new mongoose.Schema({
  jobId: {
    type: String, // e.g. "daily_catholic_job_2026_09_05"
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  recipient: {
    type: String, // Email address or clean phone number
    required: true,
    trim: true,
    index: true
  },
  channel: {
    type: String,
    enum: ['whatsapp', 'email', 'push', 'inApp'],
    required: true
  },
  notificationDate: {
    type: String, // "YYYY-MM-DD" in Asia/Kolkata
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
    enum: ['pending', 'sent', 'failed', 'skipped', 'retrying'],
    default: 'pending',
    index: true
  },
  attemptCount: {
    type: Number,
    default: 0
  },
  attemptedAt: {
    type: Date,
    default: null
  },
  sentAt: {
    type: Date,
    default: null
  },
  providerMessageId: {
    type: String,
    default: null
  },
  error: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Compound unique index: Only 1 delivery per recipient, channel, and notification date
notificationDeliverySchema.index({ notificationDate: 1, recipient: 1, channel: 1 }, { unique: true });

// Secondary queries
notificationDeliverySchema.index({ jobId: 1, channel: 1, status: 1 });
notificationDeliverySchema.index({ userId: 1, notificationDate: 1 });

module.exports = mongoose.model('NotificationDelivery', notificationDeliverySchema);
