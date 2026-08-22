const mongoose = require('mongoose');

const permissionRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'expired'], 
    default: 'pending' 
  },
  reason: { type: String, required: true, trim: true },
  requestedChanges: { type: Object, required: true }, // { "notifications.eventReminders": { label: "Event Reminders", old: true, new: false } }
  approvedAt: { type: Date },
  rejectedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('PermissionRequest', permissionRequestSchema);
