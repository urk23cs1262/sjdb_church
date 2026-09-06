const mongoose = require('mongoose');

const userDevotionalProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  songId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RosarySong',
    default: null
  },
  songTitle: {
    type: String,
    default: ''
  },
  songIndex: {
    type: Number,
    default: 0
  },
  positionSeconds: {
    type: Number,
    default: 0
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('UserDevotionalProgress', userDevotionalProgressSchema);
