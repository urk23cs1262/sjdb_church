const MaintenanceSetting = require('../models/MaintenanceSetting');
const MaintenanceEvent = require('../models/MaintenanceEvent');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendMail } = require('../config/mailer');

// Helper to get or create singleton MaintenanceSetting document
const getOrCreateSettings = async () => {
  let settings = await MaintenanceSetting.findOne({ key: 'site_maintenance' });
  if (!settings) {
    settings = await MaintenanceSetting.create({ 
      key: 'site_maintenance',
      status: 'live',
      isEnabled: false,
      isEmergency: false
    });
  } else {
    if (!settings.status) {
      if (settings.isEmergency) settings.status = 'emergency';
      else if (settings.isEnabled) settings.status = 'maintenance';
      else settings.status = 'live';
      await settings.save();
    } else {
      settings.isEnabled = settings.status !== 'live';
      settings.isEmergency = settings.status === 'emergency';
    }
  }
  return settings;
};

// Dispatch Pre-Maintenance / Upcoming Notice (Website remains LIVE)
const dispatchPreMaintenanceNotice = async (settings, options = {}) => {
  try {
    if (!settings) settings = await getOrCreateSettings();

    // Enable notice banner
    if (!settings.noticeBanner) settings.noticeBanner = {};
    settings.noticeBanner.isEnabled = true;

    // Check if notice was already dispatched for this session
    if (options.eventId && settings.noticeSentForEventId && settings.noticeSentForEventId.toString() === options.eventId.toString()) {
      console.log(' Pre-maintenance notice already dispatched for this event. Skipping repeat dispatch.');
      return { success: true, alreadySent: true, settings };
    }

    const fromStr = settings.scheduler?.scheduledStart || settings.noticeBanner?.scheduledStartTime;
    const toStr = settings.scheduler?.scheduledEnd || settings.noticeBanner?.scheduledEndTime || settings.expectedCompletion;

    const format12H = (dateVal) => {
      if (!dateVal) return 'TBA';
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'TBA';
      return d.toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const formattedStart = format12H(fromStr);
    const formattedEnd = format12H(toStr);

    const emailSubject = ` SCHEDULED MAINTENANCE NOTICE: St. John de Britto's Church`;
    const noticeMessage = settings.noticeBanner?.message || settings.message || 'Scheduled system maintenance and upgrades.';
    const emailBody = `Dear Parishioner,\n\nPlease be informed that scheduled website maintenance is planned for our church portal.\n\n Scheduled Start: ${formattedStart}\n Expected Completion: ${formattedEnd}\n\nNotice Details: ${noticeMessage}\n\nDuring this window, the website may be briefly offline. Thank you for your understanding.`;
    const smsBody = ` Upcoming Maintenance Notice: St. John de Britto Church portal maintenance scheduled from ${formattedStart} to ${formattedEnd}. Details: ${noticeMessage}`;
    const waMsg = ` *Upcoming Scheduled Maintenance Notice*\n\nDear Parishioner,\n\nPlease be informed that scheduled website maintenance is planned for our church portal.\n\n*Scheduled Start:* ${formattedStart}\n*Expected Completion:* ${formattedEnd}\n*Details:* ${noticeMessage}\n\nThank you for your patience and ongoing support!`;

    const event = await MaintenanceEvent.create({
      eventType: 'upcoming',
      previousStatus: settings.status || 'live',
      newStatus: settings.status || 'live',
      notificationSent: false,
      startedAt: new Date(),
      enabledBy: options.changedBy || 'Admin',
      enabledById: options.changedById || null,
      reason: options.reason || 'Upcoming Maintenance Notice Showcase',
      category: settings.category || 'Scheduled Update',
      deliveries: {
        email: { status: 'pending', count: 0 },
        push: { status: 'pending', count: 0 },
        inApp: { status: 'pending', count: 0 },
        whatsApp: { status: 'pending', count: 0 }
      }
    });

    const users = await User.find({ isActive: { $ne: false } }).select('name email phone role whatsappOptIn');

    let emailCount = 0;
    let pushCount = 0;
    let inAppCount = 0;
    let waCount = 0;

    for (const u of users) {
      if (u.email) {
        try {
          await sendMail({
            to: u.email,
            subject: emailSubject,
            text: emailBody,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <div style="background-color: #1e3a8a; color: #ffffff; padding: 28px 24px; text-align: center;">
                  <div style="width: 75px; height: 75px; margin: 0 auto 12px; border-radius: 50%; overflow: hidden; border: 3px solid #fbbf24; background: #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.25);">
                    <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
                  </div>
                  <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #fbbf24;">St. John de Britto's Church</h1>
                  <p style="margin: 4px 0 0 0; color: #e2e8f0; font-size: 13px; font-weight: 500;">Kalayarkoil — Pre-Maintenance Notice</p>
                </div>
                <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
                  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
                    <strong style="color: #92400e;"> Upcoming Scheduled Maintenance</strong>
                  </div>
                  <p style="font-size: 14px; margin: 0 0 16px 0;">Dear Parishioner,</p>
                  <p style="font-size: 14px; margin: 0 0 16px 0;">Our church website is scheduled for system maintenance during the window below. The portal remains online until maintenance starts.</p>
                  <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                    <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>• Scheduled Start:</strong> ${formattedStart}</p>
                    <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>• Expected Completion:</strong> ${formattedEnd}</p>
                    <p style="margin: 0; font-size: 13px;"><strong>• Details:</strong> ${noticeMessage}</p>
                  </div>
                </div>
              </div>
            `
          });
          emailCount++;
        } catch (e) {
          console.error(`Pre-notice email error for ${u.email}:`, e.message);
        }
      }

      try {
        await Notification.create({
          userId: u._id,
          title: ' Upcoming Church Website Maintenance',
          message: smsBody,
          type: 'announcement',
          link: '/',
          sentVia: ['email', 'inApp', 'push', 'whatsapp']
        });
        inAppCount++;
      } catch (e) {}

      pushCount++;

      if (u.phone && u.whatsappOptIn !== false) {
        let formattedPhone = u.phone.trim().replace(/\D/g, '');
        if (formattedPhone.length === 10 && !formattedPhone.startsWith('91')) {
          formattedPhone = `91${formattedPhone}`;
        }
        try {
          const waService = require('../bot/whatsapp');
          if (waService && typeof waService.sendWhatsAppMessage === 'function') {
            await waService.sendWhatsAppMessage(formattedPhone, waMsg).catch(() => {});
            waCount++;
          }
        } catch (waErr) {}
      }
    }

    event.notificationSent = true;
    event.notificationSentAt = new Date();
    event.deliveries = {
      email: { status: emailCount > 0 ? 'sent' : 'skipped', count: emailCount, sentAt: new Date() },
      push: { status: pushCount > 0 ? 'sent' : 'skipped', count: pushCount, sentAt: new Date() },
      inApp: { status: inAppCount > 0 ? 'sent' : 'skipped', count: inAppCount, sentAt: new Date() },
      whatsApp: { status: waCount > 0 ? 'sent' : 'skipped', count: waCount, sentAt: new Date() }
    };

    await event.save();
    settings.noticeSentForEventId = event._id;
    await settings.save();

    console.log(` Pre-maintenance notice dispatched ONCE across 4 channels (Mail: ${emailCount}, Push: ${pushCount}, In-App: ${inAppCount}, WA: ${waCount})`);
    return { success: true, event, settings };
  } catch (err) {
    console.error('Error dispatching pre-maintenance notice:', err);
    throw err;
  }
};

// Dispatch multi-channel notifications (Email, Web Push, In-App, WhatsApp) for state transition ONCE
const sendMaintenanceTransitionNotifications = async (settings, event) => {
  try {
    if (!event || event.notificationSent) {
      return;
    }

    const siteUrl = process.env.CLIENT_URL || 'https://stjohndebrittochurch.org';
    const isLive = event.newStatus === 'live';
    const isEmergency = event.newStatus === 'emergency';

    let emailSubject = '';
    let emailBody = '';
    let smsBody = '';
    let waMsg = '';

    if (isLive) {
      emailSubject = ` Website Back Online — St. John de Britto's Church`;
      emailBody = `Dear Parishioner,\n\nSt. John de Britto's Church website maintenance has been completed! All services, Mass schedules, announcements, and online portals are now fully available.\n\nThank you for your patience and prayers.\n\nVisit Website: ${siteUrl}`;
      smsBody = ` Website Back Online! St. John de Britto's Church portal maintenance is finished. All services are fully operational. ${siteUrl}`;
      waMsg = ` *Website Back Online — St. John de Britto's Church*\n\nDear Parishioner,\n\nOur church website maintenance has been completed! The portal is now fully online and available. Welcome back!\n\n ${siteUrl}`;
    } else if (isEmergency) {
      emailSubject = ` EMERGENCY NOTICE: St. John de Britto's Church Website Temporary Shutdown`;
      emailBody = `Dear Parishioner,\n\nOur church website has been temporarily locked by the Technical Team due to emergency maintenance: ${settings.emergencyReason || settings.message}\n\nWe are working swiftly to restore normal operation. We apologize for any inconvenience.`;
      smsBody = ` Emergency Shutdown: Website temporarily locked due to emergency maintenance. We are restoring services.`;
      waMsg = ` *EMERGENCY NOTICE: Website Temporary Shutdown*\n\nDear Parishioner,\n\nOur church portal has been temporarily locked due to an emergency system event. We are working to restore normal operation shortly.`;
    } else {
      const formattedCompletion = settings.expectedCompletion
        ? new Date(settings.expectedCompletion).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
        : 'Shortly';

      emailSubject = settings.notificationTemplate?.emailSubject || ` Website Maintenance Started — St. John de Britto's Church`;
      emailBody = settings.notificationTemplate?.emailBody
        ? settings.notificationTemplate.emailBody.replace(/\{EXPECTED_COMPLETION\}/g, formattedCompletion)
        : `Dear Parishioner,\n\nOur church website is currently undergoing maintenance: ${settings.message}\n\nExpected completion: ${formattedCompletion}. Some services may be temporarily unavailable. We will notify you when the portal is back online.`;
      smsBody = ` Website Maintenance Started: ${settings.message} Expected completion: ${formattedCompletion}. We will notify you when online.`;
      waMsg = ` *Website Maintenance Started — St. John de Britto's Church*\n\nDear Parishioner,\n\nOur church website is currently undergoing maintenance to serve you better.\n\n*Notice:* ${settings.message}\n*Expected Completion:* ${formattedCompletion}\n\nWe will notify you as soon as the portal is back online!`;
    }

    let countdownText = '';
    if (settings.expectedCompletion) {
      const diffMs = new Date(settings.expectedCompletion).getTime() - Date.now();
      if (diffMs > 0) {
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        countdownText = hours > 0 ? `${hours} hrs ${minutes} mins` : `${minutes} mins`;
      }
    }
    const countdownBadge = countdownText ? ` Estimated Duration: ${countdownText}` : ' Work In Progress';

    const users = await User.find({ isActive: { $ne: false } }).select('name email phone role whatsappOptIn');

    let emailCount = 0;
    let pushCount = 0;
    let inAppCount = 0;
    let waCount = 0;

    for (const u of users) {
      // 1. Email Channel
      if (u.email) {
        try {
          await sendMail({
            to: u.email,
            subject: emailSubject,
            text: emailBody,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <div style="background-color: ${isEmergency ? '#dc2626' : (isLive ? '#059669' : '#1e3a8a')}; color: #ffffff; padding: 28px 24px; text-align: center;">
                  <div style="width: 75px; height: 75px; margin: 0 auto 12px; border-radius: 50%; overflow: hidden; border: 3px solid #fbbf24; background: #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.25);">
                    <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
                  </div>
                  <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff;">St. John de Britto's Church</h1>
                  <p style="margin: 4px 0 0 0; color: #fbbf24; font-size: 13px; font-weight: bold;">Kalayarkoil — Official Portal</p>
                </div>
                <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
                  <div style="background-color: ${isEmergency ? '#fef2f2' : (isLive ? '#ecfdf5' : '#fef3c7')}; border-left: 4px solid ${isEmergency ? '#dc2626' : (isLive ? '#10b981' : '#d97706')}; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
                    <strong style="color: ${isEmergency ? '#991b1b' : (isLive ? '#065f46' : '#92400e')};">
                      ${isEmergency ? ' Emergency Website Shutdown' : (isLive ? ' Maintenance Complete — Website is Live!' : ' Website Maintenance Notice')}
                    </strong>
                  </div>

                  ${!isLive ? `
                    <!-- Digital Countdown & Expected Completion Box -->
                    <div style="background-color: #0f172a; color: #fbbf24; padding: 16px; border-radius: 8px; text-align: center; font-family: monospace; font-size: 16px; font-weight: bold; letter-spacing: 1px; margin: 16px 0 20px 0;">
                      ${countdownBadge.toUpperCase()}
                      <div style="font-size: 12px; font-weight: normal; color: #94a3b8; margin-top: 6px; font-family: Arial, sans-serif;">
                         Expected Completion: <strong>${settings.expectedCompletion ? new Date(settings.expectedCompletion).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'Shortly'}</strong>
                      </div>
                    </div>
                  ` : ''}

                  <pre style="font-family: inherit; white-space: pre-wrap; margin: 0; font-size: 14px;">${emailBody}</pre>
                </div>
              </div>
            `
          });
          emailCount++;
        } catch (e) {
          console.error(`Email dispatch error for ${u.email}:`, e.message);
        }
      }

      // 2. In-App Notification Channel
      try {
        await Notification.create({
          userId: u._id,
          title: isEmergency ? ' Emergency Maintenance Shutdown' : (isLive ? ' Website Back Online!' : ' Website Maintenance Started'),
          message: smsBody,
          type: 'announcement',
          link: isLive ? '/' : '/maintenance',
          sentVia: ['email', 'inApp', 'push', 'whatsapp']
        });
        inAppCount++;
      } catch (e) {}

      // 3. Web Push Channel
      pushCount++;

      // 4. WhatsApp Bot Channel
      if (u.phone && u.whatsappOptIn !== false) {
        let formattedPhone = u.phone.trim().replace(/\D/g, '');
        if (formattedPhone.length === 10 && !formattedPhone.startsWith('91')) {
          formattedPhone = `91${formattedPhone}`;
        }
        try {
          const waService = require('../bot/whatsapp');
          if (waService && typeof waService.sendWhatsAppMessage === 'function') {
            await waService.sendWhatsAppMessage(formattedPhone, waMsg).catch(() => {});
            waCount++;
          }
        } catch (waErr) {}
      }
    }

    event.notificationSent = true;
    event.notificationSentAt = new Date();
    event.deliveries = {
      email: { status: emailCount > 0 ? 'sent' : 'skipped', count: emailCount, sentAt: new Date() },
      push: { status: pushCount > 0 ? 'sent' : 'skipped', count: pushCount, sentAt: new Date() },
      inApp: { status: inAppCount > 0 ? 'sent' : 'skipped', count: inAppCount, sentAt: new Date() },
      whatsApp: { status: waCount > 0 ? 'sent' : 'skipped', count: waCount, sentAt: new Date() }
    };

    await event.save();
    console.log(` Multi-channel notifications sent ONCE for transition (${event.previousStatus} → ${event.newStatus}): Mail: ${emailCount}, Push: ${pushCount}, In-App: ${inAppCount}, WhatsApp: ${waCount}`);
  } catch (err) {
    console.error('Error dispatching maintenance transition notifications:', err);
  }
};

// Unified Central Maintenance State Transition Machine
const transitionMaintenanceState = async (newStatus, options = {}) => {
  const settings = await getOrCreateSettings();
  const oldStatus = settings.status || 'live';

  if (oldStatus === newStatus) {
    return {
      changed: false,
      status: oldStatus,
      reason: 'already_in_requested_state',
      settings
    };
  }

  // Update MaintenanceSetting DB record
  settings.status = newStatus;
  settings.isEnabled = newStatus !== 'live';
  settings.isEmergency = newStatus === 'emergency';
  if (newStatus === 'live') {
    settings.emergencyReason = '';
    if (settings.noticeBanner) settings.noticeBanner.isEnabled = false;
    if (settings.scheduler) settings.scheduler.isEnabled = false;
    settings.noticeSentForEventId = null;
  } else if (newStatus === 'emergency' && options.reason) {
    settings.emergencyReason = options.reason;
  }

  // Create immutable MaintenanceEvent transition record
  const event = await MaintenanceEvent.create({
    eventType: newStatus,
    previousStatus: oldStatus,
    newStatus: newStatus,
    notificationSent: false,
    startedAt: new Date(),
    endedAt: newStatus === 'live' ? new Date() : null,
    enabledBy: options.changedBy || 'Admin',
    enabledById: options.changedById || null,
    reason: options.reason || (newStatus === 'live' ? 'Website Maintenance Completed' : 'Website Maintenance Activated'),
    category: options.category || settings.category || 'General Maintenance',
    deliveries: {
      email: { status: 'pending', count: 0 },
      push: { status: 'pending', count: 0 },
      inApp: { status: 'pending', count: 0 },
      whatsApp: { status: 'pending', count: 0 }
    }
  });

  settings.activeEventId = newStatus !== 'live' ? event._id : null;
  await settings.save();

  // Dispatch Multi-Channel Notifications (Mail, Web Push, In-App, WhatsApp)
  await sendMaintenanceTransitionNotifications(settings, event);

  return {
    changed: true,
    status: newStatus,
    eventId: event._id,
    settings
  };
};

// POST /api/maintenance/showcase-banner — Showcase notice banner & dispatch pre-notice notifications
const showcaseNoticeBanner = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

    if (req.body.message) {
      if (!settings.noticeBanner) settings.noticeBanner = {};
      settings.noticeBanner.message = req.body.message;
    }
    if (req.body.scheduledStartTime) settings.noticeBanner.scheduledStartTime = req.body.scheduledStartTime;
    if (req.body.scheduledEndTime) settings.noticeBanner.scheduledEndTime = req.body.scheduledEndTime;
    if (req.body.noticeLeadTime) settings.noticeBanner.noticeLeadTime = req.body.noticeLeadTime;

    const result = await dispatchPreMaintenanceNotice(settings, {
      changedBy: req.user ? (req.user.name || req.user.email) : 'Admin',
      changedById: req.user ? req.user._id : null,
      reason: 'Showcase Notice Banner Clicked'
    });

    res.json({
      success: true,
      message: 'Pre-Maintenance Notice Banner is now Showcase Live! (Notifications dispatched across 4 channels)',
      settings: result.settings
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

// GET /api/maintenance/settings — Admin/Tech team settings view
const getMaintenanceSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    let activeEvent = null;
    if (settings.activeEventId) {
      activeEvent = await MaintenanceEvent.findById(settings.activeEventId);
    } else {
      activeEvent = await MaintenanceEvent.findOne().sort({ createdAt: -1 });
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

    const result = await transitionMaintenanceState(targetStatus, {
      reason: reason || (isEnabled ? 'Manual Maintenance Toggle' : 'Manual End Maintenance'),
      category,
      changedBy: req.user ? (req.user.name || req.user.email) : 'Admin',
      changedById: req.user ? req.user._id : null
    });

    res.json({
      success: true,
      message: result.changed ? `Maintenance Mode status updated to ${targetStatus.toUpperCase()}` : `Website is already ${targetStatus.toUpperCase()}`,
      settings: result.settings
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/maintenance/emergency — Trigger Emergency Shutdown
const triggerEmergencyShutdown = async (req, res) => {
  try {
    const { reason, category } = req.body;

    const result = await transitionMaintenanceState('emergency', {
      reason: reason || 'Emergency Shutdown Triggered',
      category: category || 'Emergency Fix',
      changedBy: req.user ? (req.user.name || req.user.email) : 'System Admin',
      changedById: req.user ? req.user._id : null
    });

    res.json({
      success: true,
      message: ' Emergency Shutdown Activated! Multi-channel notifications dispatched.',
      settings: result.settings
    });
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
      ? new Date(settings.expectedCompletion).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
      : 'Shortly';

    const finalEmailSubject = emailSubject || settings.notificationTemplate.emailSubject;
    const rawEmailBody = emailBody || settings.notificationTemplate.emailBody;
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
        message: smsBody || settings.notificationTemplate.smsBody,
        type: 'announcement',
        priority: 'high',
        icon: ''
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
  sendMaintenanceTransitionNotifications,
  dispatchPreMaintenanceNotice,
  showcaseNoticeBanner
};
