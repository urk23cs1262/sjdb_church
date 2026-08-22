const mongoose = require('mongoose');

const otpVerificationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  email: { 
    type: String, 
    lowercase: true, 
    trim: true 
  },
  phone: { 
    type: String, 
    trim: true 
  },
  purpose: { 
    type: String, 
    enum: ['login', 'registration', 'password_reset', 'profile_update', 'account_verification', 'monthly_verification'], 
    default: 'login',
    required: true
  },
  // Plain OTP is NEVER stored in database — only bcrypt hash
  otpHash: { 
    type: String, 
    required: true 
  },
  otpExpiresAt: { 
    type: Date, 
    required: true,
    index: true
  },
  verified: { 
    type: Boolean, 
    default: false,
    index: true
  },
  status: { 
    type: String, 
    enum: ['pending', 'verified', 'expired', 'replaced', 'failed'], 
    default: 'pending',
    index: true
  },
  attempts: { 
    type: Number, 
    default: 0 
  },
  notifiedExpired: { 
    type: Boolean, 
    default: false,
    index: true
  },
  lastOtpSentAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

// Compound indexes for fast lookup and cleanup
otpVerificationSchema.index({ userId: 1, purpose: 1, status: 1 });
otpVerificationSchema.index({ email: 1, purpose: 1, status: 1 });
otpVerificationSchema.index({ phone: 1, purpose: 1, status: 1 });
otpVerificationSchema.index({ otpExpiresAt: 1, status: 1, notifiedExpired: 1 });

module.exports = mongoose.model('OTPVerification', otpVerificationSchema);
