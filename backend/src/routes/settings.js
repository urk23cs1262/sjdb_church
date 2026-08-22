const router = require('express').Router();
const multer = require('multer');
const storage = multer.memoryStorage();
const memoryUpload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const { getSettings, getSetting, updateTextSetting, uploadFileSetting, deleteSetting } = require('../controllers/settingsController');
const {
  getTodayVerse,
  changeTodayVerse,
  getAllVerses,
  uploadVerses,
  createVerse,
  updateVerse,
  deleteVerse,
  exportVerses,
  resetVerses
} = require('../controllers/dailyVerseController');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes
router.get('/', getSettings);
router.get('/daily-verses/today', getTodayVerse);
router.get('/:key', getSetting);

// Admin site settings routes
router.post('/text', protect, adminOnly, updateTextSetting);
router.post('/file', protect, adminOnly, (req, res, next) => {
  req.uploadFolder = 'settings';
  next();
}, upload.single('file'), uploadFileSetting);

// Admin Daily Bible Verses CMS routes
router.get('/daily-verses/export', protect, adminOnly, exportVerses);
router.get('/daily-verses/all', protect, adminOnly, getAllVerses);
router.post('/daily-verses/change-today', protect, adminOnly, changeTodayVerse);
router.post('/daily-verses/upload', protect, adminOnly, memoryUpload.single('file'), uploadVerses);
router.post('/daily-verses/reset', protect, adminOnly, resetVerses);
router.post('/daily-verses', protect, adminOnly, createVerse);
router.put('/daily-verses/:id', protect, adminOnly, updateVerse);
router.delete('/daily-verses/:id', protect, adminOnly, deleteVerse);

router.delete('/:key', protect, adminOnly, deleteSetting);

module.exports = router;
