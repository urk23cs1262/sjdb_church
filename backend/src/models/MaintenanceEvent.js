const mongoose = require('mongoose');

const channelDeliverySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'skipped', 'in_progress'],
    default: 'pending'
  },
  sentCount: {
    type: Number,
    default: 0
  },
  failedCount: {
    type: Number,
    default: 0
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
  cycleId: {
    type: String,
    index: true
  },
  eventType: {
    type: String,
    enum: ['PRE_MAINTENANCE', 'MAINTENANCE_STARTED', 'MAINTENANCE_COMPLETED', 'EMERGENCY', 'upcoming', 'maintenance', 'live', 'emergency'],
    default: 'MAINTENANCE_STARTED',
    index: true
  },
  status: {
    type: String,
    enum: ['SCHEDULED', 'DISPATCHING', 'DISPATCH_COMPLETE', 'PARTIALLY_COMPLETE', 'FAILED', 'CANCELLED'],
    default: 'SCHEDULED'
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
    email: { type: channelDeliverySchema, default: () => ({ status: 'pending', sentCount: 0, failedCount: 0, count: 0 }) },
    push: { type: channelDeliverySchema, default: () => ({ status: 'pending', sentCount: 0, failedCount: 0, count: 0 }) },
    inApp: { type: channelDeliverySchema, default: () => ({ status: 'pending', sentCount: 0, failedCount: 0, count: 0 }) },
    whatsApp: { type: channelDeliverySchema, default: () => ({ status: 'pending', sentCount: 0, failedCount: 0, count: 0 }) }
  },
  metadata: {
    startTime: { type: Date },
    endTime: { type: Date },
    expectedCompletion: { type: Date },
    bannerMessage: { type: String },
    noticeLeadTime: { type: String }
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
