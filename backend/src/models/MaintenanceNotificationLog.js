const mongoose = require('mongoose');

const maintenanceNotificationLogSchema = new mongoose.Schema({
  maintenanceEventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaintenanceEvent',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  channel: {
    type: String,
    enum: ['email', 'whatsapp', 'push', 'in_app'],
    required: true
  },
  status: {
    type: String,
    enum: ['sent', 'failed', 'skipped', 'pending'],
    default: 'pending'
  },
  recipient: {
    type: String // email address or phone number
  },
  sentAt: {
    type: Date
  },
  error: {
    type: String
  }
}, { timestamps: true });

// Enforce unique compound index to strictly prevent duplicate notification dispatch
maintenanceNotificationLogSchema.index(
  { maintenanceEventId: 1, userId: 1, channel: 1 },
  { unique: true }
);

module.exports = mongoose.model('MaintenanceNotificationLog', maintenanceNotificationLogSchema);
