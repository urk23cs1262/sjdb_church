const router = require('express').Router();
const { getPublic, getAll, create, updateStatus, incrementPrayer, deletePrayer, deleteAllByStatus } = require('../controllers/prayerController');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');

router.get('/public', getPublic);
router.get('/', protect, adminOnly, getAll);
router.post('/', optionalAuth, create);
router.put('/:id/status', protect, adminOnly, updateStatus);
router.delete('/all', protect, adminOnly, deleteAllByStatus);
router.delete('/clear-all', protect, adminOnly, deleteAllByStatus);
router.delete('/:id', protect, adminOnly, deletePrayer);
router.post('/:id/pray', incrementPrayer);

module.exports = router;
