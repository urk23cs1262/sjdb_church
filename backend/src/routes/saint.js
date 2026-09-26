const router = require('express').Router();
const { getSaint, refreshSaint, getSaintStatus, searchSaintImage } = require('../controllers/saintController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', getSaint);
router.get('/refresh-today', (req, res, next) => {
  req.query.force = 'true';
  return getSaint(req, res, next);
});
router.get('/image-search', searchSaintImage);
router.post('/refresh', protect, adminOnly, refreshSaint);
router.get('/status', protect, adminOnly, getSaintStatus);

module.exports = router;
