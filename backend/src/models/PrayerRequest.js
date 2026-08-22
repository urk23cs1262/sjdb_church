const mongoose = require('mongoose');

const prayerRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String },
  email: { type: String },
  intention: { type: String, default: '' },
  isPublic: { type: Boolean, default: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'completed'], default: 'pending' },
  prayerCount: { type: Number, default: 0 },
  language: { type: String, enum: ['en', 'ta'], default: 'en' },
  // New fields from modern form
  prayerLocation: { type: String, enum: ['personal', 'church', 'confession'], default: 'personal' },
  churchLocation: { type: String },
  type: { type: String },
  preferredDate: { type: Date },
  preferredTime: { type: String },
  confessionLocation: { type: String },
  contactPhone: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('PrayerRequest', prayerRequestSchema);
