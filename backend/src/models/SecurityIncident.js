const mongoose = require('mongoose');

const securityIncidentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String },
  userEmail: { type: String },
  userPhone: { type: String },

  // Incident Classification
  type: {
    type: String,
    enum: ['unauthorized_login_reported', 'suspicious_activity', 'multiple_failed_logins', 'brute_force_suspension', 'brute_force_lockout'],
    default: 'unauthorized_login_reported'
  },
  status: {
    type: String,
    enum: ['Awaiting Review', 'Investigating', 'Resolved', 'Dismissed', 'Reactivated'],
    default: 'Awaiting Review'
  },

  // Audit Metrics
  failedAttempts: { type: Number, default: 0 },
  threshold: { type: Number, default: 10 },
  firstFailedAttempt: { type: Date },
  lastFailedAttempt: { type: Date },

  // Login session snapshot
  loginTime: { type: Date, default: Date.now },
  device: { type: String, default: 'Desktop / Mobile' },
  browser: { type: String, default: 'Web Browser' },
  os: { type: String, default: 'Windows / Android / iOS' },
  ipAddress: { type: String, default: '103.45.23.12' },
  location: { type: String, default: 'Coimbatore, Tamil Nadu, India' },
  loginMethod: { type: String, default: 'Password / OTP' },

  // Security actions taken
  actionsTaken: [{ type: String }],
  reportToken: { type: String },
  reportedAt: { type: Date, default: Date.now },

  // Reactivation Audit
  adminWhoReactivated: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reactivationTime: { type: Date },
  adminNotes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('SecurityIncident', securityIncidentSchema);
