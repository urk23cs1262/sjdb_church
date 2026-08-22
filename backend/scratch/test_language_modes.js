require('dotenv').config();
const mongoose = require('mongoose');
const { getTodayDailyContent } = require('../src/services/dailyContentService');
const { generateDailyNotificationHtml } = require('../src/templates/dailyNotificationEmail');

async function testLanguageModes() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church');
  const dailyContent = await getTodayDailyContent();

  console.log('=== TESTING LANGUAGE MODES FOR EMAIL ===\n');

  // 1. Test Tamil Mode ('ta')
  const htmlTa = generateDailyNotificationHtml({
    userName: 'Tamil Parishioner',
    dailyContent,
    userLanguage: 'ta'
  });
  console.log('1. Mode "ta" (Tamil):');
  console.log('   Includes Tamil Mass Reading Section:', htmlTa.includes('✝️ இன்றைய திருப்பலி வாசகங்கள்'));
  console.log('   Includes English Mass Reading Section:', htmlTa.includes('✝️ DAILY MASS READINGS'));
  console.log('   Includes Tamil Reflection Section:', htmlTa.includes('💭 இன்றைய சிந்தனை'));
  console.log('   Includes English Reflection Section:', htmlTa.includes('💭 TODAY\'S REFLECTION'));
  console.log('   Includes Bilingual Bible Verse:', htmlTa.includes('தமிழ் (Tamil)') && htmlTa.includes('English'));
  console.log('   Includes Bilingual Saint:', htmlTa.includes('புனித பத்தாம் பயஸ்') && htmlTa.includes('St. Pius X'));

  // 2. Test English Mode ('en')
  const htmlEn = generateDailyNotificationHtml({
    userName: 'English Parishioner',
    dailyContent,
    userLanguage: 'en'
  });
  console.log('\n2. Mode "en" (English):');
  console.log('   Includes Tamil Mass Reading Section:', htmlEn.includes('✝️ இன்றைய திருப்பலி வாசகங்கள்'));
  console.log('   Includes English Mass Reading Section:', htmlEn.includes('✝️ DAILY MASS READINGS'));
  console.log('   Includes Tamil Reflection Section:', htmlEn.includes('💭 இன்றைய சிந்தனை'));
  console.log('   Includes English Reflection Section:', htmlEn.includes('💭 TODAY\'S REFLECTION'));
  console.log('   Includes Bilingual Bible Verse:', htmlEn.includes('தமிழ் (Tamil)') && htmlEn.includes('English'));
  console.log('   Includes Bilingual Saint:', htmlEn.includes('புனித பத்தாம் பயஸ்') && htmlEn.includes('St. Pius X'));

  // 3. Test Both Mode ('both')
  const htmlBoth = generateDailyNotificationHtml({
    userName: 'Bilingual Parishioner',
    dailyContent,
    userLanguage: 'both'
  });
  console.log('\n3. Mode "both" (Tamil + English):');
  console.log('   Includes Tamil Mass Reading Section:', htmlBoth.includes('✝️ இன்றைய திருப்பலி வாசகங்கள்'));
  console.log('   Includes English Mass Reading Section:', htmlBoth.includes('✝️ DAILY MASS READINGS'));
  console.log('   Includes Tamil Reflection Section:', htmlBoth.includes('💭 இன்றைய சிந்தனை'));
  console.log('   Includes English Reflection Section:', htmlBoth.includes('💭 TODAY\'S REFLECTION'));
  console.log('   Includes Bilingual Bible Verse:', htmlBoth.includes('தமிழ் (Tamil)') && htmlBoth.includes('English'));
  console.log('   Includes Bilingual Saint:', htmlBoth.includes('புனித பத்தாம் பயஸ்') && htmlBoth.includes('St. Pius X'));

  process.exit(0);
}

testLanguageModes();
