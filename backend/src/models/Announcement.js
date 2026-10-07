const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  titleTa: { type: String },
  content: { type: String, required: true },
  contentTa: { type: String },
  type: { type: String, enum: ['general', 'feast', 'funeral', 'marriage', 'emergency', 'meeting'], default: 'general' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isPublished: { type: Boolean, default: true },
  date: { type: Date },
  expiresAt: { type: Date },
  attachment: { type: String },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  eventLink: { type: String, default: '/events' },
  status: {
    type: String,
    enum: ['published', 'unpublished', 'expired', 'deleted'],
    default: 'published'
  },
  lastReminderSentAt: { type: Date },
  nextReminderAt: { type: Date },
  reminderStatus: {
    type: String,
    enum: ['active', 'idle', 'expired', 'cancelled'],
    default: 'idle'
  },
  reminderCount: { type: Number, default: 0 },
  reminderHistory: [{
    sentAt: { type: Date, default: Date.now },
    channels: [String],
    recipientCount: Number
  }],
}, { timestamps: true });

announcementSchema.index({ status: 1, expiresAt: 1 });
announcementSchema.index({ isPublished: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
