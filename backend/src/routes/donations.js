const router = require('express').Router();
const { getAll, create, verify, rejectDonation, getStats, getMyDonations } = require('../controllers/donationController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, adminOnly, getAll);
router.get('/my', protect, getMyDonations);
router.get('/stats', protect, adminOnly, getStats);
router.post('/', protect, create);
router.put('/:id/verify', protect, adminOnly, verify);
router.put('/:id/reject', protect, adminOnly, rejectDonation);

module.exports = router;
