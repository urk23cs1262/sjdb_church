const mongoose = require('mongoose');

const violationIncidentSchema = new mongoose.Schema({
  messageId: { type: String, default: null },
  messageText: { type: String, required: true },
  matchedWords: [{ type: String }],
  severity: { type: Number, enum: [1, 2, 3], default: 2 }, // 1: Mild, 2: Standard, 3: Extreme
  warningSent: { type: String, default: null },
  timestamp: { type: Date, default: Date.now }
}, { _id: true });

const restorationAuditSchema = new mongoose.Schema({
  restoredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  restoredByName: { type: String, default: 'Parish Administrator' },
  restoredAt: { type: Date, default: Date.now },
  restoreReason: { type: String, default: 'Restored by parish administrator upon review' },
  previousStatus: { type: String, default: 'blocked' },
  strikesAtRestore: { type: Number, default: 0 }
}, { _id: true });

const userModerationSchema = new mongoose.Schema({
  // Authoritative identity: canonical E.164 phone number (e.g. "+919876543210")
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  // Optional link to website User account
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  whatsappDisplayName: {
    type: String,
    trim: true,
    default: ''
  },
  violationCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastViolationAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'warning', 'blocked'],
    default: 'active',
    index: true
  },
  blockedAt: {
    type: Date,
    default: null
  },
  blockedReason: {
    type: String,
    trim: true,
    default: null
  },
  unblockedAt: {
    type: Date,
    default: null
  },
  unblockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  violations: [violationIncidentSchema],
  restorationHistory: [restorationAuditSchema]
}, {
  timestamps: true
});

userModerationSchema.index({ status: 1, lastViolationAt: -1 });

module.exports = mongoose.model('UserModeration', userModerationSchema);
