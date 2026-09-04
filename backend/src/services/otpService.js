const bcrypt = require('bcryptjs');
const User = require('../models/User');
const OTPVerification = require('../models/OTPVerification');
const { sendMail } = require('../config/mailer');
const { sendSMS } = require('../config/twilio');
const { notifyAdmin } = require('./adminNotificationService');

/**
 * Generates a cryptographically sound 6-digit numeric OTP code.
 */
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Creates a fresh, hashed OTP verification session and dispatches the plain OTP to the user.
 * 
 * - Invalids any previous pending OTP sessions (status = 'replaced')
 * - Stores ONLY the bcrypt hash of the OTP in the database
 * - Sets a strict 5-minute expiration time
 * - Dispatches plain OTP via SMS & Email directly to the parishioner
 * - Notifies administrators of event (excluding plain OTP from logs)
 */
const createAndSendOTP = async ({ userId, phone, email, purpose = 'login', req }) => {
  const user = await User.findById(userId);
  const targetPhone = (phone || user?.phone || '').trim();
  const targetEmail = (email || user?.email || '').trim().toLowerCase();

  // 0. Per-contact & Per-user Cooldown Check (60 seconds)
  const cooldownWindowMs = 60 * 1000;
  const orConditions = [];
  if (userId) orConditions.push({ userId });
  if (targetPhone) orConditions.push({ phone: targetPhone });
  if (targetEmail) orConditions.push({ email: targetEmail });

  if (orConditions.length > 0) {
    const recentOTP = await OTPVerification.findOne({
      $or: orConditions,
      createdAt: { $gt: new Date(Date.now() - cooldownWindowMs) }
    }).sort({ createdAt: -1 });

    if (recentOTP) {
      const elapsedMs = Date.now() - new Date(recentOTP.createdAt).getTime();
      const waitSec = Math.max(1, Math.ceil((cooldownWindowMs - elapsedMs) / 1000));
      const error = new Error(`Please wait ${waitSec} second${waitSec > 1 ? 's' : ''} before requesting another verification code.`);
      error.statusCode = 429;
      error.cooldownRemaining = waitSec;
      throw error;
    }
  }

  // 1. Invalidate any existing pending OTP sessions for this user/purpose
  const existingPending = await OTPVerification.find({
    userId,
    purpose,
    verified: false,
    status: 'pending'
  });

  const wasReissued = existingPending.length > 0;

  if (wasReissued) {
    await OTPVerification.updateMany(
      {
        userId,
        purpose,
        verified: false,
        status: 'pending'
      },
      {
        $set: { status: 'replaced' }
      }
    );
  }

  // 2. Generate new 6-digit OTP and calculate bcrypt hash
  const otp = generateOTP();
  const salt = await bcrypt.genSalt(10);
  const otpHash = await bcrypt.hash(otp, salt);

  // 3. Strict 5-Minute Expiration
  const now = new Date();
  const otpExpiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

  // 4. Save new OTPVerification session document
  const session = await OTPVerification.create({
    userId,
    email: targetEmail,
    phone: targetPhone,
    purpose,
    otpHash,
    otpExpiresAt,
    verified: false,
    status: 'pending',
    attempts: 0,
    notifiedExpired: false,
    lastOtpSentAt: now
  });

  // Keep legacy User timestamps synchronized
  if (user) {
    await User.findByIdAndUpdate(userId, {
      otpGeneratedAt: now,
      otpNotifiedExpired: false
    });
  }

  // 5. Notify admin of OTP dispatch (Plain OTP is strictly omitted)
  notifyAdmin({
    type: wasReissued ? 'OTP_REISSUED' : 'OTP_SENT',
    user: user || { _id: userId, name: 'Parish Member', email: targetEmail, phone: targetPhone },
    req,
    extra: {
      phone: targetPhone,
      email: targetEmail,
      purpose,
      expiresAt: otpExpiresAt,
      requestedAt: now
    }
  }).catch(e => console.warn('Admin OTP notification error:', e.message));

  // 6. Send OTP via SMS
  if (targetPhone) {
    let formattedPhone = targetPhone;
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+91' + formattedPhone;
    }

    const smsBody = `Your St. John de britto Church verification code is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;

    sendSMS(formattedPhone, smsBody).then(res => {
      if (res.success) console.log(` OTP SMS sent to ${formattedPhone}`);
      else console.warn(` SMS failed for ${formattedPhone}: [${res.code || 'N/A'}] ${res.error}`);
    }).catch(err => console.error(` SMS Error: ${err.message}`));
  }

  // 7. Send OTP via Email
  if (targetEmail) {
    sendMail({
      to: targetEmail,
      subject: 'Your Verification Code — St. John de Britto\'s Church',
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Verification Code</title>
  <style>
    body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 12px 8px !important; }
      .email-content { padding: 24px 16px !important; }
      .header-box { padding: 24px 16px !important; }
      .otp-code { font-size: 34px !important; letter-spacing: 8px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;">
  <div class="email-wrapper" style="background-color:#f1f5f9; padding:25px 12px;">
    <div style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.08); border:1px solid #e5e7eb;">
      
      <!-- Header -->
      <div class="header-box" style="background:linear-gradient(135deg,#1e3a8a,#0f172a); padding:32px 24px; text-align:center;">
        <div style="width:75px; height:75px; margin:0 auto 14px; border-radius:50%; overflow:hidden; border:3px solid #fbbf24; background:#ffffff; box-shadow:0 6px 16px rgba(0,0,0,0.25);">
          <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
        </div>
        <h1 style="margin:0; color:#fbbf24; font-size:24px; font-weight:800; letter-spacing:0.5px;">St. John de britto Church</h1>
        <p style="margin:4px 0 0; color:#ffffff; opacity:0.9; font-size:12.5px; font-weight:600; letter-spacing:0.5px;">PARISH ONLINE PORTAL VERIFICATION</p>
      </div>

      <!-- Body -->
      <div class="email-content" style="padding:32px 24px; text-align:center;">
        <h2 style="color:#1e3a8a; margin-top:0; font-size:22px; font-weight:800; margin-bottom:8px;">One-Time Verification Code</h2>
        <p style="color:#4b5563; font-size:14px; line-height:1.6; margin-bottom:20px;">Use the following code to securely complete your ${purpose === 'registration' ? 'registration' : purpose === 'password_reset' ? 'password reset' : 'sign-in'}.</p>
        
        <div style="background:linear-gradient(135deg,#fef3c7,#fff7ed); border:2px dashed #f59e0b; border-radius:16px; padding:20px 16px; margin:20px 0;">
          <div class="otp-code" style="font-size:38px; font-weight:900; letter-spacing:10px; color:#92400e; font-family:Consolas, Monaco, monospace;">${otp}</div>
        </div>

        <p style="color:#dc2626; font-weight:700; margin-top:16px; font-size:13.5px;"> This OTP is valid for 5 minutes only.</p>
        <p style="color:#6b7280; font-size:12.5px; line-height:1.6; margin-top:8px;">Do not share this code with anyone for your account security.</p>
        
        <!-- DYNAMIC_BIBLE_VERSE -->
      </div>

      <!-- Footer -->
      <div style="background-color:#111827; padding:18px 16px; text-align:center; color:#9ca3af; font-size:11.5px; line-height:1.6;">
        <p style="margin:0 0 4px; color:#e5e7eb; font-weight:700;">St. John de britto Church, Kalayarkoil - 630551</p>
        <p style="margin:0; color:#6b7280;">Automated System Message • Do not reply</p>
      </div>
    </div>
  </div>
</body>
</html>`
    }).catch(err => console.error(` Mail Error: ${err.message}`));
  }

  // Dev log
  console.log(` OTP generated for ${targetPhone || targetEmail} [${purpose}]: ${otp}`);

  return { session, otp };
};

