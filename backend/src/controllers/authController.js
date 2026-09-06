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
        title: "Welcome to St. John de britto Church! ",
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
            message: `Dear ${user.name}, St. John de britto Church wishes you a very Happy Birthday! May God bless you with abundant joy, health, and peace on your special day. `,
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

    // Mandatory Re-verification / 30-Day Cycle Check
    const requiresReverification = checkReverificationRequired(user);

    if (requiresReverification) {
      const { otp } = await createAndSendOTP({
        userId: user._id,
        phone: user.phone,
        email: user.email,
        purpose: 'account_verification',
        req
      });

      const isExpiredCycle = user.otpVerifiedAt && ((now.getTime() - new Date(user.otpVerifiedAt).getTime()) >= THIRTY_DAYS_MS);
      const emailMasked = user.email ? user.email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3') : null;
      const phoneMasked = user.phone ? user.phone.slice(0, 2) + '******' + user.phone.slice(-2) : null;

      return res.status(200).json({
        success: true,
        requiresOTP: true,
        requiresReverification: true,
        userId: user._id,
        devOtp: otp,
        emailMasked,
        phoneMasked,
        message: isExpiredCycle
          ? 'Your 30-day security verification window has expired. A fresh 5-minute verification code has been sent.'
          : 'Security verification code required. A 5-minute code has been dispatched to your registered contact.'
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

/**
 * Determines whether a user requires mandatory account re-verification.
 * - Church admins are exempt from routine parishioner verification.
 * - Checks account_verified, isVerified, otpVerified.
 * - Checks 30-day security cycle expiration against last_verified_at or otpVerifiedAt.
 */
const checkReverificationRequired = (user) => {
  if (!user) return false;
  if (user.role === 'admin') return false;
  if (user.account_verified === false) return true;
  if (user.isVerified === false) return true;
  if (user.otpVerified === false) return true;
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const refDate = user.last_verified_at || user.otpVerifiedAt;
  if (!refDate) return true;
  if ((Date.now() - new Date(refDate).getTime()) >= THIRTY_DAYS_MS) return true;
  return false;
};

/**
 * Calculates remaining active parishioners requiring re-verification dynamically from database.
 */
const getPendingReverificationCount = async () => {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);
  return await User.countDocuments({
    $or: [
      { otpVerified: false },
      { isVerified: false },
      { account_verified: false },
      { otpVerifiedAt: null },
      { otpVerifiedAt: { $lte: thirtyDaysAgo } }
    ],
    isActive: { $ne: false },
    role: { $ne: 'admin' }
  });
};

// @GET /api/auth/me
const getMe = async (req, res) => {
  const userObj = req.user ? (req.user.toObject ? req.user.toObject() : { ...req.user }) : null;
  if (userObj) {
    userObj.requiresReverification = checkReverificationRequired(req.user);
  }
  res.json({ success: true, user: userObj });
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
    const { userId, emailOrUsername } = req.body;
    if (!userId && !emailOrUsername) {
      return res.status(400).json({ success: false, message: 'Please enter your email, username, or phone number' });
    }

    let user = null;
    if (userId) {
      user = await User.findById(userId);
    } else {
      const trimmed = emailOrUsername.trim().toLowerCase();
      user = await User.findOne({
        $or: [
          { email: trimmed },
          { phone: trimmed },
          { parishMemberId: trimmed.toUpperCase() },
          { name: new RegExp(`^${trimmed}$`, 'i') }
        ]
      });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'No registered account found with that email or identifier' });
    }

    // Check if user is already verified
    if (!checkReverificationRequired(user)) {
      return res.json({
        success: true,
        alreadyVerified: true,
        message: 'Your account is already verified. No OTP verification needed.',
        userId: user._id
      });
    }

    // Generate and dispatch OTP via Email and SMS
    const { createAndSendOTP } = require('../services/otpService');
    const { otp } = await createAndSendOTP({
      userId: user._id,
      email: user.email,
      phone: user.phone,
      purpose: 'account_verification',
      req
    });

    const emailMasked = user.email ? user.email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3') : null;
    const phoneMasked = user.phone ? user.phone.slice(0, 2) + '******' + user.phone.slice(-2) : null;

    res.json({
      success: true,
      message: `Verification code sent to ${emailMasked || phoneMasked || 'your registered contact'}`,
      userId: user._id,
      emailMasked,
      phoneMasked,
      devOtp: otp
    });
  } catch (err) {
    console.error('sendVerificationOtp error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
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

    const now = new Date();
    const wasRecentlyVerified = user.reverificationNotifiedAt && (now.getTime() - new Date(user.reverificationNotifiedAt).getTime() < 60000);

    // Reset 30-day verification cycle in database
    user.account_verified = true;
    user.isVerified = true;
    user.otpVerified = true;
    user.last_verified_at = now;
    user.otpVerifiedAt = now;
    user.last_verification_stage = null;
    user.last_verification_reminder_at = null;
    user.reverificationNotifiedAt = now;
    await user.save();

    let remainingCount = 0;

    // Immediately enable/send notifications across all subscribed channels (with duplicate prevention)
    if (!wasRecentlyVerified) {
      // 1. In-App Notification to User
      const userLang = user.preferredLanguage || 'en';
      const userNotifTitle = userLang === 'ta' ? 'கணக்கு வெற்றிகரமாக மறுசரிபார்க்கப்பட்டது! ✅' : 'Account Re-Verified Successfully! ✅';
      const userNotifMessage = userLang === 'ta'
        ? `அன்பார்ந்த ${user.name}, உங்கள் பங்கு கணக்கு மறுசரிபார்ப்பு வெற்றிகரமாக நிறைவடைந்தது. இணையதளத்தின் அனைத்து சேவைகளும் தடையின்றி இயங்கும்.`
        : `Dear ${user.name}, your parish account re-verification has been completed successfully. All church services, mass bookings, and daily readings are fully active.`;

      createNotification({
        userId: user._id,
        recipient: 'user',
        title: userNotifTitle,
        message: userNotifMessage,
        type: 'security',
        category: 'account',
        priority: 'high',
        actionUrl: '/dashboard'
      }).catch(err => console.warn('User re-verification in-app notification error:', err.message));

      // 2. Web Push Notification to User (if enabled)
      if (user.settings?.notifications?.push !== false) {
        const { sendPushToUser } = require('../services/webPushService');
        sendPushToUser(user._id, {
          title: 'Account Re-Verified — St. John de britto Church',
          body: `Welcome back, ${user.name}! Your account re-verification is complete. All notifications are active.`,
          url: '/dashboard',
          icon: '/favicon.png'
        }).catch(err => console.warn('User re-verification push error:', err.message));
      }

      // 3. Email Notification to User (if email exists and enabled)
      if (user.email && user.settings?.notifications?.email !== false) {
        const { sendMail } = require('../config/mailer');
        sendMail({
          to: user.email,
          subject: 'Account Re-Verification Completed — St. John de britto Church',
          html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Account Re-Verified</title></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f1f5f9;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e3a8a,#1e40af);padding:32px 24px;text-align:center;color:#ffffff;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;">St. John de britto Church</h1>
      <p style="margin:0;font-size:13px;color:#cbd5e1;">Kalayarkoil, Tamil Nadu</p>
    </div>
    <div style="padding:28px 24px;">
      <div style="text-align:center;margin-bottom:20px;">
        <span style="display:inline-block;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:6px 16px;border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">✅ Re-Verified</span>
      </div>
      <h2 style="font-size:18px;color:#0f172a;margin:0 0 12px;text-align:center;">Account Successfully Re-Verified</h2>
      <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 16px;">
        Dear <strong>${user.name}</strong> (Parish ID: ${user.parishMemberId || 'N/A'}),
      </p>
      <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px;">
        Thank you for completing your scheduled account re-verification. Your parishioner account has been securely renewed for another 30 days. You will continue receiving your subscribed notifications, daily readings, and parish updates without interruption.
      </p>
      <div style="text-align:center;margin:28px 0 16px;">
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard" style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:10px;font-weight:700;font-size:14px;">Go to Dashboard →</a>
      </div>
    </div>
    <div style="background:#0f172a;padding:20px;text-align:center;color:#94a3b8;font-size:12px;">
      <p style="margin:0;">St. John de britto Church • Automated Parish Service</p>
    </div>
  </div>
</body>
</html>`
        }).catch(err => console.warn('User re-verification email error:', err.message));
      }

      // 4. WhatsApp Bot Notification to User (if phone exists and opted-in)
      if (user.phone && user.whatsappOptIn !== false) {
        const { sendWhatsAppMessage } = require('../bot/whatsapp');
        const userWaText = userLang === 'ta'
          ? `*புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்*\n\n✅ *கணக்கு மறுசரிபார்ப்பு வெற்றிகரமாக முடிந்தது*\n\nஅன்பார்ந்த *${user.name}* (பங்கு எண்: ${user.parishMemberId || 'N/A'}),\n\nஉங்கள் பங்கு இணையதளக் கணக்கு வெற்றிகரமாக மறுசரிபார்க்கப்பட்டது. தங்களின் தினசரி வாசிப்புகள், அறிவிப்புகள் மற்றும் தேவாலய சேவைகள் வழக்கம் போல் இயங்கும்.\n\n🌐 *இணையதளம்:* ${process.env.CLIENT_URL || 'https://st-jb-church.vercel.app'}\n\n_புனித அருளானந்தர் தேவாலயம்_`
          : `*St. John de britto Church, Kalayarkoil*\n\n✅ *Account Re-Verification Completed*\n\nDear *${user.name}* (ID: ${user.parishMemberId || 'N/A'}),\n\nYour parish account re-verification has been completed successfully. Your daily readings, announcements, and mass booking features remain fully active.\n\n🌐 *Website:* ${process.env.CLIENT_URL || 'https://st-jb-church.vercel.app'}\n\n_St. John de britto Church_`;

        sendWhatsAppMessage(user.phone, userWaText).catch(err => console.warn('User re-verification WhatsApp error:', err.message));
      }

      // 5. Dynamic Calculation of Remaining Users
      remainingCount = await getPendingReverificationCount();

      const maskedContact = user.email
        ? user.email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3')
        : (user.phone ? user.phone.slice(0, 2) + '******' + user.phone.slice(-2) : 'Confidential');

      // 6. Admin Notifications: In-App, Audit Email, and WhatsApp
      createNotification({
        recipient: 'admin',
        title: 'User Re-Verification Completed',
        message: `A user has successfully completed account re-verification.\nUser: ${user.name} (ID: ${user.parishMemberId || 'N/A'}, Contact: ${maskedContact})\n\nRemaining users: ${remainingCount} users have not yet completed re-verification.`,
        type: 'security',
        category: 'account',
        priority: 'normal',
        actionUrl: '/admin/users'
      }).catch(err => console.warn('Admin re-verification in-app error:', err.message));

      const { notifyAdmin } = require('../services/adminNotificationService');
      notifyAdmin({
        type: 'USER_REVERIFIED',
        user: {
          _id: user._id,
          name: user.name,
          parishMemberId: user.parishMemberId
        },
        req,
        extra: {
          remainingCount,
          maskedContact,
          name: user.name
        }
      }).catch(err => console.warn('Admin notifyAdmin error:', err.message));

      // Admin WhatsApp Alert
      User.find({ role: 'admin', phone: { $exists: true, $ne: null } }).select('phone').then(admins => {
        const { sendWhatsAppMessage } = require('../bot/whatsapp');
        const adminWaMsg = `⛪ *St. John de britto Church — Admin Alert*\n\n✅ *User Re-Verification Completed*\nA user has successfully completed account re-verification.\n\n👤 *User:* ${user.name} (ID: ${user.parishMemberId || 'N/A'})\n📱 *Contact:* ${maskedContact}\n\n⏳ *Remaining users:* *${remainingCount}* users have not yet completed re-verification.\n\n_புனித அருளானந்தர் தேவாலயம்_`;
        for (const adm of admins) {
          if (adm.phone) {
            sendWhatsAppMessage(adm.phone, adminWaMsg).catch(() => { });
          }
        }
      }).catch(() => { });
    } else {
      remainingCount = await getPendingReverificationCount();
    }

    const token = generateToken(user._id, user.role, user.authVersion || user.tokenVersion || 1);
    const updatedUser = await User.findById(user._id).select('-passwordHash -otp -otpExpires');

    res.json({
      success: true,
      message: 'Account verified successfully! You can now use all church features freely.',
      token,
      user: {
        ...updatedUser.toObject(),
        requiresReverification: false,
        account_verified: true,
        last_verified_at: user.last_verified_at
      },
      remainingPendingUsers: remainingCount
    });
  } catch (err) {
    console.error('verifyAccountOtp error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/verify-account/status
const getVerificationStatus = async (req, res) => {
  try {
    let user = req.user;
    if (!user && (req.query.userId || req.query.emailOrUsername)) {
      if (req.query.userId) {
        user = await User.findById(req.query.userId);
      } else {
        const trimmed = req.query.emailOrUsername.trim().toLowerCase();
        user = await User.findOne({
          $or: [
            { email: trimmed },
            { phone: trimmed },
            { parishMemberId: trimmed.toUpperCase() }
          ]
        });
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const requiresReverification = checkReverificationRequired(user);
    const emailMasked = user.email ? user.email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3') : null;
    const phoneMasked = user.phone ? user.phone.slice(0, 2) + '******' + user.phone.slice(-2) : null;

    res.json({
      success: true,
      userId: user._id,
      name: user.name,
      emailMasked,
      phoneMasked,
      isVerified: Boolean(user.isVerified && user.account_verified),
      requiresReverification,
      lastVerifiedAt: user.last_verified_at || user.otpVerifiedAt
    });
  } catch (err) {
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
  verifyAccountOtp,
  getVerificationStatus,
  checkReverificationRequired,
  getPendingReverificationCount
};


