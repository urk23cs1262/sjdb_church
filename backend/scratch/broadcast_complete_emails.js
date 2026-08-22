require('dotenv').config();
const mongoose = require('mongoose');
const DailyNotificationLog = require('../src/models/DailyNotificationLog');
const { sendDailyChurchNotifications } = require('../src/services/dailyNotificationService');

async function broadcastCompleteEmailToAll() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected.\n');

    // Wipe logs so we send a full fresh broadcast
    await DailyNotificationLog.deleteMany({ dateKey: '2026-08-21' });

    console.log('🚀 BROADCASTING COMPLETE LITURGICAL EMAILS TO ALL REGISTERED USERS...');
    const result = await sendDailyChurchNotifications({ force: true });
    console.log('Broadcast Finished:', JSON.stringify(result, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Broadcast failed:', err);
    process.exit(1);
  }
}

broadcastCompleteEmailToAll();
