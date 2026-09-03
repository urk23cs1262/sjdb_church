/**
 * Comprehensive Fresh Start Script: Purge Bot Sessions, Reset Preferences & Broadcast Logs
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const BotSession = require('../models/BotSession');
const User = require('../models/User');
const DailyNotificationLog = require('../models/DailyNotificationLog');
const { warmUpCache } = require('../bot/churchDataCache');

async function deepCleanFreshStart() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church';
  console.log('Connecting to MongoDB at:', uri);
  await mongoose.connect(uri);

  console.log('\n--- 1. PURGING ALL BOT SESSIONS ---');
  const botSessionsDeleted = await BotSession.deleteMany({});
  console.log(`✅ Deleted ${botSessionsDeleted.deletedCount} bot session record(s).`);

  console.log('\n--- 2. PURGING ALL BROADCAST & NOTIFICATION LOGS ---');
  const logsDeleted = await DailyNotificationLog.deleteMany({});
  console.log(`✅ Deleted ${logsDeleted.deletedCount} daily notification log record(s).`);

  console.log('\n--- 3. RESETTING USER BOT SUBSCRIPTION PREFERENCES ---');
  const userResetResult = await User.updateMany(
    {},
    {
      $set: {
        botPreferences: [],
        whatsappOptIn: true,
        readingPreference: 'full',
        sendLinks: true
      }
    }
  );
  console.log(`✅ Reset bot preferences for ${userResetResult.modifiedCount} registered user(s).`);

  console.log('\n--- 4. RE-WARMING IN-MEMORY CHURCH CACHE ---');
  await warmUpCache();
  console.log('✅ Church data cache freshly warmed up.');

  const sessionCountAfter = await BotSession.countDocuments();
  const logsCountAfter = await DailyNotificationLog.countDocuments();

  console.log('\n========================================================');
  console.log('✨ 100% COMPLETE FRESH START APPLIED!');
  console.log(`• Active Bot Sessions: ${sessionCountAfter}`);
  console.log(`• Daily Broadcast Logs: ${logsCountAfter}`);
  console.log(`• Users with Clean Preferences: ${userResetResult.modifiedCount}`);
  console.log('\nAll users, registered parishioners, and new visitors will');
  console.log('now undergo the complete fresh onboarding & verification');
  console.log('flow on their very next message.');
  console.log('========================================================');

  await mongoose.disconnect();
}

deepCleanFreshStart().catch(err => {
  console.error('Deep clean error:', err);
  process.exit(1);
});
