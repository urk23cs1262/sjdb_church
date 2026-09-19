const mongoose = require('mongoose');

const securityAuditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      'REGISTRATION_OTP_GENERATED',
      'REGISTRATION_OTP_VERIFIED',
      'REVERIFICATION_REQUIRED',
      'REVERIFICATION_OTP_GENERATED',
      'REVERIFICATION_OTP_VERIFIED',
      'INVALID_OTP',
      'OTP_EXPIRED',
      'OTP_RESEND',
      'GLOBAL_OTP_RESET',
      'DAILY_REMINDER_SENT',
      'NOTIFICATION_FAILURE'
    ],
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  ipAddress: {
    type: String,
    default: 'Unknown'
  },
  userAgent: {
    type: String,
    default: 'Unknown'
  },
  source: {
    type: String,
    enum: ['LOGIN', 'REGISTER', 'GLOBAL_OTP_RESET', 'CRON_JOB', 'ADMIN_ACTION', 'SYSTEM'],
    default: 'SYSTEM'
  },
  success: {
    type: Boolean,
    default: true
  },
  affectedCount: {
    type: Number,
    default: 0
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

securityAuditLogSchema.index({ eventType: 1, timestamp: -1 });
securityAuditLogSchema.index({ userId: 1, eventType: 1 });

module.exports = mongoose.model('SecurityAuditLog', securityAuditLogSchema);
