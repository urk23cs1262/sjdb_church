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

  // Receipt & Email Delivery Tracking
  receiptUrl: { type: String, default: null },
  receiptSent: { type: Boolean, default: false },
  receiptSentAt: { type: Date, default: null },
}, { timestamps: true });

// Auto-sync note and message fields
donationSchema.pre('save', function (next) {
  if (this.message && !this.note) this.note = this.message;
  if (this.note && !this.message) this.message = this.note;
  if (this.status === 'paid' || this.status === 'verified') {
    this.isVerified = true;
    if (!this.paidAt) this.paidAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Donation', donationSchema);
