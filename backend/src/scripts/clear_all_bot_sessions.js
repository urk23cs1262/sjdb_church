/**
 * Utility Script: Clear All WhatsApp Bot Sessions for Fresh New Onboarding
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const BotSession = require('../models/BotSession');
const { warmUpCache } = require('../bot/churchDataCache');

async function clearSessions() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church';
  console.log('Connecting to MongoDB at:', uri);
  await mongoose.connect(uri);

  const beforeCount = await BotSession.countDocuments();
  console.log(`Found ${beforeCount} existing bot session(s).`);

  const deleteResult = await BotSession.deleteMany({});
  console.log(`✅ Deleted ${deleteResult.deletedCount} bot session(s).`);

  const afterCount = await BotSession.countDocuments();
  console.log(`Current bot sessions count in database: ${afterCount}`);

  console.log('Warming up data cache...');
  await warmUpCache();
  console.log('✅ Cache warmed up freshly.');

  console.log('\n========================================================');
  console.log('✨ ALL BOT SESSIONS CLEARED SUCCESSFULLY!');
  console.log('Any new message to the bot will now start 100% freshly');
  console.log('with the complete verification & onboarding flow.');
  console.log('========================================================');

  await mongoose.disconnect();
}

clearSessions().catch(err => {
  console.error('Error clearing sessions:', err);
  process.exit(1);
});
