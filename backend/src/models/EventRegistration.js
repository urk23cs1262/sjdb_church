const mongoose = require('mongoose');

const eventRegistrationSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: 'male'
  },
  comingFrom: {
    type: String,
    trim: true
  },
  registeredAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  notificationDispatched: {
    type: Boolean,
    default: false
  },
  notificationDispatchedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Enforce unique registration per user per event at database level
eventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('EventRegistration', eventRegistrationSchema);
