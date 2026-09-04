const path = require('path');
const fs = require('fs');
const { sendMail } = require('../config/mailer');
const { sendSMS, sendWhatsApp } = require('../config/twilio');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { generateUserReportPdf } = require('./userReportPdfService');

/**
 * Parses client IP address and location cleanly from request.
 */
const getClientIp = (req) => {
  if (!req) return '127.0.0.1';
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
};

/**
 * Parses user agent into device/browser snapshot.
 */
const getDeviceSnapshot = (req) => {
  const ua = req?.headers ? req.headers['user-agent'] || '' : '';
  let browser = 'Web Browser';
  let os = 'Unknown OS';
  let device = 'Desktop';

  if (/mobile/i.test(ua)) device = 'Mobile Device';
  else if (/tablet|ipad/i.test(ua)) device = 'Tablet';

  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  if (/edg/i.test(ua)) browser = 'Microsoft Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Google Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/safari/i.test(ua)) browser = 'Apple Safari';

  return { browser, os, device, raw: ua };
};

/**
 * Centralized Administrator Notification & Security Activity Service.
 *
 * @param {Object} event
 * @param {string} event.type - Event type (e.g. 'NEW_USER', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'OTP_EXPIRED', etc.)
 * @param {Object} [event.user] - User document or partial object
 * @param {string} [event.userId] - User ID
 * @param {Object} [event.req] - Express request object for IP and User-Agent telemetry
 * @param {string} [event.reason] - Reason for failure or details
 * @param {number} [event.attempt] - Attempt counter
 * @param {Object} [event.extra] - Additional context dictionary
 */
