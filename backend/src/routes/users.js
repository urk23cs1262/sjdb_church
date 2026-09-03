const router = require('express').Router();
const { 
  getAllUsers, getUserById, updateProfile, updateUser, deleteUser, 
  changePassword, updateSettings, getUserPdfReport, getAllUsersPdfReport,
  getMemberIdFormatInfo, updateMemberIdFormat, lookupUserByQr, getMemberReportByToken,
  getMemberReportPdfByToken, getFamilyIdByName, getExistingFamilies
} = require('../controllers/userController');
const { protect, optionalAuth, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', protect, adminOnly, getAllUsers);
router.get('/export/pdf', protect, adminOnly, getAllUsersPdfReport);
router.get('/lookup/scan', protect, adminOnly, lookupUserByQr);
router.get('/family-id-by-name', protect, adminOnly, getFamilyIdByName);
router.get('/existing-families', protect, adminOnly, getExistingFamilies);
router.get('/member-report/:token', optionalAuth, getMemberReportByToken);
router.get('/member-report/:token/pdf', optionalAuth, getMemberReportPdfByToken);
router.get('/member-id-format', protect, adminOnly, getMemberIdFormatInfo);
router.post('/update-member-id-format', protect, adminOnly, updateMemberIdFormat);
router.get('/:id/pdf', protect, getUserPdfReport);
router.get('/:id', protect, getUserById);
router.put('/profile', protect, (req, res, next) => { req.uploadFolder = 'profiles'; next(); }, upload.single('photo'), updateProfile);
router.put('/settings', protect, updateSettings);
router.put('/change-password', protect, changePassword);
router.put('/:id', protect, adminOnly, updateUser);
router.delete('/:id', protect, adminOnly, deleteUser);

module.exports = router;

