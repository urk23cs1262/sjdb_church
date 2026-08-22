require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const DailyNotificationLog = require('../src/models/DailyNotificationLog');
const Notification = require('../src/models/Notification');
const { sendDailyChurchNotifications, getDailyNotificationStatus } = require('../src/services/dailyNotificationService');

async function resetLogsAndBroadcast() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sjdb_church';
    console.log('Connecting to MongoDB...', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected.\n');

    const todayDateKey = '2026-08-21';

    // 1. Delete existing daily notification logs for today
    const deletedLogs = await DailyNotificationLog.deleteMany({ dateKey: todayDateKey });
    console.log(`🗑️ Deleted ${deletedLogs.deletedCount} DailyNotificationLogs for dateKey: ${todayDateKey}`);

    // 2. Delete existing daily_spiritual notifications created today for a clean slate
    const deletedNotifs = await Notification.deleteMany({
      type: 'daily_spiritual',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    console.log(`🗑️ Deleted ${deletedNotifs.deletedCount} previous daily spiritual in-app notifications.`);

    console.log('\n================================================================');
    console.log('🚀 STARTING FRESH 4-CHANNEL DAILY NOTIFICATION BROADCAST NOW');
    console.log('================================================================\n');

    const result = await sendDailyChurchNotifications({ force: true });
    console.log('\nBroadcast Result:', JSON.stringify(result, null, 2));

    console.log('\n--- Status Verification ---');
    const status = await getDailyNotificationStatus();
    console.log(`DateKey: ${status.dateKey}`);
    console.log(`Status: ${status.status}`);
    console.log(`Total Users: ${status.totalUsers}`);
    console.log(`Sent: ${status.sentCount}, Failed: ${status.failedCount}, Skipped: ${status.skippedCount}`);
    console.log(`Channels Delivered: In-App=${status.channels?.inApp}, Push=${status.channels?.push}, Email=${status.channels?.email}, WhatsApp=${status.channels?.whatsapp}`);

    console.log('\n FRESH DAILY NOTIFICATION BROADCAST COMPLETED! ');
    process.exit(0);
  } catch (err) {
    console.error('Reset & Broadcast Failed:', err);
    process.exit(1);
  }
}

resetLogsAndBroadcast();
