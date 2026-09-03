const mongoose = require('mongoose');

const pageViewSchema = new mongoose.Schema({
  path: { type: String, required: true, trim: true, index: true },
  pageTitle: { type: String, default: 'Church Portal', trim: true },
  visitorId: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  ip: { type: String },
  device: { type: String, enum: ['Desktop', 'Mobile', 'Tablet'], default: 'Desktop' },
  browser: { type: String, default: 'Unknown' },
  referrer: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

// Compound indexes for high-speed period aggregations
pageViewSchema.index({ createdAt: -1, visitorId: 1 });
pageViewSchema.index({ createdAt: -1, path: 1 });

module.exports = mongoose.model('PageView', pageViewSchema);
