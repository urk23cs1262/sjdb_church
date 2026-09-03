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
  expiresAt: { type: Date },
  attachment: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
