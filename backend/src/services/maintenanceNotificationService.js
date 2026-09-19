const MaintenanceSetting = require('../models/MaintenanceSetting');
const MaintenanceEvent = require('../models/MaintenanceEvent');
const MaintenanceNotificationLog = require('../models/MaintenanceNotificationLog');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendMail } = require('../config/mailer');
const { sendWhatsAppMessage } = require('../bot/whatsapp');
const { sendPushToUser, sendPushBroadcast } = require('./webPushService');

const SITE_URL = process.env.CLIENT_URL || 'https://stjb-church.vercel.app';

/**
 * Format a Date object or timestamp into 12-hour Indian Standard Time (IST)
 */
function formatIST(dateVal) {
  if (!dateVal) return 'To Be Announced';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'To Be Announced';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }) + ' IST';
}

/**
 * Parse lead time strings (e.g. '15m', '30m', '1h', '2h') into integer minutes
 */
function getLeadTimeMinutes(leadTimeStr) {
  if (!leadTimeStr) return 15;
  switch (leadTimeStr) {
    case '15m': return 15;
    case '30m': return 30;
    case '1h': return 60;
    case '2h': return 120;
    case '6h': return 360;
    case '12h': return 720;
    case '24h': return 1440;
    default: {
      const match = String(leadTimeStr).match(/(\d+)\s*(m|min|h|hour|d|day)/i);
      if (match) {
        const val = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        if (unit.startsWith('m')) return val;
        if (unit.startsWith('h')) return val * 60;
        if (unit.startsWith('d')) return val * 1440;
      }
      return 15;
    }
  }
}

/**
 * Core multi-channel user notification sender with per-user-per-channel duplicate protection.
 */
