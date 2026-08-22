const router = require('express').Router();
const {
  getPublicTeamMembers,
  getAllTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  toggleTeamMemberActive,
  reorderTeamMembers,
  deleteAllTeamMembers,
  deleteTeamMembersByCategory,
  resetDefaultTeam
} = require('../controllers/teamController');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public route
router.get('/', getPublicTeamMembers);

// Admin routes
router.get('/admin', protect, adminOnly, getAllTeamMembers);
router.post('/reorder', protect, adminOnly, reorderTeamMembers);
router.post('/reset', protect, adminOnly, resetDefaultTeam);
router.delete('/all/members', protect, adminOnly, deleteAllTeamMembers);
router.delete('/category/:category', protect, adminOnly, deleteTeamMembersByCategory);
router.post('/', protect, adminOnly, (req, res, next) => { req.uploadFolder = 'team'; next(); }, upload.single('photo'), createTeamMember);
router.put('/:id/toggle', protect, adminOnly, toggleTeamMemberActive);
router.put('/:id', protect, adminOnly, (req, res, next) => { req.uploadFolder = 'team'; next(); }, upload.single('photo'), updateTeamMember);
router.delete('/:id', protect, adminOnly, deleteTeamMember);

module.exports = router;
