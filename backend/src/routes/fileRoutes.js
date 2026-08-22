const router = require('express').Router();
const multer = require('multer');
const { uploadFile, getFile, deleteFile } = require('../controllers/fileController');
const { optionalAuth, protect } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.post('/upload', optionalAuth, upload.single('file'), uploadFile);
router.post('/upload-image', optionalAuth, upload.single('image'), uploadFile);
router.get('/:id', getFile);
router.delete('/:id', protect, deleteFile);

module.exports = router;
