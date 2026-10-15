const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function backupAndOptimize() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('No MONGODB_URI found in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const SiteSettings = require('../src/models/SiteSettings');

  // 1. Create backups directory if not exists
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // 2. Fetch all SiteSettings documents
  const allDocs = await SiteSettings.find().lean();
  console.log(`Fetched ${allDocs.length} documents from sitesettings.`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(backupDir, `sitesettings_backup_${timestamp}.json`);
  fs.writeFileSync(backupFilePath, JSON.stringify(allDocs, null, 2), 'utf8');
  console.log(`Verbatim backup created successfully at: ${backupFilePath} (${fs.statSync(backupFilePath).size} bytes)`);

  // 3. Inspect and optimize cache documents
  let totalSavedBytes = 0;
  let optimizedCount = 0;

  for (const doc of allDocs) {
    if (doc.key && (doc.key === 'daily_saint_cache' || doc.key.startsWith('daily_saint_cache_'))) {
      const origLength = doc.value ? doc.value.length : 0;
      let parsed = null;
      try {
        parsed = JSON.parse(doc.value);
      } catch (e) {
        console.warn(`Could not parse JSON for key ${doc.key}:`, e.message);
        continue;
      }

      if (parsed) {
        let changed = false;

        // Check if imageAttachment exists and has buffer content
        if (parsed.imageAttachment) {
          delete parsed.imageAttachment;
          changed = true;
        }

        // Check if primaryImageResult has buffer
        if (parsed.primaryImageResult && parsed.primaryImageResult.buffer) {
          delete parsed.primaryImageResult.buffer;
          changed = true;
        }

        // Check if primarySaint has imageAttachment
        if (parsed.primarySaint && parsed.primarySaint.imageAttachment) {
          delete parsed.primarySaint.imageAttachment;
          changed = true;
        }

        // Check if other saints have imageAttachment
        if (Array.isArray(parsed.otherSaints)) {
          parsed.otherSaints.forEach(s => {
            if (s.imageAttachment) {
              delete s.imageAttachment;
              changed = true;
            }
          });
        }

        // Check if allSaints has imageAttachment
        if (Array.isArray(parsed.allSaints)) {
          parsed.allSaints.forEach(s => {
            if (s.imageAttachment) {
              delete s.imageAttachment;
              changed = true;
            }
          });
        }

        // Check if saints has imageAttachment
        if (Array.isArray(parsed.saints)) {
          parsed.saints.forEach(s => {
            if (s.imageAttachment) {
              delete s.imageAttachment;
              changed = true;
            }
          });
        }

        if (changed) {
          const optimizedJson = JSON.stringify(parsed);
          const newLength = optimizedJson.length;
          const diff = origLength - newLength;
          totalSavedBytes += diff;
          optimizedCount++;

          await SiteSettings.updateOne(
            { _id: doc._id },
            { $set: { value: optimizedJson } }
          );

          console.log(`Optimized ${doc.key}: ${origLength} chars -> ${newLength} chars (Saved ${(diff / 1024).toFixed(2)} KB / ${((diff / origLength) * 100).toFixed(1)}%)`);
        } else {
          console.log(`Document ${doc.key} is already clean (${origLength} chars).`);
        }
      }
    }
  }

  console.log(`\nOptimization Complete!`);
  console.log(`- Documents optimized: ${optimizedCount}`);
  console.log(`- Total data size reduced: ${(totalSavedBytes / 1024).toFixed(2)} KB`);

  await mongoose.disconnect();
}

backupAndOptimize().catch(err => {
  console.error('Backup & Optimization error:', err);
  process.exit(1);
});
