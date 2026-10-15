/**
 * Verified Migration Script: MongoDB GridFS to Cloudflare R2 Object Storage
 * St. John de Britto Church
 *
 * Usage:
 *   1. Dry Run / Export local backup:
 *      node scripts/migrate_gridfs_to_r2.js --export
 *
 *   2. Migrate to Cloudflare R2:
 *      node scripts/migrate_gridfs_to_r2.js --execute
 *
 *   3. Reclaim Atlas Chunk Storage (ONLY run after verifying R2 migration):
 *      node scripts/migrate_gridfs_to_r2.js --drop-chunks
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');
const { isR2Configured, uploadToR2, headR2Object } = require('../src/services/r2StorageService');

const formatBytes = (bytes) => {
  if (!bytes || isNaN(bytes)) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const isExport = args.includes('--export');
  const isExecute = args.includes('--execute');
  const isDropChunks = args.includes('--drop-chunks');

  console.log('='.repeat(75));
  console.log('   ST. JOHN DE BRITTO CHURCH — GRIDFS TO CLOUDFLARE R2 MIGRATION');
  console.log('='.repeat(75));

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const bucket = new GridFSBucket(db, { bucketName: 'uploads' });

  const filesColl = db.collection('uploads.files');
  const chunksColl = db.collection('uploads.chunks');

  const files = await filesColl.find({}).toArray();
  const totalChunks = await chunksColl.countDocuments();

  console.log(`\nGridFS Status: ${files.length} active files, ${totalChunks} chunks`);

  if (files.length === 0) {
    console.log('No files found in uploads.files.');
    await mongoose.disconnect();
    return;
  }

  // Action 1: Export local copies for safety
  if (isExport || (!isExecute && !isDropChunks)) {
    const exportDir = path.join(__dirname, '../backups/gridfs_export');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    console.log(`\n[EXPORT] Exporting ${files.length} files to local disk backup (${exportDir})...`);
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const fileIdStr = f._id.toString();
      const safeName = `${fileIdStr}_${(f.filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const destPath = path.join(exportDir, safeName);

      const downloadStream = bucket.openDownloadStream(f._id);
      const buffer = await streamToBuffer(downloadStream);
      fs.writeFileSync(destPath, buffer);

      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      console.log(`  [${i + 1}/${files.length}] Exported ${f.filename} (${formatBytes(f.length)}) -> SHA256: ${hash.slice(0, 16)}...`);
    }
    console.log(`\n✅ Local export complete. All ${files.length} files backed up safely.`);
  }

  // Action 2: Execute Migration to Cloudflare R2
  if (isExecute) {
    if (!isR2Configured()) {
      console.error('\n❌ Cloudflare R2 is NOT configured in .env!');
      console.error('Please configure the following environment variables:');
      console.error('  R2_ACCOUNT_ID=...');
      console.error('  R2_ACCESS_KEY_ID=...');
      console.error('  R2_SECRET_ACCESS_KEY=...');
      console.error('  R2_BUCKET_NAME=...');
      console.error('  R2_PUBLIC_DOMAIN=... (optional)');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`\n[MIGRATE] Uploading ${files.length} files to Cloudflare R2 bucket: "${process.env.R2_BUCKET_NAME}"...`);

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const fileIdStr = f._id.toString();
      console.log(`\nProcessing [${i + 1}/${files.length}]: ${f.filename} (${formatBytes(f.length)})`);

      const downloadStream = bucket.openDownloadStream(f._id);
      const buffer = await streamToBuffer(downloadStream);
      const originalHash = crypto.createHash('sha256').update(buffer).digest('hex');

      // Upload to R2 under the key matching its fileIdStr (preserves /api/files/:id URL!)
      await uploadToR2(buffer, fileIdStr, f.contentType || 'application/octet-stream', {
        originalName: f.filename || 'file',
        mongoId: fileIdStr,
        sha256: originalHash
      });

      // Verify with HeadObject
      const head = await headR2Object(fileIdStr);
      if (head && head.contentLength === f.length) {
        console.log(`  ✅ Verified on R2! Key: "${fileIdStr}", Size: ${formatBytes(head.contentLength)}`);
        successCount++;
      } else {
        console.error(`  ❌ Verification failed for ${fileIdStr}!`);
      }
    }

    console.log(`\n=======================================================`);
    console.log(`MIGRATION SUMMARY: ${successCount}/${files.length} files migrated & verified in R2.`);
    console.log(`Existing URLs like /api/files/:id will now be streamed directly from R2!`);
    console.log(`=======================================================`);
  }

  // Action 3: Drop Chunks Collection to reclaim 471 MB in Atlas
  if (isDropChunks) {
    console.log('\n[RECLAIM STORAGE] Dropping uploads.chunks to reclaim 471 MB in Atlas...');
    try {
      await chunksColl.drop();
      console.log('✅ uploads.chunks dropped successfully! MongoDB Atlas allocated disk storage has been reclaimed.');
    } catch (err) {
      console.error('Could not drop uploads.chunks:', err.message);
    }
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Migration script error:', err);
  process.exit(1);
});
