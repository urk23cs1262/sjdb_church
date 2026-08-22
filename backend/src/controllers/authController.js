const bcrypt = require('bcryptjs');
const User = require('../models/User');
const SecurityIncident = require('../models/SecurityIncident');
const { generateToken } = require('../middleware/auth');
const { createAndSendOTP, verifyOTPSession, sendOTP, verifyOTP } = require('../services/otpService');
const { createNotification } = require('../services/notificationService');
const { notifyAdmin } = require('../services/adminNotificationService');
const { sendLoginAlertEmail, sendPasswordUpdatedEmail } = require('../services/loginSecurityService');

const { generateNextMemberId, generateNextFamilyId } = require('../services/memberIdService');

// @POST /api/auth/register
const register = async (req, res) => {
  try {
    const MaintenanceSetting = require('../models/MaintenanceSetting');
    const maintSettings = await MaintenanceSetting.findOne({ key: 'site_maintenance' });
    if (maintSettings && maintSettings.isEnabled) {
      return res.status(503).json({
        success: false,
        isMaintenanceRestricted: true,
        title: 'Access Restricted',
        message: 'The website is currently under maintenance. Registration is temporarily disabled for normal users. Please try again later.'
      });
    }

    let { name, familyName, familyId, dob, gender, phone, email, address, parishMemberId, password, subStation, familyRole, familyMembers } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Name, phone, and password are required' });
    }

    // Sanitize empty strings for unique fields so they don't trigger E11000 duplicate key errors
    if (email === "") email = undefined;
    
    // Auto-generate sequential Member ID (SJDB_M01, SJDB_M02...) if not provided
    if (!parishMemberId || parishMemberId.trim() === "") {
      parishMemberId = await generateNextMemberId();
    }

    // Auto-assign Family ID: Check if matching familyName already exists so family members share the SAME Family ID!
    if (!familyId || familyId.trim() === "") {
      if (familyName && familyName.trim()) {
        const existingFamilyUser = await User.findOne({
          familyName: new RegExp('^' + familyName.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i')
        }).select('familyId');
        if (existingFamilyUser && existingFamilyUser.familyId) {
          familyId = existingFamilyUser.familyId;
        }
      }
      if (!familyId || familyId.trim() === "") {
        familyId = await generateNextFamilyId();
      }
    }

    const existing = await User.findOne({ $or: [{ phone }, ...(email ? [{ email }] : [])] });
    if (existing) {
      if (existing.isVerified) {
        // Already a verified account — do NOT touch any data, just reject
        return res.status(409).json({ success: false, message: 'Phone or email already registered. Please sign in.' });
      } else {
        // Pending/incomplete registration only: Update details, invalidate old OTP, generate & send fresh OTP
        // Only update fields that were provided and are not yet set
        const passwordHash = await bcrypt.hash(password, 12);
        existing.name = name;
        if (familyName) existing.familyName = familyName;
        if (familyId) existing.familyId = familyId;
        if (dob) existing.dob = dob;
        if (gender) existing.gender = gender;
        if (address) existing.address = address;
        if (subStation) existing.subStation = subStation;
        if (familyRole) existing.familyRole = familyRole;
        if (familyMembers) existing.familyMembers = familyMembers;
        if (email) existing.email = email;
        existing.passwordHash = passwordHash;
        await existing.save();

        const { otp } = await createAndSendOTP({
          userId: existing._id,
          phone: existing.phone,
          email: existing.email,
          purpose: 'registration',
          req
        });

        return res.status(200).json({
          success: true,
          message: 'Previous incomplete registration found. A fresh 5-minute verification code has been sent.',
          userId: existing._id,
          devOtp: otp,
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ 
      name, 
      familyName, 
      familyId,
      dob, 
      gender, 
      phone, 
      email, 
      address, 
      subStation,
      familyRole,
      familyMembers,
      parishMemberId, 
      passwordHash 
    });

    const { otp } = await createAndSendOTP({
      userId: user._id,
      phone,
      email,
      purpose: 'registration',
      req
    });

    // Emit NEW_USER admin notification & generate registration PDF report
    notifyAdmin({
      type: 'NEW_USER',
      user,
      req
    }).catch(e => console.warn('Admin NEW_USER notification error:', e.message));

    return res.status(201).json({
      success: true,
      message: 'Registration successful. A 5-minute verification code has been sent.',
      userId: user._id,
      devOtp: otp,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/auth/verify-otp
const verifyOtp = async (req, res) => {
  try {
    const { userId, otp, purpose } = req.body;
    const result = await verifyOTP(userId, otp, purpose, req);
    if (!result.valid) return res.status(400).json({ success: false, message: result.message });

    // Fetch the latest user AFTER OTP verification (verifyOTPSession already sets isVerified: true)
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const now = new Date();
    const isFirstLogin = !user.firstSuccessfulLoginAt;
    const isReVerification = user.isVerified === true && !!user.firstSuccessfulLoginAt;

    // Update OTP verification state — preserve all existing account data
    // For re-verification (30-day cycle): keep isVerified true, restore isActive & unsuspended
    const updateFields = {
      otpVerified: true,
      otpVerifiedAt: now,
      isVerified: true,   // Always ensure verified stays true after successful OTP
      isActive: true,     // Restore active status
      isSuspended: false, // Ensure suspension is lifted
      suspensionReason: undefined,
      otp: null,
      otpExpires: null,
      lastLogin: now,
      lastSuccessfulLogin: now,
      failedLoginAttempts: 0,
      firstFailedAttempt: null,
      lastFailedAttempt: null,
      isLockedUntil: null,
      lockoutCount: 0,
      firstLockoutAt: null,
      ...(isFirstLogin ? { firstSuccessfulLoginAt: now } : {})
    };
    await User.findByIdAndUpdate(user._id, updateFields);

    // Auto-resolve any pending SecurityIncident records for this user
    try {
      const SecurityIncident = require('../models/SecurityIncident');
      await SecurityIncident.updateMany(
        { userId: user._id, status: { $in: ['Awaiting Review', 'Under Review'] } },
        { 
          $set: { status: 'Reactivated', reactivationTime: now },
          $push: { actionsTaken: `Auto-reactivated via verified OTP login on ${now.toISOString()}` }
        }
      );
    } catch (incErr) {
      console.warn('Security incident auto-reactivation warning in authController:', incErr.message);
    }

    // Re-fetch fresh user state after update (so token/response has latest data)
    const updatedUser = await User.findById(userId).select('-passwordHash -otp -otpExpires');

    const token = generateToken(user._id, user.role, user.authVersion || user.tokenVersion || 1);

    // Trigger Login Alert Email
    sendLoginAlertEmail({ user: updatedUser, req, loginMethod: 'OTP' }).catch(e => console.error('Login alert email error:', e));

    // Notify Admin — only on first login (not routine 30-day re-verifications)
    if (isFirstLogin) {
      notifyAdmin({
        type: 'LOGIN_SUCCESS',
        user: updatedUser,
        req,
        extra: { isFirstLogin: true }
      }).catch(e => console.warn('Admin LOGIN_SUCCESS notification error:', e.message));
    }

    // Send Welcome Notification only on very first registration verification
    if (isFirstLogin) {
      createNotification({
        userId: user._id,
        recipient: 'user',
        title: "Welcome to St. John de Britto's Church! ",
        message: `Dear ${user.name}, thank you for registering with our Parish platform. Our website allows you to book Mass intentions, request documents, view daily readings, and stay updated with church events. We are glad to have you with us!`,
        type: 'general',
        category: 'account',
        priority: 'low',
        actionUrl: '/dashboard',
        channels: ['email']
      }).catch(e => console.warn('Welcome notification error:', e.message));

      // Check if it's their birthday TODAY and send birthday wish if so
      if (user.dob) {
        const today = new Date();
        const dob = new Date(user.dob);
        if (today.getDate() === dob.getDate() && today.getMonth() === dob.getMonth()) {
          createNotification({
            userId: user._id,
            isBroadcast: false,
            title: "Birthday Blessings",
            message: `Dear ${user.name}, St. John de Britto's Church wishes you a very Happy Birthday! May God bless you with abundant joy, health, and peace on your special day. `,
            type: 'general',
            channels: ['email']
          }).catch(e => console.warn('Birthday notification error:', e.message));
        }
      }
    }

    return res.json({ 
      success: true, 
      message: isReVerification ? 'Re-verified successfully. Your account remains active.' : 'Verified successfully', 
      token, 
      user: { 
        _id: updatedUser._id, 
        name: updatedUser.name, 
        role: updatedUser.role,
        dob: updatedUser.dob,
        isVerified: true,
        isActive: updatedUser.isActive
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/auth/login
const login = async (req, res) => {
  try {
    const { login: loginId, password } = req.body;
    if (!loginId || !password) return res.status(400).json({ success: false, message: 'Login and password required' });

    let user = await User.findOne({
      $or: [
        { email: { $regex: new RegExp('^' + loginId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i') } },
        { phone: loginId }
      ]
    });

    if (!user && !loginId.includes('@')) {
      const cleanDigits = loginId.replace(/\D/g, '');
      if (cleanDigits.length >= 10) {
        const last10 = cleanDigits.slice(-10);
        user = await User.findOne({ phone: new RegExp(last10 + '$') });
      }
    }

    if (!user) {
      notifyAdmin({
        type: 'LOGIN_FAILED',
        req,
        reason: 'User not found / Invalid identifier',
        extra: { email: loginId, phone: loginId }
      }).catch(e => console.warn('Admin LOGIN_FAILED error:', e.message));
      return res.status(401).json({ success: false, message: 'Incorrect password or user not found. Please try again.' });
    }

    const now = new Date();

    // 1. Check if Account is Suspended
    if (user.isSuspended) {
      notifyAdmin({
        type: 'ACCOUNT_LOCKED',
        user,
        req,
        reason: 'Suspended account attempted login'
      }).catch(e => console.warn('Admin ACCOUNT_LOCKED error:', e.message));

      return res.status(403).json({
        success: false,
        isSuspended: true,
        canResetPassword: true,
        message: 'Your account has been automatically suspended due to repeated failed login attempts for your security. Please contact the administrator to restore access.'
      });
    }

    // 2. Check if Account is Temporarily Locked (15-min lockout)
    if (user.isLockedUntil) {
      if (now < new Date(user.isLockedUntil)) {
        const remainingMins = Math.max(1, Math.ceil((new Date(user.isLockedUntil) - now) / (60 * 1000)));
        return res.status(429).json({
          success: false,
          isLockedOut: true,
          lockedUntil: user.isLockedUntil,
          canResetPassword: true,
          message: `Your account is temporarily locked for 15 minutes due to multiple failed login attempts. Please try again in ${remainingMins} minute(s) or reset your password.`
        });
      } else {
        // Lockout expired, clear lockout flag
        await User.findByIdAndUpdate(user._id, { isLockedUntil: null });
      }
    }

    const match = await bcrypt.compare(password, user.passwordHash);

    // 3. Password Mismatch Handling (Progressive Lockout & Suspension)
    if (!match) {
      // 24-hour lockout counter window reset check
      const dayMs = 24 * 60 * 60 * 1000;
      let lockoutCount = user.lockoutCount || 0;
      let firstLockoutAt = user.firstLockoutAt || null;

      if (firstLockoutAt && (now - new Date(firstLockoutAt)) > dayMs) {
        lockoutCount = 0;
        firstLockoutAt = null;
      }

      // 30-minute failed attempt window reset check
      const windowMs = 30 * 60 * 1000;
      let failedAttempts = (user.failedLoginAttempts || 0) + 1;
      let firstAttempt = user.firstFailedAttempt || now;

      if (user.firstFailedAttempt && (now - new Date(user.firstFailedAttempt)) > windowMs) {
        failedAttempts = 1;
        firstAttempt = now;
      }

      const updateFields = {
        failedLoginAttempts: failedAttempts,
        firstFailedAttempt: firstAttempt,
        lastFailedAttempt: now,
        lockoutCount,
        firstLockoutAt
      };

      const { parseUserAgent, parseClientIpAndLocation, sendUserSuspensionEmail, sendAdminSuspensionIncidentEmail, sendUserTemporaryLockoutEmail } = require('../services/loginSecurityService');
      const ipDetails = parseClientIpAndLocation(req);
      const uaDetails = parseUserAgent(req.headers['user-agent']);

      // RULE: 10 Failed Attempts OR 2 Lockouts within 24h = AUTOMATIC ACCOUNT SUSPENSION
      if (failedAttempts >= 10 || lockoutCount >= 2) {
        updateFields.isSuspended = true;
        updateFields.suspendedAt = now;
        updateFields.suspensionReason = `Exceeded failed attempt threshold (${failedAttempts} attempts / ${lockoutCount} lockouts within 24h)`;

        await User.findByIdAndUpdate(user._id, updateFields);

        // Record Security Incident
        const incident = await SecurityIncident.create({
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          userPhone: user.phone,
          type: 'brute_force_suspension',
          status: 'Awaiting Review',
          failedAttempts,
          threshold: 10,
          firstFailedAttempt: firstAttempt,
          lastFailedAttempt: now,
          loginTime: now,
          device: uaDetails.device,
          browser: uaDetails.browser,
          os: uaDetails.os,
          ipAddress: ipDetails.ip,
          location: ipDetails.location,
          loginMethod: 'Password',
          actionsTaken: [
            `Automatically suspended user account after ${failedAttempts} failed login attempts`,
            'Blocked future login attempts pending administrator review',
            'Logged incident in security audit registry',
            'Dispatched email notification to user & parish administrator'
          ]
        });

        // Send Email Alerts & Notifications
        sendUserSuspensionEmail({ user, incident, ipDetails }).catch(e => console.warn('User suspension email error:', e.message));
        sendAdminSuspensionIncidentEmail({ user, incident, ipDetails }).catch(e => console.warn('Admin suspension email error:', e.message));

        createNotification({
          recipient: 'admin',
          title: ' Security Incident: Account Suspended',
          message: `User ${user.name} (${user.email || user.phone}) has been automatically suspended after ${failedAttempts} failed login attempts.`,
          type: 'system',
          category: 'system',
          priority: 'high',
          actionUrl: `/admin/notifications?incidentId=${incident._id}`,
          relatedId: incident._id,
          relatedModel: 'SecurityIncident'
        }).catch(e => console.warn('Suspension admin notification error:', e.message));

        return res.status(403).json({
          success: false,
          isSuspended: true,
          canResetPassword: true,
          message: 'Your account has been automatically suspended due to repeated failed login attempts for your security. Please contact the administrator to restore access.'
        });

      } 
      // RULE: 5 Failed Attempts = 15-MINUTE TEMPORARY LOCKOUT
      else if (failedAttempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        updateFields.isLockedUntil = lockUntil;
        updateFields.lockoutCount = lockoutCount + 1;
        updateFields.firstLockoutAt = firstLockoutAt || now;

        await User.findByIdAndUpdate(user._id, updateFields);

        // Send Lockout Email & Notification to User
        sendUserTemporaryLockoutEmail({ user, lockMinutes: 15, ipDetails }).catch(e => console.warn('Lockout email error:', e.message));

        createNotification({
          userId: user._id,
          recipient: 'user',
          title: 'Account Temporarily Locked ',
          message: 'Your account has been temporarily locked for 15 minutes due to 5 consecutive failed login attempts. You can try again in 15 minutes or reset your password.',
          type: 'general',
          category: 'account',
          priority: 'high',
          actionUrl: '/login',
          channels: ['email', 'push']
        }).catch(e => console.warn('Lockout user notification error:', e.message));

        return res.status(429).json({
          success: false,
          isLockedOut: true,
          lockedUntil: lockUntil,
          canResetPassword: true,
          message: 'Your account has been temporarily locked for 15 minutes due to multiple failed login attempts. Please check your email or reset your password.'
        });

      } 
      // RULE: 4 Failed Attempts = WARNING MESSAGE
      else if (failedAttempts === 4) {
        notifyAdmin({
          type: 'LOGIN_FAILED',
          user,
          req,
          attempt: failedAttempts,
          reason: 'Incorrect password (Attempt 4/5)'
        }).catch(e => console.warn('Admin LOGIN_FAILED error:', e.message));

        await User.findByIdAndUpdate(user._id, updateFields);
        return res.status(401).json({
          success: false,
          message: 'You have 1 attempt remaining before your account is temporarily locked for 15 minutes.'
        });

      } 
      // ℹ RULE: 1 - 3 Failed Attempts = STANDARD ERROR MESSAGE
      else {
        notifyAdmin({
          type: 'LOGIN_FAILED',
          user,
          req,
          attempt: failedAttempts,
          reason: 'Incorrect password'
        }).catch(e => console.warn('Admin LOGIN_FAILED error:', e.message));

        await User.findByIdAndUpdate(user._id, updateFields);
        return res.status(401).json({
          success: false,
          message: 'Incorrect password. Please try again.'
        });
      }
    }

    // 30-Day OTP Re-verification Cycle Check
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const isOtpValid30Days = (user.otpVerified === true || user.isVerified === true) && user.otpVerifiedAt && ((now.getTime() - new Date(user.otpVerifiedAt).getTime()) < THIRTY_DAYS_MS);

    if (!isOtpValid30Days || !user.isVerified) {
      const { otp } = await createAndSendOTP({
        userId: user._id,
        phone: user.phone,
        email: user.email,
        purpose: 'login',
        req
      });

      const isExpiredCycle = user.otpVerifiedAt && ((now.getTime() - new Date(user.otpVerifiedAt).getTime()) >= THIRTY_DAYS_MS);

      return res.status(200).json({
        success: true,
        requiresOTP: true,
        userId: user._id,
        devOtp: otp,
        message: isExpiredCycle
          ? 'Your 30-day security verification window has expired. A fresh 5-minute verification code has been sent.'
          : 'Security verification code required. A 5-minute code has been dispatched to your registered phone/email.'
      });
    }

    // Check Maintenance Mode Restriction
    const MaintenanceSetting = require('../models/MaintenanceSetting');
    const maintSettings = await MaintenanceSetting.findOne({ key: 'site_maintenance' });
    if (maintSettings && maintSettings.isEnabled) {
      const userRole = (user.role || '').toLowerCase();
      const isAdmin = ['admin', 'priest'].includes(userRole);
      const isTech = Boolean(user.isTechnicalTeam) || ['staff', 'technical_team', 'tech_team'].includes(userRole);

      if (!isAdmin && !isTech) {
        return res.status(403).json({
          success: false,
          isMaintenanceRestricted: true,
          title: 'Access Restricted',
          message: 'The website is currently under maintenance.\nOnly Administrators and the Technical Team can access the system at this time.\nPlease try again later.'
        });
      }
    }

    const isFirstLogin = !user.firstSuccessfulLoginAt;

    // Successful login: Reset all failed attempt & lockout counters
    await User.findByIdAndUpdate(user._id, {
      lastLogin: now,
      lastSuccessfulLogin: now,
      ...(isFirstLogin ? { firstSuccessfulLoginAt: now } : {}),
      failedLoginAttempts: 0,
      firstFailedAttempt: null,
      lastFailedAttempt: null,
      isLockedUntil: null,
      lockoutCount: 0,
      firstLockoutAt: null
    });

    const token = generateToken(user._id, user.role, user.authVersion || user.tokenVersion || 1);

    // Notify Admin only on first successful login after registration (omit routine logins by existing users)
    if (isFirstLogin) {
      notifyAdmin({
        type: 'LOGIN_SUCCESS',
        user,
        req,
        extra: { isFirstLogin: true }
      }).catch(e => console.warn('Admin LOGIN_SUCCESS error:', e.message));
    }

    // Trigger Login Security Alert Email
    sendLoginAlertEmail({ user, req, loginMethod: 'Password' }).catch(e => console.error('Login alert email error:', e));

    return res.json({
      success: true,
      token,
      user: { 
        _id: user._id, 
        name: user.name, 
        email: user.email, 
        phone: user.phone, 
        role: user.role, 
        isTechnicalTeam: user.isTechnicalTeam || (user.role === 'staff' || user.role === 'technical_team'),
        profilePhoto: user.profilePhoto,
        dob: user.dob
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/auth/resend-otp
const resendOtp = async (req, res) => {
  try {
    const { userId, purpose = 'login' } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const { otp } = await createAndSendOTP({
      userId: user._id,
      phone: user.phone,
      email: user.email,
      purpose,
      req
    });
    res.json({ success: true, message: 'A new 5-minute verification code has been sent.', devOtp: otp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const MaintenanceSetting = require('../models/MaintenanceSetting');
    const maintSettings = await MaintenanceSetting.findOne({ key: 'site_maintenance' });
    if (maintSettings && maintSettings.isEnabled) {
      return res.status(503).json({
        success: false,
        isMaintenanceRestricted: true,
        title: 'Access Restricted',
        message: 'The website is currently under maintenance. Password reset is temporarily disabled. Please try again later.'
      });
    }

    const { login: loginId } = req.body;
    
    let user = await User.findOne({
      $or: [
        { email: { $regex: new RegExp('^' + loginId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i') } },
        { phone: loginId }
      ]
    });

    if (!user && !loginId.includes('@')) {
      const cleanDigits = loginId.replace(/\D/g, '');
      if (cleanDigits.length >= 10) {
        const last10 = cleanDigits.slice(-10);
        user = await User.findOne({ phone: new RegExp(last10 + '$') });
      }
    }

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Always send email OTP; also try SMS if they logged in by phone
    const sendEmail = user.email || null;
    const sendPhone = loginId.includes('@') ? null : user.phone;
    const { otp } = await createAndSendOTP({
      userId: user._id,
      phone: sendPhone,
      email: sendEmail,
      purpose: 'password_reset',
      req
    });

    notifyAdmin({
      type: 'PASSWORD_RESET',
      user,
      req,
      reason: 'Password reset OTP requested'
    }).catch(e => console.warn('Admin PASSWORD_RESET notification error:', e.message));

    res.json({ success: true, message: 'OTP sent to your requested medium', userId: user._id, devOtp: otp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { userId, otp, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Reject if new password matches old password BEFORE verifying/clearing OTP!
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password cannot be the same as your old password. Please enter a different password.'
      });
    }

    // Now verify and consume the OTP after password validation passes
    const result = await verifyOTP(userId, otp, 'password_reset', req);
    if (!result.valid) return res.status(400).json({ success: false, message: result.message });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(userId, {
      passwordHash,
      $inc: { tokenVersion: 1 }
    });

    notifyAdmin({
      type: 'PASSWORD_RESET',
      user,
      req,
      reason: 'Password updated successfully'
    }).catch(e => console.warn('Admin PASSWORD_RESET notification error:', e.message));

    // Send "Password Updated Successfully" Security Confirmation Email
    sendPasswordUpdatedEmail({ user }).catch(e => console.warn('Password updated email error:', e.message));

    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// @GET /api/auth/family-lookup?familyName=...
const lookupFamily = async (req, res) => {
  try {
    const { familyName } = req.query;
    if (!familyName || !familyName.trim()) {
      return res.json({ success: true, families: [] });
    }

    const cleanName = familyName.trim();
    const users = await User.find({
      familyName: { $regex: new RegExp('^' + cleanName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i') }
    }).select('name familyName familyRole familyMembers subStation phone email parishMemberId familyId');

    if (!users || users.length === 0) {
      return res.json({ success: true, families: [] });
    }

    const families = users.map(user => {
      const allMembers = [];
      if (user.name) {
        allMembers.push({ 
          name: user.name, 
          role: user.familyRole || 'Head', 
          isRegisteredUser: true,
          parishMemberId: user.parishMemberId || '—',
          familyId: user.familyId || '—'
        });
      }
      if (user.familyMembers && Array.isArray(user.familyMembers)) {
        user.familyMembers.forEach(m => {
          if (m.name) {
            allMembers.push({ 
              name: m.name, 
              role: m.role || 'Member', 
              isRegisteredUser: false,
              parishMemberId: m.parishMemberId || '—',
              familyId: user.familyId || '—'
            });
          }
        });
      }

      return {
        userId: user._id,
        familyName: user.familyName,
        subStation: user.subStation,
        familyId: user.familyId,
        parishMemberId: user.parishMemberId,
        primaryUser: { name: user.name, role: user.familyRole, parishMemberId: user.parishMemberId, familyId: user.familyId },
        familyMembers: user.familyMembers || [],
        allMembers
      };
    });

    res.json({ success: true, families });
  } catch (err) {
    console.error('lookupFamily error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/verify-account/send-otp
const sendVerificationOtp = async (req, res) => {
  try {
    const { emailOrUsername } = req.body;
    if (!emailOrUsername) {
      return res.status(400).json({ success: false, message: 'Please enter your email or username' });
    }

    const trimmed = emailOrUsername.trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { email: trimmed },
        { phone: trimmed },
        { parishMemberId: trimmed.toUpperCase() },
        { name: new RegExp(`^${trimmed}$`, 'i') }
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No registered account found with that email or identifier' });
    }

    // Generate and dispatch OTP via Email and SMS
    const { createAndSendOTP } = require('../services/otpService');
    await createAndSendOTP({
      userId: user._id,
      email: user.email,
      phone: user.phone,
      purpose: 'account_verification',
      req
    });

    const emailMasked = user.email ? user.email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3') : null;

    res.json({
      success: true,
      message: `Verification code sent to ${emailMasked || 'your registered contact'}`,
      userId: user._id,
      emailMasked
    });
  } catch (err) {
    console.error('sendVerificationOtp error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/verify-account/verify-otp
const verifyAccountOtp = async (req, res) => {
  try {
    const { userId, emailOrUsername, otp } = req.body;
    if (!otp) {
      return res.status(400).json({ success: false, message: 'Please enter the 6-digit OTP code' });
    }

    let user = null;
    if (userId) {
      user = await User.findById(userId);
    } else if (emailOrUsername) {
      const trimmed = emailOrUsername.trim().toLowerCase();
      user = await User.findOne({
        $or: [
          { email: trimmed },
          { phone: trimmed },
          { parishMemberId: trimmed.toUpperCase() }
        ]
      });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found' });
    }

    const { verifyOTPSession } = require('../services/otpService');
    const result = await verifyOTPSession({
      userId: user._id,
      inputOtp: otp,
      purpose: 'account_verification',
      req
    });

    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    // Reset 30-day verification cycle
    user.account_verified = true;
    user.isVerified = true;
    user.last_verified_at = new Date();
    user.last_verification_stage = null;
    user.last_verification_reminder_at = null;
    await user.save();

    res.json({
      success: true,
      message: 'Account verified successfully! You can now use all church features freely.',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        account_verified: true,
        last_verified_at: user.last_verified_at
      }
    });
  } catch (err) {
    console.error('verifyAccountOtp error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  register,
  verifyOtp,
  login,
  resendOtp,
  forgotPassword,
  resetPassword,
  getMe,
  lookupFamily,
  sendVerificationOtp,
  verifyAccountOtp
};


