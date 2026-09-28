/**
 * Storage Management Controller
 * St. John de Britto Church
 */

const {
  getStorageOverview,
  deleteGridFSFiles,
  getLogsOverview,
  cleanupOldLogs
} = require('../services/storageAuditService');

/**
 * GET /api/admin/storage/gridfs
 * Full diagnostics of GridFS storage (Files, Chunks, Duplicates, Orphans, References)
 */
const getGridFSStorage = async (req, res) => {
  try {
    const overview = await getStorageOverview();
    res.json({
      success: true,
      data: overview
    });
  } catch (err) {
    console.error('[StorageController] Error getting GridFS storage overview:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch GridFS storage overview'
    });
  }
};

/**
 * POST /api/admin/storage/gridfs/preview-delete
 * Dry-run mode: checks selected files and returns impact without deleting
 */
const previewDeleteGridFS = async (req, res) => {
  try {
    const { fileIds } = req.body;
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide at least one file ID' });
    }

    const overview = await getStorageOverview();
    const selectedFiles = overview.files.filter(f => fileIds.includes(f._id));

    const inUseFiles = selectedFiles.filter(f => f.inUse);
    const removableFiles = selectedFiles.filter(f => !f.inUse);

    const totalFreedBytes = removableFiles.reduce((acc, f) => acc + (f.length || 0), 0);

    res.json({
      success: true,
      preview: {
        totalSelected: selectedFiles.length,
        removableCount: removableFiles.length,
        inUseCount: inUseFiles.length,
        totalFreedBytes,
        totalFreedMB: parseFloat((totalFreedBytes / (1024 * 1024)).toFixed(2)),
        inUseFiles: inUseFiles.map(f => ({ id: f._id, name: f.originalName, references: f.references })),
        removableFiles: removableFiles.map(f => ({ id: f._id, name: f.originalName, size: f.sizeFormatted, reason: f.reason }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/admin/storage/gridfs/delete
 * Permanently deletes unreferenced GridFS files after strict reference verification
 */
const deleteGridFS = async (req, res) => {
  try {
    const { fileIds, confirmPermanent } = req.body;
    if (!confirmPermanent) {
      return res.status(400).json({
        success: false,
        message: 'Explicit confirmation required (confirmPermanent: true)'
      });
    }

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No file IDs provided for deletion' });
    }

    const result = await deleteGridFSFiles(fileIds, req.user);
    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} unreferenced file(s), reclaiming ${result.freedFormatted}.`,
      result
    });
  } catch (err) {
    console.error('[StorageController] Error deleting GridFS files:', err);
    res.status(err.blockedFiles ? 400 : 500).json({
      success: false,
      message: err.message || 'Deletion failed',
      blockedFiles: err.blockedFiles || []
    });
  }
};

/**
 * GET /api/admin/storage/logs
 * Log collections overview
 */
const getLogsStorage = async (req, res) => {
  try {
    const data = await getLogsOverview();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/admin/storage/logs/cleanup
 * Retention cleanup for log collections
 */
const cleanupLogs = async (req, res) => {
  try {
    const { retentionDays } = req.body;
    const days = parseInt(retentionDays, 10) || 90;
    const result = await cleanupOldLogs(days, req.user);
    res.json({
      success: true,
      message: `Cleaned up ${result.totalDeleted} log record(s) older than ${days} days.`,
      result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getGridFSStorage,
  previewDeleteGridFS,
  deleteGridFS,
  getLogsStorage,
  cleanupLogs
};
