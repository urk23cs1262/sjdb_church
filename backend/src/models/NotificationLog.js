const mongoose = require('mongoose');

/**
 * NotificationLog Schema — SJDB Connect
 * St. John de Britto Church, Kalayarkoil
 *
 * Implements strict deduplication & idempotency for all logical notifications
 * and reminders across Website In-App, WhatsApp, Email, and Web Push.
 *
 * Guaranteed uniqueness via compound index:
 * { entityType: 1, entityId: 1, notificationType: 1, reminderType: 1, scheduledFor: 1 }
 */
const notificationLogSchema = new mongoose.Schema({
  entityType: {
    type: String,
    enum: ['event', 'announcement', 'registration', 'general'],
    required: true,
    index: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  notificationType: {
    type: String,
    enum: [
      'event_created',
      'event_reminder',
      'event_updated',
      'event_cancelled',
      'announcement_created',
      'announcement_reminder',
      'announcement_updated',
      'announcement_expired',
      'event_registration',
      'event_registration_withdrawn'
    ],
    required: true,
    index: true
  },
  reminderType: {
    type: String,
    required: true // e.g. "creation", "12_hours", "6_hours", "hourly_04:00", "hourly_05:00", "expiry"
  },
  scheduledFor: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['sent', 'suppressed', 'failed'],
    default: 'sent'
  },
  suppressionReason: {
    type: String
  },
  title: {
    type: String
  },
  channels: [{
    type: String
  }],
  recipientCount: {
    type: Number,
    default: 0
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Compound unique index ensuring only ONE notification of a given type/reminderType per schedule slot
notificationLogSchema.index({
  entityType: 1,
  entityId: 1,
  notificationType: 1,
  reminderType: 1,
  scheduledFor: 1
}, { unique: true });

notificationLogSchema.index({ entityId: 1, sentAt: -1 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
