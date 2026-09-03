const router = require('express').Router();
const { getAll, create, update, remove } = require('../controllers/announcementController');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', getAll);
router.post('/', protect, adminOnly, (req, res, next) => { req.uploadFolder = 'announcements'; next(); }, upload.single('attachment'), create);
router.put('/:id', protect, adminOnly, (req, res, next) => { req.uploadFolder = 'announcements'; next(); }, upload.single('attachment'), update);
router.delete('/:id', protect, adminOnly, remove);

module.exports = router;
