const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  imageUrl: { type: String, required: true },
  category: { type: String, enum: ['church', 'feast', 'events', 'priests', 'community', 'other'], default: 'other' },
  album: { type: String },
  isVideo: { type: Boolean, default: false },
  videoUrl: { type: String },
  isPublished: { type: Boolean, default: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Gallery', gallerySchema);
