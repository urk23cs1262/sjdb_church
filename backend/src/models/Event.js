const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  titleTa: { type: String },
  description: { type: String },
  descriptionTa: { type: String },
  date: { type: Date, required: true },
  time: { type: String },
  venue: { type: String },
  organizer: { type: String },
  category: { type: String, enum: ['feast', 'mass', 'meeting', 'youth', 'choir', 'catechism', 'community', 'other'], default: 'other' },
  image: { type: String },
  registrationRequired: { type: Boolean, default: false },
  registrationLimit: { type: Number, default: 0 }, // 0 = unlimited
  registrationCount: { type: Number, default: 0 },
  registrations: [{
    userId: mongoose.Schema.Types.ObjectId,
    name: String,
    phone: String,
    email: String,
    gender: String,
    comingFrom: String,
    registeredAt: { type: Date, default: Date.now }
  }],
  isPublished: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'cancelled', 'completed'], default: 'active' },
  isCancelled: { type: Boolean, default: false },
  cancelledAt: { type: Date },
  cancelledReason: { type: String },
  lastReminderSentAt: { type: Date },
  nextReminderAt: { type: Date },
  reminderStatus: { type: String, enum: ['active', 'idle', 'completed', 'cancelled'], default: 'idle' },
  reminderCount: { type: Number, default: 0 },
  reminderHistory: [{
    sentAt: { type: Date, default: Date.now },
    channels: [String],
    recipientCount: Number
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

eventSchema.index({ isPublished: 1, date: 1 });
eventSchema.index({ category: 1, isPublished: 1 });

module.exports = mongoose.model('Event', eventSchema);
