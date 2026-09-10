const express = require('express');
const router = express.Router();
const { 
  getActiveSongs, 
  getAllSongsAdmin, 
  uploadIndividualSongs, 
  uploadZipSongs, 
  toggleSongStatus, 
  updateSong, 
  bulkUpdateStatus, 
  reorderSongs,
  deleteSong 
} = require('../controllers/rosarySongController');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public: Get all active songs for Navbar Rosary modal
router.get('/', getActiveSongs);

// Admin: Get all songs (active & inactive)
router.get('/admin', protect, adminOnly, getAllSongsAdmin);

// Admin: Upload individual song audio files
router.post('/individual', protect, adminOnly, upload.array('files', 50), uploadIndividualSongs);

// Admin: Upload ZIP archive with songs
router.post('/zip', protect, adminOnly, upload.single('file'), uploadZipSongs);

// Admin: Toggle active status
router.patch('/:id/toggle', protect, adminOnly, toggleSongStatus);

// Admin: Bulk update active statuses
router.patch('/bulk-status', protect, adminOnly, bulkUpdateStatus);

// Admin: Reorder songs
router.patch('/reorder', protect, adminOnly, reorderSongs);

// Admin: Update song details
router.patch('/:id', protect, adminOnly, updateSong);

// Admin: Delete song
router.delete('/:id', protect, adminOnly, deleteSong);

module.exports = router;
