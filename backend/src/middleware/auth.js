const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && typeof authHeader === 'string') {
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      token = authHeader;
    }
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id || decoded.userId).select('-passwordHash -otp -otpExpires');
    if (!req.user || req.user.isActive === false) {
      return res.status(401).json({ success: false, message: 'User account not found or deactivated' });
    }

    // Check multi-device session invalidation (authVersion / tokenVersion)
    const tokenVer = decoded.authVersion !== undefined ? decoded.authVersion : (decoded.tokenVersion !== undefined ? decoded.tokenVersion : 0);
    const userVer = req.user.authVersion !== undefined ? req.user.authVersion : (req.user.tokenVersion !== undefined ? req.user.tokenVersion : 0);

    if (tokenVer < userVer) {
      return res.status(401).json({ success: false, message: 'Session expired due to security reset. Please log in again.' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired: ' + err.message });
  }
};

const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id || decoded.userId).select('-passwordHash -otp -otpExpires');
    } catch (err) {}
  }
  next();
};

const adminOnly = (req, res, next) => {
  const role = (req.user?.role || '').toLowerCase();
  if (req.user && (role === 'admin' || role === 'priest' || role === 'staff' || req.user.isTechnicalTeam)) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Admin access required' });
};

const generateToken = (id, role, version = 1) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is not configured');
  }
  return jwt.sign(
    { id, userId: id, role, tokenVersion: version, authVersion: version },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    }
  );
};

module.exports = { protect, optionalAuth, adminOnly, generateToken };
