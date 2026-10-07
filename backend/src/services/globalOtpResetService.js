const crypto = require('crypto');
const cron = require('node-cron');
const User = require('../models/User');
const GlobalOtpReset = require('../models/GlobalOtpReset');
const GlobalOtpNotificationLog = require('../models/GlobalOtpNotificationLog');
const OTPVerification = require('../models/OTPVerification');
const { createNotification } = require('./notificationService');
const { sendPushBroadcast, sendPushToUser } = require('./webPushService');
const { sendMail } = require('../config/mailer');
const { notifyAdmin } = require('./adminNotificationService');
const { logSecurityEvent } = require('./securityAuditService');
const { getSiteUrl } = require('../config/siteRoutes');

function getWA() {
  try {
    return require('../bot/whatsapp');
  } catch (e) {
    return null;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const REMINDER_DAYS = [1, 3, 7, 14, 21, 27, 29, 30];

/**
 * 1. Triggers a complete Global OTP Reset Event for ALL users including admins.
 */
async function triggerGlobalOtpReset({ adminUser, req }) {
  const now = new Date();
  const resetId = `RESET-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const verificationDeadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

  // Step 1: Invalidate active OTP sessions
  await OTPVerification.updateMany(
    { status: 'pending' },
    { $set: { status: 'replaced' } }
  );

  // Step 2: Invalidate OTP/re-verification state for ALL users (normal, admin, priest, tech team)
  const filter = { isActive: { $ne: false } };
  const updateResult = await User.updateMany(
    filter,
    {
      $set: {
        verificationRequired: true,
        otpVerificationRequired: true,
        otpVerified: false,
        verificationStatus: 'Pending Verification',
        activeGlobalResetId: resetId,
        globalResetId: resetId
      },
      $unset: {
        otp: "",
        otpExpires: "",
        otpExpiresAt: ""
      }
    }
  );

  const affectedCount = updateResult.modifiedCount || 0;

  // Step 3: Create GlobalOtpReset event
  const resetEvent = await GlobalOtpReset.create({
    resetId,
    triggeredBy: adminUser?._id || null,
    triggeredByAdminId: adminUser?._id ? adminUser._id.toString() : 'system',
    triggeredByAdminName: adminUser?.name || 'Administrator',
    triggeredAt: now,
    verificationDeadline,
    status: 'active',
    totalAffectedCount: affectedCount,
    verifiedCount: 0,
    pendingCount: affectedCount,
    metadata: {
      ip: req?.ip || 'Unknown',
      userAgent: req?.headers?.['user-agent'] || 'Unknown'
    }
  });

  // Step 4: Record security audit event
  await logSecurityEvent({
    userId: adminUser?._id,
    adminId: adminUser?._id,
    eventType: 'GLOBAL_OTP_RESET_INITIATED',
    req,
    source: 'ADMIN_DASHBOARD',
    success: true,
    affectedCount,
    details: {
      resetId,
      deadline: verificationDeadline,
      triggeredBy: adminUser?.name || 'Admin',
      totalAffected: affectedCount
    }
  });

  // Step 5: Immediately notify ALL users and ALL admins across all channels (Day 0)
  dispatchImmediateGlobalResetNotifications({ resetEvent, adminUser, req }).catch(err => {
    console.error('[GlobalOtpResetService] Error during immediate notification dispatch:', err);
  });

  return {
    success: true,
    resetId,
    affectedCount,
    deadline: verificationDeadline
  };
}

/**
 * Dispatches immediate notifications (Day 0) across In-App, Push, Email, and WhatsApp
 * with persistent deduplication tracking.
 */
async function dispatchImmediateGlobalResetNotifications({ resetEvent, adminUser, req }) {
  const clientUrl = getSiteUrl('');
  const notifTitle = 'Security Verification Required';
  const notifMessage = 'A security re-verification has been initiated by the Church Administration. Please complete OTP verification to continue using your account. Your re-verification cycle is valid for 30 days.\n\nநிர்வாகத்தின் பாதுகாப்பு விதிமுறைகளின்படி உங்கள் கணக்கை OTP மூலம் மீண்டும் சரிபார்க்கவும். இந்த சரிபார்ப்பு 30 நாட்களுக்கு செல்லுபடியாகும்.';

  // 1. In-App Broadcast Notification
  let broadcastNotif = null;
  try {
    broadcastNotif = await createNotification({
      isBroadcast: true,
      title: notifTitle,
      message: notifMessage,
      type: 'security',
      category: 'security',
      priority: 'high',
      recipient: 'user',
      actionUrl: '/login?verify=true',
      channels: ['in_app']
    });
  } catch (err) {
    console.warn('[GlobalOtpResetService] In-app broadcast creation error:', err.message);
  }

  // 2. Web Push Broadcast
  try {
    await sendPushBroadcast({
      title: 'Security Verification Required',
      body: 'A security re-verification has been initiated by Church Administration. Please verify your OTP to keep your account active.',
      notificationId: broadcastNotif?._id ? broadcastNotif._id.toString() : resetEvent.resetId,
      url: '/login?verify=true',
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: `sjdb-global-reset-${resetEvent.resetId}`,
      renotify: true
    });
  } catch (err) {
    console.warn('[GlobalOtpResetService] Push broadcast error:', err.message);
  }

  // 3. Multi-Channel Per-User Notifications (Email & WhatsApp) with Deduplication
  const allUsers = await User.find({ isActive: { $ne: false } })
    .select('name email phone role parishMemberId settings preferredLanguage')
    .lean();

  console.log(`[GlobalOtpResetService] Dispatching immediate notifications to ${allUsers.length} users...`);

  const wa = getWA();

  for (const u of allUsers) {
    const userName = u.name || 'Parishioner';
    const memberId = u.parishMemberId || 'Parish Member';

    // Record In-App deduplication
    try {
      await GlobalOtpNotificationLog.create({
        notificationType: 'immediate',
        userId: u._id,
        globalResetId: resetEvent.resetId,
        reminderDay: 0,
        channel: 'in_app',
        status: 'sent'
      });
    } catch (e) { /* ignore duplicate */ }

    // Record Push deduplication
    try {
      await GlobalOtpNotificationLog.create({
        notificationType: 'immediate',
        userId: u._id,
        globalResetId: resetEvent.resetId,
        reminderDay: 0,
        channel: 'push',
        status: 'sent'
      });
    } catch (e) { /* ignore duplicate */ }

    // ── Email Notification ──────────────────────────────────────────
    if (u.email) {
      const alreadySentEmail = await GlobalOtpNotificationLog.findOne({
        userId: u._id,
        globalResetId: resetEvent.resetId,
        reminderDay: 0,
        channel: 'email'
      });

      if (!alreadySentEmail) {
        const emailHtml = buildSecurityEmailHtml({
          userName,
          memberId,
          clientUrl,
          deadlineStr: resetEvent.verificationDeadline.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' }),
          isReminder: false
        });

        try {
          await sendMail({
            to: u.email,
            subject: 'Security Verification Required — St. John de Britto Church',
            html: emailHtml
          });

          await GlobalOtpNotificationLog.create({
            notificationType: 'immediate',
            userId: u._id,
            globalResetId: resetEvent.resetId,
            reminderDay: 0,
            channel: 'email',
            status: 'sent'
          });
        } catch (mailErr) {
          console.warn(`[GlobalOtpResetService] Email error to ${u.email}:`, mailErr.message);
          await GlobalOtpNotificationLog.create({
            notificationType: 'immediate',
            userId: u._id,
            globalResetId: resetEvent.resetId,
            reminderDay: 0,
            channel: 'email',
            status: 'failed',
            error: mailErr.message
          }).catch(() => {});
        }
      }
    }

    // ── WhatsApp Notification through SJDB Connect ─────────────────
    if (u.phone && wa && typeof wa.sendWhatsAppMessage === 'function') {
      const alreadySentWa = await GlobalOtpNotificationLog.findOne({
        userId: u._id,
        globalResetId: resetEvent.resetId,
        reminderDay: 0,
        channel: 'whatsapp'
      });

      if (!alreadySentWa) {
        const waMsg = `⛪ *St. John de Britto Church, Kalayarkoil*\n*Security Verification Required*\n\nDear *${userName}*,\n\nA security re-verification has been initiated by the Church Administration. Please complete OTP verification to continue using your account. Your re-verification cycle is valid for 30 days.\n\n*Verify Now:*\n${clientUrl}/login?verify=true\n\n_நிர்வாகத்தின் பாதுகாப்பு விதிமுறைகளின்படி உங்கள் கணக்கை OTP மூலம் மீண்டும் சரிபார்க்கவும்._\n\n_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_`;

        try {
          await wa.sendWhatsAppMessage(u.phone, waMsg);
          await GlobalOtpNotificationLog.create({
            notificationType: 'immediate',
            userId: u._id,
            globalResetId: resetEvent.resetId,
            reminderDay: 0,
            channel: 'whatsapp',
            status: 'sent'
          });
        } catch (waErr) {
          console.warn(`[GlobalOtpResetService] WhatsApp error to ${u.phone}:`, waErr.message);
          await GlobalOtpNotificationLog.create({
            notificationType: 'immediate',
            userId: u._id,
            globalResetId: resetEvent.resetId,
            reminderDay: 0,
            channel: 'whatsapp',
            status: 'failed',
            error: waErr.message
          }).catch(() => {});
        }
      }
    }
  }

  // Notify admin activity
  notifyAdmin({
    type: 'SECURITY_ALERT',
    req,
    title: 'Global OTP Reset Initiated',
    reason: `Global OTP reset initiated by ${adminUser?.name || 'Admin'}. ${resetEvent.totalAffectedCount} users affected across all communication channels.`
  }).catch(() => {});
}

/**
 * 2. Handles successful OTP re-verification for a user or admin.
 * Starts their individual 30-day verification cycle and stops all reset reminders.
 */
async function recordGlobalOtpVerificationSuccess({ userId, req }) {
  const now = new Date();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const verificationExpiresAt = new Date(now.getTime() + THIRTY_DAYS_MS);

  const user = await User.findById(userId);
  if (!user) return null;

  const previousResetId = user.activeGlobalResetId || user.globalResetId;
  const userRole = (user.role || 'user').toLowerCase();
  const isAdminUser = ['admin', 'priest'].includes(userRole);

  user.verificationRequired = false;
  user.otpVerificationRequired = false;
  user.otpVerified = true;
  user.otpVerifiedAt = now;
  user.lastVerifiedAt = now;
  user.verificationExpiresAt = verificationExpiresAt;
  user.nextVerificationAt = verificationExpiresAt;
  user.verificationStatus = 'Verified';
  user.activeGlobalResetId = null; // Clears active reset so reminders STOP
  user.account_verified = true;
  user.isVerified = true;
  user.isActive = true;
  user.isSuspended = false;
  user.failedLoginAttempts = 0;
  await user.save();

  // If there is an active reset event, increment verified count
  if (previousResetId) {
    await GlobalOtpReset.updateOne(
      { resetId: previousResetId, status: 'active' },
      {
        $inc: { verifiedCount: 1, pendingCount: -1 }
      }
    );
  }

  // Record audit events
  await logSecurityEvent({
    userId: user._id,
    adminId: isAdminUser ? user._id : null,
    eventType: 'GLOBAL_OTP_REVERIFICATION_SUCCESS',
    req,
    source: isAdminUser ? 'ADMIN_DASHBOARD' : 'LOGIN',
    success: true,
    details: {
      userId: user._id,
      userRole: user.role,
      globalResetId: previousResetId,
      expiresAt: verificationExpiresAt
    }
  });

  // Also log specific role audit event for timeline clarity
  await logSecurityEvent({
    userId: user._id,
    adminId: isAdminUser ? user._id : null,
    eventType: isAdminUser ? 'ADMIN_OTP_REVERIFIED' : 'USER_OTP_REVERIFIED',
    req,
    source: isAdminUser ? 'ADMIN_DASHBOARD' : 'LOGIN',
    success: true,
    details: {
      userName: user.name,
      userRole: user.role,
      globalResetId: previousResetId
    }
  });

  return {
    success: true,
    user,
    verificationExpiresAt
  };
}

/**
 * 3. Daily Automated Scan for Active Global Resets and 30-Day Reminder Schedulers.
 * Dispatches reminders on Day 1, 3, 7, 14, 21, 27, 29, 30 with strict deduplication.
 * Marks users as 'Expired' when 30 days deadline passes.
 */
async function checkAndSendGlobalResetReminders({ forceDay = null } = {}) {
  const now = new Date();
  const activeResets = await GlobalOtpReset.find({ status: 'active' });

  if (!activeResets || activeResets.length === 0) {
    return { success: true, processedResets: 0 };
  }

  const clientUrl = getSiteUrl('');
  const wa = getWA();

  for (const reset of activeResets) {
    const elapsedMs = now.getTime() - new Date(reset.triggeredAt).getTime();
    const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

    // Check if 30-day period expired
    if (now > new Date(reset.verificationDeadline)) {
      console.log(`[GlobalOtpResetService] Reset ${reset.resetId} has passed its 30-day deadline. Marking expired...`);
      reset.status = 'expired';
      await reset.save();

      // Find users who did NOT complete verification
      const expiredUsers = await User.find({
        $or: [
          { activeGlobalResetId: reset.resetId },
          { globalResetId: reset.resetId }
        ],
        verificationRequired: true
      });

      for (const u of expiredUsers) {
        u.verificationStatus = 'Expired';
        await u.save();

        await logSecurityEvent({
          userId: u._id,
          eventType: 'OTP_REVERIFICATION_EXPIRED',
          source: 'CRON_JOB',
          success: true,
          details: {
            userName: u.name,
            userRole: u.role,
            resetId: reset.resetId,
            description: `Verification window expired for ${u.name}`
          }
        });
      }

      continue;
    }

    // Determine if today is an eligible reminder day (or forced)
    let currentReminderDay = forceDay !== null ? forceDay : null;
    if (currentReminderDay === null) {
      if (REMINDER_DAYS.includes(elapsedDays)) {
        currentReminderDay = elapsedDays;
      }
    }

    if (currentReminderDay === null) {
      // Not a scheduled reminder day today
      continue;
    }

    // Find ONLY users who have NOT completed verification
    const pendingUsers = await User.find({
      $or: [
        { activeGlobalResetId: reset.resetId },
        { globalResetId: reset.resetId }
      ],
      verificationRequired: true,
      otpVerified: false,
      isActive: { $ne: false }
    }).select('name email phone role parishMemberId settings');

    console.log(`[GlobalOtpResetService] Reset ${reset.resetId} (Day ${currentReminderDay}): ${pendingUsers.length} users pending verification.`);

    let reminderSentCount = 0;

    for (const u of pendingUsers) {
      const userName = u.name || 'Parishioner';
      const memberId = u.parishMemberId || 'Parish Member';
      let sentAnyChannel = false;

      // ── A. In-App Notification Reminder ───────────────────────────
      const inAppLog = await GlobalOtpNotificationLog.findOne({
        userId: u._id,
        globalResetId: reset.resetId,
        reminderDay: currentReminderDay,
        channel: 'in_app'
      });

      if (!inAppLog) {
        try {
          await createNotification({
            userId: u._id,
            title: 'OTP Re-Verification Reminder',
            message: 'Your account still requires security re-verification. Please complete OTP verification to keep your account active.\n\nஉங்கள் கணக்கு தொடர்ந்து செயல்பட OTP சரிபார்ப்பை பூர்த்தி செய்யவும்.',
            type: 'account_verification',
            category: 'account',
            priority: 'high',
            actionUrl: '/login?verify=true',
            channels: ['in_app']
          });

          await GlobalOtpNotificationLog.create({
            notificationType: 'reminder',
            userId: u._id,
            globalResetId: reset.resetId,
            reminderDay: currentReminderDay,
            channel: 'in_app',
            status: 'sent'
          });
          sentAnyChannel = true;
        } catch (e) { /* ignore duplicate */ }
      }

      // ── B. Web Push Reminder ──────────────────────────────────────
      const pushLog = await GlobalOtpNotificationLog.findOne({
        userId: u._id,
        globalResetId: reset.resetId,
        reminderDay: currentReminderDay,
        channel: 'push'
      });

      if (!pushLog) {
        try {
          await sendPushToUser(u._id, {
            title: 'OTP Re-Verification Reminder',
            body: 'Your account still requires security re-verification. Verify now to keep your account active.',
            url: '/login?verify=true',
            icon: '/favicon.png',
            badge: '/favicon.png',
            tag: `sjdb-reminder-${reset.resetId}-${currentReminderDay}`
          });

          await GlobalOtpNotificationLog.create({
            notificationType: 'reminder',
            userId: u._id,
            globalResetId: reset.resetId,
            reminderDay: currentReminderDay,
            channel: 'push',
            status: 'sent'
          });
          sentAnyChannel = true;
        } catch (e) { /* ignore */ }
      }

      // ── C. Email Reminder ─────────────────────────────────────────
      if (u.email) {
        const emailLog = await GlobalOtpNotificationLog.findOne({
          userId: u._id,
          globalResetId: reset.resetId,
          reminderDay: currentReminderDay,
          channel: 'email'
        });

        if (!emailLog) {
          const emailHtml = buildSecurityEmailHtml({
            userName,
            memberId,
            clientUrl,
            deadlineStr: reset.verificationDeadline.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' }),
            isReminder: true,
            reminderDay: currentReminderDay
          });

          try {
            await sendMail({
              to: u.email,
              subject: `OTP Re-Verification Reminder (Day ${currentReminderDay}) — St. John de Britto Church`,
              html: emailHtml
            });

            await GlobalOtpNotificationLog.create({
              notificationType: 'reminder',
              userId: u._id,
              globalResetId: reset.resetId,
              reminderDay: currentReminderDay,
              channel: 'email',
              status: 'sent'
            });
            sentAnyChannel = true;
          } catch (mailErr) {
            await GlobalOtpNotificationLog.create({
              notificationType: 'reminder',
              userId: u._id,
              globalResetId: reset.resetId,
              reminderDay: currentReminderDay,
              channel: 'email',
              status: 'failed',
              error: mailErr.message
            }).catch(() => {});
          }
        }
      }

      // ── D. WhatsApp Reminder ──────────────────────────────────────
      if (u.phone && wa && typeof wa.sendWhatsAppMessage === 'function') {
        const waLog = await GlobalOtpNotificationLog.findOne({
          userId: u._id,
          globalResetId: reset.resetId,
          reminderDay: currentReminderDay,
          channel: 'whatsapp'
        });

        if (!waLog) {
          const waReminderMsg = `⛪ *St. John de Britto Church, Kalayarkoil*\n*OTP Re-Verification Reminder (Day ${currentReminderDay})*\n\nDear *${userName}*,\n\nYour account still requires security re-verification. Please complete OTP verification to keep your account active.\n\n*Verify Now:*\n${clientUrl}/login?verify=true\n\n_உங்கள் கணக்கு தொடர்ந்து செயல்பட OTP சரிபார்ப்பை பூர்த்தி செய்யவும்._\n\n_புனித அருளானந்தர் தேவாலயம்_`;

          try {
            await wa.sendWhatsAppMessage(u.phone, waReminderMsg);
            await GlobalOtpNotificationLog.create({
              notificationType: 'reminder',
              userId: u._id,
              globalResetId: reset.resetId,
              reminderDay: currentReminderDay,
              channel: 'whatsapp',
              status: 'sent'
            });
            sentAnyChannel = true;
          } catch (waErr) {
            await GlobalOtpNotificationLog.create({
              notificationType: 'reminder',
              userId: u._id,
              globalResetId: reset.resetId,
              reminderDay: currentReminderDay,
              channel: 'whatsapp',
              status: 'failed',
              error: waErr.message
            }).catch(() => {});
          }
        }
      }

      if (sentAnyChannel) {
        reminderSentCount++;
        u.lastOtpReminderSentAt = now;
        await u.save();
      }
    }

    if (reminderSentCount > 0) {
      await logSecurityEvent({
        eventType: 'OTP_REVERIFICATION_REMINDER_SENT',
        source: 'CRON_JOB',
        success: true,
        affectedCount: reminderSentCount,
        details: {
          resetId: reset.resetId,
          reminderDay: currentReminderDay,
          remindedCount: reminderSentCount,
          description: `Re-verification reminders sent to ${reminderSentCount} pending accounts.`
        }
      });
    }
  }

  return { success: true };
}

/**
 * Returns the list of pending users with complete details for the Admin "View List" modal.
 */
async function getPendingOtpUsersList() {
  const now = new Date();
  const latestReset = await GlobalOtpReset.findOne().sort({ triggeredAt: -1 });

  // Query users who require verification (any role, including admins)
  const pendingUsers = await User.find({
    isActive: { $ne: false },
    $or: [
      { verificationRequired: true },
      { otpVerificationRequired: true },
      { verificationStatus: { $in: ['Pending Verification', 'pending', 'expired', 'Expired', 'Overdue'] } },
      { isVerified: false },
      { verificationExpiresAt: { $lte: now } },
      { nextVerificationAt: { $lte: now } },
      { lastVerifiedAt: null }
    ]
  })
    .select('name email phone role parishMemberId familyId createdAt lastLogin lastVerifiedAt verificationExpiresAt nextVerificationAt verificationStatus verificationRequired otpVerificationRequired activeGlobalResetId globalResetId lastOtpSentAt lastOtpReminderSentAt')
    .sort({ createdAt: -1 });

  const formatted = pendingUsers.map(u => {
    const resetDate = latestReset?.triggeredAt || u.createdAt;
    const defaultExpiry = latestReset?.verificationDeadline || (u.lastVerifiedAt ? new Date(new Date(u.lastVerifiedAt).getTime() + 30 * 24 * 60 * 60 * 1000) : null);
    const expiryDate = u.verificationExpiresAt || u.nextVerificationAt || defaultExpiry;

    let displayStatus = 'Pending';
    if (u.verificationStatus === 'Expired' || u.verificationStatus === 'expired' || (expiryDate && now > new Date(expiryDate))) {
      displayStatus = 'Expired';
    } else if (u.verificationRequired || u.otpVerificationRequired) {
      displayStatus = 'Pending';
    }

    return {
      _id: u._id,
      name: u.name || 'Anonymous Parishioner',
      email: u.email || 'None',
      phone: u.phone || 'None',
      role: (u.role || 'user').charAt(0).toUpperCase() + (u.role || 'user').slice(1),
      resetDate: resetDate,
      verificationStatus: displayStatus,
      lastOtpSent: u.lastOtpSentAt || u.lastLogin || null,
      lastReminderSent: u.lastOtpReminderSentAt || null,
      verificationExpiry: expiryDate,
      verifyStatus: displayStatus,
      parishMemberId: u.parishMemberId || 'N/A'
    };
  });

  return formatted;
}

/**
 * Builds standard Catholic branded email template for Security Re-verification.
 */
function buildSecurityEmailHtml({ userName, memberId, clientUrl, deadlineStr, isReminder = false, reminderDay = 0 }) {
  const badgeTitle = isReminder ? `Reminder (Day ${reminderDay}) • Re-verification Required` : `Security Verification Required • 30-Day Window`;
  const mainTitle = isReminder ? `OTP Re-Verification Reminder` : `Security Verification Required`;
  const mainDesc = isReminder
    ? `Your parish account still requires security re-verification. Please complete OTP verification to keep your account active and prevent interruption to parish portal services.`
    : `A security re-verification has been initiated by the Church Administration. Please complete OTP verification to continue using your account. Your re-verification cycle is valid for 30 days.`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(mainTitle)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div style="background-color: #f8fafc; padding: 24px 12px; width: 100%; box-sizing: border-box;">
    <div style="max-width: 580px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; box-sizing: border-box;">
      
      <!-- HEADER -->
      <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 30px 20px; text-align: center; color: #ffffff;">
        <div style="width: 75px; height: 75px; background: #ffffff; border-radius: 50%; margin: 0 auto 12px; overflow: hidden; border: 3px solid #fbbf24; box-shadow: 0 4px 14px rgba(0,0,0,0.25);">
          <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
        </div>
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #fbbf24; letter-spacing: 0.5px;">St. John de Britto Church</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #e2e8f0; font-weight: 500;">புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்</p>
        <div style="display: inline-block; margin-top: 12px; padding: 4px 14px; background: #dc2626; border-radius: 999px; font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.8px;">
          ${escapeHtml(badgeTitle)}
        </div>
      </div>

      <!-- BODY -->
      <div style="padding: 26px 20px;">
        <h2 style="margin: 0 0 10px; font-size: 17px; font-weight: 800; color: #0f172a;">
          Dear ${escapeHtml(userName)},
        </h2>
        <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #475569;">
          ${escapeHtml(mainDesc)}
        </p>

        <!-- NOTICE BOX -->
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 16px; border-radius: 0 10px 10px 0; margin-bottom: 20px;">
          <p style="margin: 0 0 6px; font-size: 13px; font-weight: 800; color: #991b1b;">
            Verification Cycle Details:
          </p>
          <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #7f1d1d; line-height: 1.5;">
            <li style="margin-bottom: 4px;"><strong>Verification Deadline:</strong> ${escapeHtml(deadlineStr)}</li>
            <li style="margin-bottom: 4px;"><strong>Validity:</strong> 30 Days upon successful OTP verification.</li>
            <li><strong>Channel:</strong> OTP codes are delivered securely to your registered WhatsApp &amp; Email.</li>
          </ul>
        </div>

        <!-- ACTION BUTTON -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 16px; text-align: center; margin-bottom: 20px;">
          <p style="margin: 0 0 14px; font-size: 13.5px; font-weight: 700; color: #1e3a8a;">
            Click below to complete verification immediately:
          </p>
          <a href="${clientUrl}/login?verify=true" style="display: inline-block; background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 800; padding: 13px 28px; border-radius: 10px; box-shadow: 0 4px 14px rgba(30, 58, 138, 0.35); text-align: center;">
            Verify Now →
          </a>
        </div>

        <!-- MEMBER INFO FOOTER -->
        <div style="background-color: #f1f5f9; border-radius: 10px; padding: 12px 14px; font-size: 12px; color: #64748b; line-height: 1.5;">
          <strong>Member Name:</strong> ${escapeHtml(userName)} &bull; <strong>Parish ID:</strong> <span style="font-family: monospace;">${escapeHtml(memberId)}</span>
        </div>

      </div>

      <!-- FOOTER -->
      <div style="background-color: #0f172a; padding: 16px 18px; text-align: center; color: #94a3b8; font-size: 11.5px;">
        <p style="margin: 0; font-weight: 700; color: #f8fafc;">St. John de Britto Church, Kalayarkoil</p>
        <p style="margin: 4px 0 0; color: #64748b;">Centralized Security &amp; Verification System</p>
      </div>

    </div>
  </div>
</body>
</html>
  `;
}

// ─── Daily Cron Schedulers (Asia/Kolkata) ──────────────────────────────────────
// 12:00 AM IST & 8:00 AM IST Scans
cron.schedule('0 0 * * *', async () => {
  console.log('[GlobalOtpReset CRON 12:00 AM IST] Scanning 30-day global reset cycles & reminder milestones...');
  await checkAndSendGlobalResetReminders();
}, { timezone: 'Asia/Kolkata' });

cron.schedule('0 8 * * *', async () => {
  console.log('[GlobalOtpReset CRON 8:00 AM IST] Executing daytime reminder dispatch & expiration check...');
  await checkAndSendGlobalResetReminders();
}, { timezone: 'Asia/Kolkata' });

console.log('✅ [GlobalOtpReset Service] 12:00 AM & 8:00 AM IST Schedulers registered (Asia/Kolkata).');

module.exports = {
  triggerGlobalOtpReset,
  recordGlobalOtpVerificationSuccess,
  checkAndSendGlobalResetReminders,
  getPendingOtpUsersList,
  REMINDER_DAYS
};
