const mongoose = require('mongoose');

const globalOtpResetSchema = new mongoose.Schema({
  resetId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  triggeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  triggeredByAdminId: {
    type: String,
    default: null
  },
  triggeredByAdminName: {
    type: String,
    default: null
  },
  triggeredAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  verificationDeadline: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'expired'],
    default: 'active',
    index: true
  },
  totalAffectedCount: {
    type: Number,
    default: 0
  },
  verifiedCount: {
    type: Number,
    default: 0
  },
  pendingCount: {
    type: Number,
    default: 0
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('GlobalOtpReset', globalOtpResetSchema);
