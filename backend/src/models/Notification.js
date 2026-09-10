const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Who receives this notification (null = broadcast)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isBroadcast: { type: Boolean, default: false },

  // Content
  title: { type: String, required: true },
  message: { type: String, required: true },

  // Classification
  type: {
    type: String,
    enum: [
      'booking', 'bookings', 'document', 'documents', 'event', 'events',
      'announcement', 'announcements', 'ticket', 'tickets',
      'donation', 'donations', 'prayer', 'prayers', 'family', 'account',
      'profile', 'system', 'ai', 'feedback', 'general', 'permission',
      'security', 'activity', 'auth', 'account_verification', 'spiritual',
      'daily_spiritual', 'verse', 'saint', 'mass'
    ],
    default: 'general'
  },
  category: {
    type: String,
    enum: [
      'events', 'event', 'announcements', 'announcement', 'donations', 'donation',
      'family', 'prayer', 'prayers', 'account', 'profile', 'system', 'ai',
      'feedback', 'general', 'bookings', 'booking', 'documents', 'document',
      'tickets', 'ticket', 'permission', 'security', 'activity', 'auth',
      'account_verification', 'spiritual', 'daily_spiritual'
    ],
    default: 'general'
  },
  priority: { type: String, enum: ['low', 'normal', 'medium', 'high', 'critical', 'urgent'], default: 'low' },

  // Event Metadata (for security & user activity details)
  metadata: { type: Object, default: {} },

  // Audience: 'user' = only user panel, 'admin' = only admin panel, 'both' = both
  recipient: { type: String, enum: ['user', 'admin', 'both'], default: 'user' },

  // State
  isRead: { type: Boolean, default: false },
  isPinned: { type: Boolean, default: false },

  // Action deep link (e.g. /dashboard/booking or /admin/donations)
  actionUrl: { type: String },

  // Delivery channels
  sentVia: [{ type: String, enum: ['email', 'sms', 'whatsapp', 'push', 'inApp', 'website'] }],

  // Related document
  relatedId: { type: mongoose.Schema.Types.ObjectId },
  relatedModel: { type: String },
  fileUrl: { type: String },
}, { timestamps: true });

// Index for fast user lookups
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ isBroadcast: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
