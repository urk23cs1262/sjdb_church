require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const BotSession = require('../models/BotSession');

async function setAllSubscribersEnglish() {
  console.log('🔄 Setting language to English for all subscribers and users in the database...');
  
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sjdb_church');
  
  const userResult = await User.updateMany(
    {},
    {
      $set: {
        preferredLanguage: 'en',
        mass_reflection_language: 'en'
      }
    }
  );
  console.log(`✅ Updated ${userResult.modifiedCount} users to English.`);

  const botResult = await BotSession.updateMany(
    {},
    {
      $set: {
        language: 'en'
      }
    }
  );
  console.log(`✅ Updated ${botResult.modifiedCount} bot sessions to English.`);

  const sampleUsers = await User.find({ phone: { $exists: true, $ne: '' } }).select('name phone preferredLanguage mass_reflection_language').lean();
  console.log('\n📋 Sample Users after update:');
  sampleUsers.forEach(u => {
    console.log(`- ${u.name} (${u.phone}): preferredLanguage=${u.preferredLanguage}, mass_reflection_language=${u.mass_reflection_language}`);
  });

  await mongoose.disconnect();
  console.log('\n🎉 All subscribers and users are now set to English!');
}

setAllSubscribersEnglish().catch(err => {
  console.error('Error updating users to English:', err);
  process.exit(1);
});
