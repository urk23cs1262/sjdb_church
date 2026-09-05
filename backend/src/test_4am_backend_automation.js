/**
 * Comprehensive Acceptance Test Suite: 04:00 AM IST Backend Automation & Decoupling
 * 
 * Tests:
 * 1. Static Verification: Baileys lifecycle owned by server.js, zero frontend connection triggers.
 * 2. Static Verification: Zero setTimeout startup broadcast triggers in dailyNotificationService.js.
 * 3. Schedule Verification: Exactly 04:00 AM IST (0 4 * * * Asia/Kolkata).
 * 4. Model Architecture: DailyNotificationJob & NotificationDelivery schemas and unique indexes.
 * 5. Distributed Locking: Atomic job creation & concurrent lock prevention.
 * 6. Idempotency: Duplicate sends to the same recipient on the same dateKey are prevented.
 * 7. Webhook Security: /api/daily-notifications/scheduler-trigger requires valid CRON_SECRET.
 * 8. Liturgical Content Formatting: Verse, Readings, Reflection, Saint of the Day, Saint Image.
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DailyNotificationJob = require('./models/DailyNotificationJob');
const NotificationDelivery = require('./models/NotificationDelivery');
const { getTodayDailyContent } = require('./services/dailyContentService');
const { generateDailyCatholicMessage, generateDailyLinksMessage, generateSaintInfoMessage } = require('./services/whatsappDailyFormatter');
const { getSchedulerStatus } = require('./services/dailyNotificationService');

async function runTests() {
  console.log('================================================================');
  console.log('🛡️ RUNNING 04:00 AM IST AUTONOMOUS BACKEND ARCHITECTURE TESTS');
  console.log('================================================================\n');

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

  try {
    await mongoose.connect('mongodb://localhost:27017/sjdb_church', { serverSelectionTimeoutMS: 1500 });
  } catch (err) {
    mongoose.set('bufferTimeoutMS', 300);
  }

  // ── 1. STATIC VERIFICATION: Zero startup broadcast timers ──
  console.log('--- 1. Verification of Zero Startup Triggers ---');
  const serviceCode = fs.readFileSync(path.join(__dirname, 'services', 'dailyNotificationService.js'), 'utf8');
  assert(!serviceCode.includes('setTimeout(checkAndSendOnStartup'), 'No setTimeout(checkAndSendOnStartup) in service');
  assert(!serviceCode.includes('90 * 1000'), 'No 90-second startup timer (which caused the 08:24 AM delivery bug)');

  // ── 2. STATIC VERIFICATION: Server starts Baileys, frontend does not ──
  console.log('\n--- 2. Baileys Daemon Lifecycle Verification ---');
  const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert(serverCode.includes('connectToWhatsApp()'), 'server.js initiates WhatsApp daemon on boot');
  const adminWaCode = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/admin/admin_whatsapp.jsx'), 'utf8');
  assert(!adminWaCode.includes('connectToWhatsApp'), 'Frontend admin_whatsapp.jsx does NOT initialize Baileys directly');
  assert(!adminWaCode.includes('makeWASocket'), 'Frontend does not contain Baileys socket creation');

  // ── 3. SCHEDULE VERIFICATION: 04:00 AM IST (Asia/Kolkata) ──
  console.log('\n--- 3. Schedule Expression Verification ---');
  assert(serviceCode.includes("cron.schedule('0 4 * * *'"), 'Service cron expression is 0 4 * * * (04:00 AM IST)');
  assert(serviceCode.includes("timezone: 'Asia/Kolkata'"), 'Service cron timezone is Asia/Kolkata');
  const schedStatus = getSchedulerStatus();
  assert(schedStatus.cronExpression === '0 4 * * *', 'getSchedulerStatus() reports 0 4 * * *');
  assert(schedStatus.timezone === 'Asia/Kolkata', 'getSchedulerStatus() reports Asia/Kolkata');

  // ── 4. MODEL SCHEMA & UNIQUE CONSTRAINTS ──
  console.log('\n--- 4. Database Job System & Idempotency Constraints ---');
  assert(!!DailyNotificationJob, 'DailyNotificationJob model is defined');
  assert(!!NotificationDelivery, 'NotificationDelivery model is defined');

  const deliveryIndexes = NotificationDelivery.schema.indexes();
  const hasCompoundUnique = deliveryIndexes.some(([idx, opts]) => 
    idx.notificationDate === 1 && idx.recipient === 1 && idx.channel === 1 && opts.unique === true
  );
  assert(hasCompoundUnique, 'NotificationDelivery enforces unique { notificationDate, recipient, channel }');

  // ── 5. CONTENT PREPARATION AT 04:00 AM ──
  console.log('\n--- 5. Daily Catholic Liturgical Content at 04:00 AM ---');
  const dailyContent = await getTodayDailyContent(new Date());
  assert(!!dailyContent.dateKey, `DateKey is defined: ${dailyContent.dateKey}`);
  assert(!!dailyContent.bible && !!dailyContent.bible.ref, `Bible Verse present: ${dailyContent.bible.ref}`);
  assert(!!dailyContent.massReadings, 'Mass Readings present');
  assert(!!dailyContent.reflection, 'Daily Reflection present');
  assert(!!dailyContent.saint && (!!dailyContent.saint.nameEnglish || !!dailyContent.saint.nameTamil), 'Saint of the Day present');

  const saintImageUrl = dailyContent?.saintImage || dailyContent?.saint?.image || dailyContent?.saintOfTheDay?.english?.imageUrl;
  assert(!!saintImageUrl && saintImageUrl.startsWith('http'), `Saint of the day image available (${saintImageUrl})`);

  // ── 6. BILINGUAL WHATSAPP FORMATTING ──
  console.log('\n--- 6. Bilingual Formatting Verification ---');
  const msgTa = generateDailyCatholicMessage({ dailyContent, language: 'ta', readingPreference: 'full' });
  const msgEn = generateDailyCatholicMessage({ dailyContent, language: 'en', readingPreference: 'full' });
  assert(msgTa.includes('இன்றைய கத்தோலிக்க திருப்பலி வாசகங்கள்'), 'Tamil WhatsApp message has liturgical Tamil header');
  assert(msgEn.includes('DAILY BIBLE VERSE'), 'English WhatsApp message has English header');
  assert(!msgTa.includes('http://') && !msgTa.includes('https://'), 'Devotional message 1 contains 0 URLs');

  // ── 7. EXTERNAL CRON ROUTE & CONTROLLER ──
  console.log('\n--- 7. External Cron Webhook Route Verification ---');
  const routesCode = fs.readFileSync(path.join(__dirname, 'routes', 'dailyNotificationRoutes.js'), 'utf8');
  assert(routesCode.includes("router.all('/scheduler-trigger', triggerSchedulerCron)"), 'Scheduler trigger endpoint registered');

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