async function executeMultiChannelDispatch({ event, title, emailHtml, emailText, smsText, waText, pushPayload }) {
  try {
    const users = await User.find({ isActive: { $ne: false } }).select('name email phone role whatsappOptIn settings');
    console.log(`[MaintenanceNotify] Starting dispatch for event ${event._id} (${event.eventType}) to ${users.length} active users.`);

    let emailSent = 0;
    let emailFailed = 0;
    let waSent = 0;
    let waFailed = 0;
    let pushSent = 0;
    let pushFailed = 0;
    let inAppSent = 0;
    let inAppFailed = 0;

    for (const u of users) {
      // 1. EMAIL CHANNEL
      if (u.email && (!u.settings || u.settings.notifications?.email !== false)) {
        try {
          const alreadyLogged = await MaintenanceNotificationLog.findOne({
            maintenanceEventId: event._id,
            userId: u._id,
            channel: 'email'
          });

          if (!alreadyLogged) {
            try {
              const res = await sendMail({
                to: u.email,
                subject: title,
                text: emailText,
                html: emailHtml
              });
              if (res && res.success === false) {
                emailFailed++;
                await MaintenanceNotificationLog.create({
                  maintenanceEventId: event._id,
                  userId: u._id,
                  channel: 'email',
                  status: 'failed',
                  recipient: u.email,
                  error: res.error || 'Email send failed'
                });
              } else {
                emailSent++;
                await MaintenanceNotificationLog.create({
                  maintenanceEventId: event._id,
                  userId: u._id,
                  channel: 'email',
                  status: 'sent',
                  recipient: u.email,
                  sentAt: new Date()
                });
              }
            } catch (sendErr) {
              emailFailed++;
              await MaintenanceNotificationLog.create({
                maintenanceEventId: event._id,
                userId: u._id,
                channel: 'email',
                status: 'failed',
                recipient: u.email,
                error: sendErr.message
              });
            }
          }
        } catch (dbErr) {
          // duplicate key race condition caught by mongo unique index
        }
      }

      // 2. WHATSAPP BOT CHANNEL
      if (u.phone && u.whatsappOptIn !== false) {
        let formattedPhone = u.phone.trim().replace(/\D/g, '');
        if (formattedPhone.length === 10 && !formattedPhone.startsWith('91')) {
          formattedPhone = `91${formattedPhone}`;
        }

        try {
          const alreadyLogged = await MaintenanceNotificationLog.findOne({
            maintenanceEventId: event._id,
            userId: u._id,
            channel: 'whatsapp'
          });

          if (!alreadyLogged) {
            try {
              const success = await sendWhatsAppMessage(formattedPhone, waText);
              if (success) {
                waSent++;
                await MaintenanceNotificationLog.create({
                  maintenanceEventId: event._id,
                  userId: u._id,
                  channel: 'whatsapp',
                  status: 'sent',
                  recipient: formattedPhone,
                  sentAt: new Date()
                });
              } else {
                waFailed++;
                await MaintenanceNotificationLog.create({
                  maintenanceEventId: event._id,
                  userId: u._id,
                  channel: 'whatsapp',
                  status: 'failed',
                  recipient: formattedPhone,
                  error: 'WhatsApp message delivery failed or socket disconnected'
                });
              }
            } catch (waErr) {
              waFailed++;
              await MaintenanceNotificationLog.create({
                maintenanceEventId: event._id,
                userId: u._id,
                channel: 'whatsapp',
                status: 'failed',
                recipient: formattedPhone,
                error: waErr.message
              });
            }
          }
        } catch (dbErr) { }
      }

      // 3. IN-APP NOTIFICATION CHANNEL
      try {
        const alreadyLogged = await MaintenanceNotificationLog.findOne({
          maintenanceEventId: event._id,
          userId: u._id,
          channel: 'in_app'
        });

        if (!alreadyLogged) {
          try {
            await Notification.create({
              userId: u._id,
              title,
              message: smsText,
              type: 'system',
              category: 'system',
              priority: event.eventType === 'EMERGENCY' ? 'urgent' : 'high',
              actionUrl: '/',
              sentVia: ['inApp']
            });
            inAppSent++;
            await MaintenanceNotificationLog.create({
              maintenanceEventId: event._id,
              userId: u._id,
              channel: 'in_app',
              status: 'sent',
              sentAt: new Date()
            });
          } catch (notifErr) {
            inAppFailed++;
            await MaintenanceNotificationLog.create({
              maintenanceEventId: event._id,
              userId: u._id,
              channel: 'in_app',
              status: 'failed',
              error: notifErr.message
            });
          }
        }
      } catch (dbErr) { }

      // 4. WEB PUSH NOTIFICATION CHANNEL
      try {
        const alreadyLogged = await MaintenanceNotificationLog.findOne({
          maintenanceEventId: event._id,
          userId: u._id,
          channel: 'push'
        });

        if (!alreadyLogged) {
          try {
            const pushRes = await sendPushToUser(u._id, pushPayload);
            if (pushRes && pushRes.success) {
              pushSent++;
              await MaintenanceNotificationLog.create({
                maintenanceEventId: event._id,
                userId: u._id,
                channel: 'push',
                status: 'sent',
                sentAt: new Date()
              });
            } else {
              // User may not have active browser push subscription
              await MaintenanceNotificationLog.create({
                maintenanceEventId: event._id,
                userId: u._id,
                channel: 'push',
                status: pushRes?.reason === 'No push subscriptions found' ? 'skipped' : 'failed',
                error: pushRes?.reason || pushRes?.error || 'Push not delivered'
              });
            }
          } catch (pushErr) {
            await MaintenanceNotificationLog.create({
              maintenanceEventId: event._id,
              userId: u._id,
              channel: 'push',
              status: 'failed',
              error: pushErr.message
            });
          }
        }
      } catch (dbErr) { }
    }

    // Try web push broadcast for any unregistered guest sessions
    try {
      await sendPushBroadcast(pushPayload);
    } catch (e) { }

    // Finalize delivery metrics on the MaintenanceEvent document
    event.notificationSent = true;
    event.notificationSentAt = new Date();
    event.status = (emailFailed === 0 && waFailed === 0) ? 'DISPATCH_COMPLETE' : 'PARTIALLY_COMPLETE';

    event.deliveries = {
      email: {
        status: emailSent > 0 ? 'sent' : (emailFailed > 0 ? 'failed' : 'skipped'),
        sentCount: emailSent,
        failedCount: emailFailed,
        count: emailSent,
        sentAt: new Date()
      },
      push: {
        status: pushSent > 0 ? 'sent' : 'skipped',
        sentCount: pushSent,
        failedCount: pushFailed,
        count: pushSent,
        sentAt: new Date()
      },
      inApp: {
        status: inAppSent > 0 ? 'sent' : 'failed',
        sentCount: inAppSent,
        failedCount: inAppFailed,
        count: inAppSent,
        sentAt: new Date()
      },
      whatsApp: {
        status: waSent > 0 ? 'sent' : (waFailed > 0 ? 'failed' : 'skipped'),
        sentCount: waSent,
        failedCount: waFailed,
        count: waSent,
        sentAt: new Date()
      }
    };

    await event.save();
    console.log(`[MaintenanceNotify] Dispatch finished for event ${event._id}. Real metrics: Email: ${emailSent} sent / ${emailFailed} failed, WhatsApp: ${waSent} sent / ${waFailed} failed, InApp: ${inAppSent}, Push: ${pushSent}`);
    return event;
  } catch (err) {
    console.error('[MaintenanceNotify] Critical error in executeMultiChannelDispatch:', err);
    event.status = 'FAILED';
    await event.save().catch(() => {});
    throw err;
  }
}

