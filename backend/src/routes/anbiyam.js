const router = require('express').Router();
const {
  getPublicAnbiyams,
  getAdminAnbiyams,
  createAnbiyamGroup,
  updateAnbiyamGroup,
  deleteAnbiyamGroup,
  getAnbiyamMembers,
  createAnbiyamMember,
  updateAnbiyamMember,
  deleteAnbiyamMember,
  transferAnbiyamMember,
  recordAttendance,
  getAnbiyamStats
} = require('../controllers/anbiyamController');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public route — safe public display for website
router.get('/public', getPublicAnbiyams);

// Admin routes — groups
router.get('/groups', protect, adminOnly, getAdminAnbiyams);
router.post('/groups', protect, adminOnly, (req, res, next) => { req.uploadFolder = 'anbiyam'; next(); }, upload.single('image'), createAnbiyamGroup);
router.put('/groups/:id', protect, adminOnly, (req, res, next) => { req.uploadFolder = 'anbiyam'; next(); }, upload.single('image'), updateAnbiyamGroup);
router.delete('/groups/:id', protect, adminOnly, deleteAnbiyamGroup);

// Admin routes — members & stats
router.get('/members', protect, adminOnly, getAnbiyamMembers);
router.post('/members', protect, adminOnly, (req, res, next) => { req.uploadFolder = 'anbiyam-members'; next(); }, upload.single('profilePhoto'), createAnbiyamMember);
router.put('/members/:id', protect, adminOnly, (req, res, next) => { req.uploadFolder = 'anbiyam-members'; next(); }, upload.single('profilePhoto'), updateAnbiyamMember);
router.delete('/members/:id', protect, adminOnly, deleteAnbiyamMember);
router.put('/members/:id/transfer', protect, adminOnly, transferAnbiyamMember);
router.post('/attendance', protect, adminOnly, recordAttendance);
router.get('/stats', protect, adminOnly, getAnbiyamStats);

module.exports = router;
