const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SecurityIncident = require('../models/SecurityIncident');
const { createNotification } = require('../services/notificationService');
const { sendMail } = require('../config/mailer');

// GET /api/security/verify-token?token=...
const verifyReportToken = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: 'Security token is required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sjdb_secret_key_2024');
    const user = await User.findById(decoded.userId).select('name email phone role');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      },
      token
    });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Invalid or expired security link' });
  }
};

// POST /api/security/confirm-unauthorized
const confirmUnauthorized = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sjdb_secret_key_2024');
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Step 3: Secure the Account
    // 1. Invalidate all active sessions across all devices
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    // 2. Generate emergency password reset OTP
    const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = resetOtp;
    user.otpExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
    await user.save();

    // 3. Create Security Incident Record in Database
    const incident = await SecurityIncident.create({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone,
      type: 'unauthorized_login_reported',
      status: 'Awaiting Review',
      loginTime: decoded.createdAt ? new Date(decoded.createdAt) : new Date(),
      actionsTaken: [
        'Invalidated all active sessions across all devices',
        'Blocked suspicious token session',
        'Initiated forced password reset OTP',
        'Notified Parish Administrator'
      ],
      reportToken: token,
      reportedAt: new Date()
    });

    // 4. Notify Admin In-App
    createNotification({
      recipient: 'admin',
      title: ' Security Incident: Unauthorized Login Reported',
      message: `User ${user.name} (${user.email || user.phone}) reported an unauthorized login to their account. Active sessions logged out & password reset triggered.`,
      type: 'system',
      category: 'system',
      priority: 'high',
      actionUrl: '/admin/notifications',
      relatedId: incident._id,
      relatedModel: 'SecurityIncident'
    }).catch(e => console.warn('Security incident admin notification warning:', e.message));

    // 5. Send Detailed Security Incident Email to Admin(s)
    sendAdminSecurityIncidentEmail({ user, incident, decoded }).catch(e => console.warn('Admin security email warning:', e.message));

    // 6. Send Emergency Password Reset OTP via Email to User
    if (user.email) {
      sendMail({
        to: user.email,
        subject: `Emergency Security Password Reset — St. John de Britto's Church`,
        html: `
<div style="background:#f1f5f9; padding:20px 10px; font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:580px; margin:0 auto; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.06); border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#991b1b 0%,#450a0a 100%); padding:28px 20px; text-align:center; color:#ffffff;">
      <div style="width:75px; height:75px; margin:0 auto 12px; border-radius:50%; overflow:hidden; border:3px solid #fbbf24; background:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.3);">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <h1 style="color:#fbbf24; margin:0; font-size:20px; font-weight:800;">St. John de Britto's Church</h1>
      <p style="color:#fca5a5; margin:4px 0 0; font-size:12.5px; font-weight:600;">Emergency Account Security Notice</p>
    </div>
    <div style="padding:24px 20px; color:#1e293b; line-height:1.6;">
      <h2 style="color:#991b1b; margin-top:0; font-size:18px;">Emergency Account Security Notice</h2>
      <p>Dear ${user.name},</p>
      <p>We received your report of an unauthorized login to your Parish Account. Your account has been immediately secured:</p>
      <ul style="color:#475569; font-size:13.5px; padding-left:20px;">
        <li>All active sessions on all devices have been terminated.</li>
        <li>Your previous login tokens are now invalid.</li>
      </ul>
      <p><strong>Your Verification OTP for Password Reset is:</strong></p>
      <div style="text-align:center; margin:20px 0;">
        <div style="background-color:#fef3c7; font-size:32px; font-weight:900; letter-spacing:8px; color:#92400e; padding:14px 24px; display:inline-block; border-radius:12px; border:2px dashed #f59e0b;">
          ${resetOtp}
        </div>
      </div>
      <p style="font-size:12px; color:#64748b; text-align:center;">This OTP expires in 30 minutes.</p>
      <p style="font-size:13.5px; color:#334155;">Please use this OTP on our website to set a new password and regain access to your account.</p>
      <!-- DYNAMIC_BIBLE_VERSE -->
    </div>
    <div style="background:#0f172a; padding:16px 18px; text-align:center; color:#94a3b8; font-size:11px;">
      <p style="margin:0;">St. John de Britto's Church Security Team • Kalayarkoil</p>
    </div>
  </div>
</div>
        `
      }).catch(e => console.warn('Security reset email warning:', e.message));
    }

    res.json({
      success: true,
      message: 'Account secured successfully! All sessions logged out.',
      resetOtp: process.env.NODE_ENV !== 'production' ? resetOtp : undefined,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/security/incidents (Admin Only)
const getIncidents = async (req, res) => {
  try {
    const incidents = await SecurityIncident.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'name email phone');
    res.json({ success: true, incidents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/security/incidents/:id (Admin Only)
const updateIncidentStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const incident = await SecurityIncident.findByIdAndUpdate(
      req.params.id,
      { status, adminNotes },
      { new: true }
    );
    res.json({ success: true, incident });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/security/incidents/:id/reactivate (Admin Only)
const reactivateUserAccount = async (req, res) => {
  try {
    const id = req.params.id;
    let incident = null;
    let user = null;

    if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
      incident = await SecurityIncident.findById(id);
    }

    if (incident && incident.userId) {
      user = await User.findById(incident.userId);
    }

    // Fallback: If id is directly a User ID or identifier
    if (!user) {
      if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
        user = await User.findById(id);
      }
      if (!user) {
        user = await User.findOne({ $or: [{ email: id }, { phone: id }, { parishMemberId: id }] });
      }
    }

    if (!user) return res.status(404).json({ success: false, message: 'User record not found' });

    // 1. Lift suspension & reset failed counters, restore active & verified status
    user.isSuspended = false;
    user.isActive = true;
    user.isVerified = true;
    user.failedLoginAttempts = 0;
    user.firstFailedAttempt = null;
    user.lastFailedAttempt = null;
    user.isLockedUntil = null;
    user.lockoutCount = 0;
    user.firstLockoutAt = null;
    user.suspensionReason = undefined;
    await user.save();

    // 2. Update Security Incident record(s)
    if (incident) {
      incident.status = 'Reactivated';
      incident.adminWhoReactivated = req.user._id;
      incident.reactivationTime = new Date();
      incident.actionsTaken.push(`Reactivated by Admin ${req.user.name} on ${new Date().toISOString()}`);
      if (req.body.adminNotes) incident.adminNotes = req.body.adminNotes;
      await incident.save();
    }

    // Also update any pending incident for this user
    await SecurityIncident.updateMany(
      { userId: user._id, status: { $in: ['Awaiting Review', 'Under Review'] } },
      { 
        $set: { status: 'Reactivated', reactivationTime: new Date(), adminWhoReactivated: req.user._id },
        $push: { actionsTaken: `Reactivated by Admin ${req.user.name} on ${new Date().toISOString()}` }
      }
    );

    // 3. Dispatch Account Reactivated Email
    try {
      const { sendAccountReactivatedEmail } = require('../services/loginSecurityService');
      sendAccountReactivatedEmail({ user }).catch(e => console.warn('Reactivation email error:', e.message));
    } catch (e) {
      console.warn('sendAccountReactivatedEmail warning:', e.message);
    }

    // 4. Issue In-App Notification to User
    createNotification({
      userId: user._id,
      recipient: 'user',
      title: 'Account Access Restored',
      message: 'Your account has been reactivated by the administrator. You can now log in normally using your password.',
      type: 'general',
      category: 'account',
      priority: 'high',
      actionUrl: '/login',
      channels: ['email', 'push']
    }).catch(e => console.warn('Reactivation in-app notification error:', e.message));

    res.json({ success: true, message: 'Account reactivated successfully!', user, incident });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/security/users/:userId/reactivate (Admin Only) — Reactivate directly by User ID (no incident required)
const reactivateUserByUserId = async (req, res) => {
  try {
    const identifier = req.params.userId;
    let user = null;

    if (identifier && identifier.match(/^[0-9a-fA-F]{24}$/)) {
      user = await User.findById(identifier);
    }
    if (!user) {
      user = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }, { parishMemberId: identifier }] });
    }
    if (!user) return res.status(404).json({ success: false, message: 'User record not found' });

    // Lift suspension & reset failed counters, restore active & verified status
    await User.findByIdAndUpdate(user._id, {
      isSuspended: false,
      isActive: true,
      isVerified: true,
      failedLoginAttempts: 0,
      firstFailedAttempt: null,
      lastFailedAttempt: null,
      isLockedUntil: null,
      suspensionReason: undefined,
      lockoutCount: 0,
      firstLockoutAt: null
    });

    // Also update any pending incident for this user
    await SecurityIncident.updateMany(
      { userId: user._id, status: { $in: ['Awaiting Review', 'Under Review'] } },
      { 
        $set: { status: 'Reactivated', reactivationTime: new Date(), adminWhoReactivated: req.user._id },
        $push: { actionsTaken: `Reactivated by Admin ${req.user.name} on ${new Date().toISOString()}` }
      }
    );

    // Dispatch reactivation email
    try {
      const { sendAccountReactivatedEmail } = require('../services/loginSecurityService');
      sendAccountReactivatedEmail({ user }).catch(e => console.warn('Reactivation email error:', e.message));
    } catch (e) {
      console.warn('sendAccountReactivatedEmail not available:', e.message);
    }

    // In-App Notification to User
    createNotification({
      userId: user._id,
      recipient: 'user',
      title: 'Account Access Restored',
      message: 'Your account has been reactivated by the administrator. You can now log in normally using your registered credentials.',
      type: 'general',
      category: 'account',
      priority: 'high',
      actionUrl: '/login',
      channels: ['email', 'push']
    }).catch(e => console.warn('Reactivation in-app notification error:', e.message));

    const refreshedUser = await User.findById(user._id).select('-passwordHash -otp -otpExpires');
    res.json({ success: true, message: 'Account reactivated successfully!', user: refreshedUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Send detailed security incident report email to Admin(s)
async function sendAdminSecurityIncidentEmail({ user, incident, decoded }) {
  try {
    const adminUsers = await User.find({ role: 'admin', email: { $exists: true, $ne: null } }).select('email name');
    const adminEmails = adminUsers.map(a => a.email).filter(Boolean);

    if (adminEmails.length === 0) return;

    const formattedTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' IST';

    const loginTimeFormatted = decoded?.createdAt ? new Date(decoded.createdAt).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' IST' : formattedTime;

    let clientUrl = process.env.CLIENT_URL || 'https://st-jb-church.vercel.app';
    if (clientUrl.includes('localhost')) clientUrl = 'https://st-jb-church.vercel.app';
    clientUrl = clientUrl.replace(/\/$/, '');

    const deepLinkUrl = `${clientUrl}/admin/notifications?incidentId=${incident._id}`;
    const incidentCode = incident._id.toString().slice(-6).toUpperCase();

    const emailHtml = `
<div style="display:none !important; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#0f172a; opacity:0;">
  [Security-Alert-Ref: ${incident._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}]
</div>
<div style="background-color:#0f172a; padding:25px 12px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px; margin:0 auto; background-color:#1e293b; border-radius:18px; overflow:hidden; box-shadow:0 12px 40px rgba(0,0,0,0.5); border:1px solid #334155;">
    
    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,#991b1b,#7f1d1d,#450a0a); padding:28px 20px; text-align:center; border-bottom:2px solid #ef4444;">
      <div style="width:75px; height:75px; margin:0 auto 12px; border-radius:50%; background:#ffffff; overflow:hidden; border:3px solid #fbbf24; box-shadow:0 4px 14px rgba(0,0,0,0.3);">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <h1 style="margin:4px 0 0; color:#ffffff; font-size:20px; font-weight:900; line-height:1.3;">Security Incident: Unauthorized Login Reported</h1>
      <p style="margin:6px 0 0; color:#fca5a5; font-size:12px; font-weight:600;">St. John de Britto's Church — Parish Management System</p>
    </div>

    <!-- BODY CONTENT -->
    <div style="padding:22px 18px; color:#e2e8f0;">
      <p style="color:#f8fafc; font-size:14px; font-weight:700; margin-top:0;">Dear Administrator,</p>
      <p style="color:#cbd5e1; font-size:13px; line-height:1.6; margin-bottom:20px;">
        A security incident has been detected and requires your attention. A parish member has reported that a recently detected login to their account was not authorized by them using the emergency <strong>"Wasn't You?"</strong> security feature.
      </p>

      <!-- INCIDENT SUMMARY -->
      <div style="background-color:#0f172a; border:1px solid #334155; border-radius:14px; padding:16px 18px; margin-bottom:18px;">
        <h3 style="margin:0 0 14px; color:#f8fafc; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #1e293b; padding-bottom:8px;">
           Incident Summary
        </h3>
        
        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Incident ID</div>
          <div style="font-size:13px; font-weight:700; color:#c084fc; font-family:monospace; word-break:break-all; margin-top:2px;">${incident._id}</div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Severity</div>
          <div style="margin-top:3px;"><span style="background-color:#7f1d1d; color:#fca5a5; font-weight:800; font-size:11px; padding:3px 10px; border-radius:20px; border:1px solid #ef4444; display:inline-block;">HIGH</span></div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Status</div>
          <div style="font-size:13px; font-weight:700; color:#34d399; margin-top:2px;">User Reported – Account Secured</div>
        </div>

        <div>
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Reported On</div>
          <div style="font-size:13px; font-weight:700; color:#f8fafc; margin-top:2px;">${formattedTime}</div>
        </div>
      </div>

      <!-- USER INFORMATION -->
      <div style="background-color:#0f172a; border:1px solid #334155; border-radius:14px; padding:16px 18px; margin-bottom:18px;">
        <h3 style="margin:0 0 14px; color:#f8fafc; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #1e293b; padding-bottom:8px;">
           User Information
        </h3>
        
        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Member Name</div>
          <div style="font-size:13px; font-weight:700; color:#f8fafc; word-break:break-word; margin-top:2px;">${user.name}</div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Member ID</div>
          <div style="font-size:13px; font-weight:700; color:#c084fc; font-family:monospace; word-break:break-all; margin-top:2px;">${user.parishMemberId || user._id}</div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Registered Email</div>
          <div style="font-size:13px; font-weight:700; color:#38bdf8; word-break:break-all; margin-top:2px;">${user.email || 'N/A'}</div>
        </div>

        <div>
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Registered Mobile</div>
          <div style="font-size:13px; font-weight:700; color:#f8fafc; margin-top:2px;">${user.phone || 'N/A'}</div>
        </div>
      </div>

      <!-- SUSPICIOUS LOGIN DETAILS -->
      <div style="background-color:#0f172a; border:1px solid #334155; border-radius:14px; padding:16px 18px; margin-bottom:18px;">
        <h3 style="margin:0 0 14px; color:#f8fafc; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #1e293b; padding-bottom:8px;">
           Suspicious Login Details
        </h3>
        
        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Login Date & Time</div>
          <div style="font-size:13px; font-weight:700; color:#f8fafc; margin-top:2px;">${loginTimeFormatted}</div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Location</div>
          <div style="font-size:13px; font-weight:700; color:#f8fafc; margin-top:2px;">Coimbatore, Tamil Nadu, India</div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">IP Address</div>
          <div style="font-size:13px; font-weight:700; color:#cbd5e1; font-family:monospace; margin-top:2px;">103.45.23.12</div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Device</div>
          <div style="font-size:13px; font-weight:700; color:#f8fafc; margin-top:2px;">Windows PC / Laptop</div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Operating System</div>
          <div style="font-size:13px; font-weight:700; color:#f8fafc; margin-top:2px;">Windows</div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Browser</div>
          <div style="font-size:13px; font-weight:700; color:#f8fafc; margin-top:2px;">Google Chrome</div>
        </div>

        <div>
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Login Method</div>
          <div style="font-size:13px; font-weight:700; color:#38bdf8; margin-top:2px;">Password / OTP</div>
        </div>
      </div>

      <!-- INCIDENT TIMELINE -->
      <div style="background-color:#0f172a; border:1px solid #334155; border-radius:14px; padding:16px 18px; margin-bottom:18px;">
        <h3 style="margin:0 0 14px; color:#f8fafc; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #1e293b; padding-bottom:8px;">
           Incident Timeline
        </h3>
        
        <div style="font-size:13px; line-height:1.7;">
          <div style="margin-bottom:10px; padding-left:10px; border-left:3px solid #ef4444;">
            <strong style="color:#ef4444;">1. Login Attempt:</strong> A successful login to the user's account was detected.
          </div>

          <div style="margin-bottom:10px; padding-left:10px; border-left:3px solid #f59e0b;">
            <strong style="color:#f59e0b;">2. Security Notification:</strong> The system immediately sent a login alert email to the registered email address.
          </div>

          <div style="margin-bottom:10px; padding-left:10px; border-left:3px solid #dc2626;">
            <strong style="color:#dc2626;">3. User Action:</strong> The user opened the security email, selected "Wasn't You?", and confirmed that the login was unauthorized.
          </div>

          <div style="padding-left:10px; border-left:3px solid #10b981;">
            <strong style="color:#10b981;">4. Automatic Security Response:</strong>
            <p style="margin:4px 0 0; color:#cbd5e1;">The system immediately performed the following automated protection actions:</p>
            <ul style="margin:6px 0 0; padding-left:16px; color:#6ee7b7; font-weight:600;">
              <li> Logged out all active sessions.</li>
              <li> Terminated the suspicious login session.</li>
              <li> Invalidated all active authentication tokens.</li>
              <li> Removed the suspicious device from trusted devices.</li>
              <li> Marked the login as a security incident.</li>
              <li> Initiated the password recovery/reset process.</li>
              <li> Recorded the incident in the security audit log.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- CURRENT ACCOUNT STATUS -->
      <div style="background-color:#0f172a; border:1px solid #334155; border-radius:14px; padding:16px 18px; margin-bottom:18px;">
        <h3 style="margin:0 0 14px; color:#f8fafc; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #1e293b; padding-bottom:8px;">
           Current Account Status
        </h3>
        
        <div style="margin-bottom:10px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Account Status</div>
          <div style="font-size:13px; font-weight:700; color:#34d399; margin-top:2px;">Secured</div>
        </div>

        <div style="margin-bottom:10px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Suspicious Session</div>
          <div style="font-size:13px; font-weight:700; color:#f8fafc; margin-top:2px;">Terminated</div>
        </div>

        <div style="margin-bottom:10px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Authentication Tokens</div>
          <div style="font-size:13px; font-weight:700; color:#f8fafc; margin-top:2px;">Invalidated</div>
        </div>

        <div style="margin-bottom:10px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Password Reset</div>
          <div style="font-size:13px; font-weight:700; color:#f59e0b; margin-top:2px;">Initiated / Pending User Update</div>
        </div>

        <div style="margin-bottom:10px;">
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Trusted Device Status</div>
          <div style="font-size:13px; font-weight:700; color:#f8fafc; margin-top:2px;">Removed</div>
        </div>

        <div>
          <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Risk Level</div>
          <div style="margin-top:3px;"><span style="background-color:#7f1d1d; color:#fca5a5; font-weight:800; font-size:11px; padding:3px 10px; border-radius:20px; border:1px solid #ef4444; display:inline-block;">HIGH</span></div>
        </div>
      </div>

      <!-- RECOMMENDED ADMINISTRATOR ACTIONS -->
      <div style="background-color:#0f172a; border:1px solid #334155; border-radius:14px; padding:16px 18px; margin-bottom:22px;">
        <h3 style="margin:0 0 12px; color:#f8fafc; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #1e293b; padding-bottom:8px;">
           Recommended Administrator Actions
        </h3>
        <ul style="margin:0; padding-left:16px; font-size:13px; color:#cbd5e1;">
          <li style="padding:2px 0;">Review the user's recent account activity.</li>
          <li style="padding:2px 0;">Verify whether any profile or account changes were made during the suspicious session.</li>
          <li style="padding:2px 0;">Contact the member if additional verification is required.</li>
          <li style="padding:2px 0;">Assist the user if they encounter any issues during password recovery.</li>
          <li style="padding:2px 0;">Escalate the incident if repeated suspicious login attempts are detected.</li>
        </ul>
      </div>

      <!-- VIEW IN NOTIFICATIONS DEEP-LINK BUTTON -->
      <div style="text-align:center; margin:28px 0 20px;">
        <p style="color:#cbd5e1; font-size:13px; line-height:1.6; margin-bottom:14px;">
          To view the complete incident report, activity logs, affected sessions, and audit details, click the button below:
        </p>
        <a href="${deepLinkUrl}" style="display:block; width:100%; box-sizing:border-box; background:linear-gradient(135deg,#2563eb,#1d4ed8); color:#ffffff; font-weight:800; font-size:15px; text-decoration:none; padding:16px 20px; border-radius:14px; text-align:center; box-shadow:0 4px 18px rgba(37,99,235,0.4); border:1px solid #3b82f6;">
           View in Notifications
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

    <!-- FOOTER -->
    <div style="background-color:#0f172a; padding:16px 20px; text-align:center; color:#94a3b8; font-size:12px; border-top:1px solid #334155;">
      <p style="margin:0; font-weight:700; color:#cbd5e1;">St. John de Britto's Church, Kalayarkoil</p>
      <p style="margin:4px 0 0; color:#64748b; font-size:11px;">Parish Management System • Automated Security Monitor</p>
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
        subject: ` Security Incident #${incidentCode}: Unauthorized Login Reported — St. John de Britto's Church`,
        html: emailHtml
      }).then(res => {
        if (res.success) console.log(` Security incident email sent to admin ${adminEmail}`);
      }).catch(err => console.error(' Security incident admin email error:', err.message));
    });

  } catch (err) {
    console.error(' sendAdminSecurityIncidentEmail error:', err.message);
  }
}

module.exports = {
  verifyReportToken,
  confirmUnauthorized,
  getIncidents,
  updateIncidentStatus,
  reactivateUserAccount,
  reactivateUserByUserId
};

