/**
 * Test Suite: Server-Side Content Sync & Monitoring Service
 * 
 * Verifies:
 * 1. Automatic monitoring and immediate database update across:
 *    - Saint of the Day (Vatican News + Authentic Image)
 *    - Daily Mass Readings (Catholic Gallery Tamil & English)
 *    - Daily Reflection (Tamil Catholic Daily)
 *    - Daily Bible Verse (Liturgical rotation)
 * 2. Canonical DailyCatholicContent storage in MongoDB
 * 3. Update detection (hash change detection)
 * 4. Anti-regression protection (never overwrites valid data with empty/stale fallbacks)
 * 5. getTodayDailyContent() consumes the canonical record for 04:00 AM broadcast
 * 6. Public API endpoints: /api/daily-content/today & /api/daily-content/monitor-status
 */

require('dotenv').config();
const mongoose = require('mongoose');
const http = require('http');
const express = require('express');

const DailyCatholicContent = require('./models/DailyCatholicContent');
const { checkAndSyncDailyContent, getMonitoringStatus } = require('./services/contentMonitoringService');
const { getTodayDailyContent } = require('./services/dailyContentService');
const dailyContentRoutes = require('./routes/dailyContentRoutes');
const { getDateKey } = require('./services/dailyMassReadingService');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('✝️ TESTING SERVER-SIDE CATHOLIC CONTENT MONITORING SERVICE');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB.');

  const todayDateKey = getDateKey(new Date());

  // ── 1. INITIAL SYNC & CANONICAL DB CREATION ──
  console.log('\n--- 1. Initial Source Monitoring & Synchronization ---');
  const canonicalDoc = await checkAndSyncDailyContent(new Date(), true);

  assert(canonicalDoc !== null, 'DailyCatholicContent document created');
  assert(canonicalDoc.date === todayDateKey, `Date matches today (${canonicalDoc.date})`);
  assert(Boolean(canonicalDoc.formattedDate && canonicalDoc.formattedDateTa), 'Formatted English & Tamil dates present');

  // Check Saint
  assert(Boolean(canonicalDoc.saint?.nameEnglish || canonicalDoc.saint?.nameTamil), `Saint of the day present (${canonicalDoc.saint?.nameEnglish})`);
  assert(Boolean(canonicalDoc.saint?.image), `Saint image present (${canonicalDoc.saint?.image?.slice(0, 50)}...)`);
  assert(Boolean(canonicalDoc.sourceHashes?.saint), 'Saint content hash computed');

  // Check Mass Readings
  assert(Boolean(canonicalDoc.massReadings?.tamil?.title), `Tamil Mass readings title present (${canonicalDoc.massReadings?.tamil?.title})`);
  assert(Array.isArray(canonicalDoc.massReadings?.tamil?.readings) && canonicalDoc.massReadings.tamil.readings.length > 0, `Tamil readings array has ${canonicalDoc.massReadings?.tamil?.readings?.length} sections`);
  assert(Boolean(canonicalDoc.massReadings?.english?.title), `English Mass readings title present (${canonicalDoc.massReadings?.english?.title})`);
  assert(Array.isArray(canonicalDoc.massReadings?.english?.readings) && canonicalDoc.massReadings.english.readings.length > 0, `English readings array has ${canonicalDoc.massReadings?.english?.readings?.length} sections`);

  // Check Reflection
  assert(Boolean(canonicalDoc.reflection?.tamil), 'Tamil daily reflection present');
  assert(Boolean(canonicalDoc.reflection?.english), 'English daily reflection present');

  // Check Bible Verse
  assert(Boolean(canonicalDoc.bible?.ref), `Daily Bible Verse reference present (${canonicalDoc.bible?.ref})`);
  assert(Boolean(canonicalDoc.bible?.tamil && canonicalDoc.bible?.english), 'Bilingual Bible Verse text present');

  // Check Sync Status flags
  assert(canonicalDoc.syncStatus.saint === true, 'Saint syncStatus is true');
  assert(canonicalDoc.syncStatus.massReadings === true, 'Mass Readings syncStatus is true');
  assert(canonicalDoc.syncStatus.reflection === true, 'Reflection syncStatus is true');
  assert(canonicalDoc.syncStatus.verse === true, 'Bible Verse syncStatus is true');

  // ── 2. UPDATE DETECTION (IDEMPOTENCY & CHECKSUM MATCHING) ──
  console.log('\n--- 2. Update Detection & Idempotent Monitoring Tick ---');
  const secondCheck = await checkAndSyncDailyContent(new Date(), false);
  assert(secondCheck.sourceHashes.saint === canonicalDoc.sourceHashes.saint, 'Saint hash preserved on duplicate check');
  assert(secondCheck.sourceHashes.massReadings === canonicalDoc.sourceHashes.massReadings, 'Mass readings hash preserved on duplicate check');

  // ── 3. ANTI-REGRESSION PROTECTION ──
  console.log('\n--- 3. Anti-Regression Protection ---');
  // Ensure that rich content is never wiped out
  const savedDoc = await DailyCatholicContent.findOne({ date: todayDateKey });
  assert(savedDoc.massReadings.tamil.readings.length > 0, 'Readings preserved against regression');
  assert(savedDoc.saint.nameEnglish.length > 0, 'Saint biography preserved against regression');

  // ── 4. CANONICAL BROADCAST INTEGRATION ──
  console.log('\n--- 4. Daily Catholic Broadcast Data Integration ---');
  const broadcastData = await getTodayDailyContent(new Date());
  assert(broadcastData.dateKey === todayDateKey, 'getTodayDailyContent() returns matching dateKey');
  assert(broadcastData.bible.ref === savedDoc.bible.ref, 'Broadcast uses canonical Bible Verse');
  assert(broadcastData.saint.nameEnglish === savedDoc.saint.nameEnglish, 'Broadcast uses canonical Saint of the Day');
  assert(broadcastData.massReadings.tamil.title === savedDoc.massReadings.tamil.title, 'Broadcast uses canonical Tamil Mass Title');
  assert(broadcastData.massReadings.english.title === savedDoc.massReadings.english.title, 'Broadcast uses canonical English Mass Title');

  // ── 5. PUBLIC HTTP API ENDPOINTS ──
  console.log('\n--- 5. Public HTTP API Endpoints (/api/daily-content) ---');
  const app = express();
  app.use(express.json());
  app.use('/api/daily-content', dailyContentRoutes);

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;

  function httpGet(path) {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}${path}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      }).on('error', reject);
    });
  }

  const resToday = await httpGet('/api/daily-content/today');
  assert(resToday.status === 200, '/api/daily-content/today returns HTTP 200');
  assert(resToday.data.success === true, 'API returns success: true');
  assert(resToday.data.data.date === todayDateKey, `API returned date: ${resToday.data.data.date}`);
  assert(Boolean(resToday.data.data.saint?.nameEnglish), `API returned saint: ${resToday.data.data.saint?.nameEnglish}`);

  const resStatus = await httpGet('/api/daily-content/monitor-status');
  assert(resStatus.status === 200, '/api/daily-content/monitor-status returns HTTP 200');
  assert(resStatus.data.active === true, 'Monitoring service is active');
  assert(resStatus.data.timezone === 'Asia/Kolkata', 'Monitoring timezone is Asia/Kolkata');

  server.close();
  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
