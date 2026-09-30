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
    default: 'general'
  },
  category: {
    type: String,
    default: 'general'
  },
  requestType: { type: String }, // e.g. MASS_BOOKING, DOCUMENT_REQUEST, TICKET, PRAYER_REQUEST, etc.
  requestId: { type: String },   // e.g. MB-2026-00012, DOC-123456, TKT-123456
  status: { type: String },      // e.g. PENDING, UNDER_REVIEW, APPROVED, REJECTED, COMPLETED, CANCELLED
  priority: { type: String, enum: ['low', 'normal', 'medium', 'high', 'critical', 'urgent'], default: 'low' },

  // Event Metadata (for security & user activity details)
  metadata: { type: Object, default: {} },

  // Audience: 'user' = only user panel, 'admin' = only admin panel, 'both' = both
  recipient: { type: String, enum: ['user', 'admin', 'both'], default: 'user' },

  // State
  isRead: { type: Boolean, default: false },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isPinned: { type: Boolean, default: false },

  // Action deep link / redirect URL (e.g. /dashboard/bookings/:id or /admin/bookings/:id)
  actionUrl: { type: String },
  redirectUrl: { type: String },

  // Delivery channels & tracking
  sentVia: [{ type: String }],
  channels: {
    website: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date },
      read: { type: Boolean, default: false }
    },
    push: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date },
      error: { type: String },
      sentCount: { type: Number, default: 0 }
    },
    email: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date },
      error: { type: String },
      recipients: [{ type: String }]
    },
    whatsapp: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date },
      error: { type: String },
      recipients: [{ type: String }],
      hasAttachment: { type: Boolean, default: false }
    }
  },

  // Unique idempotency key to prevent duplicate notifications
  idempotencyKey: { type: String, sparse: true, index: true },

  // Related document
  relatedId: { type: mongoose.Schema.Types.ObjectId },
  relatedModel: { type: String },
  fileUrl: { type: String },

  // Saint of the Day integration
  imageUrl: { type: String },
  saintName: { type: String },
  saintNameTa: { type: String },
  saintImage: { type: String },
  saintFeastDay: { type: String },
  saintDescription: { type: String },
  saintUrl: { type: String },
}, { timestamps: true });

// Auto-sync actionUrl and redirectUrl, and channels.website
notificationSchema.pre('save', function(next) {
  if (this.actionUrl && !this.redirectUrl) this.redirectUrl = this.actionUrl;
  if (this.redirectUrl && !this.actionUrl) this.actionUrl = this.redirectUrl;
  if (!this.channels) this.channels = {};
  if (!this.channels.website) {
    this.channels.website = { sent: true, sentAt: new Date(), read: this.isRead || false };
  } else {
    this.channels.website.read = this.isRead || false;
  }
  next();
});

// Index for fast user lookups
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ isBroadcast: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ requestId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
