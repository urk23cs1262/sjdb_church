const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const User = require('../models/User');
const BotSession = require('../models/BotSession');

async function resetUsersAndBotSessions() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // 1. Reset parishioner Users: clear bot preferences, opt-out, set inactive (preserve admin/priests)
  const userResult = await User.updateMany(
    { role: { $nin: ['admin', 'priest'] } },
    {
      $set: {
        isActive: false,
        memberStatus: 'Inactive',
        botPreferences: [],
        whatsappOptIn: false
      }
    }
  );
  console.log(`Parishioner users updated: ${userResult.modifiedCount} modified (made inactive & preferences cleared).`);

  // 2. Reset all BotSessions: reset step to language_selection, unverify, unset language
  const sessionResult = await BotSession.updateMany(
    {},
    {
      $set: {
        step: 'language_selection',
        isVerified: false,
        isOnboarded: false,
        preferences: []
      },
      $unset: {
        language: 1,
        providedPhone: 1,
        linkedUserId: 1,
        tempOtp: 1,
        tempOtpExpires: 1
      }
    }
  );
  console.log(`BotSessions reset: ${sessionResult.modifiedCount} modified (step: language_selection).`);

  const activeUserCount = await User.countDocuments({ isActive: true });
  console.log(`Active users count now: ${activeUserCount}`);

  await mongoose.disconnect();
  console.log('Database reset completed successfully.');
}

resetUsersAndBotSessions().catch(err => {
  console.error('Reset error:', err);
  process.exit(1);
});
