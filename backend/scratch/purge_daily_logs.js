require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const DailyNotificationLog = require('../src/models/DailyNotificationLog');
const Notification = require('../src/models/Notification');

async function purgeAllDailyLogs() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sjdb_church';
    console.log('Connecting to MongoDB...', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected.\n');

    // Permanently wipe ALL daily notification logs from collection
    const deletedLogs = await DailyNotificationLog.deleteMany({});
    console.log(`🗑️ PERMANENTLY DELETED ${deletedLogs.deletedCount} DailyNotificationLogs from database.`);

    // Also delete any existing daily_spiritual in-app notifications
    const deletedNotifs = await Notification.deleteMany({ type: 'daily_spiritual' });
    console.log(`🗑️ PERMANENTLY DELETED ${deletedNotifs.deletedCount} daily spiritual in-app notifications.`);

    const remainingCount = await DailyNotificationLog.countDocuments({});
    console.log(`\nRemaining DailyNotificationLogs in Database: ${remainingCount}`);

    console.log('\n DATABASE CLEANED! You can now restart backend or let nodemon trigger the fresh broadcast on boot.');
    process.exit(0);
  } catch (err) {
    console.error('Purge Failed:', err);
    process.exit(1);
  }
}

purgeAllDailyLogs();
