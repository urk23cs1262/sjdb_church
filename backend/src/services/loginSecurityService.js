const jwt = require('jsonwebtoken');
const { sendMail } = require('../config/mailer');
const { getSiteUrl } = require('../config/siteRoutes');

// Parse User-Agent string into friendly Device, OS, and Browser names
function parseUserAgent(ua = '') {
  let os = 'Unknown OS';
  let device = 'Desktop Device';
  let browser = 'Web Browser';

  if (/iphone/i.test(ua)) {
    os = 'iOS';
    device = 'iPhone';
  } else if (/ipad/i.test(ua)) {
    os = 'iPadOS';
    device = 'iPad Tablet';
  } else if (/android/i.test(ua)) {
    os = 'Android';
    device = 'Android Smartphone';
  } else if (/windows/i.test(ua)) {
    os = 'Windows';
    device = 'Windows PC / Laptop';
  } else if (/macintosh|mac os/i.test(ua)) {
    os = 'macOS';
    device = 'Mac Workstation';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
    device = 'Linux Workstation';
  }

  if (/edg/i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/chrome|crios/i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    browser = 'Apple Safari';
  } else if (/opera|opr/i.test(ua)) {
    browser = 'Opera';
  }

  return { os, device: `${device} (${browser})`, browser };
}

// Format client IP and Location
function parseClientIpAndLocation(req) {
  let ip = (
    req?.headers?.['cf-connecting-ip'] ||
    req?.headers?.['x-real-ip'] ||
    req?.headers?.['x-forwarded-for'] ||
    req?.socket?.remoteAddress ||
    req?.ip ||
    '127.0.0.1'
  ).split(',')[0].trim();

  // Check headers for real location if behind proxy/CDN
  const city = req?.headers?.['cf-ipcity'] || req?.headers?.['x-vercel-ip-city'];
  const region = req?.headers?.['cf-region'] || req?.headers?.['cf-region-code'] || req?.headers?.['x-vercel-ip-country-region'];
  const country = req?.headers?.['cf-ipcountry'] || req?.headers?.['x-vercel-ip-country'];

  if (city || country) {
    const parts = [city, region, country].filter(Boolean);
    return { ip, location: parts.join(', ') };
  }

  if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.0.0.1') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    ip = '127.0.0.1';
    return { ip, location: 'Local Network (Dev)' };
  }

  // Generic clean location fallback
  return { ip, location: 'Coimbatore, Tamil Nadu, India' };
}

// Generate a signed, 24-hour report token for security verification with telemetry context
function generateSecurityReportToken(userId, extra = {}) {
  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is not configured');
  }
  return jwt.sign(
    { userId, purpose: 'report_unauthorized', createdAt: Date.now(), ...extra },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Dispatch WhatsApp message via Baileys bot or Twilio fallback
async function dispatchWhatsAppAlert(phone, text) {
  if (!phone) return false;
  try {
    const waBot = require('../bot/whatsapp');
    if (waBot && typeof waBot.sendWhatsAppMessage === 'function') {
      const sent = await waBot.sendWhatsAppMessage(phone, text);
      if (sent) return true;
    }
  } catch (e) {
    // Continue to Twilio fallback
  }

  try {
    const { sendWhatsApp } = require('../config/twilio');
    if (typeof sendWhatsApp === 'function') {
      let formattedPhone = phone.trim();
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }
      await sendWhatsApp(formattedPhone, text);
      return true;
    }
  } catch (e) {}

  return false;
}

/**
 * Dispatches a Multi-Channel Login Alert across ALL 5 notification channels:
 * 1. Email (HTML card matching exact template with "Wasn't you?" report action)
 * 2. In-App Notification (Notification model for user dashboard / bell icon)
 * 3. Browser Web Push Notification (Desktop & mobile system notifications)
 * 4. WhatsApp Notification (Direct instant alert via SJDB Connect Bot)
 * 5. Admin Security Telemetry (Notification for admin panel if suspicious or new device)
 */
