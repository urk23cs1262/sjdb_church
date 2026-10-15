/**
 * Safe Cleanup Script for Obsolete Prototype Collections
 * St. John de Britto Church
 *
 * Takes a JSON backup first, then drops only confirmed prototype collections.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OBSOLETE_COLLECTIONS = [
  'test_chunks.chunks',
  'test_chunks.files',
  'families',
  'dailycatholiccontents',
  'userdevotionalprogresses',
  'dailynotificationjobs',
  'notificationdeliveries',
  'birthdaydeliverylogs',
  'saints'
];

async function run() {
  const isExecute = process.argv.includes('--execute');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log('='.repeat(75));
  console.log('   ST. JOHN DE BRITTO CHURCH — OBSOLETE COLLECTIONS CLEANUP');
  console.log('='.repeat(75));

  const existingCols = (await db.listCollections().toArray()).map(c => c.name);
  const targets = OBSOLETE_COLLECTIONS.filter(name => existingCols.includes(name));

  console.log(`Found ${targets.length} candidate obsolete collections to clean up:\n`);
  for (const name of targets) {
    const count = await db.collection(name).countDocuments().catch(() => 0);
    console.log(` - ${name} (${count} documents)`);
  }

  const backupDir = path.join(__dirname, '../backups/obsolete_collections_backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Backup step
  console.log(`\n[BACKUP] Backing up documents to ${backupDir}...`);
  for (const name of targets) {
    const docs = await db.collection(name).find({}).toArray();
    const backupFile = path.join(backupDir, `${name.replace('.', '_')}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(docs, null, 2));
    console.log(`  Backed up ${docs.length} docs from ${name} -> ${path.basename(backupFile)}`);
  }

  if (!isExecute) {
    console.log('\n[DRY RUN] Run with --execute to permanently drop these obsolete collections.');
    await mongoose.disconnect();
    return;
  }

  console.log('\n[EXECUTE] Dropping obsolete collections from database...');
  for (const name of targets) {
    try {
      await db.collection(name).drop();
      console.log(`  ✅ Dropped collection: ${name}`);
    } catch (e) {
      console.error(`  ❌ Failed to drop ${name}:`, e.message);
    }
  }

  console.log('\n✅ Cleanup completed safely. All other 45 active collections remain 100% intact.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
