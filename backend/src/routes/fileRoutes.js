const router = require('express').Router();
const upload = require('../middleware/upload');
const { uploadFile, getFile, deleteFile } = require('../controllers/fileController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/upload', protect, upload.single('file'), uploadFile);
router.post('/upload-image', protect, upload.single('image'), uploadFile);
router.get('/:id', getFile);
router.delete('/:id', protect, adminOnly, deleteFile);

module.exports = router;
