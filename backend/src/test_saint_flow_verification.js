/**
 * Verification Test Suite: Saint of the Day Two-Message Flow & Multi-Tier Image Fallback
 */

const mongoose = require('mongoose');
const { getTodayDailyContent } = require('./services/dailyContentService');
const { generateSaintInfoMessage } = require('./services/whatsappDailyFormatter');
const { answerChurchQuestion } = require('./bot/churchRAGService');
const { resolveSaintImage } = require('./services/saintImageResolver');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING SAINT OF THE DAY 2-MESSAGE FLOW TESTS');
  console.log('====================================================\n');

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

  // Fetch today's aggregated daily content
  const dailyContent = await getTodayDailyContent(new Date());

  // Test 1: Daily Content has valid saint and image
  const saintImageUrl = dailyContent?.saintImage || dailyContent?.saint?.image || dailyContent?.saintOfTheDay?.english?.imageUrl;
  assert(!!saintImageUrl && saintImageUrl.startsWith('http'), 'Saint image URL exists and is a valid HTTP URL');

  // Test 2: generateSaintInfoMessage (English)
  const saintInfoEn = generateSaintInfoMessage({ dailyContent, language: 'en' });
  assert(saintInfoEn.includes('✝️ *Saint of the Day*'), 'English Saint Info has correct header');
  assert(saintInfoEn.includes('👑 *'), 'English Saint Info has saint crown/name block');
  assert(saintInfoEn.includes('/bible-verse#saint-of-the-day'), 'English Saint Info has exact canonical read more link');
  assert(saintInfoEn.includes("St. John de Britto's Church, Kalayarkoil"), 'English Saint Info has parish signature');

  // Test 3: generateSaintInfoMessage (Tamil)
  const saintInfoTa = generateSaintInfoMessage({ dailyContent, language: 'ta' });
  assert(saintInfoTa.includes('✝️ *இன்றைய புனிதர் (Saint of the Day)*'), 'Tamil Saint Info has correct header');
  assert(saintInfoTa.includes('👑 *'), 'Tamil Saint Info has saint crown/name block');
  assert(saintInfoTa.includes('/bible-verse#saint-of-the-day'), 'Tamil Saint Info has exact canonical read more link');
  assert(saintInfoTa.includes('புனித ஜான் டி பிரிட்டோ திருத்தலம், காளையார்கோவில்'), 'Tamil Saint Info has parish signature');

  // Test 4: RAG Queries for Saint of the Day triggers isSaintOfDayFlow and returns imageUrl
  const queries = [
    "Today's Saint",
    "saint of the day",
    "today saint",
    "who is today's saint?",
    "SAINT",
    "இன்றைய புனிதர் யார்"
  ];

  for (const q of queries) {
    const isTa = /(இன்றைய|புனிதர்)/.test(q);
    const res = await answerChurchQuestion(q, isTa ? 'ta' : 'en');
    assert(res.success === true, `RAG query "${q}" succeeds`);
    assert(res.isSaintOfDayFlow === true, `RAG query "${q}" triggers isSaintOfDayFlow=true`);
    assert(!!res.imageUrl && res.imageUrl.startsWith('http'), `RAG query "${q}" returns valid image URL`);
    assert(res.reply.includes('/bible-verse#saint-of-the-day'), `RAG query "${q}" has canonical link`);
  }

  // Test 5: Image Multi-Tier Fallback Resolver
  const sampleFallback = await resolveSaintImage('St. Non-Existent Unknown Martyr', null, null);
  assert(!!sampleFallback && !!sampleFallback.url, 'Image fallback resolver returns a valid image for unknown saint');
  assert(sampleFallback.url.startsWith('http'), 'Fallback image URL starts with http');

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
