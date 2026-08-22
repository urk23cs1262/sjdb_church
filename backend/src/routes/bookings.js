const router = require('express').Router();
const { getMyBookings, getAllBookings, createBooking, updateBookingStatus, deleteBooking } = require('../controllers/bookingController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/my', protect, getMyBookings);
router.get('/', protect, adminOnly, getAllBookings);
router.post('/', protect, createBooking);
router.put('/:id/status', protect, adminOnly, updateBookingStatus);
router.delete('/:id', protect, adminOnly, deleteBooking);

module.exports = router;
