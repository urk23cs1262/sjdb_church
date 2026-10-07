const mongoose = require('mongoose');

const reminderLogSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  itemModel: { type: String, enum: ['Event', 'Announcement'], required: true },
  reminderType: {
    type: String,
    required: true
  },
  title: { type: String },
  sentCount: { type: Number, default: 0 },
  sentAt: { type: Date, default: Date.now }
}, { timestamps: true });

reminderLogSchema.index({ itemId: 1, reminderType: 1 }, { unique: true });

module.exports = mongoose.model('ReminderLog', reminderLogSchema);
