/**
 * Restore script for SiteSettings daily saint cache
 * Usage: node scripts/restore_sitesettings_cache.js [backup_file_path]
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const SiteSettings = require('../src/models/SiteSettings');

async function restore() {
  const backupDir = path.join(__dirname, '../backups');
  let backupFile = process.argv[2];

  if (!backupFile) {
    if (!fs.existsSync(backupDir)) {
      console.error('No backups directory found.');
      process.exit(1);
    }
    const files = fs.readdirSync(backupDir).filter(f => f.startsWith('sitesettings_backup_')).sort().reverse();
    if (files.length === 0) {
      console.error('No backup files found in', backupDir);
      process.exit(1);
    }
    backupFile = path.join(backupDir, files[0]);
  }

  console.log(`Loading backup from: ${backupFile}`);
  const rawData = fs.readFileSync(backupFile, 'utf8');
  const backupDocs = JSON.parse(rawData);

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');

  let restoredCount = 0;
  for (const doc of backupDocs) {
    await SiteSettings.findOneAndUpdate(
      { key: doc.key },
      { $set: { value: doc.value, description: doc.description, updatedAt: new Date() } },
      { upsert: true }
    );
    restoredCount++;
  }

  console.log(`Successfully restored ${restoredCount} document(s) to SiteSettings.`);
  await mongoose.disconnect();
}

restore().catch(err => {
  console.error('Restore failed:', err);
  process.exit(1);
});