/**
 * EVENT 1: Pre-Maintenance Notice
 * Dispatched at scheduledStartTime - noticeLeadTime
 */
async function dispatchPreMaintenanceEvent({ settings, changedBy = 'Admin', changedById = null }) {
  try {
    if (!settings) settings = await MaintenanceSetting.findOne({ key: 'site_maintenance' });
    if (!settings) return null;

    const bannerConfig = settings.noticeBanner || {};
    const startTimeVal = bannerConfig.scheduledStartTime || settings.scheduler?.scheduledStart;
    const endTimeVal = bannerConfig.scheduledEndTime || settings.scheduler?.scheduledEnd || settings.expectedCompletion;
    const leadTimeStr = bannerConfig.noticeLeadTime || settings.scheduler?.noticeLeadTime || '15m';

    const formattedStart = formatIST(startTimeVal);
    const formattedEnd = formatIST(endTimeVal);
    const bannerMsg = bannerConfig.message || settings.message || 'Scheduled system maintenance and upgrades to serve you better.';

    const cycleId = settings.currentCycleId || new Date().toISOString();

    // Check if Pre-Maintenance event for this cycle has already been created & dispatched
    let event = null;
    if (settings.preMaintenanceEventId) {
      event = await MaintenanceEvent.findById(settings.preMaintenanceEventId);
    }
    if (!event) {
      event = await MaintenanceEvent.findOne({
        cycleId,
        eventType: 'PRE_MAINTENANCE'
      });
    }

    if (event) {
      console.log(`[PreMaintenanceNotice] Event ${event._id} already exists (status: ${event.status}) for cycle ${cycleId}. Skipping duplicate dispatch.`);
      return { success: true, event, settings, alreadyDispatched: true };
    }

    if (!event) {
      event = await MaintenanceEvent.create({
        cycleId,
        eventType: 'PRE_MAINTENANCE',
        status: 'DISPATCHING',
        previousStatus: settings.status || 'live',
        newStatus: settings.status || 'live',
        enabledBy: changedBy,
        enabledById: changedById,
        reason: 'Scheduled Pre-Maintenance Notice',
        category: settings.category || 'Scheduled Update',
        metadata: {
          startTime: startTimeVal,
          endTime: endTimeVal,
          expectedCompletion: endTimeVal,
          bannerMessage: bannerMsg,
          noticeLeadTime: leadTimeStr
        }
      });
    }

    // Update settings references immediately
    settings.preMaintenanceEventId = event._id;
    if (!settings.noticeBanner) settings.noticeBanner = {};
    settings.noticeBanner.isEnabled = true;
    settings.noticeBanner.isNoticeSent = true;
    settings.noticeBanner.sentAt = new Date();
    settings.noticeBanner.eventId = event._id;
    await settings.save();

    const title = '⚠️ Scheduled Maintenance Notice';
    const emailSubject = `⚠️ Scheduled Maintenance Notice — St. John de Britto Church`;
    const emailText = `Dear Parishioner,\n\nPlease be informed that scheduled website maintenance is planned for the St. John de Britto Church portal.\n\n📅 Maintenance Start: ${formattedStart}\n⏳ Expected Completion: ${formattedEnd}\n📝 Details: ${bannerMsg}\n\nDuring this window, online services and mass bookings may be temporarily unavailable.\n\nThank you for your understanding.\n\n— St. John de Britto Church, Kalayarkoil`;
    const smsText = `⚠️ Scheduled Maintenance Notice: St. John de Britto Church portal maintenance is scheduled for ${formattedStart}. Expected completion: ${formattedEnd}. Details: ${bannerMsg}`;
    const waText = `⚠️ *Scheduled Maintenance Notice*

Dear Parishioner,

Please be informed that scheduled website maintenance is planned for the *St. John de Britto Church* portal.

📅 *Maintenance Start:* ${formattedStart}
⏳ *Expected Completion:* ${formattedEnd}
📝 *Details:* ${bannerMsg}

During this window, website services and mass bookings will be temporarily unavailable.

🌐 Visit: ${SITE_URL}

Thank you for your patience and prayers. 🙏

— *St. John de Britto Church, Kalayarkoil*`;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
        <div style="background-color: #d97706; color: #ffffff; padding: 28px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff;">⚠️ Scheduled Maintenance Notice</h1>
          <p style="margin: 6px 0 0 0; color: #fef3c7; font-size: 13px; font-weight: 500;">St. John de Britto Church, Kalayarkoil</p>
        </div>
        <div style="padding: 28px 24px; color: #1e293b; line-height: 1.6;">
          <p style="font-size: 15px; margin: 0 0 16px 0;">Dear Parishioner,</p>
          <p style="font-size: 14px; margin: 0 0 16px 0;">
            Please be informed that scheduled website maintenance has been planned to optimize our parish systems and enhance data security.
          </p>
          <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 18px; margin-bottom: 24px; font-size: 14px;">
            <p style="margin: 0 0 8px 0; color: #92400e;"><strong>📅 Scheduled Start:</strong> ${formattedStart}</p>
            <p style="margin: 0 0 8px 0; color: #92400e;"><strong>⏳ Expected Completion:</strong> ${formattedEnd}</p>
            <p style="margin: 0; color: #92400e;"><strong>📝 Details:</strong> ${bannerMsg}</p>
          </div>
          <p style="font-size: 13px; color: #64748b; margin: 0 0 20px 0;">
            * During this maintenance window, access to the website, online mass bookings, and parishioner forms will be temporarily unavailable.
          </p>
          <div style="text-align: center;">
            <a href="${SITE_URL}" style="display: inline-block; background-color: #d97706; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 700;">Visit Church Website</a>
          </div>
        </div>
      </div>
    `;

    const pushPayload = {
      title,
      body: `Scheduled maintenance on ${formattedStart}. Expected finish: ${formattedEnd}.`,
      icon: '/assets/church-logo.png',
      url: SITE_URL
    };

    // Execute asynchronously in background
    setImmediate(() => {
      executeMultiChannelDispatch({
        event,
        title: emailSubject,
        emailHtml,
        emailText,
        smsText,
        waText,
        pushPayload
      }).catch(err => console.error('[PreMaintenanceNotice] Async dispatch error:', err));
    });

    return { success: true, event, settings };
  } catch (err) {
    console.error('[PreMaintenanceNotice] Error:', err);
    throw err;
  }
}

/**
 * EVENT 2: Maintenance Started
 * Dispatched immediately when Maintenance Mode is enabled (manually or auto-scheduler)
 */
async function dispatchMaintenanceStartedEvent({ settings, changedBy = 'Admin', changedById = null, isEmergency = false }) {
  try {
    if (!settings) settings = await MaintenanceSetting.findOne({ key: 'site_maintenance' });
    if (!settings) return null;

    const formattedCompletion = formatIST(settings.expectedCompletion);
    const reasonMsg = isEmergency
      ? (settings.emergencyReason || settings.message || 'Emergency security patch & system lockdown')
      : (settings.message || 'Scheduled system maintenance and data upgrade');

    const cycleId = settings.currentCycleId || new Date().toISOString();

    const event = await MaintenanceEvent.create({
      cycleId,
      eventType: isEmergency ? 'EMERGENCY' : 'MAINTENANCE_STARTED',
      status: 'DISPATCHING',
      previousStatus: 'live',
      newStatus: isEmergency ? 'emergency' : 'maintenance',
      enabledBy: changedBy,
      enabledById: changedById,
      reason: reasonMsg,
      category: settings.category || (isEmergency ? 'Emergency Fix' : 'Scheduled Update'),
      metadata: {
        startTime: new Date(),
        expectedCompletion: settings.expectedCompletion,
        bannerMessage: reasonMsg
      }
    });

    settings.activeEventId = event._id;
    settings.maintenanceStartedEventId = event._id;
    await settings.save();

    const title = isEmergency ? '🚨 Emergency Website Maintenance Has Started' : '🔧 Website Maintenance Has Started';
    const emailSubject = `${title} — St. John de Britto Church`;
    const emailText = `Dear Parishioner,\n\nOur church website is currently undergoing maintenance.\n\n🛠️ Status: Under Maintenance\n⏳ Expected Completion: ${formattedCompletion}\n📝 Details: ${reasonMsg}\n\nRegular website access and online services are temporarily paused. We appreciate your patience.\n\n— St. John de Britto Church, Kalayarkoil`;
    const smsText = `${title}: Our website is currently undergoing maintenance. Expected completion: ${formattedCompletion}. Details: ${reasonMsg}`;
    const waText = `${isEmergency ? '🚨' : '🔧'} *Website Maintenance Has Started*

Dear Parishioner,

The *St. John de Britto Church* website is currently undergoing ${isEmergency ? 'emergency' : 'scheduled'} maintenance.

🛠️ *Status:* Under Maintenance
⏳ *Expected Completion:* ${formattedCompletion}
📝 *Details:* ${reasonMsg}

During this period, public access and online bookings are temporarily unavailable. Our technical team is working swiftly to complete updates.

🌐 Visit: ${SITE_URL}

Thank you for your understanding and patience. 🙏

— *St. John de Britto Church, Kalayarkoil*`;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
        <div style="background-color: ${isEmergency ? '#991b1b' : '#1e3a8a'}; color: #ffffff; padding: 28px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff;">${isEmergency ? '🚨 Emergency Maintenance Started' : '🔧 Website Maintenance Has Started'}</h1>
          <p style="margin: 6px 0 0 0; color: #e2e8f0; font-size: 13px; font-weight: 500;">St. John de Britto Church, Kalayarkoil</p>
        </div>
        <div style="padding: 28px 24px; color: #1e293b; line-height: 1.6;">
          <p style="font-size: 15px; margin: 0 0 16px 0;">Dear Parishioner,</p>
          <p style="font-size: 14px; margin: 0 0 16px 0;">
            Our church website is currently undergoing ${isEmergency ? 'emergency' : 'scheduled'} maintenance. During this window, regular website features and online bookings are temporarily paused.
          </p>
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px; margin-bottom: 24px; font-size: 14px;">
            <p style="margin: 0 0 8px 0;"><strong>🛠️ Status:</strong> <span style="color: ${isEmergency ? '#dc2626' : '#2563eb'}; font-weight: bold;">MAINTENANCE ACTIVE</span></p>
            <p style="margin: 0 0 8px 0;"><strong>⏳ Expected Completion:</strong> ${formattedCompletion}</p>
            <p style="margin: 0;"><strong>📝 Reason:</strong> ${reasonMsg}</p>
          </div>
          <div style="text-align: center;">
            <a href="${SITE_URL}" style="display: inline-block; background-color: ${isEmergency ? '#991b1b' : '#1e3a8a'}; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 700;">Check Live Status</a>
          </div>
        </div>
      </div>
    `;

    const pushPayload = {
      title,
      body: `Maintenance is in progress. Expected back online: ${formattedCompletion}.`,
      icon: '/assets/church-logo.png',
      url: SITE_URL
    };

    setImmediate(() => {
      executeMultiChannelDispatch({
        event,
        title: emailSubject,
        emailHtml,
        emailText,
        smsText,
        waText,
        pushPayload
      }).catch(err => console.error('[MaintenanceStarted] Async dispatch error:', err));
    });

    return { success: true, event, settings };
  } catch (err) {
    console.error('[MaintenanceStarted] Error:', err);
    throw err;
  }
}

