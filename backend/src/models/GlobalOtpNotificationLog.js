const mongoose = require('mongoose');

const globalOtpNotificationLogSchema = new mongoose.Schema({
  notificationType: {
    type: String,
    enum: ['immediate', 'reminder', 'final_reminder', 'expiry'],
    default: 'reminder',
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  globalResetId: {
    type: String,
    required: true,
    index: true
  },
  reminderDay: {
    type: Number,
    required: true, // 0 = immediate, 1, 3, 7, 14, 21, 27, 29, 30
    index: true
  },
  channel: {
    type: String,
    enum: ['in_app', 'push', 'email', 'whatsapp'],
    required: true,
    index: true
  },
  sentAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['sent', 'failed', 'skipped'],
    default: 'sent'
  },
  error: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Compound unique index prevents any duplicate notification for the same user, reset, day, and channel
globalOtpNotificationLogSchema.index(
  { userId: 1, globalResetId: 1, reminderDay: 1, channel: 1 },
  { unique: true }
);

module.exports = mongoose.model('GlobalOtpNotificationLog', globalOtpNotificationLogSchema);
