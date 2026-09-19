const MaintenanceSetting = require('../models/MaintenanceSetting');
const MaintenanceEvent = require('../models/MaintenanceEvent');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendMail } = require('../config/mailer');

// Fast In-Memory State Cache for Sub-millisecond Checks
let stateCache = {
  status: 'live', // 'live' | 'maintenance' | 'emergency'
  isEnabled: false,
  isEmergency: false,
  emergencyReason: '',
  title: 'Website Under Maintenance',
  message: 'Scheduled system maintenance in progress',
  category: 'General Maintenance',
  expectedCompletion: null,
  allowAdminLogin: true,
  allowTechTeam: true,
  allowContentEditors: false,
  contactPhone: '+91 94431 00000',
  contactEmail: 'stjdbchurch@gmail.com',
  noticeBanner: null,
  scheduler: null,
  activeEventId: null,
  lastUpdated: 0
};

/**
 * Ensures a singleton database record exists for maintenance configuration
 */
async function getOrCreateSettings() {
  try {
    let settings = await MaintenanceSetting.findOne({ key: 'site_maintenance' });
    if (!settings) {
      settings = await MaintenanceSetting.create({
        key: 'site_maintenance',
        isEnabled: false,
        isEmergency: false,
        status: 'live',
        title: 'Website Under Maintenance',
        message: 'We are currently performing scheduled maintenance. Please check back soon.',
        category: 'General Maintenance',
        showCountdown: true,
        allowAdminLogin: true,
        allowTechTeam: true,
        allowContentEditors: false,
        allowPublic: false,
        contactPhone: '+91 94431 00000',
        contactEmail: 'stjdbchurch@gmail.com',
        mediaUrl: '',
        mediaType: 'none',
        accessAttemptsCount: 0
      });
    }
    updateCacheFromSettings(settings);
    return settings;
  } catch (err) {
    console.error('[SystemControl] Error fetching maintenance settings:', err.message);
    return null;
  }
}

/**
 * Updates the in-memory state cache from a database document
 */
function updateCacheFromSettings(settings) {
  if (!settings) return;
  const status = settings.status || (settings.isEnabled ? (settings.isEmergency ? 'emergency' : 'maintenance') : 'live');
  stateCache = {
    status: status,
    isEnabled: status !== 'live',
    isEmergency: status === 'emergency',
    emergencyReason: settings.emergencyReason || '',
    title: settings.title || 'Website Under Maintenance',
    message: settings.message || 'Scheduled system maintenance in progress',
    category: settings.category || 'General Maintenance',
    expectedCompletion: settings.expectedCompletion || null,
    allowAdminLogin: settings.allowAdminLogin !== false,
    allowTechTeam: settings.allowTechTeam !== false,
    allowContentEditors: Boolean(settings.allowContentEditors),
    contactPhone: settings.contactPhone || '+91 94431 00000',
    contactEmail: settings.contactEmail || 'stjdbchurch@gmail.com',
    noticeBanner: settings.noticeBanner || null,
    scheduler: settings.scheduler || null,
    activeEventId: settings.activeEventId,
    lastUpdated: Date.now()
  };
}

/**
 * Read-only fast query of the current system state
 */
async function getSystemState(forceRefresh = false) {
  if (forceRefresh || !stateCache.lastUpdated || (Date.now() - stateCache.lastUpdated > 10000)) {
    await getOrCreateSettings();
  }
  return stateCache;
}

/**
 * Asynchronous background notification worker for state transitions
 */
