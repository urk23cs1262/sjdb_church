const express = require('express');
const router = express.Router();
const { 
  getActiveSongs, 
  getAllSongsAdmin, 
  uploadIndividualSongs, 
  uploadZipSongs, 
  confirmZipImport,
  cancelZipImport,
  previewTempAudio,
  toggleSongStatus, 
  updateSong, 
  bulkUpdateStatus, 
  reorderSongs,
  deleteSong,
  deleteAllSongs 
} = require('../controllers/rosarySongController');
const { protect, adminOnly } = require('../middleware/auth');
const diskUpload = require('../middleware/diskUpload');

// Public: Get all active songs for Navbar Rosary modal
router.get('/', getActiveSongs);

// Admin: Get all songs (active & inactive)
router.get('/admin', protect, adminOnly, getAllSongsAdmin);

// Admin: Upload individual song audio files (Zero-RAM disk streaming)
router.post('/individual', protect, adminOnly, diskUpload.array('files', 50), uploadIndividualSongs);

// Admin: Upload ZIP archive with songs (Zero-RAM disk streaming & duplicate detection)
router.post('/zip', protect, adminOnly, diskUpload.single('file'), uploadZipSongs);

// Admin: Confirm ZIP import choices after duplicate review
router.post('/zip/confirm', protect, adminOnly, confirmZipImport);

// Admin: Cancel ZIP import and purge temporary files
router.post('/zip/cancel', protect, adminOnly, cancelZipImport);

// Admin: Preview temporary uploaded audio for duplicate review
router.get('/temp-preview/:sessionId/:fileName', protect, adminOnly, previewTempAudio);

// Admin: Delete all songs and clean up GridFS
router.delete('/all', protect, adminOnly, deleteAllSongs);

// Admin: Toggle active status
router.patch('/:id/toggle', protect, adminOnly, toggleSongStatus);

// Admin: Bulk update active statuses
router.patch('/bulk-status', protect, adminOnly, bulkUpdateStatus);

// Admin: Reorder songs
router.patch('/reorder', protect, adminOnly, reorderSongs);

// Admin: Update song details
router.patch('/:id', protect, adminOnly, updateSong);

// Admin: Delete single song
router.delete('/:id', protect, adminOnly, deleteSong);

module.exports = router;
