/**
 * Storage Audit and Safe GridFS Management Service
 * St. John de Britto Church
 * 
 * Provides:
 * 1. Safe read-only GridFS storage auditing
 * 2. Exact content SHA-256 hash duplicate detection
 * 3. Cross-collection reference checking across all 10 MongoDB models
 * 4. Safe GridFS deletion mechanism that checks references before deleting
 * 5. Log collection retention policies & cleanup
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');

// Application Models
const RosarySong = require('../models/RosarySong');
const Gallery = require('../models/Gallery');
const Priest = require('../models/Priest');
const TeamMember = require('../models/TeamMember');
const User = require('../models/User');
const Document = require('../models/Document');
const Event = require('../models/Event');
const Announcement = require('../models/Announcement');
const SiteSettings = require('../models/SiteSettings');
const Notification = require('../models/Notification');
const SecurityAuditLog = require('../models/SecurityAuditLog');
const DailyNotificationLog = require('../models/DailyNotificationLog');
const BirthdayLog = require('../models/BirthdayLog');
const CelebrationLog = require('../models/CelebrationLog');
const NotificationJobLog = require('../models/NotificationJobLog');
const MaintenanceNotificationLog = require('../models/MaintenanceNotificationLog');

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  if (!bytes || isNaN(bytes)) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getBucket = () => {
  if (!mongoose.connection.db) {
    throw new Error('Database connection not established');
  }
  return new GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
};

/**
 * Computes SHA-256 hash of a GridFS file by streaming its chunks
 */
