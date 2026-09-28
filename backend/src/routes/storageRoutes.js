/**
 * Admin Storage Management Routes
 * St. John de Britto Church
 */

const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  getGridFSStorage,
  previewDeleteGridFS,
  deleteGridFS,
  getLogsStorage,
  cleanupLogs
} = require('../controllers/storageController');

// All storage endpoints require Admin authentication
router.use(protect);
router.use(adminOnly);

// GridFS Storage Diagnostics & Safe Deletion
router.get('/gridfs', getGridFSStorage);
router.post('/gridfs/preview-delete', previewDeleteGridFS);
router.post('/gridfs/delete', deleteGridFS);

// Log Collections Retention Diagnostics & Cleanup
router.get('/logs', getLogsStorage);
router.post('/logs/cleanup', cleanupLogs);

module.exports = router;
