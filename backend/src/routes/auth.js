const router = require('express').Router();
const {
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
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);
router.post('/resend-otp', resendOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/family-lookup', lookupFamily);
router.get('/me', protect, getMe);

// ── Monthly Account Verification Routes ──────────────────────────────────────
router.post('/verify-account/send-otp', sendVerificationOtp);
router.post('/verify-account/verify-otp', verifyAccountOtp);

module.exports = router;


