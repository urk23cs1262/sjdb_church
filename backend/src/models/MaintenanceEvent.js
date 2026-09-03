const mongoose = require('mongoose');

const channelDeliverySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'skipped'],
    default: 'pending'
  },
  count: {
    type: Number,
    default: 0
  },
  sentAt: {
    type: Date
  },
  error: {
    type: String
  }
}, { _id: false });

const maintenanceEventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: ['upcoming', 'maintenance', 'live', 'emergency'],
    default: 'maintenance'
  },
  previousStatus: {
    type: String,
    enum: ['live', 'maintenance', 'emergency'],
    default: 'live'
  },
  newStatus: {
    type: String,
    enum: ['live', 'maintenance', 'emergency'],
    default: 'maintenance'
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  notificationSentAt: {
    type: Date
  },
  deliveries: {
    email: { type: channelDeliverySchema, default: () => ({ status: 'pending', count: 0 }) },
    push: { type: channelDeliverySchema, default: () => ({ status: 'pending', count: 0 }) },
    inApp: { type: channelDeliverySchema, default: () => ({ status: 'pending', count: 0 }) },
    whatsApp: { type: channelDeliverySchema, default: () => ({ status: 'pending', count: 0 }) }
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  },
  enabledBy: {
    type: String,
    default: 'Admin'
  },
  enabledById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reason: {
    type: String,
    default: 'Scheduled System Maintenance'
  },
  category: {
    type: String,
    default: 'Scheduled Update'
  }
}, { timestamps: true });

module.exports = mongoose.model('MaintenanceEvent', maintenanceEventSchema);
