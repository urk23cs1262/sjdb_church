/**
 * Automated Verification Script:
 * 1. Services Menu & Intent Router (SERVICES, MENU, READINGS, 1-14 numbers, Natural Queries)
 * 2. Saint Image Resolver multi-tier fallback (Vatican -> Wikipedia/Wikimedia -> Calendar Fallback)
 */

const { answerChurchQuestion, extractQueryIntents } = require('./bot/churchRAGService');
const { searchSaintFallback, resolveSaintImage } = require('./services/saintImageResolver');
const { fetchDailySaint } = require('./services/saintService');
const mongoose = require('mongoose');
require('dotenv').config();

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING BOT SERVICES & SAINT IMAGE RESOLVER TESTS');
  console.log('====================================================\n');

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sjdb_church';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(' Connected to MongoDB for test verification.\n');
  } catch (e) {
    console.warn(' MongoDB connection skipped:', e.message);
  }

  // Test 1: Intent Extraction for Services Variations
  console.log('--- TEST 1: Services Intent Detection ---');
  const serviceVariations = [
    'services',
    'Services',
    'SERVICES',
    'SeRvIcEs',
    'what services do you provide?',
    'What services do you provide',
    'church services',
    'parish services',
    'services list',
    'சேவைகள்',
    'பங்கு சேவைகள்'
  ];

  let test1Passed = true;
  for (const q of serviceVariations) {
    const intents = extractQueryIntents(q);
    const hasServicesIntent = intents.includes('services_menu');
    console.log(`Query: "${q}" -> Intents: ${JSON.stringify(intents)} | Passed: ${hasServicesIntent}`);
    if (!hasServicesIntent) test1Passed = false;
  }
  console.log(`Test 1 Result: ${test1Passed ? '✅ PASSED' : '❌ FAILED'}\n`);

  // Test 2: Natural Query Intent Routing (Specific Direct Answers)
  console.log('--- TEST 2: Natural Questions Routing Directly to Answers ---');
  const naturalQueries = [
    { query: 'When is Mass?', expectedIntent: 'mass_timings' },
    { query: 'Where is the church?', expectedIntent: 'location' },
    { query: 'Who is the saint today?', expectedIntent: 'saint_of_the_day' },
    { query: 'What are today\'s readings?', expectedIntent: 'readings' },
    { query: 'Confession time', expectedIntent: 'confession' },
    { query: 'How to pray the rosary', expectedIntent: 'prayers' },
    { query: 'Who is the parish priest?', expectedIntent: 'priests' },
    { query: 'Tell me about church history', expectedIntent: 'church_history' }
  ];

  let test2Passed = true;
  for (const item of naturalQueries) {
    const intents = extractQueryIntents(item.query);
    const passed = intents.includes(item.expectedIntent);
    console.log(`Query: "${item.query}" -> Expected: "${item.expectedIntent}" -> Got: ${JSON.stringify(intents)} | ${passed ? '✅' : '❌'}`);
    if (!passed) test2Passed = false;
  }
  console.log(`Test 2 Result: ${test2Passed ? '✅ PASSED' : '❌ FAILED'}\n`);

  // Test 3: Services Menu Content Generation
  console.log('--- TEST 3: Services Menu Response Content ---');
  const enServicesRes = await answerChurchQuestion('services', 'en');
  console.log('English Services Menu Output:');
  console.log(enServicesRes.reply);
  console.log('\n');

  const taServicesRes = await answerChurchQuestion('சேவைகள்', 'ta');
  console.log('Tamil Services Menu Output:');
  console.log(taServicesRes.reply);
  console.log('\n');

  const test3Passed = enServicesRes.reply.includes('1️⃣ ⛪ *Mass Timings*') && 
                      enServicesRes.reply.includes('1️⃣4️⃣ 📞 *Contact Church*') &&
                      taServicesRes.reply.includes('1️⃣ ⛪ *திருப்பலி நேரங்கள்*') &&
                      taServicesRes.reply.includes('1️⃣4️⃣ 📞 *தொடர்பு விபரம்*');
  console.log(`Test 3 Result: ${test3Passed ? '✅ PASSED' : '❌ FAILED'}\n`);

  // Test 4: Map Location link in Location Query
  console.log('--- TEST 4: Google Maps Link in Location Query ---');
  const locRes = await answerChurchQuestion('Where is the church?', 'en');
  const hasMapsLink = locRes.reply.includes('maps.google.com') && locRes.reply.includes('630551');
  console.log(`Location Response contains Google Maps URL: ${hasMapsLink ? '✅' : '❌'}`);
  console.log(locRes.reply);
  console.log('\n');

  // Test 5: Saint Image Resolver Multi-Tier Fallback Search
  console.log('--- TEST 5: Saint Image Fallback Search (e.g. St. Raymond Nonnatus) ---');
  const testSaint = 'St. Raymond Nonnatus';
  console.log(`Searching fallback image for "${testSaint}"...`);
  const fallbackResult = await searchSaintFallback(testSaint);
  console.log('Fallback Search Result:', fallbackResult);
  const test5Passed = fallbackResult && fallbackResult.url && fallbackResult.url.startsWith('https://');
  console.log(`Test 5 Result: ${test5Passed ? '✅ PASSED' : '❌ FAILED'} [URL: ${fallbackResult?.url || 'None'}]\n`);

  // Test 6: Universal Master Resolver Execution
  console.log('--- TEST 6: Universal Master Resolver ---');
  const masterResolved = await resolveSaintImage(testSaint, 'https://www.vaticannews.va/en/saints/08/31.html', null, new Date());
  console.log('Master Resolver Output:', masterResolved);
  const test6Passed = masterResolved && masterResolved.url && masterResolved.url.startsWith('https://');
  console.log(`Test 6 Result: ${test6Passed ? '✅ PASSED' : '❌ FAILED'}\n`);

  console.log('====================================================');
  if (test1Passed && test2Passed && test3Passed && hasMapsLink && test5Passed && test6Passed) {
    console.log('🎉 ALL AUTOMATED VERIFICATION TESTS PASSED (6/6)');
  } else {
    console.log('⚠️ SOME TESTS RETURNED UNEXPECTED RESULTS');
  }
  console.log('====================================================');

  process.exit(0);
}

runTests().catch(err => {
  console.error('Test script encountered error:', err);
  process.exit(1);
});
