const mongoose = require('mongoose');

/**
 * BirthdayDeliveryLog Schema — SJDB Connect
 * 
 * Tracks birthday greetings delivered to parish members across all channels.
 * Provides strict idempotency: { birthdayDate, userId, channel } is UNIQUE.
 * Prevents any duplicate birthday wishes if the scheduler runs multiple times.
 */
const birthdayDeliveryLogSchema = new mongoose.Schema({
  jobId: {
    type: String, // e.g., "birthday_2026-09-06"
    required: true,
    index: true
  },
  birthdayDate: {
    type: String, // "YYYY-MM-DD" in Asia/Kolkata timezone
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userName: {
    type: String,
    default: ''
  },
  recipient: {
    type: String, // Clean phone number, email address, or userId
    required: true,
    trim: true,
    index: true
  },
  channel: {
    type: String,
    enum: ['whatsapp', 'email', 'push', 'inApp'],
    required: true
  },
  language: {
    type: String,
    enum: ['ta', 'en'],
    default: 'ta'
  },
  status: {
    type: String,
    enum: ['sent', 'failed', 'skipped'],
    default: 'sent',
    index: true
  },
  error: {
    type: String,
    default: null
  },
  sentAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound unique index: Only 1 delivery per user, channel, and birthday date
birthdayDeliveryLogSchema.index({ birthdayDate: 1, userId: 1, channel: 1 }, { unique: true });

// Secondary queries
birthdayDeliveryLogSchema.index({ jobId: 1, channel: 1, status: 1 });
birthdayDeliveryLogSchema.index({ userId: 1, birthdayDate: 1 });

module.exports = mongoose.model('BirthdayDeliveryLog', birthdayDeliveryLogSchema);
