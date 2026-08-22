const jwt = require('jsonwebtoken');
const MaintenanceSetting = require('../models/MaintenanceSetting');
const User = require('../models/User');

const maintenanceMiddleware = async (req, res, next) => {
  try {
    const settings = await MaintenanceSetting.findOne({ key: 'site_maintenance' });
    const currentStatus = settings ? (settings.status || (settings.isEnabled ? (settings.isEmergency ? 'emergency' : 'maintenance') : 'live')) : 'live';

    if (!settings || currentStatus === 'live') {
      return next();
    }

    // Endpoints accessible during maintenance mode
    const allowedPathPrefixes = [
      '/api/maintenance/status',
      '/api/maintenance/track-attempt',
      '/api/health'
    ];

    const isAllowedPath = allowedPathPrefixes.some(prefix => req.originalUrl.startsWith(prefix));
    const isLoginPost = req.originalUrl.startsWith('/api/auth/login') && req.method === 'POST';

    if (isAllowedPath || isLoginPost) {
      return next();
    }

    // Server-side JWT authentication check for admin/technical team role bypass
    let token;
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (token && token !== 'null' && token !== 'undefined') {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sjdb_secret_key_2024');
        const user = await User.findById(decoded.id).select('role isTechnicalTeam isActive');
        if (user && user.isActive !== false) {
          const userRole = (user.role || '').toLowerCase();
          const isAdmin = ['admin', 'priest'].includes(userRole);
          const isTech = Boolean(user.isTechnicalTeam) || ['staff', 'technical_team', 'tech_team', 'technical'].includes(userRole);
          
          if (isAdmin || isTech) {
            return next();
          }
        }
      } catch (authErr) {
        // Invalid or expired token — proceed to block
      }
    }

    // Increment access attempt analytics counter asynchronously
    MaintenanceSetting.updateOne({ key: 'site_maintenance' }, { $inc: { accessAttemptsCount: 1 } }).catch(() => {});

    // Return HTTP 503 Service Unavailable for public users & guests
    return res.status(503).json({
      success: false,
      maintenance: true,
      code: 'SERVICE_UNAVAILABLE',
      status: currentStatus,
      title: settings.title || (currentStatus === 'emergency' ? 'EMERGENCY MAINTENANCE IN PROGRESS' : 'Website Under Maintenance'),
      message: settings.message || 'Our website is currently undergoing maintenance. Please check back shortly.',
      category: settings.category,
      expectedCompletion: settings.expectedCompletion,
      contactPhone: settings.contactPhone,
      contactEmail: settings.contactEmail
    });
  } catch (err) {
    console.error('Error in maintenance middleware:', err);
    next();
  }
};

module.exports = maintenanceMiddleware;
