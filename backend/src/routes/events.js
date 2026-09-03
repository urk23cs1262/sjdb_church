const router = require('express').Router();
const { getAll, getOne, create, update, remove, registerForEvent, withdrawRegistration } = require('../controllers/eventController');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', getAll);
router.get('/:id', getOne);
router.post('/', protect, adminOnly, (req, res, next) => { req.uploadFolder = 'events'; next(); }, upload.single('image'), create);
router.put('/:id', protect, adminOnly, (req, res, next) => { req.uploadFolder = 'events'; next(); }, upload.single('image'), update);
router.delete('/:id', protect, adminOnly, remove);
router.post('/:id/register', protect, registerForEvent);
router.delete('/:id/register', protect, withdrawRegistration);

module.exports = router;
