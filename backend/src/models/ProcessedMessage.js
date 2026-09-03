const mongoose = require('mongoose');

// Dedicated TTL collection for WhatsApp Message ID Idempotency across distributed/multiple server instances
const processedMessageSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true, index: true },
  from: { type: String },
  bodyPreview: { type: String },
  processedAt: { type: Date, default: Date.now, expires: 86400 } // Automatic TTL expiration after 24 hours
}, { timestamps: true });

module.exports = mongoose.model('ProcessedMessage', processedMessageSchema);
