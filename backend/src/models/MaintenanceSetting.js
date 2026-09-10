const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  enabledBy: { type: String, default: 'System Admin' },
  enabledById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String, default: 'Scheduled System Maintenance' },
  category: { 
    type: String, 
    enum: ['Scheduled Update', 'Security Patch', 'Database Upgrade', 'Server Migration', 'Emergency Fix', 'General Maintenance'], 
    default: 'Scheduled Update' 
  },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  durationMinutes: { type: Number, default: 0 },
  emailSentCount: { type: Number, default: 0 },
  smsSentCount: { type: Number, default: 0 },
  ipAddress: { type: String, default: '127.0.0.1' },
  triggerType: { type: String, enum: ['Manual', 'Emergency', 'Scheduled'], default: 'Manual' }
}, { timestamps: true });

const maintenanceSettingSchema = new mongoose.Schema({
  key: { type: String, default: 'site_maintenance', unique: true },
  status: { type: String, enum: ['live', 'maintenance', 'emergency'], default: 'live' },
  activeEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceEvent' },
  isEnabled: { type: Boolean, default: false },
  isEmergency: { type: Boolean, default: false },
  emergencyReason: { type: String, default: '' },
  
  title: { type: String, default: 'Website Under Maintenance' },
  message: { 
    type: String, 
    default: 'We are making improvements to serve you better. Please visit again shortly.' 
  },
  category: { 
    type: String, 
    enum: ['Scheduled Update', 'Security Patch', 'Database Upgrade', 'Server Migration', 'Emergency Fix', 'General Maintenance'], 
    default: 'Scheduled Update' 
  },
  expectedCompletion: { type: Date, default: () => new Date(Date.now() + 2 * 60 * 60 * 1000) },
  showCountdown: { type: Boolean, default: true },
  
  // Access Permission Controls
  allowAdminLogin: { type: Boolean, default: true },
  allowTechTeam: { type: Boolean, default: true },
  allowContentEditors: { type: Boolean, default: false },
  allowPublic: { type: Boolean, default: false },
  
  // Contact & Social Details
  contactPhone: { type: String, default: '+91 94431 00000' },
  contactEmail: { type: String, default: 'support@stjohndebrittochurch.org' },
  socialLinks: {
    facebook: { type: String, default: 'https://facebook.com' },
    instagram: { type: String, default: 'https://instagram.com' },
    youtube: { type: String, default: 'https://youtube.com' }
  },

  // Media (Image or Video)
  mediaUrl: { type: String, default: '' },
  mediaType: { type: String, enum: ['image', 'video', 'none'], default: 'none' },

  // Pre-Maintenance Notice Banner
  noticeBanner: {
    isEnabled: { type: Boolean, default: false },
    message: { type: String, default: 'Scheduled website maintenance today.' },
    scheduledStartTime: { type: Date },
    scheduledEndTime: { type: Date },
    noticeLeadTime: { type: String, enum: ['15m', '30m', '1h', '2h', '6h', '12h', '24h'], default: '1h' }
  },

  // Scheduler Configuration
  scheduler: {
    isEnabled: { type: Boolean, default: false },
    scheduledStart: { type: Date },
    scheduledEnd: { type: Date },
    noticeLeadTime: { type: String, enum: ['15m', '30m', '1h', '2h', '6h', '12h', '24h'], default: '1h' },
    autoNotify: { type: Boolean, default: true }
  },

  noticeSentForEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceEvent' },

  // Notification Template Defaults
  notificationTemplate: {
    emailSubject: { type: String, default: "St. John de Britto's Church Website Maintenance Notice" },
    emailBody: { 
      type: String, 
      default: "Dear Parishioner,\n\nOur church website is currently undergoing scheduled maintenance to improve performance and add new features.\n\nDuring this time, the website will be temporarily unavailable.\n\nThank you for your patience.\n\nChurch Technical Team" 
    },
    smsBody: {
      type: String,
      default: "St. John de Britto's Church website is under maintenance. We will be back online shortly. Thank you."
    }
  },

  // Analytics
  accessAttemptsCount: { type: Number, default: 0 },

  // Maintenance Logs History
  history: [auditLogSchema]
}, { timestamps: true });

module.exports = mongoose.model('MaintenanceSetting', maintenanceSettingSchema);
