require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { getDefaultSongsCatalog, syncDefaultSongsToDiskAndDatabase } = require('../src/services/devotionalSongsCatalog');

async function main() {
  console.log('=== SJDB CHURCH DEVOTIONAL SONGS SYNCHRONIZER ===');
  
  // 1. Sync files and JSON catalogs
  await syncDefaultSongsToDiskAndDatabase();
  const catalog = getDefaultSongsCatalog();
  console.log(`Found ${catalog.length} devotional songs in catalog.`);

  // 2. If Mongo URI is configured, connect and seed
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (uri) {
    try {
      console.log('Connecting to MongoDB...');
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log('Connected to MongoDB. Seeding songs...');
      const RosarySong = require('../src/models/RosarySong');
      const SiteSettings = require('../src/models/SiteSettings');

      await SiteSettings.deleteOne({ key: 'devotionalSongsCleared' });

      const existingSongs = await RosarySong.find().lean();
      const existingNames = new Set(existingSongs.map(s => s.fileName));

      let added = 0;
      for (let i = 0; i < catalog.length; i++) {
        const s = catalog[i];
        if (!existingNames.has(s.fileName)) {
          await RosarySong.create({
            title: s.title,
            fileName: s.fileName,
            fileUrl: s.fileUrl,
            fileSize: s.fileSize || 0,
            mimeType: s.mimeType || 'audio/mpeg',
            isActive: true,
            sortOrder: existingSongs.length + added + 1
          });
          added++;
        }
      }

      console.log(`Auto-seeded ${added} new devotional songs into MongoDB.`);
      const totalInDb = await RosarySong.countDocuments();
      console.log(`Total songs now in MongoDB: ${totalInDb}`);
      await mongoose.disconnect();
    } catch (err) {
      console.warn('MongoDB connection note:', err.message);
    }
  }

  console.log('=== DEVOTIONAL SONGS SYNCHRONIZATION COMPLETE ===');
}

main().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
