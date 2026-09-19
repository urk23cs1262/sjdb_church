const mongoose = require('mongoose');

const notificationJobLogSchema = new mongoose.Schema({
  jobName: {
    type: String,
    required: true,
    index: true
  },
  executionDate: {
    type: String, // e.g. "2026-09-19" (in Asia/Kolkata timezone)
    required: true,
    index: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['running', 'completed', 'failed'],
    default: 'running'
  },
  processedUsers: {
    type: Number,
    default: 0
  },
  notifiedUsers: {
    type: Number,
    default: 0
  },
  failedUsers: {
    type: Number,
    default: 0
  },
  error: {
    type: String,
    default: null
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Compound unique index guaranteeing only ONE run of a specific job per executionDate
notificationJobLogSchema.index({ jobName: 1, executionDate: 1 }, { unique: true });

module.exports = mongoose.model('NotificationJobLog', notificationJobLogSchema);