const notifyAdmin = async (event) => {
  try {
    const { type, req, reason, attempt, extra = {} } = event;
    let user = event.user;

    if (!user && event.userId) {
      user = await User.findById(event.userId);
    }

    const ip = extra.ip || getClientIp(req);
    const sessionInfo = extra.sessionInfo || getDeviceSnapshot(req);
    const now = new Date();
    const formattedTime = now.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const memberId = user?.parishMemberId || extra.memberId || 'N/A';
    const familyId = user?.familyId || extra.familyId || 'N/A';
    const userName = user?.name || extra.name || 'Anonymous / Unregistered';
    const userEmail = user?.email || extra.email || 'None';
    const userPhone = user?.phone || extra.phone || 'None';

    let title = 'Admin Security & Activity Notification';
    let message = '';
    let category = 'system';
    let priority = 'low';
    let pdfUrl = null;
    let sendEmailAlert = false;
    let sendSmsAlert = false;
    let emailSubject = '';

    switch (type) {
      case 'NEW_USER': {
        title = ` New Member Registered: ${userName}`;
        message = `${userName} (${userEmail} / ${userPhone}) has registered.\nMember ID: ${memberId} | Family ID: ${familyId}\nTime: ${formattedTime}\nDevice: ${sessionInfo.browser} on ${sessionInfo.os} (${sessionInfo.device})`;
        category = 'account';
        priority = 'medium';
        sendEmailAlert = true;
        emailSubject = ` New Member Registered — ${userName} (${memberId})`;

        // Generate official Member Registration PDF Report
        try {
          pdfUrl = await generateUserReportPdf(user, { ip, ...sessionInfo });
          if (user?._id) {
            await User.findByIdAndUpdate(user._id, { registrationReportPdfUrl: pdfUrl });
          }
        } catch (pdfErr) {
          console.error('Failed to generate user report PDF:', pdfErr.message);
        }
        break;
      }

      case 'LOGIN_SUCCESS': {
        const isFirstLogin = Boolean(extra.isFirstLogin) || !user?.firstSuccessfulLoginAt;
        // Do NOT send or create notifications for routine logins by existing/old users
        if (!isFirstLogin) {
          return null;
        }

        title = ` First Login: ${userName}`;
        message = `${userName} (${memberId}) completed their first login successfully.\nTime: ${formattedTime}\nIP: ${ip} | Device: ${sessionInfo.browser} (${sessionInfo.os})`;
        category = 'account';
        priority = 'low';
        sendEmailAlert = true;
        emailSubject = ` First Successful Login & Member Report — ${userName} (${memberId})`;
        try {
          pdfUrl = user?.registrationReportPdfUrl || await generateUserReportPdf(user, { ip, ...sessionInfo });
        } catch (e) {
          console.error('PDF error on first login:', e.message);
        }
        break;
      }

      case 'LOGIN_ATTEMPT': {
        title = ` Login Attempt: ${userName}`;
        message = `Login attempt recorded for ${userName} (${userEmail || userPhone}).\nStatus: ${reason || 'Pending Authentication'}\nIP: ${ip} | Device: ${sessionInfo.browser} (${sessionInfo.os})`;
        category = 'security';
        priority = 'low';
        break;
      }

      case 'LOGIN_FAILED': {
        title = ` Failed Login Attempt: ${userEmail !== 'None' ? userEmail : userPhone}`;
        message = `Failed login attempt (#${attempt || 1}) for ${userEmail !== 'None' ? userEmail : userPhone}.\nReason: ${reason || 'Invalid Credentials'}\nIP: ${ip} | Device: ${sessionInfo.browser} (${sessionInfo.os})\nTime: ${formattedTime}`;
        category = 'security';
        priority = 'medium';
        sendEmailAlert = (attempt || 1) >= 3; // Email after 3 failures
        emailSubject = ` Failed Login Attempt Alert — ${userEmail !== 'None' ? userEmail : userPhone}`;
        break;
      }

      case 'OTP_SENT': {
        const purposeText = extra.purpose ? extra.purpose.toUpperCase() : 'AUTHENTICATION';
        title = ` Verification OTP Dispatched: ${userName}`;
        message = `A 6-digit verification code was sent to ${userPhone || userEmail} for ${purposeText}.\n(Note: Authentication codes are strictly omitted from admin logs for privacy).\nExpires in: 5 minutes\nTime: ${formattedTime}\nIP: ${ip}`;
        category = 'auth';
        priority = 'low';
        break;
      }

      case 'OTP_REISSUED': {
        const purposeText = extra.purpose ? extra.purpose.toUpperCase() : 'AUTHENTICATION';
        title = ` OTP Reissued: ${userName}`;
        message = `A fresh verification OTP was reissued for ${userName} (${userEmail !== 'None' ? userEmail : userPhone}).\nPurpose: ${purposeText}\nPrevious Status: Replaced / Abandoned\nNew OTP Status: Active (Expires in 5 mins)\nTime: ${formattedTime}\nIP: ${ip}`;
        category = 'auth';
        priority = 'low';
        break;
      }

      case 'OTP_VERIFIED': {
        title = ` OTP Verified: ${userName}`;
        message = `Account verification OTP confirmed successfully for ${userName} (${memberId}).\nTime: ${formattedTime}`;
        category = 'auth';
        priority = 'low';
        break;
      }

      case 'OTP_EXPIRED': {
        title = ` OTP Verification Abandoned: ${userName}`;
        message = `Verification code for ${userName} (${userEmail} / ${userPhone}) expired without being verified.\nMember ID: ${memberId}\nTime: ${formattedTime}\nStatus: Not Verified (OTP Expired)`;
        category = 'security';
        priority = 'medium';
        sendEmailAlert = true;
        emailSubject = ` OTP Verification Expired / Abandoned — ${userName}`;
        break;
      }

      case 'MULTIPLE_FAILED_OTP': {
        title = ` Repeated Invalid OTP Attempts: ${userName}`;
        message = `Multiple failed OTP verification attempts (${attempt || 5}+) detected for ${userName} (${userEmail !== 'None' ? userEmail : userPhone}).\nVerification session suspended.\nIP: ${ip}\nDevice: ${sessionInfo.browser} (${sessionInfo.os})\nTime: ${formattedTime}`;
        category = 'security';
        priority = 'critical';
        sendEmailAlert = true;
        sendSmsAlert = true;
        emailSubject = ` Security Alert: Repeated Invalid OTP Attempts on ${userName}`;
        break;
      }

      case 'MULTIPLE_FAILED_LOGIN': {
        title = ` Critical Security Alert: Multiple Failed Logins`;
        message = `Multiple failed login attempts (${attempt || 5}+) detected for account ${userEmail !== 'None' ? userEmail : userPhone}.\nTarget User: ${userName} (${memberId})\nIP Address: ${ip}\nDevice: ${sessionInfo.browser} (${sessionInfo.os})\nAction: Brute-force protection initiated.`;
        category = 'security';
        priority = 'critical';
        sendEmailAlert = true;
        sendSmsAlert = true;
        emailSubject = ` CRITICAL SECURITY ALERT: Multiple Failed Logins on ${userName}`;
        break;
      }

      case 'ACCOUNT_LOCKED': {
        title = ` Security Alert: Account Temporarily Locked`;
        message = `User account for ${userName} (${memberId}) has been locked for 15 minutes due to excessive failed attempts.\nIP: ${ip}\nTime: ${formattedTime}`;
        category = 'security';
        priority = 'critical';
        sendEmailAlert = true;
        sendSmsAlert = true;
        emailSubject = ` Account Lockout Alert — ${userName} (${memberId})`;
        break;
      }

      case 'PASSWORD_RESET': {
        title = ` Password Reset Event: ${userName}`;
        message = `Password reset ${reason || 'action completed'} for ${userName} (${userEmail || userPhone}).\nIP: ${ip} | Device: ${sessionInfo.browser} (${sessionInfo.os})\nTime: ${formattedTime}`;
        category = 'security';
        priority = 'medium';
        sendEmailAlert = true;
        emailSubject = ` Password Reset Notification — ${userName}`;
        break;
      }

      case 'FIRST_BOT_INTERACTION': {
        const isRegistered = Boolean(extra.isRegistered);
        title = `✨ First-Time WhatsApp Bot User: ${userName}`;
        message = `A user has interacted with the SJDB Connect WhatsApp Bot for the first time.\n\n• Identity: ${isRegistered ? 'Registered Parishioner' : 'Unregistered User'}\n• Name: ${userName}\n• WhatsApp Number: ${userPhone}\n• Email: ${userEmail}\n• Account Status: ${extra.accountStatus || (isRegistered ? 'Registered & Active' : 'Unregistered')}\n• Preferred Language: ${extra.language || 'Tamil (தமிழ்)'}\n• First Message / Action: "${extra.initialMessage || 'Hi'}"\n• Time: ${formattedTime}`;
        category = 'system';
        priority = 'medium';
        sendEmailAlert = true;
        emailSubject = `✨ First-Time WhatsApp Bot User — ${userName} (${userPhone})`;
        break;
      }

      default: {
        title = event.title || ` Security & User Activity Event: ${type}`;
        message = event.message || `Activity event ${type} logged for ${userName}.`;
        category = 'system';
        priority = event.priority || 'low';
      }
    }

    // 1. Create In-App Notification for Admin Panel
    const notif = await Notification.create({
      recipient: 'admin',
      userId: user?._id,  // Set userId so populate() works in admin notification detail modal
      title,
      message,
      type: category,
      category,
      priority,
      actionUrl: '/admin/notifications',
      fileUrl: pdfUrl,
      relatedId: user?._id,
      relatedModel: 'User',
      metadata: {
        eventType: type,
        userId: user?._id,
        userName,
        userEmail,
        userPhone,
        memberId,
        familyId,
        ip,
        device: `${sessionInfo.browser} / ${sessionInfo.os}`,
        reason,
        attempt,
        pdfUrl,
        timestamp: now
      },
      sentVia: [
        ...(sendEmailAlert ? ['email'] : []),
        ...(sendSmsAlert ? ['sms'] : [])
      ]
    });


    // 2. Dispatch Email Alert to System Administrators
    if (sendEmailAlert) {
      const admins = await User.find({ role: 'admin' }).select('email phone name');
      const attachments = [];

      if (pdfUrl) {
        const absolutePdfPath = path.join(__dirname, '..', '..', pdfUrl);
        if (fs.existsSync(absolutePdfPath)) {
          attachments.push({
            filename: path.basename(pdfUrl),
            path: absolutePdfPath,
            contentType: 'application/pdf'
          });
        }
      }

      for (const admin of admins) {
        if (admin.email) {
          const isCritical = priority === 'critical';
          const isWarning = priority === 'high' || isCritical;
          const priorityBg = isCritical ? '#fee2e2' : isWarning ? '#fef3c7' : '#e0e7ff';
          const priorityColor = isCritical ? '#dc2626' : isWarning ? '#b45309' : '#1e3a8a';
          const eventLabel = type.replace(/_/g, ' ');

          sendMail({
            to: admin.email,
            subject: emailSubject || `Admin Notification: ${title}`,
            attachments,
            html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title}</title>
  <style>
    body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; }
    img { border: 0; outline: none; text-decoration: none; }
    .email-container { max-width: 600px; margin: 0 auto; width: 100%; }
    .card-item { margin-bottom: 10px; padding: 12px 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; }
    .label-text { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .value-text { font-size: 14px; font-weight: 700; color: #0f172a; word-break: break-word; overflow-wrap: anywhere; }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 12px 8px !important; }
      .email-content { padding: 20px 16px !important; }
      .header-box { padding: 24px 16px !important; }
      .action-btn { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;">
  <div class="email-wrapper" style="background-color:#f1f5f9; padding:25px 12px;">
    <div class="email-container" style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
      
      <!-- HEADER -->
      <div class="header-box" style="background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%); padding:28px 24px; text-align:center; color:#ffffff;">
        <div style="width:75px; height:75px; margin:0 auto 12px; border-radius:50%; background:#ffffff; overflow:hidden; border:3px solid #fbbf24; box-shadow:0 6px 16px rgba(0,0,0,0.25);">
          <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
        </div>
        <h1 style="color:#fbbf24; margin:0 0 4px; font-size:22px; font-weight:800; letter-spacing:0.5px;">St. John de britto Church</h1>
        <p style="margin:0; font-size:12px; color:#e2e8f0; font-weight:600; letter-spacing:0.5px; opacity:0.9;">PARISH ADMINISTRATION & SECURITY REGISTRY</p>
      </div>

      <!-- MAIN CONTENT -->
      <div class="email-content" style="padding:28px 24px;">
        
        <!-- Priority Pill -->
        <div style="margin-bottom:16px;">
          <span style="display:inline-block; background-color:${priorityBg}; color:${priorityColor}; font-size:11px; font-weight:800; padding:5px 12px; border-radius:999px; text-transform:uppercase; letter-spacing:0.5px; border:1px solid ${isCritical ? '#fca5a5' : '#cbd5e1'};">
            ${isCritical ? ' CRITICAL SECURITY' : priority.toUpperCase() + ' PRIORITY'} • ${eventLabel}
          </span>
        </div>

        <!-- Headline -->
        <h2 style="color:#1e3a8a; margin:0 0 12px; font-size:19px; font-weight:800; line-height:1.35;">
          ${title}
        </h2>

        <!-- Event Summary Box -->
        <div style="background-color:#f8fafc; border-left:4px solid #1e3a8a; padding:14px 16px; border-radius:8px; margin-bottom:20px; font-size:13.5px; line-height:1.6; color:#334155; word-break:break-word;">
          ${message.replace(/\n/g, '<br>')}
        </div>

        <!-- DETAILS SECTION -->
        <div style="margin-bottom:22px;">
          <div style="font-size:12px; font-weight:800; color:#1e3a8a; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px; border-bottom:1px solid #e2e8f0; padding-bottom:6px;">
             Telemetry & Account Information
          </div>

          <!-- Parishioner Name -->
          <div class="card-item" style="margin-bottom:10px; padding:12px 14px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;">
            <div class="label-text" style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:3px;"> Parishioner Name</div>
            <div class="value-text" style="font-size:14px; font-weight:800; color:#0f172a;">${userName}</div>
          </div>

          <!-- IDs -->
          <div class="card-item" style="margin-bottom:10px; padding:12px 14px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;">
            <div class="label-text" style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:6px;">Member ID & Family ID</div>
            <div style="font-size:13px; font-weight:700; color:#0f172a;">
              <span style="display:inline-block; background-color:#e0e7ff; color:#3730a3; padding:4px 10px; border-radius:6px; font-family:monospace; font-weight:800; font-size:12.5px; margin-right:6px; margin-bottom:4px; border:1px solid #c7d2fe;">Member: ${memberId}</span>
              <span style="display:inline-block; background-color:#dbeafe; color:#1e40af; padding:4px 10px; border-radius:6px; font-family:monospace; font-weight:800; font-size:12.5px; margin-bottom:4px; border:1px solid #bfdbfe;">Family: ${familyId}</span>
            </div>
          </div>

          <!-- Email & Phone (Stacked for zero truncation on mobile screens) -->
          <div class="card-item" style="margin-bottom:10px; padding:12px 14px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;">
            <div class="label-text" style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:4px;"> Contact Information</div>
            <div style="font-size:13.5px; font-weight:700; color:#2563eb; word-break:break-all; overflow-wrap:anywhere; margin-bottom:6px;">
              ${userEmail !== 'None' ? `Email: <a href="mailto:${userEmail}" style="color:#2563eb; text-decoration:none;">${userEmail}</a>` : '<span style="color:#94a3b8;">Email: None</span>'}
            </div>
            <div style="font-size:13px; font-weight:700; color:#334155;">
              ${userPhone !== 'None' ? `Mobile: <a href="tel:${userPhone}" style="color:#334155; text-decoration:none;">${userPhone}</a>` : '<span style="color:#94a3b8;">Mobile: None</span>'}
            </div>
          </div>

          <!-- Client Device & Telemetry -->
          <div class="card-item" style="margin-bottom:10px; padding:12px 14px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;">
            <div class="label-text" style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:3px;"> Client Device & Telemetry</div>
            <div style="font-size:13px; font-weight:700; color:#0f172a; word-break:break-word; margin-bottom:6px;">
              ${sessionInfo.browser} on ${sessionInfo.os} (${sessionInfo.device})
            </div>
            <div>
              <span style="display:inline-block; background-color:#f1f5f9; color:#475569; padding:3px 10px; border-radius:6px; font-family:monospace; font-size:12px; font-weight:700; border:1px solid #cbd5e1;">
                IP: ${ip}
              </span>
            </div>
          </div>

          <!-- Timestamp -->
          <div class="card-item" style="margin-bottom:10px; padding:12px 14px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;">
            <div class="label-text" style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:3px;"> Event Timestamp</div>
            <div style="font-size:13px; font-weight:700; color:#0f172a;">${formattedTime}</div>
          </div>

          ${reason ? `
          <!-- Reason / Status -->
          <div class="card-item" style="margin-bottom:10px; padding:12px 14px; background-color:#fff7ed; border:1px solid #fed7aa; border-radius:10px;">
            <div class="label-text" style="font-size:10.5px; font-weight:700; color:#c2410c; text-transform:uppercase; margin-bottom:3px;"> Audit Reason / Status</div>
            <div style="font-size:13px; font-weight:700; color:#9a3412;">${reason}</div>
          </div>
          ` : ''}
        </div>

        ${pdfUrl ? `
        <!-- ATTACHED PDF CALLOUT -->
        <div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5); border:1.5px solid #6ee7b7; border-radius:14px; padding:16px 18px; margin-bottom:22px; text-align:center;">
          <div style="font-size:24px; margin-bottom:4px;"></div>
          <p style="margin:0 0 4px; font-size:14px; color:#065f46; font-weight:800;">Member Details & Registration PDF Attached</p>
          <p style="margin:0; font-size:12px; color:#047857; line-height:1.5;">The complete confidential parish record has been attached to this email and saved to the administration archive.</p>
        </div>
        ` : ''}

        <!-- ACTION BUTTON -->
        <div style="text-align:center; margin-top:24px;">
          <a class="action-btn" href="${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/notifications" style="background:linear-gradient(135deg,#1e3a8a,#1e40af); color:#ffffff; text-decoration:none; padding:13px 28px; border-radius:12px; font-weight:800; font-size:13.5px; display:inline-block; box-shadow:0 4px 14px rgba(30,58,138,0.35);">
            Open Admin Notification Center →
          </a>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="background-color:#0f172a; padding:20px 16px; text-align:center; color:#94a3b8; font-size:11.5px; line-height:1.6;">
        <p style="margin:0 0 4px; font-weight:700; color:#cbd5e1;">St. John de britto Church, Kalayarkoil - 630551</p>
        <p style="margin:0; color:#64748b;">Automated Administrative Notification • Plain credentials & passwords strictly excluded</p>
      </div>
    </div>
  </div>
</body>
</html>`
          }).catch(err => console.error(` Admin email alert error (${admin.email}):`, err.message));
        }
      }
    }

    // 3. Dispatch Critical SMS / WhatsApp Alert
    if (sendSmsAlert) {
      const admins = await User.find({ role: 'admin' }).select('phone');
      for (const admin of admins) {
        if (admin.phone) {
          let formattedPhone = admin.phone.trim();
          if (!formattedPhone.startsWith('+')) formattedPhone = '+91' + formattedPhone;
          const smsText = ` SJDB Church Security Alert: ${title}\nUser: ${userName}\nIP: ${ip}\nTime: ${formattedTime}`;
          sendSMS(formattedPhone, smsText).catch(e => console.warn('Admin SMS alert error:', e.message));
        }
      }
    }

    return notif;
  } catch (err) {
    console.error(' notifyAdmin error:', err.message);
  }
};

module.exports = { notifyAdmin, getClientIp, getDeviceSnapshot };
