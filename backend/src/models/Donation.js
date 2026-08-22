const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  donorName: { type: String },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['general', 'feast', 'building', 'candle', 'tithe', 'special'], default: 'general' },
  paymentMethod: { type: String, enum: ['upi', 'cash', 'cheque', 'online'], default: 'upi' },
  transactionId: { type: String },
  note: { type: String },
  isAnonymous: { type: Boolean, default: false },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  isVerified: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Donation', donationSchema);