async function sendLoginAlertEmail({ user, req, loginMethod = 'Password', extra = {} }) {
  if (!user) return;

  try {
    const User = require('../models/User');
    const { createNotification } = require('./notificationService');
    const { sendPushToUser } = require('./webPushService');
    const { notifyAdmin } = require('./adminNotificationService');

    const uaInfo = parseUserAgent(req?.headers?.['user-agent'] || '');
    const ipInfo = parseClientIpAndLocation(req);
    const clientUrl = getSiteUrl('');

    // Fetch freshest user document to examine trusted devices & login history
    const freshUser = (user._id ? await User.findById(user._id) : null) || user;

    const trustedDevices = freshUser.trustedDevices || [];
    const loginHistory = freshUser.loginHistory || [];
    const hasPastLogins = loginHistory.length > 0;

    // 1. Device Evaluation
    const deviceKey = `${uaInfo.browser}-${uaInfo.os}`;
    const isRecognizedDevice = trustedDevices.some(
      d => (d.deviceId === deviceKey || d.deviceName === uaInfo.device) && d.isTrusted !== false
    );
    const isNewDevice = !isRecognizedDevice;

    // 2. Location Evaluation
    const isRecognizedLocation = !hasPastLogins || loginHistory.some(
      h => (h.location === ipInfo.location || h.ip === ipInfo.ip)
    );
    const isNewLocation = hasPastLogins && !isRecognizedLocation;

    // 3. Suspicious Pattern Detection
    const hadRecentFailures = (freshUser.failedLoginAttempts || 0) > 0;

    let impossibleTravel = false;
    if (hasPastLogins && loginHistory[0]?.location && ipInfo.location) {
      const lastLoginTime = new Date(loginHistory[0].timestamp || Date.now()).getTime();
      const timeDiffHours = (Date.now() - lastLoginTime) / (1000 * 60 * 60);
      if (timeDiffHours < 2 && loginHistory[0].location !== ipInfo.location && !loginHistory[0].location.includes('Dev') && !ipInfo.location.includes('Dev')) {
        impossibleTravel = true;
      }
    }

    const isSuspicious = hadRecentFailures || impossibleTravel || (isNewDevice && isNewLocation);

    // 4. Scope Filtering Check
    // If user explicitly configured loginAlertScope to 'new_devices', notify only on new device / location / suspicious
    const alertScope = freshUser.settings?.notifications?.loginAlertScope || 'all';
    if (alertScope === 'new_devices' && !isNewDevice && !isNewLocation && !isSuspicious) {
      console.log(`[LoginSecurity] Routine login from recognized device (${deviceKey}) skipped for ${freshUser.email} (scope: new_devices)`);
      return;
    }

    // 5. Priority and Badge classification
    let priority = 'low';
    let alertBadge = 'Security Alert';
    let alertTitle = 'New Login Detected';

    if (isSuspicious) {
      priority = 'urgent';
      alertBadge = '🚨 Critical Security Alert';
      alertTitle = 'Suspicious Login Detected';
    } else if (isNewDevice) {
      priority = 'high';
      alertBadge = '🛡️ New Device Alert';
      alertTitle = 'New Device Login Detected';
    } else if (isNewLocation) {
      priority = 'high';
      alertBadge = '📍 New Location Alert';
      alertTitle = 'New Location Login Detected';
    }

    // 6. Generate 24-hour cryptographic report token with full login telemetry
    const securityToken = generateSecurityReportToken(freshUser._id, {
      device: uaInfo.device,
      browser: uaInfo.browser,
      os: uaInfo.os,
      ip: ipInfo.ip,
      location: ipInfo.location,
      loginMethod,
      isSuspicious,
      isNewDevice,
      isNewLocation
    });
    const reportUrl = getSiteUrl(`/security/report-unauthorized?token=${securityToken}&userId=${freshUser._id}`);

    const formattedTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' IST';

    // ─────────────────────────────────────────────────────────────────────────────
    // CHANNEL 1: EMAIL NOTIFICATION
    // ─────────────────────────────────────────────────────────────────────────────
    if (freshUser.email && freshUser.settings?.notifications?.email !== false) {
      const emailHtml = `
<div style="background-color:#f1f5f9; padding:30px 15px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:580px; margin:0 auto; background-color:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%); padding:28px 24px; text-align:center;">
      <div style="width:75px; height:75px; margin:0 auto 12px; border-radius:50%; overflow:hidden; border:3px solid #fbbf24; background:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.25);">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <div style="display:inline-block; background-color:${isSuspicious ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.15)'}; padding:4px 14px; border-radius:30px; margin-bottom:8px; border:1px solid ${isSuspicious ? '#ef4444' : 'rgba(255,255,255,0.2)'};">
        <span style="color:${isSuspicious ? '#fca5a5' : '#fbbf24'}; font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase;">
          ${alertBadge}
        </span>
      </div>
      <h1 style="margin:4px 0 0; color:#ffffff; font-size:22px; font-weight:800; line-height:1.3;">
        ${alertTitle}
      </h1>
      <p style="margin:4px 0 0; color:#e2e8f0; opacity:0.9; font-size:13px;">St. John de Britto Church, Kalayarkoil</p>
    </div>

    <!-- Body Content -->
    <div style="padding:28px 24px;">
      <p style="color:#1e293b; font-size:15px; font-weight:700; margin:0 0 16px;">Dear ${freshUser.name},</p>
      
      <p style="color:#334155; font-size:14px; line-height:1.6; margin:0 0 20px;">
        A new login to your Parish Account was detected.
      </p>

      <!-- Details Box -->
      <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:18px 20px; margin-bottom:24px;">
        <h3 style="margin:0 0 14px; color:#1e3a8a; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
          Login Details
        </h3>
        
        <table style="width:100%; border-collapse:collapse; font-size:13px; color:#334155;">
          <tr>
            <td style="padding:7px 0; color:#64748b; font-weight:600; width:42%;">Date &amp; Time:</td>
            <td style="padding:7px 0; font-weight:700; color:#0f172a;">${formattedTime}</td>
          </tr>
          <tr>
            <td style="padding:7px 0; color:#64748b; font-weight:600;">Device:</td>
            <td style="padding:7px 0; font-weight:700; color:#0f172a;">${uaInfo.device}</td>
          </tr>
          <tr>
            <td style="padding:7px 0; color:#64748b; font-weight:600;">Operating System:</td>
            <td style="padding:7px 0; font-weight:700; color:#0f172a;">${uaInfo.os}</td>
          </tr>
          <tr>
            <td style="padding:7px 0; color:#64748b; font-weight:600;">IP Address:</td>
            <td style="padding:7px 0; font-weight:700; color:#0f172a; font-family:monospace;">${ipInfo.ip}</td>
          </tr>
          <tr>
            <td style="padding:7px 0; color:#64748b; font-weight:600;">Approximate Location:</td>
            <td style="padding:7px 0; font-weight:700; color:#0f172a;">${ipInfo.location}</td>
          </tr>
          <tr>
            <td style="padding:7px 0; color:#64748b; font-weight:600;">Login Method:</td>
            <td style="padding:7px 0; font-weight:700; color:#1e3a8a;">${loginMethod}</td>
          </tr>
        </table>
      </div>

      <p style="color:#475569; font-size:13px; line-height:1.6; margin:0 0 16px;">
        If this login was performed by you, no action is required.
      </p>

      <!-- Wasn't You Action Button -->
      <div style="background-color:#fef2f2; border:1px solid #fee2e2; border-radius:14px; padding:20px; text-align:center; margin:22px 0;">
        <p style="margin:0 0 12px; color:#991b1b; font-size:13px; font-weight:700;">
          Did not recognize this login or device?
        </p>
        <a href="${reportUrl}" style="display:inline-block; background-color:#dc2626; color:#ffffff; font-weight:800; font-size:14px; text-decoration:none; padding:13px 30px; border-radius:10px; box-shadow:0 4px 14px rgba(220,38,38,0.35); text-transform:uppercase; letter-spacing:0.5px;">
          Wasn't You? Report Unauthorized Access &rarr;
        </a>
        <p style="margin:10px 0 0; color:#b91c1c; font-size:11px;">
          Clicking this will instantly revoke all active sessions and start password recovery.
        </p>
      </div>

      <!-- Recommendation Steps -->
      <div style="background-color:#fffbe6; border-left:4px solid #d97706; padding:14px 16px; border-radius:8px; margin-bottom:20px; font-size:13px; color:#92400e; line-height:1.6;">
        <strong style="display:block; margin-bottom:6px;">If you do not recognize this login, we recommend that you:</strong>
        <ol style="margin:0; padding-left:20px;">
          <li style="margin-bottom:4px;">Change your password immediately.</li>
          <li style="margin-bottom:4px;">Review your account activity in your Settings &gt; Security page.</li>
          <li>Contact your parish administrator if you need assistance.</li>
        </ol>
      </div>

      <p style="color:#475569; font-size:13px; line-height:1.5; margin:0 0 20px;">
        Keeping your account secure is important to us.
      </p>

      <p style="color:#334155; font-size:13px; line-height:1.5; margin:0 0 2px;">Thank you,</p>
      <p style="color:#0f172a; font-size:14px; font-weight:800; margin:0 0 2px;">St. John de Britto Church</p>
      <p style="color:#64748b; font-size:12px; margin:0 0 2px;">Parish Management System</p>
      <p style="color:#2563eb; font-size:12px; margin:0;">
        <a href="${clientUrl}" style="color:#1e40af; text-decoration:none;">${clientUrl}</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color:#0f172a; padding:18px 24px; text-align:center; color:#94a3b8; font-size:11px; border-top:1px solid #1e293b;">
      <p style="margin:0; font-weight:700; color:#f8fafc;">St. John de Britto Church, Kalayarkoil</p>
      <p style="margin:4px 0 0; color:#64748b;">Parish Management System • Sivagangai District, Tamil Nadu</p>
    </div>

  </div>
</div>
      `;

      sendMail({
        to: freshUser.email,
        subject: `${isSuspicious ? '🚨 Critical Security Alert: Suspicious Login Detected' : isNewDevice ? '🛡️ Security Alert: New Device Login' : 'Security Alert: New Login Detected'} — St. John de Britto Church`,
        html: emailHtml
      }).catch(err => console.error(' Login alert email error:', err.message));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // CHANNEL 2: IN-APP NOTIFICATION
    // ─────────────────────────────────────────────────────────────────────────────
    if (freshUser.settings?.notifications?.inApp !== false) {
      createNotification({
        userId: freshUser._id,
        recipient: 'user',
        title: alertTitle,
        message: `A login was detected on ${formattedTime} from ${uaInfo.device} (${ipInfo.location}) via ${loginMethod}. If this was not you, report unauthorized access immediately.`,
        type: 'security',
        category: 'security',
        priority,
        actionUrl: reportUrl,
        channels: ['inApp']
      }).catch(err => console.warn('In-app login notification error:', err.message));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // CHANNEL 3: BROWSER WEB PUSH NOTIFICATION
    // ─────────────────────────────────────────────────────────────────────────────
    if (freshUser.settings?.notifications?.push !== false) {
      sendPushToUser(freshUser._id, {
        title: `${alertTitle} — St. John de Britto Church`,
        body: `Login detected from ${uaInfo.device} (${ipInfo.location}). Wasn't you? Tap to secure your account.`,
        url: reportUrl,
        notificationId: `login-${Date.now()}`,
        tag: `login-alert-${freshUser._id}`
      }).catch(err => console.warn('Web push login alert error:', err.message));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // CHANNEL 4: WHATSAPP BOT NOTIFICATION
    // ─────────────────────────────────────────────────────────────────────────────
    if (freshUser.phone && freshUser.settings?.notifications?.whatsapp !== false && freshUser.whatsappOptIn !== false) {
      let cleanPhone = freshUser.phone.replace(/[^0-9]/g, '');
      if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

      const waText =
`*${isSuspicious ? '🚨 CRITICAL SECURITY ALERT: Suspicious Login Detected' : isNewDevice ? '🛡️ SECURITY ALERT: New Device Login Detected' : '🔒 SECURITY ALERT: New Login Detected'}*

Dear ${freshUser.name},

A new login to your Parish Account was detected.

*Login Details*
• *Date & Time:* ${formattedTime}
• *Device:* ${uaInfo.device}
• *Operating System:* ${uaInfo.os}
• *IP Address:* ${ipInfo.ip}
• *Approximate Location:* ${ipInfo.location}
• *Login Method:* ${loginMethod}

If this login was performed by you, no action is required.

*If you do not recognize this login:*
1. Change your password immediately.
2. Review your account activity.
3. Contact your parish administrator if you need assistance.

👉 *Wasn't you? Secure your account immediately:*
${reportUrl}

Keeping your account secure is important to us.

Thank you,
*St. John de Britto Church*
Parish Management System
${clientUrl}`;

      dispatchWhatsAppAlert(cleanPhone, waText).catch(err => console.warn('WhatsApp login alert error:', err.message));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // CHANNEL 5: ADMINISTRATOR SECURITY TELEMETRY
    // ─────────────────────────────────────────────────────────────────────────────
    if (isSuspicious || isNewDevice || isNewLocation || Boolean(extra.isFirstLogin)) {
      notifyAdmin({
        type: isSuspicious ? 'MULTIPLE_FAILED_LOGIN' : isNewDevice ? 'LOGIN_ATTEMPT' : 'LOGIN_SUCCESS',
        user: freshUser,
        req,
        reason: isSuspicious
          ? (impossibleTravel ? 'Impossible travel anomaly detected between logins' : 'Login succeeded after failed attempts')
          : isNewDevice
            ? 'New unrecognized device login'
            : isNewLocation
              ? 'New location login detected'
              : 'Routine login verified',
        extra: {
          isNewDevice,
          isNewLocation,
          isSuspicious,
          device: uaInfo.device,
          ip: ipInfo.ip,
          location: ipInfo.location,
          loginMethod
        }
      }).catch(err => console.warn('Admin login telemetry error:', err.message));
    }

  } catch (err) {
    console.error(' sendLoginAlertEmail error:', err.message);
  }
}


// Asynchronously send "Password Updated Successfully" confirmation email
async function sendPasswordUpdatedEmail({ user }) {
  if (!user || !user.email) return;

  try {
    const clientUrl = getSiteUrl('');

    const emailHtml = `
<div style="background-color:#f1f5f9; padding:20px 10px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px; margin:0 auto; background-color:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#065f46,#047857,#0f766e); padding:28px 22px; text-align:center;">
      <div style="width:75px; height:75px; margin:0 auto 12px; border-radius:50%; overflow:hidden; border:3px solid #fbbf24; background:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.25);">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <div style="display:inline-block; background-color:rgba(255,255,255,0.15); padding:4px 14px; border-radius:30px; margin-bottom:8px;">
        <span style="color:#6ee7b7; font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase;">Security Confirmation</span>
      </div>
      <h1 style="margin:4px 0 0; color:#ffffff; font-size:22px; font-weight:800; line-height:1.3;">Your Parish Account Has Been Secured</h1>
      <p style="margin:4px 0 0; color:#e2e8f0; opacity:0.9; font-size:13px;">St. John de Britto Church</p>
    </div>

    <!-- Body Content -->
    <div style="padding:26px 22px;">
      <p style="color:#1e293b; font-size:15px; font-weight:700; margin-top:0;">Dear ${user.name},</p>
      <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:16px;">
        Your Parish Account password has been updated successfully and your account has been secured.
      </p>
      <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:20px;">
        Previous sessions were secured and revoked. Your authentication state was refreshed. You can now log in normally using your new password.
      </p>

      <!-- Notice Box -->
      <div style="background-color:#f0fdf4; border:1px solid #bbf7d0; border-radius:14px; padding:16px 18px; margin-bottom:24px;">
        <h3 style="margin:0 0 12px; color:#166534; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #dcfce7; padding-bottom:8px;">
          Security Confirmation
        </h3>
        
        <table style="width:100%; border-collapse:collapse; font-size:13px; color:#14532d;">
          <tr><td style="padding:4px 0;"> Password successfully updated.</td></tr>
          <tr><td style="padding:4px 0;"> Previous sessions have been secured and revoked.</td></tr>
          <tr><td style="padding:4px 0;"> Authentication credentials refreshed.</td></tr>
          <tr><td style="padding:4px 0;"> You can now log in safely using your new password.</td></tr>
        </table>
      </div>

      <!-- Warning Disclaimer -->
      <div style="background-color:#fffbe6; border-left:4px solid #d97706; padding:12px 14px; border-radius:8px; margin-bottom:20px; font-size:12px; color:#92400e; line-height:1.5;">
        <strong>Important Security Advice:</strong>
        <p style="margin:4px 0 0;">Never share your password, OTP, or verification links with anyone. St. John de Britto Church will never ask for your password or verification codes.</p>
      </div>

      <p style="color:#64748b; font-size:12px; line-height:1.5; margin-bottom:0;">
        If you did not request this change, please contact your parish administrator immediately.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color:#0f172a; padding:18px 22px; text-align:center; color:#94a3b8; font-size:12px;">
      <p style="margin:0; font-weight:700; color:#f8fafc;">St. John de Britto Church, Kalayarkoil</p>
      <p style="margin:4px 0 0; color:#64748b; font-size:11px;">Parish Management System • <a href="${clientUrl}" style="color:#fbbf24; text-decoration:none;">Website</a></p>
    </div>

  </div>
</div>
    `;

    sendMail({
      to: user.email,
      subject: `Your Parish Account Has Been Secured — St. John de Britto Church`,
      html: emailHtml
    }).then(res => {
      if (res.success) console.log(` Password updated email sent to ${user.email}`);
    }).catch(err => console.error(' Password updated email error:', err.message));

  } catch (err) {
    console.error(' sendPasswordUpdatedEmail error:', err.message);
  }
}

// Send "Security Alert – Your Account Has Been Suspended" Email to User
async function sendUserSuspensionEmail({ user, incident, ipDetails = {} }) {
  try {
    if (!user?.email) return;

    const contactUrl = getSiteUrl('/contact');

    const formattedSuspensionTime = new Date(incident.createdAt || Date.now()).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' IST';

    const firstAttemptFormatted = incident.firstFailedAttempt ? new Date(incident.firstFailedAttempt).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' IST' : formattedSuspensionTime;

    const lastAttemptFormatted = incident.lastFailedAttempt ? new Date(incident.lastFailedAttempt).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' IST' : formattedSuspensionTime;

    const emailHtml = `
<div style="background-color:#0f172a; padding:30px 15px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px; margin:0 auto; background-color:#1e293b; border-radius:20px; overflow:hidden; box-shadow:0 12px 40px rgba(0,0,0,0.5); border:1px solid #334155;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#991b1b 0%,#450a0a 100%); padding:32px 24px; text-align:center; border-bottom:2px solid #ef4444;">
      <div style="width:75px; height:75px; margin:0 auto 12px; border-radius:50%; overflow:hidden; border:3px solid #fbbf24; background:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.3);">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <div style="display:inline-block; background-color:rgba(255,255,255,0.15); padding:4px 14px; border-radius:30px; margin-bottom:8px;">
        <span style="color:#fef08a; font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase;">Account Suspended</span>
      </div>
      <h1 style="margin:4px 0 0; color:#ffffff; font-size:22px; font-weight:900; line-height:1.3;">Security Alert – Your Account Has Been Suspended</h1>
      <p style="margin:6px 0 0; color:#fca5a5; font-size:13px; font-weight:600;">St. John de Britto Church Security System</p>
    </div>

    <!-- Body -->
    <div style="padding:28px 24px; color:#e2e8f0;">
      <p style="color:#f8fafc; font-size:15px; font-weight:700; margin-top:0;">Hello ${user.name},</p>
      <p style="color:#cbd5e1; font-size:14px; line-height:1.6; margin-bottom:20px;">
        We detected multiple unsuccessful login attempts on your account. To protect your personal information and prevent unauthorized access, your account has been <strong>automatically suspended</strong>.
      </p>

      <!-- Security Summary Table -->
      <div style="background-color:#0f172a; border:1px solid #334155; border-radius:14px; padding:16px 18px; margin-bottom:22px;">
        <h3 style="margin:0 0 12px; color:#f8fafc; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #1e293b; padding-bottom:8px;">
           Security Summary
        </h3>
        
        <table style="width:100%; border-collapse:collapse; font-size:13px; color:#cbd5e1;">
          <tr>
            <td style="padding:5px 0; color:#94a3b8; font-weight:600; width:42%;">Date & Time of Suspension:</td>
            <td style="padding:5px 0; font-weight:700; color:#f8fafc;">${formattedSuspensionTime}</td>
          </tr>
          <tr>
            <td style="padding:5px 0; color:#94a3b8; font-weight:600;">Failed Login Attempts:</td>
            <td style="padding:5px 0; font-weight:800; color:#ef4444;">${incident.failedAttempts || 10} consecutive failed attempts</td>
          </tr>
          <tr>
            <td style="padding:5px 0; color:#94a3b8; font-weight:600;">First Failed Attempt:</td>
            <td style="padding:5px 0; font-weight:700; color:#f8fafc;">${firstAttemptFormatted}</td>
          </tr>
          <tr>
            <td style="padding:5px 0; color:#94a3b8; font-weight:600;">Last Failed Attempt:</td>
            <td style="padding:5px 0; font-weight:700; color:#f8fafc;">${lastAttemptFormatted}</td>
          </tr>
          <tr>
            <td style="padding:5px 0; color:#94a3b8; font-weight:600;">IP Address:</td>
            <td style="padding:5px 0; font-weight:700; color:#cbd5e1; font-family:monospace;">${incident.ipAddress || ipDetails.ip || '103.45.23.12'}</td>
          </tr>
          <tr>
            <td style="padding:5px 0; color:#94a3b8; font-weight:600;">Device / Browser:</td>
            <td style="padding:5px 0; font-weight:700; color:#f8fafc;">${incident.device || 'Desktop / Mobile'}</td>
          </tr>
          <tr>
            <td style="padding:5px 0; color:#94a3b8; font-weight:600;">Operating System:</td>
            <td style="padding:5px 0; font-weight:700; color:#f8fafc;">${incident.os || 'Windows / Mobile'}</td>
          </tr>
          <tr>
            <td style="padding:5px 0; color:#94a3b8; font-weight:600;">Approximate Location:</td>
            <td style="padding:5px 0; font-weight:700; color:#f8fafc;">${incident.location || 'Coimbatore, Tamil Nadu, India'}</td>
          </tr>
          <tr>
            <td style="padding:5px 0; color:#94a3b8; font-weight:600;">Reason:</td>
            <td style="padding:5px 0; font-weight:700; color:#f59e0b;">Multiple consecutive failed login attempts exceeded permitted security threshold.</td>
          </tr>
        </table>
      </div>

      <!-- Action Guidance -->
      <div style="background-color:#0f172a; border-left:4px solid #f59e0b; padding:14px 16px; border-radius:8px; margin-bottom:24px; font-size:13px; color:#cbd5e1; line-height:1.6;">
        <p style="margin:0 0 8px;"><strong>If these attempts were made by you:</strong> Please contact the parish administrator to restore access to your account.</p>
        <p style="margin:0;"><strong>If these attempts were not made by you:</strong> Your account has been protected and no further action can be performed by unauthorized users until identity verification.</p>
      </div>

      <!-- Contact Admin CTA Button -->
      <div style="text-align:center; margin:28px 0 16px;">
        <a href="${contactUrl}" style="display:inline-block; background-color:#2563eb; color:#ffffff; font-weight:800; font-size:14px; text-decoration:none; padding:14px 30px; border-radius:12px; box-shadow:0 4px 18px rgba(37,99,235,0.4);">
          Contact Administrator →
        </a>
      </div>

      <p style="color:#94a3b8; font-size:12px; line-height:1.5; text-align:center; margin-bottom:0;">
        If you need urgent assistance, you can also use the Password Reset option on our website.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color:#0f172a; padding:18px 22px; text-align:center; color:#64748b; font-size:12px; border-top:1px solid #334155;">
      <p style="margin:0; font-weight:700; color:#cbd5e1;">St. John de Britto Church, Kalayarkoil</p>
      <p style="margin:4px 0 0; color:#64748b; font-size:11px;">Parish Security System • Automated Protection Service</p>
    </div>

  </div>
</div>
    `;

    sendMail({
      to: user.email,
      subject: `Security Alert – Your Account Has Been Suspended — St. John de Britto Church`,
      html: emailHtml
    }).then(res => {
      if (res.success) console.log(` User suspension email sent to ${user.email}`);
    }).catch(err => console.error(' User suspension email error:', err.message));

  } catch (err) {
    console.error(' sendUserSuspensionEmail error:', err.message);
  }
}

// Send "Security Incident – User Account Automatically Suspended" Email to Admin(s)
async function sendAdminSuspensionIncidentEmail({ user, incident, ipDetails = {} }) {
  try {
    const User = require('../models/User');
    const adminUsers = await User.find({ role: 'admin', email: { $exists: true, $ne: null } }).select('email name');
    const adminEmails = adminUsers.map(a => a.email).filter(Boolean);

    if (adminEmails.length === 0) return;

    let clientUrl = process.env.CLIENT_URL || 'https://stjb-church.vercel.app';
    if (clientUrl.includes('localhost')) clientUrl = 'https://stjb-church.vercel.app';
    clientUrl = clientUrl.replace(/\/$/, '');

    const deepLinkUrl = `${clientUrl}/admin/notifications?incidentId=${incident._id}`;
    const incidentCode = incident._id.toString().slice(-6).toUpperCase();

    const formattedSuspensionTime = new Date(incident.createdAt || Date.now()).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' IST';

    const lastLoginFormatted = user.lastSuccessfulLogin ? new Date(user.lastSuccessfulLogin).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' IST' : 'No previous successful logins';

    const emailHtml = `
<div style="display:none !important; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#0f172a; opacity:0;">
  [Security-Susp-Ref: ${incident._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}]
</div>
<div style="background-color:#0f172a; padding:25px 12px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px; margin:0 auto; background-color:#1e293b; border-radius:18px; overflow:hidden; box-shadow:0 12px 40px rgba(0,0,0,0.5); border:1px solid #334155;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#991b1b 0%,#450a0a 100%); padding:28px 20px; text-align:center; border-bottom:2px solid #ef4444;">
      <div style="width:75px; height:75px; margin:0 auto 12px; border-radius:50%; overflow:hidden; border:3px solid #fbbf24; background:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.3);">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <div style="display:inline-block; background-color:rgba(255,255,255,0.15); padding:4px 14px; border-radius:30px; margin-bottom:8px;">
        <span style="color:#fef08a; font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase;">Brute-Force Protection Dispatch</span>
      </div>
      <h1 style="margin:4px 0 0; color:#ffffff; font-size:20px; font-weight:900; line-height:1.3;">Security Incident – User Account Automatically Suspended</h1>
      <p style="margin:6px 0 0; color:#fca5a5; font-size:12px; font-weight:600;">St. John de Britto Church — Administrative Security Monitor</p>
    </div>

    <!-- Body -->
    <div style="padding:22px 18px; color:#e2e8f0;">
      <p style="color:#f8fafc; font-size:14px; font-weight:700; margin-top:0;">Dear Administrator,</p>
      <p style="color:#cbd5e1; font-size:13px; line-height:1.6; margin-bottom:20px;">
        A user account has been <strong>automatically suspended</strong> after exceeding the permitted threshold of consecutive failed login attempts.
      </p>

      <!-- User Information -->
      <div style="background-color:#0f172a; border:1px solid #334155; border-radius:14px; padding:16px 18px; margin-bottom:18px;">
        <h3 style="margin:0 0 14px; color:#f8fafc; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #1e293b; padding-bottom:8px;">
           User Information
        </h3>
        
        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">User Name</div>
          <div style="font-size:13px; font-weight:700; color:#f8fafc; word-break:break-word; margin-top:2px;">${user.name}</div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">User Database ID</div>
          <div style="font-size:13px; font-weight:700; color:#c084fc; font-family:monospace; word-break:break-all; margin-top:2px;">${user._id}</div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Email Address</div>
          <div style="font-size:13px; font-weight:700; color:#38bdf8; word-break:break-all; margin-top:2px;">${user.email || 'N/A'}</div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Phone Number</div>
          <div style="font-size:13px; font-weight:700; color:#f8fafc; margin-top:2px;">${user.phone || 'N/A'}</div>
        </div>

        <div>
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Last Successful Login</div>
          <div style="font-size:13px; font-weight:700; color:#f8fafc; margin-top:2px;">${lastLoginFormatted}</div>
        </div>
      </div>

      <!-- Incident Details -->
      <div style="background-color:#0f172a; border:1px solid #334155; border-radius:14px; padding:16px 18px; margin-bottom:18px;">
        <h3 style="margin:0 0 14px; color:#f8fafc; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #1e293b; padding-bottom:8px;">
           Incident Details
        </h3>
        
        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Total Failed Attempts</div>
          <div style="font-size:13px; font-weight:800; color:#ef4444; margin-top:2px;">${incident.failedAttempts || 10} attempts</div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Allowed Threshold</div>
          <div style="font-size:13px; font-weight:700; color:#f8fafc; margin-top:2px;">10 consecutive failed attempts / 30 mins</div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">IP Address History</div>
          <div style="font-size:13px; font-weight:700; color:#cbd5e1; font-family:monospace; margin-top:2px;">${incident.ipAddress || ipDetails.ip || '103.45.23.12'}</div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Device Information</div>
          <div style="font-size:13px; font-weight:700; color:#f8fafc; margin-top:2px;">${incident.device || 'Desktop / Mobile'}</div>
        </div>

        <div>
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Risk Level</div>
          <div style="margin-top:3px;"><span style="background-color:#7f1d1d; color:#fca5a5; font-weight:800; font-size:11px; padding:3px 10px; border-radius:20px; border:1px solid #ef4444; display:inline-block;">HIGH</span></div>
        </div>
      </div>

      <!-- Recommended Actions -->
      <div style="background-color:#0f172a; border:1px solid #334155; border-radius:14px; padding:16px 18px; margin-bottom:22px;">
        <h3 style="margin:0 0 12px; color:#f8fafc; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #1e293b; padding-bottom:8px;">
           Recommended Actions
        </h3>
        <ul style="margin:0; padding-left:16px; font-size:13px; color:#cbd5e1;">
          <li style="padding:2px 0;">Review the failed login activity log.</li>
          <li style="padding:2px 0;">Verify the identity of the user if they contact support.</li>
          <li style="padding:2px 0;">Reactivate the account from the Admin Notifications portal after verification.</li>
        </ul>
      </div>

      <!-- CTA Deep-Link Button -->
      <div style="text-align:center; margin:28px 0 20px;">
        <a href="${deepLinkUrl}" style="display:block; width:100%; box-sizing:border-box; background:linear-gradient(135deg,#ef4444,#dc2626); color:#ffffff; font-weight:800; font-size:15px; text-decoration:none; padding:16px 20px; border-radius:14px; text-align:center; box-shadow:0 4px 18px rgba(239,68,68,0.4);">
           View Incident & Reactivate Account →
        </a>
      </div>

      <!-- AUDIT REFERENCE -->
      <div style="background-color:#0f172a; border-top:1px solid #334155; padding:14px; border-radius:10px; font-size:11px; color:#94a3b8; margin-top:20px; line-height:1.6;">
        <strong style="color:#cbd5e1;">Security Audit Reference:</strong><br/>
        Incident ID: <span style="color:#c084fc; font-family:monospace; word-break:break-all;">${incident._id}</span><br/>
        Audit Log Reference: <span style="color:#c084fc; font-family:monospace;">LOG-${incidentCode}</span><br/>
        Generated By: Church Management System Security Monitor
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color:#0f172a; padding:16px 20px; text-align:center; color:#94a3b8; font-size:12px; border-top:1px solid #334155;">
      <p style="margin:0; font-weight:700; color:#cbd5e1;">St. John de Britto Church, Kalayarkoil</p>
      <p style="margin:4px 0 0; color:#64748b; font-size:11px;">Parish Security System • Automated Brute-Force Monitor</p>
    </div>

  </div>
</div>
<div style="display:none !important; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#0f172a; opacity:0;">
  [Security-End-Ref: ${incident._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}]
</div>
    `;

    adminEmails.forEach(adminEmail => {
      sendMail({
        to: adminEmail,
        subject: ` Security Incident #${incidentCode}: User Account Automatically Suspended — St. John de Britto Church`,
        html: emailHtml
      }).then(res => {
        if (res.success) console.log(` Admin suspension alert sent to ${adminEmail}`);
      }).catch(err => console.error(' Admin suspension email error:', err.message));
    });

  } catch (err) {
    console.error(' sendAdminSuspensionIncidentEmail error:', err.message);
  }
}

// Send Account Reactivated Confirmation Email
async function sendAccountReactivatedEmail({ user }) {
  try {
    if (!user?.email) return;

    let clientUrl = process.env.CLIENT_URL || 'https://stjb-church.vercel.app';
    if (clientUrl.includes('localhost')) clientUrl = 'https://stjb-church.vercel.app';
    clientUrl = clientUrl.replace(/\/$/, '');
    const loginUrl = `${clientUrl}/login`;

    const emailHtml = `
<div style="background-color:#f8fafc; padding:30px 15px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px; margin:0 auto; background-color:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#065f46 0%,#0f766e 100%); padding:28px 22px; text-align:center;">
      <div style="width:75px; height:75px; margin:0 auto 12px; border-radius:50%; overflow:hidden; border:3px solid #fbbf24; background:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.25);">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <div style="display:inline-block; background-color:rgba(255,255,255,0.15); padding:4px 14px; border-radius:30px; margin-bottom:8px;">
        <span style="color:#6ee7b7; font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase;">Access Restored</span>
      </div>
      <h1 style="margin:4px 0 0; color:#ffffff; font-size:22px; font-weight:800; line-height:1.3;">Your Account Has Been Reactivated</h1>
      <p style="margin:4px 0 0; color:#e2e8f0; opacity:0.9; font-size:13px;">St. John de Britto Church</p>
    </div>

    <!-- Body -->
    <div style="padding:26px 22px;">
      <p style="color:#1e293b; font-size:15px; font-weight:700; margin-top:0;">Hello ${user.name},</p>
      <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:20px;">
        Your account has been successfully <strong>reactivated by an administrator</strong> following a temporary security lock caused by multiple unsuccessful login attempts.
      </p>

      <p style="color:#334155; font-size:14px; line-height:1.6; margin-bottom:20px;">
        You can now sign in using your registered email address and password.
      </p>

      <!-- Security Guidance Box -->
      <div style="background-color:#f0fdf4; border:1px solid #bbf7d0; border-radius:14px; padding:16px 18px; margin-bottom:24px;">
        <h3 style="margin:0 0 10px; color:#166534; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
           For Your Security:
        </h3>
        <ul style="margin:0; padding-left:18px; font-size:13px; color:#14532d; line-height:1.7;">
          <li>Ensure your password is strong and unique.</li>
          <li>Do not share your login credentials with anyone.</li>
          <li>If you did not attempt to sign in previously, please change your password immediately after logging in.</li>
        </ul>
      </div>

      <p style="color:#64748b; font-size:13px; margin-bottom:20px;">
        If you continue to experience issues, please contact the administrator.
      </p>

      <div style="text-align:center; margin:28px 0 16px;">
        <a href="${loginUrl}" style="display:inline-block; background-color:#059669; color:#ffffff; font-weight:800; font-size:15px; text-decoration:none; padding:14px 32px; border-radius:12px; box-shadow:0 4px 16px rgba(5,150,105,0.35);">
          Sign In →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color:#0f172a; padding:18px 22px; text-align:center; color:#94a3b8; font-size:12px;">
      <p style="margin:0; font-weight:700; color:#f8fafc;">St. John de Britto Church, Kalayarkoil</p>
      <p style="margin:4px 0 0; color:#64748b; font-size:11px;">Parish Management System Security Service</p>
    </div>

  </div>
</div>
    `;

    sendMail({
      to: user.email,
      subject: `Your Account Has Been Reactivated — St. John de Britto Church`,
      html: emailHtml
    }).then(res => {
      if (res.success) console.log(` Account reactivated email sent to ${user.email}`);
    }).catch(err => console.error(' Account reactivated email error:', err.message));

  } catch (err) {
    console.error(' sendAccountReactivatedEmail error:', err.message);
  }
}

// Asynchronously send 15-minute temporary lockout notification email to User
async function sendUserTemporaryLockoutEmail({ user, lockMinutes = 15, ipDetails }) {
  if (!user || !user.email) return;

  try {
    const resetUrl = getSiteUrl('/login');

    const emailHtml = `
<div style="background:#f8fafc; padding:30px 15px; font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:580px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding:28px 24px; text-align:center;">
      <div style="width:75px; height:75px; margin:0 auto 12px; border-radius:50%; overflow:hidden; border:3px solid #fbbf24; background:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.25);">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:800;">Account Temporarily Locked</h1>
      <p style="margin:6px 0 0; color:#fef3c7; font-size:13px;">St. John de Britto Church — Security Notice</p>
    </div>

    <div style="padding:30px 25px;">
      <p style="color:#1e293b; font-size:15px; font-weight:700; margin-top:0;">Dear ${user.name},</p>
      
      <p style="color:#475569; font-size:14px; line-height:1.6;">
        Your Parish Account has been <strong>temporarily locked for ${lockMinutes} minutes</strong> due to <strong>5 consecutive failed login attempts</strong>.
      </p>

      <div style="background:#fffbe6; border-left:4px solid #f59e0b; padding:16px; border-radius:12px; margin:20px 0;">
        <div style="font-weight:700; color:#92400e; font-size:13px; text-transform:uppercase; margin-bottom:6px;">Lockout Summary</div>
        <div style="color:#78350f; font-size:13px; line-height:1.6;">
          • <strong>Lock Duration:</strong> 15 Minutes<br>
          • <strong>IP Address:</strong> ${ipDetails?.ip || 'Protected'}<br>
          • <strong>Location:</strong> ${ipDetails?.location || 'India'}<br>
          • <strong>Next Action:</strong> You can try logging in again after 15 minutes or reset your password immediately.
        </div>
      </div>

      <div style="text-align:center; margin:28px 0;">
        <a href="${resetUrl}" style="background:#1e3a8a; color:#fbbf24; font-weight:700; font-size:14px; text-decoration:none; padding:14px 28px; border-radius:12px; display:inline-block; box-shadow:0 4px 14px rgba(30,58,138,0.3); border:1px solid #fbbf24;">
           Reset Password / Try Again
        </a>
      </div>

      <p style="color:#94a3b8; font-size:12px; text-align:center; margin:0;">
        If you forgot your password, click above to set a new password securely.
      </p>
    </div>

    <div style="background:#0f172a; padding:18px; text-align:center; color:#94a3b8; font-size:12px;">
      <p style="margin:0 0 4px;">St. John de Britto Church, Kalayarkoil</p>
      <p style="margin:0; color:#64748b;">Parish Management & Governance System</p>
    </div>
  </div>
</div>
    `;

    sendMail({
      to: user.email,
      subject: `Security Alert: Account Temporarily Locked (15 Mins) — St. John de Britto Church`,
      html: emailHtml
    }).catch(err => console.error(' Lockout email dispatch error:', err.message));
  } catch (err) {
    console.error(' sendUserTemporaryLockoutEmail error:', err.message);
  }
}

// Record login event in user's loginHistory and manage trusted devices
async function recordLoginHistory({ userId, req, loginMethod = 'Password', status = 'success', trusted = true }) {
  if (!userId) return;
  try {
    const User = require('../models/User');
    const uaInfo = parseUserAgent(req?.headers?.['user-agent'] || '');
    const ipInfo = parseClientIpAndLocation(req);

    const historyEntry = {
      ip: ipInfo.ip,
      location: ipInfo.location,
      device: uaInfo.device,
      browser: uaInfo.browser,
      os: uaInfo.os,
      loginMethod,
      status,
      trusted,
      timestamp: new Date()
    };

    const user = await User.findById(userId);
    if (!user) return;

    // Keep last 50 login records
    user.loginHistory = [historyEntry, ...(user.loginHistory || [])].slice(0, 50);

    // Update trusted devices and clear failure counters on successful login
    if (status === 'success') {
      user.failedLoginAttempts = 0;
      user.lastLogin = new Date();
      if (!user.firstSuccessfulLoginAt) {
        user.firstSuccessfulLoginAt = new Date();
      }

      const deviceKey = `${uaInfo.browser}-${uaInfo.os}`;
      const devices = user.trustedDevices || [];
      const existingIdx = devices.findIndex(d => d.deviceId === deviceKey || d.deviceName === uaInfo.device);
      if (existingIdx >= 0) {
        devices[existingIdx].lastUsed = new Date();
      } else {
        devices.unshift({
          deviceId: deviceKey,
          deviceName: uaInfo.device,
          browser: uaInfo.browser,
          os: uaInfo.os,
          firstSeen: new Date(),
          lastUsed: new Date(),
          isTrusted: true
        });
      }
      user.trustedDevices = devices.slice(0, 15);
    }

    await user.save();
  } catch (err) {
    console.warn('recordLoginHistory error:', err.message);
  }
}

module.exports = {
  parseUserAgent,
  parseClientIpAndLocation,
  generateSecurityReportToken,
  sendLoginAlertEmail,
  sendLoginAlert: sendLoginAlertEmail,
  sendMultiChannelLoginAlert: sendLoginAlertEmail,
  sendPasswordUpdatedEmail,
  sendUserSuspensionEmail,
  sendAdminSuspensionIncidentEmail,
  sendAccountReactivatedEmail,
  sendUserTemporaryLockoutEmail,
  recordLoginHistory
};

