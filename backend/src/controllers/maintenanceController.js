const MaintenanceSetting = require('../models/MaintenanceSetting');
const MaintenanceEvent = require('../models/MaintenanceEvent');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendMail } = require('../config/mailer');
const { setSystemState, getSystemState, getOrCreateSettings, updateCacheFromSettings } = require('../services/systemStateService');

const {
  dispatchPreMaintenanceEvent,
  getEventRealDeliveryMetrics
} = require('../services/maintenanceNotificationService');

// Backward-compatible wrapper for dispatchPreMaintenanceNotice
const dispatchPreMaintenanceNotice = async (settings, options = {}) => {
  return await dispatchPreMaintenanceEvent({
    settings,
    changedBy: options.changedBy || 'Admin',
    changedById: options.changedById || null
  });
};

// Backward-compatible alias for transitionMaintenanceState -> delegates to setSystemState
const transitionMaintenanceState = async (newStatus, options = {}) => {
  return await setSystemState(newStatus, options);
};

// POST /api/maintenance/showcase-banner — Showcase notice banner & dispatch pre-notice notifications
const showcaseNoticeBanner = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

    if (!settings.noticeBanner) settings.noticeBanner = {};
    if (req.body.message) settings.noticeBanner.message = req.body.message;
    if (req.body.scheduledStartTime) settings.noticeBanner.scheduledStartTime = req.body.scheduledStartTime;
    if (req.body.scheduledEndTime) settings.noticeBanner.scheduledEndTime = req.body.scheduledEndTime;
    if (req.body.noticeLeadTime) settings.noticeBanner.noticeLeadTime = req.body.noticeLeadTime;
    settings.noticeBanner.isEnabled = true;

    await settings.save();
    updateCacheFromSettings(settings);

    const result = await dispatchPreMaintenanceEvent({
      settings,
      changedBy: req.user ? (req.user.name || req.user.email) : 'Admin',
      changedById: req.user ? req.user._id : null
    });

    res.json({
      success: true,
      message: 'Pre-Maintenance Notice Banner is now Showcase Live!',
      settings: result?.settings || settings,
      event: result?.event || null
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/maintenance/status — Public maintenance status (Read-only)
const getPublicStatus = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

    const isLive = settings.status === 'live';
    const isMaintenance = settings.status === 'maintenance';
    const isEmergency = settings.status === 'emergency';

    res.json({
      success: true,
      status: settings.status || 'live',
      isEnabled: !isLive,
      isEmergency: isEmergency,
      emergencyReason: settings.emergencyReason,
      title: settings.title,
      message: settings.message,
      category: settings.category,
      expectedCompletion: settings.expectedCompletion,
      showCountdown: settings.showCountdown,
      contactPhone: settings.contactPhone,
      contactEmail: settings.contactEmail,
      socialLinks: settings.socialLinks,
      mediaUrl: settings.mediaUrl,
      mediaType: settings.mediaType,
      noticeBanner: settings.noticeBanner,
      scheduler: settings.scheduler,
      allowAdminLogin: settings.allowAdminLogin,
      allowTechTeam: settings.allowTechTeam,
      allowContentEditors: settings.allowContentEditors,
      allowPublic: settings.allowPublic
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/maintenance/settings — Admin/Tech team settings view with real metrics
const getMaintenanceSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    let activeEvent = null;
    if (settings.activeEventId) {
      activeEvent = await MaintenanceEvent.findById(settings.activeEventId).lean();
    } else {
      activeEvent = await MaintenanceEvent.findOne().sort({ createdAt: -1 }).lean();
    }

    if (activeEvent) {
      const realMetrics = await getEventRealDeliveryMetrics(activeEvent._id);
      if (realMetrics) {
        activeEvent.realDeliveryMetrics = realMetrics;
        if (!activeEvent.deliveries) activeEvent.deliveries = {};
        activeEvent.deliveries.email = {
          ...(activeEvent.deliveries.email || {}),
          sentCount: realMetrics.email.sent,
          failedCount: realMetrics.email.failed,
          count: realMetrics.email.sent,
          status: realMetrics.email.sent > 0 ? 'sent' : (realMetrics.email.failed > 0 ? 'failed' : 'pending')
        };
        activeEvent.deliveries.whatsApp = {
          ...(activeEvent.deliveries.whatsApp || {}),
          sentCount: realMetrics.whatsapp.sent,
          failedCount: realMetrics.whatsapp.failed,
          count: realMetrics.whatsapp.sent,
          status: realMetrics.whatsapp.sent > 0 ? 'sent' : (realMetrics.whatsapp.failed > 0 ? 'failed' : 'pending')
        };
        activeEvent.deliveries.push = {
          ...(activeEvent.deliveries.push || {}),
          sentCount: realMetrics.push.sent,
          failedCount: realMetrics.push.failed,
          count: realMetrics.push.sent,
          status: realMetrics.push.sent > 0 ? 'sent' : 'pending'
        };
        activeEvent.deliveries.inApp = {
          ...(activeEvent.deliveries.inApp || {}),
          sentCount: realMetrics.in_app.sent,
          failedCount: realMetrics.in_app.failed,
          count: realMetrics.in_app.sent,
          status: realMetrics.in_app.sent > 0 ? 'sent' : 'pending'
        };
      }
    }

    res.json({ success: true, settings, activeEvent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/maintenance/toggle — Toggle maintenance mode ON/OFF
const toggleMaintenanceMode = async (req, res) => {
  try {
    const { isEnabled, reason, category } = req.body;
    const targetStatus = isEnabled ? 'maintenance' : 'live';

    const result = await setSystemState(targetStatus, {
      reason: reason || (isEnabled ? 'Manual Maintenance Mode Enabled' : 'Manual End Maintenance'),
      category: category || 'General Maintenance',
      changedBy: req.user ? (req.user.name || req.user.email) : 'Admin',
      changedById: req.user ? req.user._id : null
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/maintenance/emergency — Trigger Emergency Shutdown
const triggerEmergencyShutdown = async (req, res) => {
  try {
    const { reason, category } = req.body;

    const result = await setSystemState('emergency', {
      reason: reason || 'Emergency System Lockdown',
      category: category || 'Emergency Fix',
      changedBy: req.user ? (req.user.name || req.user.email) : 'System Admin',
      changedById: req.user ? req.user._id : null
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/maintenance/settings — Update maintenance configuration
const updateMaintenanceSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

    const allowedFields = [
      'title', 'message', 'category', 'expectedCompletion', 'showCountdown',
      'allowAdminLogin', 'allowTechTeam', 'allowContentEditors', 'allowPublic',
      'contactPhone', 'contactEmail', 'socialLinks', 'mediaUrl', 'mediaType',
      'noticeBanner', 'scheduler', 'notificationTemplate'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        settings[field] = req.body[field];
      }
    });

    await settings.save();
    updateCacheFromSettings(settings);

    res.json({
      success: true,
      message: 'Maintenance settings saved successfully',
      settings
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/maintenance/notify — Manually dispatch notifications from Admin UI
const sendMaintenanceNotices = async (req, res) => {
  try {
    const { channels, recipients, emailSubject, emailBody, smsBody } = req.body;
    const settings = await getOrCreateSettings();

    let userQuery = {};
    if (!recipients.includes('all')) {
      const roleConditions = [];
      if (recipients.includes('members')) roleConditions.push({ memberStatus: 'Active' });
      if (recipients.includes('leaders')) roleConditions.push({ familyRole: 'Head' });
      if (recipients.includes('techTeam')) roleConditions.push({ role: { $in: ['admin', 'priest', 'staff'] } });

      if (roleConditions.length > 0) {
        userQuery = { $or: roleConditions };
      }
    }

    const targetUsers = await User.find(userQuery).select('name email phone role');

    let emailSuccessCount = 0;
    let smsSuccessCount = 0;

    const formattedCompletion = settings.expectedCompletion
      ? new Date(settings.expectedCompletion).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }) + ' IST'
      : 'Shortly';

    const finalEmailSubject = emailSubject || settings.notificationTemplate?.emailSubject || 'Church Website Maintenance Notice';
    const rawEmailBody = emailBody || settings.notificationTemplate?.emailBody || 'Church Website Maintenance Notice';
    const finalEmailBody = rawEmailBody.replace(/\{EXPECTED_COMPLETION\}/g, formattedCompletion);

    if (channels.email && targetUsers.length > 0) {
      for (const u of targetUsers) {
        if (u.email) {
          try {
            await sendMail({
              to: u.email,
              subject: finalEmailSubject,
              text: finalEmailBody
            });
            emailSuccessCount++;
          } catch (e) {
            console.error(`Email dispatch error for ${u.email}:`, e.message);
          }
        }
      }
    }

    if (channels.sms || channels.push) {
      smsSuccessCount = targetUsers.length;
      const notifications = targetUsers.map(u => ({
        userId: u._id,
        title: ' Church Website Maintenance Notice',
        message: smsBody || settings.notificationTemplate?.smsBody || 'Website maintenance in progress.',
        type: 'announcement',
        priority: 'high'
      }));
      await Notification.insertMany(notifications);
    }

    res.json({
      success: true,
      message: `Notifications dispatched successfully! (${emailSuccessCount} Email, ${smsSuccessCount} In-App/SMS)`,
      stats: {
        totalTargets: targetUsers.length,
        emailSuccessCount,
        smsSuccessCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/maintenance/history — Fetch maintenance events audit trail & analytics
const getMaintenanceHistory = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const history = await MaintenanceEvent.find().sort({ startedAt: -1 }).limit(100);

    res.json({
      success: true,
      history,
      analytics: {
        accessAttemptsCount: settings.accessAttemptsCount || 0,
        totalMaintenanceSessions: history.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/maintenance/track-attempt — Track public access attempt during maintenance
const trackAccessAttempt = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    if (settings.status !== 'live') {
      settings.accessAttemptsCount = (settings.accessAttemptsCount || 0) + 1;
      await settings.save();
      updateCacheFromSettings(settings);
    }
    res.json({ success: true, count: settings.accessAttemptsCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getPublicStatus,
  getMaintenanceSettings,
  toggleMaintenanceMode,
  triggerEmergencyShutdown,
  updateMaintenanceSettings,
  sendMaintenanceNotices,
  getMaintenanceHistory,
  trackAccessAttempt,
  transitionMaintenanceState,
  dispatchPreMaintenanceNotice,
  showcaseNoticeBanner
};
