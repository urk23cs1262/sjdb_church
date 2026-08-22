const jwt = require('jsonwebtoken');
const { sendMail } = require('../config/mailer');

// Parse User-Agent string into friendly Device, OS, and Browser names
function parseUserAgent(ua = '') {
  let os = 'Unknown OS';
  let device = 'Desktop Device';
  let browser = 'Web Browser';

  if (/windows/i.test(ua)) {
    os = 'Windows';
    device = 'Windows PC / Laptop';
  } else if (/macintosh|mac os/i.test(ua)) {
    os = 'macOS';
    device = 'Mac Workstation';
  } else if (/iphone/i.test(ua)) {
    os = 'iOS';
    device = 'iPhone';
  } else if (/ipad/i.test(ua)) {
    os = 'iPadOS';
    device = 'iPad Tablet';
  } else if (/android/i.test(ua)) {
    os = 'Android';
    device = 'Android Smartphone';
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
  let ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1').split(',')[0].trim();

  if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.0.0.1')) {
    ip = '127.0.0.1';
    return { ip, location: 'Local Network (Dev)' };
  }

  // Generic clean location fallback
  return { ip, location: 'Coimbatore, Tamil Nadu, India' };
}

// Generate a signed, 24-hour report token for security verification
function generateSecurityReportToken(userId) {
  return jwt.sign(
    { userId, purpose: 'report_unauthorized', createdAt: Date.now() },
    process.env.JWT_SECRET || 'sjdb_secret_key_2024',
    { expiresIn: '24h' }
  );
}

// Asynchronously send successful login alert email
async function sendLoginAlertEmail({ user, req, loginMethod = 'Password' }) {
  if (!user || !user.email) return;

  try {
    const uaInfo = parseUserAgent(req.headers['user-agent']);
    const ipInfo = parseClientIpAndLocation(req);
    const securityToken = generateSecurityReportToken(user._id);

    const clientUrl = (process.env.CLIENT_URL || 'https://st-jb-church.vercel.app').replace('http://localhost:5173', 'https://st-jb-church.vercel.app');
    const reportUrl = `${clientUrl}/security/report-unauthorized?token=${securityToken}&userId=${user._id}`;

    const formattedTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' IST';

    const emailHtml = `
<div style="background-color:#f1f5f9; padding:20px 10px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px; margin:0 auto; background-color:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%); padding:28px 22px; text-align:center;">
      <div style="width:75px; height:75px; margin:0 auto 12px; border-radius:50%; overflow:hidden; border:3px solid #fbbf24; background:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.25);">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <div style="display:inline-block; background-color:rgba(255,255,255,0.15); padding:4px 14px; border-radius:30px; margin-bottom:8px;">
        <span style="color:#fbbf24; font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase;">Security Alert</span>
      </div>
      <h1 style="margin:4px 0 0; color:#ffffff; font-size:22px; font-weight:800; line-height:1.3;">New Login Detected</h1>
      <p style="margin:4px 0 0; color:#e2e8f0; opacity:0.9; font-size:13px;">St. John de Britto's Church</p>
    </div>

    <!-- Body Content -->
    <div style="padding:26px 22px;">
      <p style="color:#1e293b; font-size:15px; font-weight:700; margin-top:0;">Dear ${user.name},</p>
      <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:20px;">
        A new successful login to your Parish Account was detected.
      </p>

      <!-- Details Box -->
      <div style="background-color:#f8fafc; border:1px solid #cbd5e1; border-radius:14px; padding:16px 18px; margin-bottom:24px;">
        <h3 style="margin:0 0 12px; color:#1e3a8a; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; border-b:1px solid #e2e8f0; padding-bottom:8px;">
          Login Details
        </h3>
        
        <table style="width:100%; border-collapse:collapse; font-size:13px; color:#334155;">
          <tr>
            <td style="padding:6px 0; color:#64748b; font-weight:600; width:40%;">Date & Time:</td>
            <td style="padding:6px 0; font-weight:700; color:#0f172a;">${formattedTime}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#64748b; font-weight:600;">Device / Browser:</td>
            <td style="padding:6px 0; font-weight:700; color:#0f172a;">${uaInfo.device}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#64748b; font-weight:600;">Operating System:</td>
            <td style="padding:6px 0; font-weight:700; color:#0f172a;">${uaInfo.os}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#64748b; font-weight:600;">IP Address:</td>
            <td style="padding:6px 0; font-weight:700; color:#0f172a; font-family:monospace;">${ipInfo.ip}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#64748b; font-weight:600;">Approx. Location:</td>
            <td style="padding:6px 0; font-weight:700; color:#0f172a;">${ipInfo.location}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#64748b; font-weight:600;">Login Method:</td>
            <td style="padding:6px 0; font-weight:700; color:#1e3a8a;">${loginMethod}</td>
          </tr>
        </table>
      </div>

      <!-- Action Button -->
      <div style="text-align:center; margin-bottom:26px;">
        <p style="color:#64748b; font-size:12px; margin-bottom:12px; font-style:italic;">
          Didn't log in recently? Secure your account immediately:
        </p>
        <a href="${reportUrl}" style="display:inline-block; background-color:#dc2626; color:#ffffff; font-weight:800; font-size:14px; text-decoration:none; padding:13px 28px; border-radius:10px; box-shadow:0 4px 14px rgba(220,38,38,0.35);">
          Wasn't You? Secure Account Now →
        </a>
      </div>

      <div style="background-color:#fffbe6; border-left:4px solid #d97706; padding:12px 14px; border-radius:8px; margin-bottom:20px; font-size:12px; color:#92400e; line-height:1.5;">
        <strong>If you do not recognize this login, we recommend that you:</strong>
        <ul style="margin:6px 0 0; padding-left:18px;">
          <li>Click the <strong>"Wasn't You?"</strong> button above to secure your account immediately.</li>
          <li>Change your password immediately.</li>
          <li>Review your recent account activity.</li>
        </ul>
      </div>

      <p style="color:#64748b; font-size:12px; line-height:1.5; margin-bottom:0;">
        Keeping your account secure is important to us.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color:#0f172a; padding:18px 22px; text-align:center; color:#94a3b8; font-size:12px;">
      <p style="margin:0; font-weight:700; color:#f8fafc;">St. John de Britto's Church, Kalayarkoil</p>
      <p style="margin:4px 0 0; color:#64748b; font-size:11px;">Parish Management System • <a href="${clientUrl}" style="color:#fbbf24; text-decoration:none;">Website</a></p>
    </div>

  </div>
</div>
    `;

    sendMail({
      to: user.email,
      subject: `Security Alert: New Login Detected — St. John de Britto's Church`,
      html: emailHtml
    }).then(res => {
      if (res.success) console.log(` Login alert email sent to ${user.email}`);
      else console.warn(` Login alert email skipped/failed for ${user.email}: ${res.error}`);
    }).catch(err => console.error(' Login alert email error:', err.message));

  } catch (err) {
    console.error(' sendLoginAlertEmail error:', err.message);
  }
}

