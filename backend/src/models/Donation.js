const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  donorName: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, default: 'INR' },
  type: { 
    type: String, 
    enum: ['general', 'feast', 'building', 'candle', 'tithe', 'special'], 
    default: 'general' 
  },
  paymentMethod: { 
    type: String, 
    enum: ['razorpay', 'upi', 'card', 'netbanking', 'wallet', 'cash', 'cheque', 'online'], 
    default: 'razorpay' 
  },
  transactionId: { type: String, trim: true },
  message: { type: String, trim: true },
  note: { type: String, trim: true },
  isAnonymous: { type: Boolean, default: false },

  // Razorpay Specific Fields
  razorpayOrderId: { type: String, index: true },
  razorpayPaymentId: { type: String, default: null },
  razorpaySignature: { type: String, default: null },

  status: { 
    type: String, 
    enum: ['created', 'pending', 'paid', 'verified', 'rejected', 'failed', 'refunded'], 
    default: 'created' 
  },
  isVerified: { type: Boolean, default: false },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidAt: { type: Date, default: null },

  // Receipt & Delivery Tracking
  receiptUrl: { type: String, default: null },
  receiptNumber: { type: String, unique: true, sparse: true, index: true },
  receiptAccessToken: { type: String, sparse: true, index: true },
  receiptSent: { type: Boolean, default: false },
  receiptSentAt: { type: Date, default: null },

  // Comprehensive Multi-Channel Notification Tracking
  notificationStatus: {
    notified: { type: Boolean, default: false },
    notifiedAt: { type: Date, default: null },
    retries: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    user: {
      email: { sent: { type: Boolean, default: false }, sentAt: Date, error: String },
      inApp: { sent: { type: Boolean, default: false }, sentAt: Date, error: String, notificationId: mongoose.Schema.Types.ObjectId },
      whatsapp: { sent: { type: Boolean, default: false }, sentAt: Date, error: String },
      push: { sent: { type: Boolean, default: false }, sentAt: Date, error: String }
    },
    admin: {
      email: { sent: { type: Boolean, default: false }, sentAt: Date, error: String },
      inApp: { sent: { type: Boolean, default: false }, sentAt: Date, error: String, notificationId: mongoose.Schema.Types.ObjectId },
      whatsapp: { sent: { type: Boolean, default: false }, sentAt: Date, error: String },
      push: { sent: { type: Boolean, default: false }, sentAt: Date, error: String }
    }
  }
}, { timestamps: true });

// Auto-sync note and message fields, receipt number, and access token
donationSchema.pre('save', function (next) {
  if (this.message && !this.note) this.note = this.message;
  if (this.note && !this.message) this.message = this.note;
  if (this.status === 'paid' || this.status === 'verified') {
    this.isVerified = true;
    if (!this.paidAt) this.paidAt = new Date();
    if (!this.receiptNumber) {
      const year = new Date(this.paidAt || Date.now()).getFullYear();
      const shortId = this._id ? this._id.toString().slice(-6).toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase();
      this.receiptNumber = `SJBC-${year}-${shortId}`;
    }
    if (!this.receiptAccessToken) {
      const crypto = require('crypto');
      this.receiptAccessToken = crypto.randomBytes(24).toString('hex');
    }
  }
  next();
});

module.exports = mongoose.model('Donation', donationSchema);
