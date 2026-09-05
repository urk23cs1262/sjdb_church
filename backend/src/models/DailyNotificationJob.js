const mongoose = require('mongoose');

/**
 * DailyNotificationJob Schema — SJDB Connect
 * 
 * Tracks the overall daily Catholic notification job at 04:00 AM IST.
 * Provides distributed locking and job-level idempotency to prevent duplicate runs across instances.
 */
const dailyNotificationJobSchema = new mongoose.Schema({
  jobId: {
    type: String, // e.g. "daily_catholic_job_2026_09_05"
    required: true,
    unique: true,
    index: true
  },
  notificationDate: {
    type: String, // "YYYY-MM-DD" in Asia/Kolkata
    required: true,
    unique: true,
    index: true
  },
  scheduledAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  startedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'partial', 'failed'],
    default: 'pending',
    index: true
  },
  triggerType: {
    type: String,
    enum: ['cron_scheduler', 'external_webhook', 'admin_manual', 'recovery', 'downtime_recovery', 'crash_recovery', 'watchdog_recovery'],
    default: 'cron_scheduler'
  },
  totalRecipients: {
    type: Number,
    default: 0
  },
  whatsappTotal: {
    type: Number,
    default: 0
  },
  whatsappSent: {
    type: Number,
    default: 0
  },
  whatsappFailed: {
    type: Number,
    default: 0
  },
  emailTotal: {
    type: Number,
    default: 0
  },
  emailSent: {
    type: Number,
    default: 0
  },
  emailFailed: {
    type: Number,
    default: 0
  },
  inAppTotal: {
    type: Number,
    default: 0
  },
  inAppSent: {
    type: Number,
    default: 0
  },
  pushTotal: {
    type: Number,
    default: 0
  },
  pushSent: {
    type: Number,
    default: 0
  },
  error: {
    type: String,
    default: null
  },
  lockedBy: {
    type: String, // Worker process ID or instance ID
    default: null
  },
  lockedAt: {
    type: Date,
    default: null
  },
  summary: {
    bibleRef: String,
    saintName: String,
    massTitle: String,
    saintImageUrl: String
  },
  logs: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    message: String
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('DailyNotificationJob', dailyNotificationJobSchema);
