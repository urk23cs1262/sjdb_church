const mongoose = require('mongoose');

const celebrationLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  celebrationType: {
    type: String,
    enum: ['birthday', 'new_year', 'st_john_britto_feast', 'easter', 'christmas'],
    required: true,
    index: true
  },
  year: {
    type: Number,
    required: true,
    index: true
  },
  celebrationKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  notificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification',
    default: null
  },
  acknowledgedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Guarantee each celebration type is only recorded once per user per year
celebrationLogSchema.index({ userId: 1, celebrationType: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('CelebrationLog', celebrationLogSchema);
