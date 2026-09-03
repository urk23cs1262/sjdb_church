const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ticketNumber: { type: String, unique: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  category: { type: String, enum: ['complaint', 'enquiry', 'meeting_request', 'other'], default: 'enquiry' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  replies: [{
    from: { type: String, enum: ['user', 'admin'] },
    message: String,
    timestamp: { type: Date, default: Date.now },
    repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
}, { timestamps: true });

ticketSchema.pre('save', function(next) {
  if (!this.ticketNumber) {
    this.ticketNumber = 'TKT-' + Date.now().toString().slice(-6);
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);
