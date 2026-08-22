const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  verifyReportToken,
  confirmUnauthorized,
  getIncidents,
  updateIncidentStatus,
  reactivateUserAccount,
  reactivateUserByUserId
} = require('../controllers/securityController');

// Public routes for security report link from email
router.get('/verify-token', verifyReportToken);
router.post('/confirm-unauthorized', confirmUnauthorized);

// Protected Admin routes for incident management
router.get('/incidents', protect, adminOnly, getIncidents);
router.put('/incidents/:id', protect, adminOnly, updateIncidentStatus);
router.put('/incidents/:id/reactivate', protect, adminOnly, reactivateUserAccount);
// New: Reactivate directly by User ID (no incident needed)
router.put('/users/:userId/reactivate', protect, adminOnly, reactivateUserByUserId);

module.exports = router;

