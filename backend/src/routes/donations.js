const router = require('express').Router();
const { 
  createDonationOrder, 
  verifyRazorpayPayment, 
  razorpayWebhook, 
  getAll, 
  create, 
  verify, 
  rejectDonation, 
  getStats, 
  getMyDonations, 
  getDonationConfig,
  getDonationReceipt,
  resendReceiptEmail
} = require('../controllers/donationController');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');

// Public & Razorpay Payment Endpoints
router.get('/config', getDonationConfig);
router.post('/create-order', optionalAuth, createDonationOrder);
router.post('/verify', optionalAuth, verifyRazorpayPayment);
router.post('/webhook', razorpayWebhook);

// User & Admin Protected Endpoints
router.get('/', protect, adminOnly, getAll);
router.get('/my', protect, getMyDonations);
router.get('/stats', protect, adminOnly, getStats);
router.get('/:id/receipt', protect, getDonationReceipt);
router.post('/:id/resend-receipt', protect, adminOnly, resendReceiptEmail);
router.post('/', protect, create);
router.put('/:id/verify', protect, adminOnly, verify);
router.put('/:id/reject', protect, adminOnly, rejectDonation);

module.exports = router;