/**
 * Verifies a submitted OTP against the latest active OTPVerification session.
 */
const verifyOTPSession = async ({ userId, inputOtp, purpose, req }) => {
  if (!userId || !inputOtp) {
    return { valid: false, message: 'Missing user ID or OTP code' };
  }

  const query = {
    userId,
    verified: false,
    status: 'pending'
  };
  if (purpose) query.purpose = purpose;

  // Find the latest pending verification session
  const session = await OTPVerification.findOne(query).sort({ createdAt: -1 });

  if (!session) {
    return {
      valid: false,
      message: 'No active verification session found. Please request a fresh OTP or log in again.'
    };
  }

  // Check 5-Minute Expiration
  const now = new Date();
  if (now > session.otpExpiresAt) {
    session.status = 'expired';
    await session.save();
    return {
      valid: false,
      message: 'This OTP has expired. A fresh OTP is required.'
    };
  }

  // Compare submitted code against bcrypt hash
  const isMatch = await bcrypt.compare(inputOtp.toString().trim(), session.otpHash);

  if (!isMatch) {
    session.attempts += 1;

    // Check brute-force limit on session
    if (session.attempts >= 5) {
      session.status = 'failed';
      await session.save();

      const user = await User.findById(userId);
      notifyAdmin({
        type: 'MULTIPLE_FAILED_OTP',
        user,
        req,
        attempt: session.attempts,
        extra: { purpose: session.purpose }
      }).catch(e => console.warn('Admin MULTIPLE_FAILED_OTP notification error:', e.message));

      return {
        valid: false,
        message: 'Maximum OTP verification attempts exceeded. Please request a new OTP.'
      };
    }

    await session.save();
    return {
      valid: false,
      message: `Invalid OTP code. ${5 - session.attempts} attempts remaining.`
    };
  }

  // OTP is Valid & Verified!
  session.verified = true;
  session.status = 'verified';
  await session.save();

  // Mark user as verified, active, unsuspended and clear all failure/lockout counters
  // Preserve all existing account records and profile details completely
  const user = await User.findByIdAndUpdate(userId, {
    isVerified: true,
    isActive: true,
    isSuspended: false,
    suspensionReason: undefined,
    failedLoginAttempts: 0,
    firstFailedAttempt: null,
    lastFailedAttempt: null,
    isLockedUntil: null,
    lockoutCount: 0,
    firstLockoutAt: null,
    otpNotifiedExpired: true
  }, { new: true });

  // Auto-resolve any pending SecurityIncident records for this user
  try {
    const SecurityIncident = require('../models/SecurityIncident');
    await SecurityIncident.updateMany(
      { userId: user?._id, status: { $in: ['Awaiting Review', 'Under Review'] } },
      {
        $set: { status: 'Reactivated', reactivationTime: new Date() },
        $push: { actionsTaken: `Auto-reactivated via verified OTP session on ${new Date().toISOString()}` }
      }
    );
  } catch (incErr) {
    console.warn('Security incident auto-reactivation warning:', incErr.message);
  }

  // Notify admin of confirmed OTP verification
  notifyAdmin({
    type: 'OTP_VERIFIED',
    user,
    req,
    extra: { purpose: session.purpose }
  }).catch(e => console.warn('Admin OTP_VERIFIED notification error:', e.message));

  return { valid: true, user, session };
};

