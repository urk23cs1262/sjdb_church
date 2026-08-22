const router = require('express').Router();
const { getAll, create, update, remove } = require('../controllers/priestController');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', getAll);
router.post('/', protect, adminOnly, (req, res, next) => { req.uploadFolder = 'priests'; next(); }, upload.single('photo'), create);
router.put('/:id', protect, adminOnly, (req, res, next) => { req.uploadFolder = 'priests'; next(); }, upload.single('photo'), update);
router.delete('/:id', protect, adminOnly, remove);

module.exports = router;
