const router = require('express').Router();
const { getAll, create, update, remove, removeAll } = require('../controllers/galleryController');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', getAll);
router.post('/', protect, adminOnly, (req, res, next) => { req.uploadFolder = 'gallery'; next(); }, upload.single('image'), create);
router.put('/:id', protect, adminOnly, (req, res, next) => { req.uploadFolder = 'gallery'; next(); }, upload.single('image'), update);
router.delete('/all', protect, adminOnly, removeAll);
router.delete('/:id', protect, adminOnly, remove);

module.exports = router;
