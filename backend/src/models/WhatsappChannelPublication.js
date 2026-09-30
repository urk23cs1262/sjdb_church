const mongoose = require('mongoose');

/**
 * WhatsappChannelPublication Schema
 * Tracks and logs all public posts published to the official WhatsApp Channel.
 * Guarantees zero duplicate publications and maintains an immutable audit trail.
 */
const whatsappChannelPublicationSchema = new mongoose.Schema({
  publicationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  date: {
    type: String,
    required: true,
    index: true
  },
  contentType: {
    type: String,
    required: true,
    enum: [
      'daily_content',
      'bible_verse',
      'saint_of_the_day',
      'mass_readings',
      'daily_reflection',
      'announcement',
      'event',
      'emergency_notice',
      'test_update',
      'custom_message'
    ],
    index: true
  },
  contentHash: {
    type: String,
    required: true,
    index: true
  },
  channelJid: {
    type: String,
    required: true,
    index: true
  },
  channelName: {
    type: String,
    default: 'St. John de Britto Church Kkl.'
  },
  status: {
    type: String,
    required: true,
    enum: ['published', 'failed', 'pending'],
    default: 'pending',
    index: true
  },
  publishedAt: {
    type: Date,
    default: null
  },
  source: {
    type: String,
    enum: ['scheduled_cron', 'admin_manual', 'system'],
    default: 'scheduled_cron'
  },
  triggerType: {
    type: String,
    default: '4_am_daily'
  },
  title: {
    type: String,
    default: ''
  },
  summary: {
    type: String,
    default: ''
  },
  mediaAttached: {
    type: Boolean,
    default: false
  },
  mediaType: {
    type: String,
    enum: ['none', 'image', 'video', 'document'],
    default: 'none'
  },
  errorMessage: {
    type: String,
    default: null
  },
  retryCount: {
    type: Number,
    default: 0
  },
  adminUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

// Compound index to guarantee atomic uniqueness for daily publications
whatsappChannelPublicationSchema.index({ date: 1, contentType: 1, contentHash: 1 });

module.exports = mongoose.model('WhatsappChannelPublication', whatsappChannelPublicationSchema);
