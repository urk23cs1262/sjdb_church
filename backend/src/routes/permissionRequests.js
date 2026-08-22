const router = require('express').Router();
const { 
  createRequest, 
  getUserPendingRequests, 
  respondToRequest, 
  getAdminRequestHistory 
} = require('../controllers/permissionRequestController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/', protect, adminOnly, createRequest);
router.get('/user/pending', protect, getUserPendingRequests);
router.put('/:id/respond', protect, respondToRequest);
router.get('/admin/history', protect, adminOnly, getAdminRequestHistory);

module.exports = router;