// Asynchronously send "Password Updated Successfully" confirmation email
async function sendPasswordUpdatedEmail({ user }) {
  if (!user || !user.email) return;

  try {
    const clientUrl = (process.env.CLIENT_URL || 'https://st-jb-church.vercel.app').replace('http://localhost:5173', 'https://st-jb-church.vercel.app');

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
      <h1 style="margin:4px 0 0; color:#ffffff; font-size:22px; font-weight:800; line-height:1.3;">Password Updated Successfully</h1>
      <p style="margin:4px 0 0; color:#e2e8f0; opacity:0.9; font-size:13px;">St. John de Britto's Church</p>
    </div>

    <!-- Body Content -->
    <div style="padding:26px 22px;">
      <p style="color:#1e293b; font-size:15px; font-weight:700; margin-top:0;">Dear ${user.name},</p>
      <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:16px;">
        Your Parish Account password has been updated successfully.
      </p>
      <p style="color:#475569; font-size:14px; line-height:1.6; margin-bottom:20px;">
        Your account has now been secured, and your authentication credentials have been refreshed. You can log in normally using your new password.
      </p>

      <!-- Notice Box -->
      <div style="background-color:#f0fdf4; border:1px solid #bbf7d0; border-radius:14px; padding:16px 18px; margin-bottom:24px;">
        <h3 style="margin:0 0 12px; color:#166534; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #dcfce7; padding-bottom:8px;">
          Security Notice
        </h3>
        
        <table style="width:100%; border-collapse:collapse; font-size:13px; color:#14532d;">
          <tr><td style="padding:4px 0;"> Password updated successfully.</td></tr>
          <tr><td style="padding:4px 0;"> All previous login sessions have been invalidated.</td></tr>
          <tr><td style="padding:4px 0;"> Your account is now protected with your updated password.</td></tr>
        </table>
      </div>

      <!-- Warning Disclaimer -->
      <div style="background-color:#fffbe6; border-left:4px solid #d97706; padding:12px 14px; border-radius:8px; margin-bottom:20px; font-size:12px; color:#92400e; line-height:1.5;">
        <strong>Important Safety Reminder:</strong>
        <p style="margin:4px 0 0;">Please do not share your login credentials, password, OTPs, or verification links with anyone, including church staff or administrators. Our team will never ask for your password.</p>
      </div>

      <p style="color:#64748b; font-size:12px; line-height:1.5; margin-bottom:0;">
        If you did not make this change, please contact your parish administrator immediately or use the account recovery option.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color:#0f172a; padding:18px 22px; text-align:center; color:#94a3b8; font-size:12px;">
      <p style="margin:0; font-weight:700; color:#f8fafc;">St. John de Britto's Church, Kalayarkoil</p>
      <p style="margin:4px 0 0; color:#64748b; font-size:11px;">Parish Management System • <a href="${clientUrl}" style="color:#fbbf24; text-decoration:none;">Website</a></p>
    </div>

  </div>
</div>
    `;

    sendMail({
      to: user.email,
      subject: ` Security Confirmation: Your Password Has Been Updated Successfully — St. John de Britto's Church`,
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

    const clientUrl = (process.env.CLIENT_URL || 'https://st-jb-church.vercel.app').replace('http://localhost:5173', 'https://st-jb-church.vercel.app');
    const contactUrl = `${clientUrl}/contact`;

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
      <p style="margin:6px 0 0; color:#fca5a5; font-size:13px; font-weight:600;">St. John de Britto's Church Security System</p>
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
      <p style="margin:0; font-weight:700; color:#cbd5e1;">St. John de Britto's Church, Kalayarkoil</p>
      <p style="margin:4px 0 0; color:#64748b; font-size:11px;">Parish Security System • Automated Protection Service</p>
    </div>

  </div>
</div>
    `;

    sendMail({
      to: user.email,
      subject: `Security Alert – Your Account Has Been Suspended — St. John de Britto's Church`,
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

    let clientUrl = process.env.CLIENT_URL || 'https://st-jb-church.vercel.app';
    if (clientUrl.includes('localhost')) clientUrl = 'https://st-jb-church.vercel.app';
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
      <p style="margin:6px 0 0; color:#fca5a5; font-size:12px; font-weight:600;">St. John de Britto's Church — Administrative Security Monitor</p>
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
      <p style="margin:0; font-weight:700; color:#cbd5e1;">St. John de Britto's Church, Kalayarkoil</p>
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
        subject: ` Security Incident #${incidentCode}: User Account Automatically Suspended — St. John de Britto's Church`,
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

    let clientUrl = process.env.CLIENT_URL || 'https://st-jb-church.vercel.app';
    if (clientUrl.includes('localhost')) clientUrl = 'https://st-jb-church.vercel.app';
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
      <p style="margin:4px 0 0; color:#e2e8f0; opacity:0.9; font-size:13px;">St. John de Britto's Church</p>
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
      <p style="margin:0; font-weight:700; color:#f8fafc;">St. John de Britto's Church, Kalayarkoil</p>
      <p style="margin:4px 0 0; color:#64748b; font-size:11px;">Parish Management System Security Service</p>
    </div>

  </div>
</div>
    `;

    sendMail({
      to: user.email,
      subject: `Your Account Has Been Reactivated — St. John de Britto's Church`,
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
    const clientUrl = (process.env.CLIENT_URL || 'https://st-jb-church.vercel.app').replace('http://localhost:5173', 'https://st-jb-church.vercel.app');
    const resetUrl = `${clientUrl}/login`;

    const emailHtml = `
<div style="background:#f8fafc; padding:30px 15px; font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:580px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding:28px 24px; text-align:center;">
      <div style="width:75px; height:75px; margin:0 auto 12px; border-radius:50%; overflow:hidden; border:3px solid #fbbf24; background:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.25);">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:800;">Account Temporarily Locked</h1>
      <p style="margin:6px 0 0; color:#fef3c7; font-size:13px;">St. John de Britto's Church — Security Notice</p>
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
      <p style="margin:0 0 4px;">St. John de Britto's Church, Kalayarkoil</p>
      <p style="margin:0; color:#64748b;">Parish Management & Governance System</p>
    </div>
  </div>
</div>
    `;

    sendMail({
      to: user.email,
      subject: `Security Alert: Account Temporarily Locked (15 Mins) — St. John de Britto's Church`,
      html: emailHtml
    }).catch(err => console.error(' Lockout email dispatch error:', err.message));

  } catch (err) {
    console.error(' sendUserTemporaryLockoutEmail error:', err.message);
  }
}

module.exports = {
  parseUserAgent,
  parseClientIpAndLocation,
  generateSecurityReportToken,
  sendLoginAlertEmail,
  sendPasswordUpdatedEmail,
  sendUserSuspensionEmail,
  sendAdminSuspensionIncidentEmail,
  sendAccountReactivatedEmail,
  sendUserTemporaryLockoutEmail
};
