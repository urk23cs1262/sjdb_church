/**
 * Verification Test Suite: 24/7 Fast WhatsApp Bot Architecture & In-Memory Caching
 */

const mongoose = require('mongoose');
const { warmUpCache, getCacheDiagnostics, getCachedDailyContent, getCachedEvents, getCachedAnnouncements, getCachedPriests } = require('./bot/churchDataCache');
const { answerChurchQuestion } = require('./bot/churchRAGService');

async function runTests() {
  console.log('====================================================');
  console.log('⚡ RUNNING 24/7 FAST WHATSAPP BOT ARCHITECTURE TESTS');
  console.log('====================================================\n');

  try {
    await mongoose.connect('mongodb://localhost:27017/sjdb_church', { serverSelectionTimeoutMS: 2000 });
    console.log('Connected to MongoDB for fast test execution.\n');
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

  // Test 1: Cache Warm-up
  const warmStart = Date.now();
  await warmUpCache();
  const warmTime = Date.now() - warmStart;
  assert(warmTime < 3000, `Cache warm-up completed quickly (${warmTime}ms)`);

  const diag = getCacheDiagnostics();
  assert(diag.lastWarmedAt !== null, 'Cache diagnostics reports lastWarmedAt timestamp');

  // Test 2: In-Memory Cached Retrievals (Sub-millisecond)
  const t0 = Date.now();
  const daily = await getCachedDailyContent();
  const tDaily = Date.now() - t0;
  assert(tDaily < 20, `Daily content retrieved from cache in ${tDaily}ms (< 20ms)`);
  assert(!!daily, 'Daily content is non-null');

  const t1 = Date.now();
  const priests = await getCachedPriests();
  const tPriests = Date.now() - t1;
  assert(tPriests < 20, `Priests retrieved from cache in ${tPriests}ms (< 20ms)`);

  const t2 = Date.now();
  const events = await getCachedEvents();
  const tEvents = Date.now() - t2;
  assert(tEvents < 20, `Events retrieved from cache in ${tEvents}ms (< 20ms)`);

  const t3 = Date.now();
  const announcements = await getCachedAnnouncements();
  const tAnnouncements = Date.now() - t3;
  assert(tAnnouncements < 20, `Announcements retrieved from cache in ${tAnnouncements}ms (< 20ms)`);

  // Test 3: Near-Instant Intent Processing for Core Queries
  const coreQueries = [
    { q: 'Hi', label: 'Greeting' },
    { q: 'Menu', label: 'Main Menu' },
    { q: 'Services', label: 'Services Menu' },
    { q: 'Mass timings', label: 'Mass Timings' },
    { q: "Today's saint", label: 'Saint of the Day' },
    { q: 'Where is the church?', label: 'Church Location' },
    { q: 'Daily readings', label: 'Daily Readings' },
    { q: 'Daily verse', label: 'Daily Verse' }
  ];

  for (const { q, label } of coreQueries) {
    const start = Date.now();
    const res = await answerChurchQuestion(q, 'en');
    const elapsed = Date.now() - start;

    assert(res.success === true, `Intent processing for "${label}" (${q}) succeeds`);
    assert(elapsed < 60, `Response time for "${label}" (${q}) is near-instant (${elapsed}ms < 60ms)`);
    assert(res.reply && res.reply.length > 20, `Response content for "${label}" is complete`);
  }

  // Test 4: Cache Hit Ratio
  const finalDiag = getCacheDiagnostics();
  assert(finalDiag.hits > 0, `Cache hit counter recorded ${finalDiag.hits} hits`);

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
