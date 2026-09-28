/**
 * Safe Read-Only MongoDB GridFS Storage Audit Script
 * St. John de Britto Church
 * 
 * IMPORTANT: This script is 100% READ-ONLY.
 * It NEVER modifies or deletes any collections, documents, files, or chunks.
 * 
 * Usage:
 *   node scripts/audit_gridfs_storage.js
 *   or with a specific MongoDB URI:
 *   node scripts/audit_gridfs_storage.js "mongodb+srv://..."
 */

const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');

// Import application models to check all references
const RosarySong = require('../src/models/RosarySong');
const Gallery = require('../src/models/Gallery');
const Priest = require('../src/models/Priest');
const TeamMember = require('../src/models/TeamMember');
const User = require('../src/models/User');
const Document = require('../src/models/Document');
const Event = require('../src/models/Event');
const Announcement = require('../src/models/Announcement');
const SiteSettings = require('../src/models/SiteSettings');
const Notification = require('../src/models/Notification');

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  if (!bytes || isNaN(bytes)) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

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

async function runAudit() {
  const uri = process.argv[2] || process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/sjdb_church';
  const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');

  console.log('='.repeat(80));
  console.log('  ST. JOHN DE BRITTO CHURCH — MONGODB GRIDFS STORAGE AUDIT (READ-ONLY)');
  console.log('='.repeat(80));
  console.log(`Connecting to: ${maskedUri}`);

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(`Database connected: ${db.databaseName}\n`);

  const filesColl = db.collection('uploads.files');
  const chunksColl = db.collection('uploads.chunks');
  const bucket = new GridFSBucket(db, { bucketName: 'uploads' });

  // 1. Basic Collection Counts and Stats
  const totalFiles = await filesColl.countDocuments();
  const totalChunks = await chunksColl.countDocuments();

  let chunksStats = { size: 0, storageSize: 0 };
  try {
    const stats = await db.command({ collStats: 'uploads.chunks' });
    chunksStats = {
      size: stats.size || 0,
      storageSize: stats.storageSize || 0
    };
  } catch (err) {
    // If collStats fails, compute size from filesColl sum
  }

  console.log('--- COLLECTION OVERVIEW ---');
  console.log(`uploads.files documents:  ${totalFiles}`);
  console.log(`uploads.chunks documents: ${totalChunks}`);
  if (chunksStats.size > 0) {
    console.log(`uploads.chunks Data Size:    ${formatBytes(chunksStats.size)} (${chunksStats.size} bytes)`);
    console.log(`uploads.chunks Storage Size: ${formatBytes(chunksStats.storageSize)}`);
  }
  console.log('');

  if (totalFiles === 0) {
    console.log('GridFS is completely empty. No files stored.');
    await mongoose.disconnect();
    return;
  }

  // 2. Fetch all files from uploads.files
  console.log('Scanning all files in uploads.files and computing SHA-256 binary hashes...');
  const files = await filesColl.find().sort({ uploadDate: -1 }).toArray();

  let totalFileBytes = 0;
  const fileHashList = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    totalFileBytes += file.length || 0;
    process.stdout.write(`\rHashing file ${i + 1} of ${files.length} (${file.filename.slice(0, 30)})...`);
    const sha256 = await computeFileHash(bucket, file._id);
    fileHashList.push({
      ...file,
      sha256
    });
  }
  console.log('\nDone hashing files.\n');

  // 3. Scan Application Models for references
  console.log('Scanning database collections for GridFS references...');
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
    User.find({ profilePhoto: { $exists: true, $ne: '' } }).select('name profilePhoto').lean().catch(() => []),
    Document.find({ uploadedFile: { $exists: true, $ne: '' } }).select('type uploadedFile userId').lean().catch(() => []),
    Event.find({ image: { $exists: true, $ne: '' } }).select('title image').lean().catch(() => []),
    Announcement.find({ $or: [{ image: { $exists: true, $ne: '' } }, { attachment: { $exists: true, $ne: '' } }] }).select('title image attachment').lean().catch(() => []),
    SiteSettings.find().lean().catch(() => []),
    Notification.find({ fileUrl: { $exists: true, $ne: '' } }).select('title fileUrl').lean().catch(() => [])
  ]);

  // Build reference map: idOrFilename -> [ { collection, id, title } ]
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
    if (s.fileName) addRef(s.fileName, { collection: 'RosarySong (by filename)', id: s._id, title: s.title });
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

  console.log(`Scanned references across 10 collections.\n`);

  // 4. Analyze each file: in-use vs unreferenced vs duplicate
  const filesEnriched = fileHashList.map(f => {
    const fileIdStr = f._id.toString();
    const refs = [
      ...(referenceMap.get(fileIdStr) || []),
      ...(referenceMap.get(f.filename) || [])
    ];
    return {
      _id: fileIdStr,
      filename: f.filename,
      originalName: f.metadata?.originalName || f.filename,
      length: f.length,
      formattedSize: formatBytes(f.length),
      sizeMB: (f.length / (1024 * 1024)).toFixed(2),
      uploadDate: f.uploadDate,
      contentType: f.contentType || 'unknown',
      sha256: f.sha256,
      references: refs,
      inUse: refs.length > 0
    };
  });

  // Group by content hash to find identical binary duplicates
  const hashGroups = new Map();
  filesEnriched.forEach(f => {
    if (!f.sha256) return;
    if (!hashGroups.has(f.sha256)) hashGroups.set(f.sha256, []);
    hashGroups.get(f.sha256).push(f);
  });

  const duplicateGroups = [];
  let potentialReclaimableDuplicateBytes = 0;

  for (const [hash, group] of hashGroups.entries()) {
    if (group.length > 1) {
      // Keep one, rest can be considered redundant
      const inUseCount = group.filter(x => x.inUse).length;
      duplicateGroups.push({
        hash,
        count: group.length,
        sizePerFile: group[0].formattedSize,
        files: group
      });
      // Sum redundant sizes (group.length - 1) * size
      potentialReclaimableDuplicateBytes += (group.length - 1) * group[0].length;
    }
  }

  // Identify unreferenced (orphan) files
  const unreferencedFiles = filesEnriched.filter(f => !f.inUse);
  const totalUnreferencedBytes = unreferencedFiles.reduce((acc, f) => acc + f.length, 0);

  // Largest files (top 15)
  const largestFiles = [...filesEnriched].sort((a, b) => b.length - a.length).slice(0, 15);

  // Group files by content type
  const typeMap = {};
  filesEnriched.forEach(f => {
    const type = f.contentType || 'unknown';
    if (!typeMap[type]) typeMap[type] = { count: 0, bytes: 0 };
    typeMap[type].count++;
    typeMap[type].bytes += f.length;
  });

  // Check for orphan chunks (chunks with missing parent file)
  console.log('Checking for orphaned chunks in uploads.chunks...');
  const distinctFileIdsInChunks = await chunksColl.distinct('files_id');
  const validFileIdSet = new Set(files.map(f => f._id.toString()));
  const orphanChunkFileIds = distinctFileIdsInChunks.filter(id => !validFileIdSet.has(id.toString()));

  console.log('');
  console.log('='.repeat(80));
  console.log('                    AUDIT RESULTS SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total GridFS Files:             ${filesEnriched.length}`);
  console.log(`Total GridFS Data Size:         ${formatBytes(totalFileBytes)} (${(totalFileBytes / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`Active / In-Use Files:          ${filesEnriched.filter(f => f.inUse).length}`);
  console.log(`Unreferenced / Orphan Files:    ${unreferencedFiles.length} (${formatBytes(totalUnreferencedBytes)})`);
  console.log(`Duplicate File Groups:          ${duplicateGroups.length}`);
  console.log(`Potential Duplicate Reclaim:    ${formatBytes(potentialReclaimableDuplicateBytes)}`);
  console.log(`Orphaned Chunks Files IDs:      ${orphanChunkFileIds.length}`);
  console.log('='.repeat(80));
  console.log('');

  console.log('--- STORAGE BREAKDOWN BY CONTENT TYPE ---');
  for (const [type, data] of Object.entries(typeMap)) {
    console.log(`  ${type.padEnd(25)} ${String(data.count).padStart(4)} file(s)  ${formatBytes(data.bytes).padStart(12)}`);
  }
  console.log('');

  console.log('--- TOP 10 LARGEST FILES ---');
  largestFiles.slice(0, 10).forEach((f, idx) => {
    const status = f.inUse ? `[IN USE: ${f.references.map(r => r.collection).join(', ')}]` : '[UNREFERENCED]';
    console.log(`  ${String(idx + 1).padStart(2)}. ${f.formattedSize.padStart(10)} | ${f.contentType.padEnd(16)} | ${f._id} | ${status} | ${f.originalName}`);
  });
  console.log('');

  if (duplicateGroups.length > 0) {
    console.log('--- DUPLICATE CONTENT GROUPS (IDENTICAL BINARY HASH) ---');
    duplicateGroups.forEach((dg, idx) => {
      console.log(`\nGroup ${idx + 1} (${dg.count} identical files, ${dg.sizePerFile} each, SHA-256: ${dg.hash.slice(0, 12)}...):`);
      dg.files.forEach(f => {
        const refStr = f.inUse ? `-> IN USE by ${f.references.map(r => `${r.collection} (${r.title})`).join(', ')}` : '-> UNREFERENCED (Safe to delete)';
        console.log(`    - ID: ${f._id} | Name: "${f.originalName}" | Date: ${new Date(f.uploadDate).toISOString().slice(0, 10)} ${refStr}`);
      });
    });
    console.log('');
  } else {
    console.log('No exact binary duplicate files found.\n');
  }

  if (unreferencedFiles.length > 0) {
    console.log('--- UNREFERENCED / ORPHANED FILES (NOT REFERENCED IN ANY MONGO COLLECTION) ---');
    console.log(`Total: ${unreferencedFiles.length} files (${formatBytes(totalUnreferencedBytes)})\n`);
    unreferencedFiles.forEach((f, idx) => {
      console.log(`  ${String(idx + 1).padStart(3)}. ID: ${f._id} | Size: ${f.formattedSize.padStart(10)} | Type: ${f.contentType.padEnd(14)} | Uploaded: ${new Date(f.uploadDate).toISOString().slice(0, 10)} | Name: "${f.originalName}"`);
    });
    console.log('');
  } else {
    console.log('All files in GridFS are actively referenced in database documents.\n');
  }

  console.log('='.repeat(80));
  console.log('NOTE: THIS AUDIT WAS 100% READ-ONLY. NO FILES WERE DELETED.');
  console.log('To clean up unreferenced or duplicate files safely, use the Admin Storage Manager UI.');
  console.log('='.repeat(80));

  await mongoose.disconnect();
}

runAudit().catch(err => {
  console.error('Audit Error:', err);
  process.exit(1);
});
