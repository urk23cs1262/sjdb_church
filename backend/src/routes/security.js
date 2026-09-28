const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  verifyReportToken,
  confirmUnauthorized,
  getIncidents,
  getIncidentById,
  updateIncidentStatus,
  reactivateUserAccount,
  reactivateUserByUserId,
  getLoginHistory,
  removeTrustedDevice
} = require('../controllers/securityController');

// Public routes for security report link from email
router.get('/verify-token', verifyReportToken);
router.post('/confirm-unauthorized', confirmUnauthorized);

// User Protected routes for login history & trusted devices
router.get('/login-history', protect, getLoginHistory);
router.delete('/devices/:deviceId', protect, removeTrustedDevice);

// Protected Admin routes for incident management
router.get('/incidents', protect, adminOnly, getIncidents);
router.get('/incidents/:id', protect, adminOnly, getIncidentById);
router.put('/incidents/:id', protect, adminOnly, updateIncidentStatus);
router.put('/incidents/:id/reactivate', protect, adminOnly, reactivateUserAccount);
// New: Reactivate directly by User ID (no incident needed)
router.put('/users/:userId/reactivate', protect, adminOnly, reactivateUserByUserId);

module.exports = router;

