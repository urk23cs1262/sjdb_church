const mongoose = require('mongoose');

const anbiyamSchema = new mongoose.Schema({
  hostFamily: { type: String, required: true },
  hostAddress: { type: String },
  date: { type: Date, required: true },
  time: { type: String },
  prayerIntentions: { type: String },
  area: { type: String },
  leaderName: { type: String },
  leaderPhone: { type: String },
  attendees: [{ name: String, phone: String }],
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
  notified: { type: Boolean, default: false },
  notes: { type: String },
  bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('AnbiyamMeeting', anbiyamSchema);
