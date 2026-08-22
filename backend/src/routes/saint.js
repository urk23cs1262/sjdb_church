const router = require('express').Router();
const { getSaint, refreshSaint, getSaintStatus } = require('../controllers/saintController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', getSaint);
router.post('/refresh', protect, adminOnly, refreshSaint);
router.get('/status', protect, adminOnly, getSaintStatus);

module.exports = router;