/**
 * Backward compatibility adapter for sendOTP.
 */
const sendOTP = async (userId, phone, email, purpose = 'login', req) => {
  const result = await createAndSendOTP({ userId, phone, email, purpose, req });
  return result.otp;
};

/**
 * Backward compatibility adapter for verifyOTP.
 */
const verifyOTP = async (userId, inputOtp, purpose, req) => {
  return verifyOTPSession({ userId, inputOtp, purpose, req });
};

/**
 * Background worker task: Scans for abandoned/expired pending OTP sessions
 * and emits an 'OTP_EXPIRED' administrative notification alert.
 */
const checkAndNotifyExpiredOTPs = async () => {
  try {
    const now = new Date();
    const expiredSessions = await OTPVerification.find({
      verified: false,
      status: 'pending',
      otpExpiresAt: { $lt: now },
      notifiedExpired: false
    });

    for (const session of expiredSessions) {
      session.status = 'expired';
      session.notifiedExpired = true;
      await session.save();

      const user = await User.findById(session.userId);
      await notifyAdmin({
        type: 'OTP_EXPIRED',
        user: user || { _id: session.userId, email: session.email, phone: session.phone },
        extra: {
          purpose: session.purpose,
          requestedAt: session.createdAt,
          expiredAt: session.otpExpiresAt
        }
      });
    }
  } catch (err) {
    console.error('Error scanning expired OTP sessions:', err.message);
  }
};

module.exports = {
  createAndSendOTP,
  verifyOTPSession,
  sendOTP,
  verifyOTP,
  generateOTP,
  checkAndNotifyExpiredOTPs
};
