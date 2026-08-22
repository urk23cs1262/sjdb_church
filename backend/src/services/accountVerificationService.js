const cron = require('node-cron');
const User = require('../models/User');
const { createNotification } = require('./notificationService');
const { sendPushToUser } = require('./webPushService');
const { sendMail } = require('../config/mailer');
const { notifyAdmin } = require('./adminNotificationService');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Checks all parishioners with pending OTP re-verification, dispatches all types of notifications to them,
 * and sends an official detailed report of all pending users to Church Administrators.
 */
async function checkAndSendMonthlyVerificationReminders({ forceAll = false, triggerSource = 'scheduled' } = {}) {
  try {
    console.log(`[Account Verification Service] Running verification check (trigger: ${triggerSource})...`);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const clientUrl = (process.env.CLIENT_URL || 'https://st-jb-church.vercel.app').replace('http://localhost:5173', 'https://st-jb-church.vercel.app');

    // 1. Find all active parishioners whose re-verification / OTP is pending
    const pendingUsers = await User.find({
      $or: [
        { otpVerified: false },
        { isVerified: false },
        { account_verified: false },
        { otpVerifiedAt: null },
        { otpVerifiedAt: { $lte: thirtyDaysAgo } }
      ],
      isActive: { $ne: false },
      role: { $ne: 'admin' }
    }).select('name email phone parishMemberId familyId createdAt lastLogin last_verified_at otpVerifiedAt last_verification_stage last_verification_reminder_at settings whatsappOptIn preferredLanguage');

    console.log(`[Account Verification Service] Found ${pendingUsers.length} users with pending OTP re-verification.`);

    let remindedCount = 0;
    const pendingSummaryList = [];

    for (const user of pendingUsers) {
      const referenceDate = user.otpVerifiedAt || user.last_verified_at || user.createdAt || now;
      const diffMs = now.getTime() - new Date(referenceDate).getTime();
      const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      // Collect for admin report
      pendingSummaryList.push({
        name: user.name || 'Anonymous Parishioner',
        memberId: user.parishMemberId || 'N/A',
        email: user.email || 'None',
        phone: user.phone || 'None',
        familyId: user.familyId || 'N/A',
        daysPending: diffDays > 30 ? diffDays - 30 : diffDays,
        status: !user.otpVerifiedAt ? 'Initial Verification Pending' : '30-Day Window Expired'
      });

      // If scheduled run and user was already notified within 3 days, avoid spamming unless forceAll is true
      if (!forceAll && user.last_verification_reminder_at) {
        const reminderAgeMs = now.getTime() - new Date(user.last_verification_reminder_at).getTime();
        const reminderAgeDays = Math.floor(reminderAgeMs / (1000 * 60 * 60 * 24));
        if (reminderAgeDays < 3) {
          continue;
        }
      }

      const userName = user.name || 'Parishioner';
      const userMemberId = user.parishMemberId || 'Parish Member';

      // ── A. In-App Notification ─────────────────────────────────────────────
      const notifTitle = "Action Required: Account Re-verification Pending";
      const notifMessage = "Your account re-verification is pending! Please complete your verification quickly so you can continue using all features of the Church website freely and without interruption.\n\nஉங்கள் கணக்கு மறுசரிபார்ப்பு நிலுவையில் உள்ளது! இணையதள சேவைகளை தடையின்றி பயன்படுத்த உடனே சரிபார்க்கவும்.";

      await createNotification({
        userId: user._id,
        title: notifTitle,
        message: notifMessage,
        type: 'account_verification',
        category: 'account',
        priority: 'high',
        actionUrl: '/login?verify=true',
        channels: ['in_app']
      }).catch(e => console.warn('[Verification] in-app notification error:', e.message));

      // ── B. Web Push Notification ────────────────────────────────────────────
      sendPushToUser(user._id, {
        title: "⚡ Re-verification Pending — St. John de Britto's Church",
        body: "Your account re-verification is pending. Complete now to use all church features freely!",
        url: "/login?verify=true",
        icon: "/favicon.png",
        badge: "/favicon.png",
        tag: `sjdb-pending-reverify-${user._id}`
      }).catch(e => console.warn('[Verification] push error:', e.message));

      // ── C. Dedicated Email to Pending User ──────────────────────────────────
      if (user.email && user.settings?.notifications?.email !== false) {
        const userEmailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Action Required: Complete Your Account Re-verification</title>
  <style>
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 12px 8px !important; }
      .email-card { border-radius: 12px !important; }
      .email-body { padding: 20px 14px !important; }
      .email-header { padding: 25px 15px !important; }
      .btn-responsive { display: block !important; width: 100% !important; box-sizing: border-box !important; padding: 14px 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div class="email-wrapper" style="background-color: #f8fafc; padding: 24px 12px; width: 100%; box-sizing: border-box;">
    <div class="email-card" style="max-width: 580px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; box-sizing: border-box;">
      
      <!-- HEADER -->
      <div class="email-header" style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 30px 20px; text-align: center; color: #ffffff;">
        <div style="width: 75px; height: 75px; background: #ffffff; border-radius: 50%; margin: 0 auto 12px; overflow: hidden; border: 3px solid #fbbf24; box-shadow: 0 4px 14px rgba(0,0,0,0.25);">
          <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
        </div>
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #fbbf24; letter-spacing: 0.5px;">St. John de Britto's Church</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #e2e8f0; font-weight: 500;">புனித அருளானந்தர் தேவாலயம்</p>
        <div style="display: inline-block; margin-top: 12px; padding: 4px 14px; background: #dc2626; border-radius: 999px; font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.8px;">
          Action Required • Re-verification Pending
        </div>
      </div>

      <!-- BODY -->
      <div class="email-body" style="padding: 26px 20px;">
        <h2 style="margin: 0 0 10px; font-size: 17px; font-weight: 800; color: #0f172a;">
          Dear ${escapeHtml(userName)},
        </h2>
        <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #475569;">
          Your parish account re-verification is <strong>currently pending</strong>. Please complete your verification quickly so you can continue using all features of the Church website freely and without interruption.
        </p>

        <!-- URGENT NOTICE BOX -->
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 16px; border-radius: 0 10px 10px 0; margin-bottom: 20px;">
          <p style="margin: 0 0 6px; font-size: 13px; font-weight: 800; color: #991b1b;">
            Why Re-verification is Important:
          </p>
          <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #7f1d1d; line-height: 1.5;">
            <li style="margin-bottom: 4px;">Enables unhindered access to Mass Intentions, Certificate requests, and Event registrations.</li>
            <li style="margin-bottom: 4px;">Keeps your family records and sacraments strictly protected.</li>
            <li>Grants a 30-day seamless access window across all your devices once verified.</li>
          </ul>
        </div>

        <!-- ACTION BUTTON -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 16px; text-align: center; margin-bottom: 20px;">
          <p style="margin: 0 0 14px; font-size: 13.5px; font-weight: 700; color: #1e3a8a;">
            Click below to verify in less than 1 minute:
          </p>
          <a href="${clientUrl}/login?verify=true" class="btn-responsive" style="display: inline-block; background: linear-gradient(135deg, #d97706 0%, #b45309 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 800; padding: 13px 28px; border-radius: 10px; box-shadow: 0 4px 14px rgba(217, 119, 6, 0.35); text-align: center;">
            Verify Account Now / உடனே சரிபார்க்கவும் →
          </a>
        </div>

        <!-- TAMIL NOTICE -->
        <div style="border-top: 1px dashed #cbd5e1; padding-top: 16px; margin-bottom: 16px;">
          <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #334155;">
            தமிழ் அறிவிப்பு (Tamil Notice):
          </p>
          <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">
            அன்பார்ந்த பங்கு மக்களே, உங்கள் பங்கு கணக்கு மறுசரிபார்ப்பு நிலுவையில் உள்ளது. தேவாலய இணையதளத்தில் திருப்பலி வேண்டுதல்கள், சான்றிதழ்கள் மற்றும் நிகழ்வுகளை தடையின்றி பயன்படுத்த உடனே உங்கள் கணக்கை சரிபார்க்கவும்.
          </p>
        </div>

        <!-- MEMBER INFO FOOTER -->
        <div style="background-color: #f1f5f9; border-radius: 10px; padding: 12px 14px; font-size: 12px; color: #64748b; line-height: 1.5;">
          <strong>Member Name:</strong> ${escapeHtml(userName)} &bull; <strong>Parish ID:</strong> <span style="font-family: monospace;">${escapeHtml(userMemberId)}</span>
        </div>

      </div>

      <!-- FOOTER -->
      <div style="background-color: #0f172a; padding: 16px 18px; text-align: center; color: #94a3b8; font-size: 11.5px;">
        <p style="margin: 0; font-weight: 700; color: #f8fafc;">St. John de Britto's Church, Kalayarkoil</p>
        <p style="margin: 4px 0 0; color: #64748b;">Parish Security & Verification System</p>
      </div>

    </div>
  </div>
</body>
</html>
        `;

        await sendMail({
          to: user.email,
          subject: `Action Required: Complete Your Account Re-verification — St. John de Britto's Church`,
          html: userEmailHtml
        }).catch(e => console.warn(`[Verification] Email error to ${user.email}:`, e.message));
      }

      // ── D. WhatsApp Bot Message to User ─────────────────────────────────────
      if (user.phone) {
        const userWaMsg = `*St. John de Britto's Church, Kalayarkoil*\n*Account Re-verification Pending*\n\nDear *${userName}* (ID: ${userMemberId}),\n\nYour parish account re-verification is *pending*. Please complete your OTP verification to use all features of the Church website freely without interruption.\n\n*Verify Account Now:*\n${clientUrl}/login?verify=true\n\n_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_`;

        require('../bot/whatsapp').sendWhatsAppMessage(user.phone, userWaMsg).catch(() => {});
      }

      user.last_verification_reminder_at = now;
      await user.save();
      remindedCount++;
    }

    // 2. Send all types of notifications with detailed summary report of all pending users to Church Administrators
    let adminReportSent = false;
    if (pendingSummaryList.length > 0) {
      try {
        const admins = await User.find({ role: 'admin', isActive: { $ne: false } }).select('name email phone _id settings');

        // Mobile-Optimized Parishioner Info Cards (guarantees 100% visibility of all fields on mobile)
        const memberCardsHtml = pendingSummaryList.map((u, i) => `
          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.03); box-sizing: border-box;">
            <div style="margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
              <div style="font-weight: 800; font-size: 15px; color: #0f172a; margin-bottom: 2px;">
                ${i + 1}. ${escapeHtml(u.name)}
              </div>
              <div style="display: inline-block; background-color: #f1f5f9; color: #475569; font-size: 11.5px; font-weight: 700; font-family: monospace; padding: 2px 8px; border-radius: 6px;">
                ID: ${escapeHtml(u.memberId)}
              </div>
              <div style="display: inline-block; float: right; background-color: #fee2e2; color: #dc2626; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 999px;">
                ${u.daysPending}d Pending
              </div>
              <div style="clear: both;"></div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
              <tr>
                <td style="padding: 4px 0; color: #64748b; font-weight: 600; width: 75px; vertical-align: top;">Email:</td>
                <td style="padding: 4px 0; color: #0f172a; word-break: break-all;">
                  <a href="mailto:${escapeHtml(u.email)}" style="color: #1e3a8a; font-weight: 600; text-decoration: none;">${escapeHtml(u.email)}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b; font-weight: 600; vertical-align: top;">Phone:</td>
                <td style="padding: 4px 0; color: #0f172a;">
                  <a href="tel:${escapeHtml(u.phone)}" style="color: #1e3a8a; font-weight: 600; text-decoration: none;">${escapeHtml(u.phone)}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b; font-weight: 600; vertical-align: top;">Status:</td>
                <td style="padding: 4px 0;">
                  <span style="background-color: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; display: inline-block;">
                    ${escapeHtml(u.status)}
                  </span>
                </td>
              </tr>
            </table>
          </div>
        `).join('');

        const adminEmailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Parishioner Account Re-verification Report</title>
  <style>
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 12px 8px !important; }
      .email-card { border-radius: 12px !important; }
      .email-body { padding: 18px 12px !important; }
      .email-header { padding: 25px 15px !important; }
      .btn-responsive { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div class="email-wrapper" style="background-color: #f1f5f9; padding: 24px 12px; width: 100%; box-sizing: border-box;">
    <div class="email-card" style="max-width: 620px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; box-sizing: border-box;">
      
      <!-- HEADER -->
      <div class="email-header" style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 28px 20px; text-align: center; color: #ffffff;">
        <div style="width: 75px; height: 75px; background: #ffffff; border-radius: 50%; margin: 0 auto 12px; overflow: hidden; border: 3px solid #fbbf24; box-shadow: 0 4px 14px rgba(0,0,0,0.2);">
          <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
        </div>
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #fbbf24;">St. John de Britto's Church — Administration</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #e2e8f0; font-weight: 600;">Parishioner Account Re-verification Status Report</p>
        <div style="display: inline-block; margin-top: 12px; padding: 4px 14px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); border-radius: 999px; font-size: 11.5px; font-weight: 800; color: #fca5a5;">
          ${pendingSummaryList.length} Parishioners Pending Re-verification
        </div>
      </div>

      <!-- BODY -->
      <div class="email-body" style="padding: 24px 18px;">
        <p style="margin: 0 0 16px; font-size: 13.5px; color: #475569; line-height: 1.6;">
          Below is the complete status report of parishioners whose account re-verification is currently pending after 30 days. Multi-channel notifications have been dispatched across Email, In-App Notifications, Web Push, and WhatsApp.
        </p>

        <!-- MEMBER CARDS LIST -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; margin-bottom: 20px; box-sizing: border-box;">
          ${memberCardsHtml}
        </div>

        <!-- QUICK ACTIONS -->
        <div style="text-align: center; padding-top: 10px;">
          <a href="${clientUrl}/admin/users" style="display: inline-block; background: #1e3a8a; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(30, 58, 138, 0.3);">
            Open Admin User Management →
          </a>
        </div>

        <!-- TIMESTAMP -->
        <div style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 18px; margin-top: 25px;">
          Report generated at ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST • Daily 8:00 AM Scan (${triggerSource})
        </div>
      </div>

    </div>
  </div>
</body>
</html>
        `;

        for (const admin of admins) {
          // A. Email Notification to Admin
          if (admin.email) {
            await sendMail({
              to: admin.email,
              subject: `Parishioner Re-verification Report (${pendingSummaryList.length} Pending) — St. John de Britto's Church`,
              html: adminEmailHtml
            }).catch(e => console.warn(`[Admin Report] Email error to ${admin.email}:`, e.message));
          }

          // B. Web Push Notification to Admin
          sendPushToUser(admin._id, {
            title: `Parishioner Re-verification Alert (${pendingSummaryList.length} Pending)`,
            body: `${pendingSummaryList.length} parishioners have pending account re-verifications exceeding 30 days. Click to view.`,
            url: "/admin/users",
            icon: "/favicon.png",
            badge: "/favicon.png",
            tag: `sjdb-admin-reverify-report-${Date.now()}`
          }).catch(e => console.warn(`[Admin Push] error to admin ${admin._id}:`, e.message));

          // C. WhatsApp Alert to Admin Phone
          if (admin.phone) {
            const adminWaText = `⛪ *St. John de Britto's Church — Admin Alert*\n\n📋 *Parishioner Re-verification Status Report*\n*${pendingSummaryList.length} parishioners* currently have pending OTP re-verifications exceeding 30 days.\n\n🔗 *Manage in Admin Dashboard:* ${clientUrl}/admin/users\n\n_புனித அருளானந்தர் தேவாலயம்_`;
            require('../bot/whatsapp').sendWhatsAppMessage(admin.phone, adminWaText).catch(() => {});
          }
        }

        // D. In-App Notification in Admin Notification Center
        await createNotification({
          recipient: 'admin',
          title: `Parishioner Re-verification Report: ${pendingSummaryList.length} Pending`,
          message: `${pendingSummaryList.length} parishioners currently have pending OTP re-verifications exceeding 30 days. Multi-channel reminders have been dispatched.`,
          type: 'account_verification',
          category: 'account',
          priority: 'high',
          actionUrl: '/admin/users',
          channels: ['in_app']
        }).catch(e => console.warn('[Admin In-App] notification error:', e.message));

        // E. Admin Activity Stream
        notifyAdmin({
          type: 'SECURITY_ALERT',
          title: 'Pending Account Re-verifications Report',
          reason: `${pendingSummaryList.length} parishioners currently have pending OTP re-verifications. Full multi-channel report dispatched to church administrators.`
        }).catch(() => {});

        adminReportSent = true;
      } catch (adminErr) {
        console.error('[Account Verification Service] Admin report error:', adminErr);
      }
    }

    console.log(`[Account Verification Service] Finished. Sent reminders to ${remindedCount} users. Admin report sent: ${adminReportSent}`);
    return { success: true, remindedCount, pendingCount: pendingSummaryList.length, adminReportSent };
  } catch (err) {
    console.error('[Account Verification Service] Error running verification check:', err);
    return { success: false, error: err.message };
  }
}

// ─── 8:00 AM IST Daily Automated Verification Scanner & Admin Alert ───────────
cron.schedule('0 8 * * *', async () => {
  console.log('[CRON 8:00 AM IST] Executing Monthly Account Verification scanner & Admin alert...');
  await checkAndSendMonthlyVerificationReminders({ triggerSource: 'cron_daily_8am' });
}, {
  timezone: 'Asia/Kolkata'
});

console.log('[Account Verification Service] Daily 8:00 AM IST Verification Scheduler & Admin Alert registered (Asia/Kolkata).');

module.exports = {
  checkAndSendMonthlyVerificationReminders
};
