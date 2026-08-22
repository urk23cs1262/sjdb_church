const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g. 'videoAdId', 'rosaryAudio', 'heroImage', 'stJohnImage'
  value: { type: String, required: true },             // youtube video ID or file path
  label: { type: String },                              // human-readable label
  type: { type: String, enum: ['text', 'file'], default: 'text' },
}, { timestamps: true });

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
