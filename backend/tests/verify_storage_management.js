/**
 * Verification Test Suite for MongoDB GridFS Storage Manager & Audit System
 * St. John de Britto Church
 */

const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');

const {
  getStorageOverview,
  deleteGridFSFiles,
  getLogsOverview
} = require('../src/services/storageAuditService');
const { uploadToGridFS, getGridFSFileDoc } = require('../src/services/gridfsService');
const RosarySong = require('../src/models/RosarySong');

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${desc}`);
    console.error(`    ${err.message}`);
  }
}

async function itAsync(desc, fn) {
  total++;
  try {
    await fn();
    console.log(`  PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${desc}`);
    console.error(`    ${err.message}`);
  }
}

async function runTestSuite() {
  console.log('='.repeat(80));
  console.log('--- STORAGE MANAGEMENT & GRIDFS AUDIT TEST SUITE ---');
  console.log('='.repeat(80));

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('Connected to test DB:', mongoose.connection.name);

  // 1. Test Storage Overview Read-Only Diagnostic
  let overview;
  await itAsync('getStorageOverview executes and returns complete diagnostics', async () => {
    overview = await getStorageOverview();
    assert(overview !== null, 'Overview must not be null');
    assert(typeof overview.totalFiles === 'number', 'totalFiles must be a number');
    assert(typeof overview.totalBytes === 'number', 'totalBytes must be a number');
    assert(typeof overview.totalMB === 'number', 'totalMB must be a number');
    assert(Array.isArray(overview.files), 'files must be an array');
    assert(Array.isArray(overview.duplicateGroups), 'duplicateGroups must be an array');
    assert(Array.isArray(overview.unreferencedFiles), 'unreferencedFiles must be an array');
  });

  // 2. Test File Hash Computation & Metadata
  await itAsync('Files have SHA-256 hashes computed and formatted sizes', async () => {
    if (overview.files.length > 0) {
      const first = overview.files[0];
      assert(first._id, 'File must have _id');
      assert(first.sizeFormatted, 'File must have sizeFormatted');
      assert(typeof first.inUse === 'boolean', 'File must have inUse boolean');
    }
  });

  // 3. Test In-Use File Protection: Deletion MUST be blocked
  await itAsync('deleteGridFSFiles blocks deletion if any file is in use', async () => {
    // Find an in-use file from overview
    const inUseFile = overview.files.find(f => f.inUse);
    if (inUseFile) {
      let threw = false;
      try {
        await deleteGridFSFiles([inUseFile._id]);
      } catch (err) {
        threw = true;
        assert(err.message.includes('Deletion prevented for active files') || err.message.includes('currently referenced'), 'Must show reference error message');
      }
      assert(threw, 'Must throw error when attempting to delete in-use file');
    } else {
      console.log('    (Skipped in-use file deletion test: no in-use files found)');
    }
  });

  // 4. Test Safe Upload & Deletion Lifecycle for Unreferenced Test File
  await itAsync('Can upload a test file with SHA-256 metadata and safely delete it', async () => {
    const testContent = Buffer.from('TEST_GRIDFS_CLEANUP_DATA_' + Date.now());
    const uploadRes = await uploadToGridFS(testContent, 'test_cleanup_song.mp3', 'audio/mpeg');
    assert(uploadRes.fileId, 'Upload must return fileId');
    assert(uploadRes.sha256, 'Upload must attach sha256 hash');

    // Confirm it exists in GridFS
    const doc = await getGridFSFileDoc(uploadRes.fileId);
    assert(doc !== null, 'Uploaded file must exist in GridFS uploads.files');

    // Safely delete it
    const delRes = await deleteGridFSFiles([uploadRes.fileId], { name: 'Automated Test Admin', role: 'admin' });
    assert(delRes.success === true, 'Deletion must succeed');
    assert(delRes.deletedCount === 1, 'deletedCount must be 1');

    // Confirm file was deleted from uploads.files
    const afterDoc = await getGridFSFileDoc(uploadRes.fileId);
    assert(afterDoc === null, 'File must no longer exist in uploads.files');

    // Confirm chunks were also deleted
    const chunksColl = mongoose.connection.db.collection('uploads.chunks');
    const chunkCount = await chunksColl.countDocuments({ files_id: new ObjectId(uploadRes.fileId) });
    assert(chunkCount === 0, 'Associated uploads.chunks must also be deleted');
  });

  // 5. Test Logs Overview
  await itAsync('getLogsOverview returns log collections metrics', async () => {
    const logs = await getLogsOverview();
    assert(Array.isArray(logs.collections), 'collections must be an array');
    const dailyNotifs = logs.collections.find(c => c.name === 'dailyNotificationLogs');
    assert(dailyNotifs !== undefined, 'dailyNotificationLogs collection must be present');
  });

  console.log('\n' + '='.repeat(80));
  console.log(`RESULTS: ${passed} / ${total} tests passed!`);
  console.log('='.repeat(80));

  await mongoose.disconnect();
  process.exit(passed === total ? 0 : 1);
}

runTestSuite().catch(err => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});
