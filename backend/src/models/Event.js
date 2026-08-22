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
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
