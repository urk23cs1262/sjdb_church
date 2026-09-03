/**
 * Verification Test Suite: 4:00 AM IST Automatic Daily Catholic WhatsApp Notification System
 */

const mongoose = require('mongoose');
const { getTodayDailyContent } = require('./services/dailyContentService');
const { generateDailyCatholicMessage, generateDailyLinksMessage, generateSaintInfoMessage } = require('./services/whatsappDailyFormatter');
const { resolveSaintImage } = require('./services/saintImageResolver');

async function runTests() {
  console.log('================================================================');
  console.log('🔔 RUNNING 4:00 AM IST DAILY CATHOLIC NOTIFICATION SYSTEM TESTS');
  console.log('================================================================\n');

  try {
    await mongoose.connect('mongodb://localhost:27017/sjdb_church', { serverSelectionTimeoutMS: 2000 });
    console.log('Connected to MongoDB.\n');
  } catch (err) {
    console.log('MongoDB offline, using in-memory fallbacks.\n');
    mongoose.set('bufferTimeoutMS', 500);
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (details) console.error(`   Details: ${details}`);
      failed++;
    }
  }

  // 1. Fetch current date aggregated content (Asia/Kolkata)
  const today = new Date();
  const dailyContent = await getTodayDailyContent(today);

  assert(!!dailyContent.dateKey, `DateKey is defined (${dailyContent.dateKey})`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(dailyContent.dateKey), 'DateKey matches YYYY-MM-DD format');

  // 2. Content Components Completeness
  assert(!!dailyContent.bible && !!dailyContent.bible.ref, '1. Today Bible verse & reference exist');
  assert(!!dailyContent.massReadings, '2. Daily Mass readings exist');
  assert(!!dailyContent.reflection, '3. Daily Reflection exists');
  assert(!!dailyContent.saint && (!!dailyContent.saint.nameEnglish || !!dailyContent.saint.nameTamil), '4. Saint of the Day exists');

  const saintImageUrl = dailyContent?.saintImage || dailyContent?.saint?.image || dailyContent?.saintOfTheDay?.english?.imageUrl;
  assert(!!saintImageUrl && saintImageUrl.startsWith('http'), `5. Saint image URL exists and is valid (${saintImageUrl})`);

  // 3. Message 1: Clean Catholic Liturgical Message
  const msg1Ta = generateDailyCatholicMessage({ dailyContent, language: 'ta', readingPreference: 'full' });
  assert(msg1Ta.includes('இன்றைய கத்தோலிக்க திருப்பலி வாசகங்கள்'), 'Message 1 (Tamil) has liturgical header');
  assert(msg1Ta.includes('இன்றைய இறைவார்த்தை'), 'Message 1 (Tamil) has Bible verse block');
  assert(msg1Ta.includes('இன்றைய தியானம்'), 'Message 1 (Tamil) has Reflection block');
  assert(!msg1Ta.includes('http://') && !msg1Ta.includes('https://'), 'Message 1 (Tamil) contains 0 URLs');

  const msg1En = generateDailyCatholicMessage({ dailyContent, language: 'en', readingPreference: 'full' });
  assert(msg1En.includes('Daily Catholic Devotions') || msg1En.includes('St. John de Britto'), 'Message 1 (English) has liturgical header');
  assert(msg1En.includes('DAILY BIBLE VERSE'), 'Message 1 (English) has Bible verse block');
  assert(msg1En.includes('DAILY REFLECTION'), 'Message 1 (English) has Reflection block');
  assert(!msg1En.includes('http://') && !msg1En.includes('https://'), 'Message 1 (English) contains 0 URLs');

  // 4. Message 2: Saint Image (Media attachment payload)
  assert(typeof saintImageUrl === 'string' && saintImageUrl.length > 10, 'Message 2 Saint Image payload is ready for WhatsApp media send');

  // 5. Message 3: Saint of the Day Information
  const msg3Ta = generateSaintInfoMessage({ dailyContent, language: 'ta' });
  assert(msg3Ta.includes('✝️ *இன்றைய புனிதர் (Saint of the Day)*'), 'Message 3 (Tamil) has correct header');
  assert(msg3Ta.includes('👑 *'), 'Message 3 (Tamil) has Saint crown block');
  assert(msg3Ta.includes('/bible-verse#saint-of-the-day'), 'Message 3 (Tamil) has canonical read more link');

  const msg3En = generateSaintInfoMessage({ dailyContent, language: 'en' });
  assert(msg3En.includes('✝️ *Saint of the Day*'), 'Message 3 (English) has correct header');
  assert(msg3En.includes('👑 *'), 'Message 3 (English) has Saint crown block');
  assert(msg3En.includes('/bible-verse#saint-of-the-day'), 'Message 3 (English) has canonical read more link');

  // 6. Message 4: Direct Clickable Links
  const msg4Ta = generateDailyLinksMessage({ dailyContent, language: 'ta' });
  assert(msg4Ta.includes('/bible-verse#verse'), 'Message 4 (Tamil) has direct verse link');
  assert(msg4Ta.includes('/bible-verse#readings'), 'Message 4 (Tamil) has direct readings link');
  assert(msg4Ta.includes('/bible-verse#reflection'), 'Message 4 (Tamil) has direct reflection link');
  assert(msg4Ta.includes('/bible-verse#saint-of-the-day'), 'Message 4 (Tamil) has direct saint link');

  const msg4En = generateDailyLinksMessage({ dailyContent, language: 'en' });
  assert(msg4En.includes('/bible-verse#verse'), 'Message 4 (English) has direct verse link');
  assert(msg4En.includes('/bible-verse#readings'), 'Message 4 (English) has direct readings link');
  assert(msg4En.includes('/bible-verse#reflection'), 'Message 4 (English) has direct reflection link');
  assert(msg4En.includes('/bible-verse#saint-of-the-day'), 'Message 4 (English) has direct saint link');

  // 7. Multi-Tier Image Fallback Pipeline for any date/saint
  const fallbackSaintImage = await resolveSaintImage('St. Unknown Martyr Example', null, null, new Date());
  assert(!!fallbackSaintImage && !!fallbackSaintImage.url, 'Fallback saint image resolver produced valid output');
  assert(fallbackSaintImage.url.startsWith('http'), 'Fallback image URL starts with http');

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