/**
 * EVENT 3: Maintenance Completed (Live)
 * Dispatched immediately when Maintenance Mode is disabled
 */
async function dispatchMaintenanceCompletedEvent({ settings, changedBy = 'Admin', changedById = null }) {
  try {
    if (!settings) settings = await MaintenanceSetting.findOne({ key: 'site_maintenance' });
    if (!settings) return null;

    const cycleId = settings.currentCycleId || new Date().toISOString();

    const event = await MaintenanceEvent.create({
      cycleId,
      eventType: 'MAINTENANCE_COMPLETED',
      status: 'DISPATCHING',
      previousStatus: settings.isEmergency ? 'emergency' : 'maintenance',
      newStatus: 'live',
      enabledBy: changedBy,
      enabledById: changedById,
      reason: 'Website Maintenance Completed & Restored Live',
      category: settings.category || 'General Maintenance',
      metadata: {
        startTime: settings.activeEventId ? undefined : new Date(),
        endTime: new Date()
      }
    });

    // Reset active event, save completed event reference, and renew cycleId for next maintenance session
    settings.activeEventId = null;
    settings.maintenanceCompletedEventId = event._id;
    settings.currentCycleId = new Date().toISOString() + '_' + Math.random().toString(36).substring(2, 8);
    if (settings.noticeBanner) {
      settings.noticeBanner.isEnabled = false;
      settings.noticeBanner.isNoticeSent = false;
    }
    await settings.save();

    const title = '🎉 The Website Is Live Again!';
    const emailSubject = `🎉 The Website Is Live Again! — St. John de Britto Church`;
    const emailText = `Dear Parishioner,\n\nWe are pleased to inform you that the website maintenance has been successfully completed and our church platform is now fully live and accessible.\n\nAll church services, mass bookings, prayer requests, and donor portals are fully operational.\n\n👉 Visit: ${SITE_URL}\n\nThank you for your patience and prayers.\n\n— St. John de Britto Church, Kalayarkoil`;
    const smsText = `🎉 The Website Is Live Again! Maintenance is complete and all church portal services and mass bookings are fully operational. Visit: ${SITE_URL}`;
    const waText = `🎉 *The Website Is Live Again!*

Dear Parishioner,

We are pleased to inform you that our website maintenance has been successfully completed.

The *St. John de Britto Church* platform is now live and fully operational!

✅ *Online Mass Bookings* are open
✅ *Prayer Requests & Parish Services* are active
✅ *Account & Portal Access* restored

🌐 Visit Church Website: ${SITE_URL}

Thank you for your patience, support, and prayers. 🙏

— *St. John de Britto Church, Kalayarkoil*`;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
        <div style="background-color: #065f46; color: #ffffff; padding: 28px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff;">🎉 The Website Is Live Again!</h1>
          <p style="margin: 6px 0 0 0; color: #a7f3d0; font-size: 13px; font-weight: 500;">St. John de Britto Church, Kalayarkoil</p>
        </div>
        <div style="padding: 28px 24px; color: #1e293b; line-height: 1.6;">
          <p style="font-size: 15px; margin: 0 0 16px 0;">Dear Parishioner,</p>
          <p style="font-size: 14px; margin: 0 0 16px 0;">
            We are pleased to inform you that maintenance has been successfully completed. All church website services, mass bookings, and parish portals are now live and fully operational.
          </p>
          <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 18px; margin-bottom: 24px; font-size: 14px;">
            <p style="margin: 0 0 6px 0; color: #065f46;"><strong>✅ Online Mass Bookings:</strong> Available</p>
            <p style="margin: 0 0 6px 0; color: #065f46;"><strong>✅ Parishioner Accounts:</strong> Fully Accessible</p>
            <p style="margin: 0; color: #065f46;"><strong>✅ System Status:</strong> Normal & Secure</p>
          </div>
          <div style="text-align: center;">
            <a href="${SITE_URL}" style="display: inline-block; background-color: #065f46; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 700;">Go to Church Website</a>
          </div>
        </div>
      </div>
    `;

    const pushPayload = {
      title,
      body: 'Maintenance is complete! All church services and mass bookings are live.',
      icon: '/assets/church-logo.png',
      url: SITE_URL
    };

    setImmediate(() => {
      executeMultiChannelDispatch({
        event,
        title: emailSubject,
        emailHtml,
        emailText,
        smsText,
        waText,
        pushPayload
      }).catch(err => console.error('[MaintenanceCompleted] Async dispatch error:', err));
    });

    return { success: true, event, settings };
  } catch (err) {
    console.error('[MaintenanceCompleted] Error:', err);
    throw err;
  }
}

/**
 * Get real delivery counts for an event directly from MaintenanceNotificationLog
 */
async function getEventRealDeliveryMetrics(eventId) {
  if (!eventId) return null;
  try {
    const logs = await MaintenanceNotificationLog.aggregate([
      { $match: { maintenanceEventId: eventId } },
      {
        $group: {
          _id: { channel: '$channel', status: '$status' },
          count: { $sum: 1 }
        }
      }
    ]);

    const metrics = {
      email: { sent: 0, failed: 0, skipped: 0 },
      whatsapp: { sent: 0, failed: 0, skipped: 0 },
      in_app: { sent: 0, failed: 0, skipped: 0 },
      push: { sent: 0, failed: 0, skipped: 0 }
    };

    logs.forEach(l => {
      const ch = l._id.channel;
      const st = l._id.status;
      if (metrics[ch]) {
        if (st === 'sent') metrics[ch].sent += l.count;
        else if (st === 'failed') metrics[ch].failed += l.count;
        else if (st === 'skipped') metrics[ch].skipped += l.count;
      }
    });

    return metrics;
  } catch (err) {
    console.error('[MaintenanceNotify] Error aggregating delivery metrics:', err);
    return null;
  }
}

module.exports = {
  dispatchPreMaintenanceEvent,
  dispatchMaintenanceStartedEvent,
  dispatchMaintenanceCompletedEvent,
  getEventRealDeliveryMetrics,
  formatIST,
  getLeadTimeMinutes
};
