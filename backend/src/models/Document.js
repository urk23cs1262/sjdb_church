const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['baptism', 'marriage', 'confirmation', 'family_card', 'parish_membership', 'death'],
    required: true,
  },
  requestDetails: { type: String },
  status: { type: String, enum: ['pending', 'processing', 'approved', 'rejected'], default: 'pending' },
  uploadedFile: { type: String },
  adminNote: { type: String },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
