const SecurityAuditLog = require('../models/SecurityAuditLog');

/**
 * Records a security event in the immutable SecurityAuditLog collection.
 * Plain OTP values must NEVER be passed or recorded.
 */
async function logSecurityEvent({
  userId = null,
  adminId = null,
  eventType,
  req = null,
  source = 'SYSTEM',
  success = true,
  affectedCount = 0,
  details = {}
}) {
  try {
    let ipAddress = 'Unknown';
    let userAgent = 'Unknown';

    if (req) {
      ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'Unknown';
      if (typeof ipAddress === 'string' && ipAddress.includes(',')) {
        ipAddress = ipAddress.split(',')[0].trim();
      }
      userAgent = req.headers['user-agent'] || 'Unknown';
    }

    // Sanitize details to ensure no OTP is ever stored
    const sanitizedDetails = { ...details };
    delete sanitizedDetails.otp;
    delete sanitizedDetails.plainOtp;
    delete sanitizedDetails.password;
    delete sanitizedDetails.passwordHash;

    const logEntry = await SecurityAuditLog.create({
      userId,
      adminId,
      eventType,
      timestamp: new Date(),
      ipAddress: String(ipAddress).slice(0, 100),
      userAgent: String(userAgent).slice(0, 300),
      source,
      success,
      affectedCount,
      details: sanitizedDetails
    });

    return logEntry;
  } catch (err) {
    console.warn('[SecurityAuditService] Failed to record security event:', err.message);
    return null;
  }
}

module.exports = { logSecurityEvent };