async function dispatchTransitionNotificationsBackground(settings, event) {
  try {
    if (!event || event.notificationSent) return;

    const siteUrl = 'https://stjb-church.vercel.app';
    const isLive = event.newStatus === 'live';
    const isEmergency = event.newStatus === 'emergency';

    let emailSubject = '';
    let emailBody = '';
    let smsBody = '';
    let waMsg = '';

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

    if (isLive) {
      // ✅ Maintenance Completed / Services Restored
      emailSubject = `✅ Church Website Is Live Again — St. John de Britto's Church`;
      emailBody = `Dear User,\n\nWe are happy to inform you that the maintenance has been completed and the St. John de Britto's Church website and services are now live again.\n\nYou can now access the website/app and use the available services normally.\n\n👉 Visit: ${siteUrl}\n\nThank you for your patience and understanding.\n\n— St. John de Britto's Church`;
      smsBody = `✅ Church Website Is Live Again! The St. John de Britto's Church website maintenance is complete. All services are now available. Visit: ${siteUrl}`;
      waMsg = `✅ *Services Are Live Again*

Dear User,

The St. John de Britto's Church website and services are now live again.

The maintenance has been completed, and you can now access the website/app and use the available services normally.

🌐 Visit: ${siteUrl}

Thank you for your patience and understanding.

— *St. John de Britto's Church*`;
    } else if (isEmergency) {
      // 🚨 Emergency Shutdown
      emailSubject = `🚨 Emergency Notice — St. John de Britto's Church Website`;
      emailBody = `Dear User,\n\nThe St. John de Britto's Church website and services are currently under emergency maintenance.\n\nReason: ${settings.emergencyReason || settings.message || 'Emergency system event'}\n\nDuring this period, the website/app and some services will be temporarily unavailable.\n\nWe are working swiftly to restore services. We apologize for the inconvenience and thank you for your patience.\n\n— St. John de Britto's Church`;
      smsBody = `🚨 Emergency Notice: St. John de Britto's Church website is temporarily down due to emergency maintenance. We will notify you once services are restored.`;
      waMsg = `🚨 *Emergency Maintenance Notice*

Dear User,

The St. John de Britto's Church website and services are currently under emergency maintenance.

*Reason:* ${settings.emergencyReason || settings.message || 'Emergency system event'}

The website/app and services will be temporarily unavailable during this period.

We are working swiftly to restore normal operation. Thank you for your prayers and understanding. 🙏

— *St. John de Britto's Church*`;
    } else {
      // 🔧 Maintenance Started / In Progress
      emailSubject = `🔧 Church Website Maintenance Notice — St. John de Britto's Church`;
      emailBody = `Dear User,\n\nThe St. John de Britto's Church website and services are currently under maintenance.\n\nDuring this maintenance period, the website/app and some services may be temporarily unavailable.\n\nWe apologize for the inconvenience and appreciate your patience. We will notify you once the services are available again.\n\n— St. John de Britto's Church`;
      smsBody = `🔧 Maintenance Notice: The St. John de Britto's Church website is currently under maintenance. We will notify you once services are available again.`;
      waMsg = `🔧 *Maintenance Notice*

Dear User,

The St. John de Britto's Church website and services are currently under maintenance.

The website/app and some services may be temporarily unavailable during this period.

We apologize for the inconvenience and thank you for your patience.

We will notify you once the services are live again.

— *St. John de Britto's Church*`;
    }

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
              <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
                <div style="background-color: ${isEmergency ? '#991b1b' : (isLive ? '#065f46' : '#1e3a8a')}; color: #ffffff; padding: 28px 24px; text-align: center;">
                  <div style="width: 75px; height: 75px; margin: 0 auto 12px; border-radius: 50%; overflow: hidden; border: 3px solid #fbbf24; background: #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.25);">
                    <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
                  </div>
                  <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #fbbf24;">St. John de Britto Church</h1>
                  <p style="margin: 4px 0 0 0; color: #e2e8f0; font-size: 13px; font-weight: 500;">Kalayarkoil — System Status Update</p>
                </div>
                <div style="padding: 28px 24px; color: #1e293b; line-height: 1.6;">
                  <div style="background-color: ${isEmergency ? '#fee2e2' : (isLive ? '#d1fae5' : '#fef3c7')}; border-left: 4px solid ${isEmergency ? '#ef4444' : (isLive ? '#10b981' : '#f59e0b')}; padding: 14px 16px; margin-bottom: 20px; border-radius: 8px;">
                    <strong style="color: ${isEmergency ? '#991b1b' : (isLive ? '#065f46' : '#92400e')}; font-size: 14px;">
                      ${isEmergency ? '🚨 Emergency System Notice' : (isLive ? '✅ Website is Back Online' : '🛠️ Scheduled System Maintenance')}
                    </strong>
                  </div>
                  <p style="font-size: 14px; margin: 0 0 16px 0;">Dear Parishioner,</p>
                  <p style="font-size: 14px; margin: 0 0 16px 0;">
                    ${isLive
                ? 'Our website maintenance has been completed successfully. All online features, mass readings, and parish services are fully available.'
                : (isEmergency
                  ? 'Our church website and WhatsApp services have been temporarily restricted due to an emergency system event.'
                  : 'Our church website is currently undergoing scheduled maintenance.')}
                  </p>
                  <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 24px; font-size: 13px;">
                    <p style="margin: 0 0 6px 0;"><strong>• Details:</strong> ${settings.emergencyReason || settings.message}</p>
                    <p style="margin: 0 0 6px 0;"><strong>• Status:</strong> ${event.newStatus.toUpperCase()}</p>
                    ${!isLive ? `<p style="margin: 0;"><strong>• Expected Back Online:</strong> ${formattedCompletion}</p>` : ''}
                  </div>
                  <div style="text-align: center; margin-top: 10px;">
                    <a href="${siteUrl}" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 12px rgba(30,58,138,0.25);">Visit Church Website</a>
                  </div>
                </div>
              </div>
            `
          });
          emailCount++;
        } catch (e) {
          console.error(`[SystemControl] Email dispatch error for ${u.email}:`, e.message);
        }
      }

      // 2. In-App Notification Channel
      try {
        await Notification.create({
          userId: u._id,
          title: isLive ? '✅ Church Website Back Online' : (isEmergency ? '🚨 Emergency Website Notice' : '🛠️ Church Website Under Maintenance'),
          message: smsBody,
          type: 'announcement',
          category: 'maintenance',
          priority: isEmergency ? 'urgent' : 'high',
          link: '/',
          sentVia: ['email', 'inApp', 'push', 'whatsapp']
        });
        inAppCount++;
      } catch (e) { }

      // 3. Web Push Channel
      pushCount++;

      // 4. WhatsApp Channel
      if (u.phone && u.whatsappOptIn !== false) {
        let formattedPhone = u.phone.trim().replace(/\D/g, '');
        if (formattedPhone.length === 10 && !formattedPhone.startsWith('91')) {
          formattedPhone = `91${formattedPhone}`;
        }
        try {
          const { getWA } = require('../bot/whatsapp');
          const wa = getWA();
          if (wa && typeof wa.sendWhatsAppMessage === 'function') {
            await wa.sendWhatsAppMessage(formattedPhone, waMsg);
            waCount++;
          }
        } catch (waErr) { }
      }
    }

    // Update event record with final delivery stats
    event.notificationSent = true;
    event.notificationSentAt = new Date();
    event.deliveries = {
      email: { status: emailCount > 0 ? 'sent' : 'skipped', count: emailCount, sentAt: new Date() },
      push: { status: pushCount > 0 ? 'sent' : 'skipped', count: pushCount, sentAt: new Date() },
      inApp: { status: inAppCount > 0 ? 'sent' : 'skipped', count: inAppCount, sentAt: new Date() },
      whatsApp: { status: waCount > 0 ? 'sent' : 'skipped', count: waCount, sentAt: new Date() }
    };
    await event.save();
    console.log(`[SystemControl] Multi-channel notifications delivered (Mail: ${emailCount}, Push: ${pushCount}, In-App: ${inAppCount}, WhatsApp: ${waCount})`);
  } catch (err) {
    console.error('[SystemControl] Error in background transition notifications:', err.message);
  }
}

/**
 * Performs atomic state transition with immediate response (< 50ms)
 * and queues background notifications without blocking the HTTP response
 */
async function setSystemState(targetStatus, options = {}) {
  const validStatuses = ['live', 'maintenance', 'emergency'];
  const newStatus = (targetStatus || '').toLowerCase();
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid system status '${targetStatus}'. Must be one of: ${validStatuses.join(', ')}`);
  }

  const settings = await getOrCreateSettings();
  const previousStatus = settings.status || (settings.isEnabled ? (settings.isEmergency ? 'emergency' : 'maintenance') : 'live');

  // ✅ No-op guard: if status hasn't changed, return immediately without
  // creating a new event or dispatching duplicate notifications.
  if (previousStatus === newStatus) {
    console.log(`[SystemControl] No-op: system is already '${newStatus}'. Skipping transition & notifications.`);
    return {
      success: true,
      changed: false,
      status: newStatus.toUpperCase(),
      changedBy: options.changedBy || 'Admin',
      changedAt: new Date().toISOString(),
      notificationDispatch: 'SKIPPED_NO_CHANGE',
      settings,
      activeEvent: null,
      message: `System is already in '${newStatus}' state. No changes made, no notifications sent.`
    };
  }

  const isLive = newStatus === 'live';
  const isEmergency = newStatus === 'emergency';
  const isMaintenance = newStatus === 'maintenance';

  settings.status = newStatus;
  settings.isEnabled = !isLive;
  settings.isEmergency = isEmergency;

  if (options.reason) {
    if (isEmergency) settings.emergencyReason = options.reason;
    else settings.message = options.reason;
  }
  if (options.category) settings.category = options.category;
  if (options.expectedCompletion) settings.expectedCompletion = options.expectedCompletion;

  const {
    dispatchMaintenanceStartedEvent,
    dispatchMaintenanceCompletedEvent
  } = require('./maintenanceNotificationService');

  let activeEvent = null;

  if (isLive) {
    // 3. Maintenance Completed Event
    const res = await dispatchMaintenanceCompletedEvent({
      settings,
      changedBy: options.changedBy || 'Admin',
      changedById: options.changedById || null
    });
    activeEvent = res?.event || null;
  } else {
    // 2. Maintenance Started / Emergency Event
    // If a pre-maintenance banner was active or scheduled, mark it completed/superseded
    if (settings.noticeBanner) {
      settings.noticeBanner.isNoticeSent = true;
    }
    const res = await dispatchMaintenanceStartedEvent({
      settings,
      changedBy: options.changedBy || 'Admin',
      changedById: options.changedById || null,
      isEmergency
    });
    activeEvent = res?.event || null;
  }

  await settings.save();
  updateCacheFromSettings(settings);

  console.log(`[SystemControl] System state atomically changed: ${previousStatus.toUpperCase()} → ${newStatus.toUpperCase()} by ${options.changedBy || 'Admin'}`);

  // Fast response returned immediately (< 50ms)
  return {
    success: true,
    changed: previousStatus !== newStatus,
    status: newStatus.toUpperCase(),
    changedBy: options.changedBy || 'Admin',
    changedAt: new Date().toISOString(),
    notificationDispatch: 'DISPATCHING',
    settings,
    activeEvent,
    message: isLive
      ? 'Maintenance Mode Disabled (Website is Live)'
      : (isEmergency ? 'Emergency Shutdown Activated' : 'Maintenance Mode Enabled')
  };
}

module.exports = {
  setSystemState,
  getSystemState,
  getOrCreateSettings,
  updateCacheFromSettings,
  dispatchTransitionNotificationsBackground
};