const computeFileHash = (bucket, fileId) => {
  return new Promise((resolve) => {
    try {
      const hash = crypto.createHash('sha256');
      const stream = bucket.openDownloadStream(new ObjectId(fileId));
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
};

/**
 * Scans all collections in MongoDB to build an index of all referenced GridFS files
 */
const getApplicationReferenceMap = async () => {
  const [
    songs,
    galleries,
    priests,
    teamMembers,
    users,
    documents,
    events,
    announcements,
    settings,
    notifications
  ] = await Promise.all([
    RosarySong.find().lean().catch(() => []),
    Gallery.find().lean().catch(() => []),
    Priest.find().lean().catch(() => []),
    TeamMember.find().lean().catch(() => []),
    User.find({ profilePhoto: { $exists: true, $ne: '' } }).select('name profilePhoto email').lean().catch(() => []),
    Document.find({ uploadedFile: { $exists: true, $ne: '' } }).select('type uploadedFile userId').lean().catch(() => []),
    Event.find({ image: { $exists: true, $ne: '' } }).select('title image').lean().catch(() => []),
    Announcement.find({ $or: [{ image: { $exists: true, $ne: '' } }, { attachment: { $exists: true, $ne: '' } }] }).select('title image attachment').lean().catch(() => []),
    SiteSettings.find().lean().catch(() => []),
    Notification.find({ fileUrl: { $exists: true, $ne: '' } }).select('title fileUrl').lean().catch(() => [])
  ]);

  const referenceMap = new Map();

  const addRef = (refStr, meta) => {
    if (!refStr) return;
    const cleanId = String(refStr).replace(/^\/api\/files\//, '').trim();
    if (!cleanId) return;
    if (!referenceMap.has(cleanId)) {
      referenceMap.set(cleanId, []);
    }
    referenceMap.get(cleanId).push(meta);
  };

  songs.forEach(s => {
    addRef(s.fileUrl, { collection: 'RosarySong', id: s._id, title: s.title || s.fileName });
    if (s.fileName) addRef(s.fileName, { collection: 'RosarySong', id: s._id, title: s.title });
  });

  galleries.forEach(g => {
    addRef(g.imageUrl, { collection: 'Gallery', id: g._id, title: g.title });
  });

  priests.forEach(p => {
    addRef(p.photo, { collection: 'Priest', id: p._id, title: p.name });
  });

  teamMembers.forEach(t => {
    addRef(t.image, { collection: 'TeamMember', id: t._id, title: t.name });
  });

  users.forEach(u => {
    addRef(u.profilePhoto, { collection: 'User', id: u._id, title: u.name });
  });

  documents.forEach(d => {
    addRef(d.uploadedFile, { collection: 'Document', id: d._id, title: d.type });
  });

  events.forEach(e => {
    addRef(e.image, { collection: 'Event', id: e._id, title: e.title });
  });

  announcements.forEach(a => {
    if (a.image) addRef(a.image, { collection: 'Announcement', id: a._id, title: a.title });
    if (a.attachment) addRef(a.attachment, { collection: 'Announcement', id: a._id, title: a.title });
  });

  settings.forEach(st => {
    addRef(st.value, { collection: 'SiteSettings', id: st._id, title: st.key });
  });

  notifications.forEach(n => {
    addRef(n.fileUrl, { collection: 'Notification', id: n._id, title: n.title });
  });

  return referenceMap;
};

/**
 * Audits all GridFS files, computes content hashes, and checks references.
 * 100% READ-ONLY.
 */
const getStorageOverview = async () => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

  const filesColl = db.collection('uploads.files');
  const chunksColl = db.collection('uploads.chunks');
  const bucket = getBucket();

  const [totalFiles, totalChunks, referenceMap] = await Promise.all([
    filesColl.countDocuments(),
    chunksColl.countDocuments(),
    getApplicationReferenceMap()
  ]);

  let chunksStats = { size: 0, storageSize: 0 };
  try {
    const stats = await db.command({ collStats: 'uploads.chunks' });
    chunksStats = {
      size: stats.size || 0,
      storageSize: stats.storageSize || 0
    };
  } catch (_) { }

  const rawFiles = await filesColl.find().sort({ uploadDate: -1 }).toArray();

  let totalBytes = 0;
  const files = [];

  for (const f of rawFiles) {
    totalBytes += f.length || 0;
    const fileIdStr = f._id.toString();
    const sha256 = await computeFileHash(bucket, f._id);

    const refs = [
      ...(referenceMap.get(fileIdStr) || []),
      ...(referenceMap.get(f.filename) || [])
    ];

    files.push({
      _id: fileIdStr,
      filename: f.filename,
      originalName: f.metadata?.originalName || f.filename,
      length: f.length,
      sizeBytes: f.length,
      sizeFormatted: formatBytes(f.length),
      sizeMB: parseFloat((f.length / (1024 * 1024)).toFixed(2)),
      uploadDate: f.uploadDate,
      contentType: f.contentType || 'application/octet-stream',
      sha256,
      url: `/api/files/${fileIdStr}`,
      references: refs,
      inUse: refs.length > 0,
      reason: refs.length === 0 ? 'Unreferenced orphan: not found in any database document' : `In use by ${refs.map(r => r.collection).join(', ')}`
    });
  }

  // Find duplicates by SHA-256 hash
  const hashGroups = new Map();
  files.forEach(f => {
    if (!f.sha256) return;
    if (!hashGroups.has(f.sha256)) hashGroups.set(f.sha256, []);
    hashGroups.get(f.sha256).push(f);
  });

  const duplicateGroups = [];
  let potentialDuplicateReclaimBytes = 0;

  for (const [hash, group] of hashGroups.entries()) {
    if (group.length > 1) {
      const inUseCount = group.filter(x => x.inUse).length;
      duplicateGroups.push({
        hash,
        count: group.length,
        sizePerFile: group[0].sizeFormatted,
        sizeBytes: group[0].length,
        inUseCount,
        files: group.map(g => ({
          ...g,
          isDuplicate: true,
          duplicateOfCount: group.length - 1
        }))
      });
      potentialDuplicateReclaimBytes += (group.length - 1) * group[0].length;
    }
  }

  // Update duplicate reason tag for files in duplicate groups
  duplicateGroups.forEach(dg => {
    dg.files.forEach(f => {
      const matched = files.find(x => x._id === f._id);
      if (matched && !matched.inUse) {
        matched.reason = `Exact duplicate of ${dg.count - 1} other file(s) with identical content`;
      }
    });
  });

  const unreferencedFiles = files.filter(f => !f.inUse);
  const totalUnreferencedBytes = unreferencedFiles.reduce((acc, f) => acc + f.length, 0);

  // Content type breakdown
  const typeMap = {};
  files.forEach(f => {
    const t = f.contentType || 'unknown';
    if (!typeMap[t]) typeMap[t] = { count: 0, bytes: 0 };
    typeMap[t].count++;
    typeMap[t].bytes += f.length;
  });

  const largestFiles = [...files].sort((a, b) => b.length - a.length).slice(0, 15);

  return {
    totalFiles,
    totalChunks,
    totalBytes,
    totalMB: parseFloat((totalBytes / (1024 * 1024)).toFixed(2)),
    totalFormatted: formatBytes(totalBytes),
    storageSizeFormatted: chunksStats.storageSize > 0 ? formatBytes(chunksStats.storageSize) : formatBytes(totalBytes),
    activeCount: files.filter(f => f.inUse).length,
    orphanCount: unreferencedFiles.length,
    orphanBytes: totalUnreferencedBytes,
    orphanFormatted: formatBytes(totalUnreferencedBytes),
    orphanMB: parseFloat((totalUnreferencedBytes / (1024 * 1024)).toFixed(2)),
    duplicateGroupCount: duplicateGroups.length,
    duplicateReclaimableBytes: potentialDuplicateReclaimBytes,
    duplicateReclaimableFormatted: formatBytes(potentialDuplicateReclaimBytes),
    duplicateGroups,
    unreferencedFiles,
    largestFiles,
    typeBreakdown: Object.entries(typeMap).map(([type, data]) => ({
      type,
      count: data.count,
      bytes: data.bytes,
      formatted: formatBytes(data.bytes)
    })),
    files
  };
};

/**
 * Safe GridFS Deletion with reference validation.
 * NEVER drops collections.
 * Uses bucket.delete() to delete both the file and its chunks.
 */
const deleteGridFSFiles = async (fileIds = [], adminUser = null) => {
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw new Error('No file IDs provided for deletion');
  }

  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

  const filesColl = db.collection('uploads.files');
  const bucket = getBucket();
  const referenceMap = await getApplicationReferenceMap();

  const validatedFiles = [];
  const blockedFiles = [];

  for (const idStr of fileIds) {
    if (!ObjectId.isValid(idStr)) {
      blockedFiles.push({ id: idStr, reason: 'Invalid ObjectId format' });
      continue;
    }

    const doc = await filesColl.findOne({ _id: new ObjectId(idStr) });
    if (!doc) {
      continue; // Already deleted or not found
    }

    // Check references
    const refs = [
      ...(referenceMap.get(idStr) || []),
      ...(referenceMap.get(doc.filename) || [])
    ];

    if (refs.length > 0) {
      blockedFiles.push({
        id: idStr,
        filename: doc.metadata?.originalName || doc.filename,
        reason: `Cannot delete: currently referenced by ${refs.map(r => `${r.collection} (${r.title})`).join(', ')}`
      });
    } else {
      validatedFiles.push(doc);
    }
  }

  if (blockedFiles.length > 0) {
    const errorMsg = blockedFiles.map(b => `${b.filename || b.id}: ${b.reason}`).join('; ');
    const err = new Error(`Deletion prevented for active files: ${errorMsg}`);
    err.blockedFiles = blockedFiles;
    throw err;
  }

  // Perform deletion
  let deletedCount = 0;
  let freedBytes = 0;
  const deletedDetails = [];

  for (const doc of validatedFiles) {
    try {
      await bucket.delete(doc._id);
      deletedCount++;
      freedBytes += doc.length || 0;
      deletedDetails.push({
        id: doc._id.toString(),
        filename: doc.metadata?.originalName || doc.filename,
        size: doc.length
      });
    } catch (delErr) {
      console.error(`Failed to delete GridFS file ${doc._id}:`, delErr.message);
    }
  }

  // Audit Log
  try {
    await SecurityAuditLog.create({
      event: 'GRIDFS_STORAGE_CLEANUP',
      userId: adminUser?._id || null,
      userName: adminUser?.name || 'Administrator',
      role: adminUser?.role || 'admin',
      severity: 'medium',
      details: `Safely deleted ${deletedCount} unreferenced GridFS file(s), reclaiming ${formatBytes(freedBytes)}.`,
      metadata: {
        deletedFiles: deletedDetails,
        freedBytes,
        freedFormatted: formatBytes(freedBytes)
      }
    });
  } catch (_) { }

  return {
    success: true,
    deletedCount,
    freedBytes,
    freedFormatted: formatBytes(freedBytes),
    freedMB: parseFloat((freedBytes / (1024 * 1024)).toFixed(2))
  };
};

/**
 * Returns document counts and oldest records for log collections
 */
const getLogsOverview = async () => {
  const [
    dailyNotifsCount,
    birthdayLogsCount,
    celebrationLogsCount,
    jobLogsCount,
    maintNotifsCount
  ] = await Promise.all([
    DailyNotificationLog.countDocuments().catch(() => 0),
    BirthdayLog.countDocuments().catch(() => 0),
    CelebrationLog.countDocuments().catch(() => 0),
    NotificationJobLog.countDocuments().catch(() => 0),
    MaintenanceNotificationLog.countDocuments().catch(() => 0)
  ]);

  const [oldestDailyNotif, oldestBirthdayLog] = await Promise.all([
    DailyNotificationLog.findOne().sort({ createdAt: 1 }).select('createdAt').lean().catch(() => null),
    BirthdayLog.findOne().sort({ createdAt: 1 }).select('createdAt').lean().catch(() => null)
  ]);

  return {
    collections: [
      { name: 'dailyNotificationLogs', label: 'Daily Notification Logs', count: dailyNotifsCount, oldestDate: oldestDailyNotif?.createdAt || null, retentionCandidate: true },
      { name: 'birthdayLogs', label: 'Birthday Delivery Logs', count: birthdayLogsCount, oldestDate: oldestBirthdayLog?.createdAt || null, retentionCandidate: true },
      { name: 'celebrationLogs', label: 'Celebration Delivery Logs', count: celebrationLogsCount, oldestDate: null, retentionCandidate: true },
      { name: 'notificationJobLogs', label: 'Notification Job Logs', count: jobLogsCount, oldestDate: null, retentionCandidate: true },
      { name: 'maintenanceNotificationLogs', label: 'Maintenance Notification Logs', count: maintNotifsCount, oldestDate: null, retentionCandidate: true }
    ]
  };
};

/**
 * Cleans up logs older than retentionDays
 */
const cleanupOldLogs = async (retentionDays = 90, adminUser = null) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - Number(retentionDays));

  const [dailyNotifsRes, birthdayRes, celebrationRes] = await Promise.all([
    DailyNotificationLog.deleteMany({ createdAt: { $lt: cutoffDate } }),
    BirthdayLog.deleteMany({ createdAt: { $lt: cutoffDate } }),
    CelebrationLog.deleteMany({ createdAt: { $lt: cutoffDate } })
  ]);

  const totalDeleted =
    (dailyNotifsRes.deletedCount || 0) +
    (birthdayRes.deletedCount || 0) +
    (celebrationRes.deletedCount || 0);

  try {
    await SecurityAuditLog.create({
      event: 'LOG_STORAGE_RETENTION_CLEANUP',
      userId: adminUser?._id || null,
      userName: adminUser?.name || 'Administrator',
      role: adminUser?.role || 'admin',
      severity: 'low',
      details: `Purged ${totalDeleted} log record(s) older than ${retentionDays} days.`,
      metadata: {
        retentionDays,
        cutoffDate,
        deleted: {
          dailyNotificationLogs: dailyNotifsRes.deletedCount,
          birthdayLogs: birthdayRes.deletedCount,
          celebrationLogs: celebrationRes.deletedCount
        }
      }
    });
  } catch (_) { }

  return {
    success: true,
    totalDeleted,
    retentionDays,
    cutoffDate,
    deletedBreakdown: {
      dailyNotificationLogs: dailyNotifsRes.deletedCount || 0,
      birthdayLogs: birthdayRes.deletedCount || 0,
      celebrationLogs: celebrationRes.deletedCount || 0
    }
  };
};

module.exports = {
  getStorageOverview,
  deleteGridFSFiles,
  getLogsOverview,
  cleanupOldLogs
};
