const mongoose = require('mongoose');

const anbiyamGroupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  patronSaint: { type: String, trim: true },
  description: { type: String, trim: true },
  establishedDate: { type: Date },
  areaStreetZone: { type: String, trim: true },
  meetingDay: { type: String, trim: true }, // e.g. Sunday, Every 2nd Saturday
  meetingTime: { type: String, trim: true }, // e.g. 6:30 PM
  meetingFrequency: { type: String, enum: ['Weekly', 'Bi-weekly', 'Monthly', 'Other'], default: 'Monthly' },
  meetingVenue: { type: String, trim: true }, // e.g. St. Antony Chapel / Rotating Family Houses
  isActive: { type: Boolean, default: true },
  image: { type: String, trim: true }, // Group photo URL
  leaderName: { type: String, trim: true },
  leaderPhone: { type: String, trim: true },
  viceLeaderName: { type: String, trim: true },
  secretaryName: { type: String, trim: true },
  contactPerson: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('AnbiyamGroup', anbiyamGroupSchema);
