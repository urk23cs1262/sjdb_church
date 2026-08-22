require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const { sendDailyChurchNotifications, getDailyNotificationStatus } = require('../src/services/dailyNotificationService');

async function triggerDailyBroadcastNow() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sjdb_church';
    console.log('Connecting to MongoDB...', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected.\n');

    console.log('================================================================');
    console.log('🚀 EXECUTING 4-CHANNEL DAILY CHURCH NOTIFICATION BROADCAST NOW');
    console.log('================================================================\n');

    const result = await sendDailyChurchNotifications({ force: true });
    console.log('\nBroadcast Execution Result:', JSON.stringify(result, null, 2));

    console.log('\n--- Fetching Updated 4-Channel Status & Metrics ---');
    const status = await getDailyNotificationStatus();
    console.log('Today Metrics:', status.todayMetrics);
    console.log('Channel Delivery Totals (Today):', status.todayMetrics?.channels);

    console.log('\n DAILY NOTIFICATION BROADCAST COMPLETED SUCCESSFULLY! ');
    process.exit(0);
  } catch (err) {
    console.error('Broadcast Execution Failed:', err);
    process.exit(1);
  }
}

triggerDailyBroadcastNow();
