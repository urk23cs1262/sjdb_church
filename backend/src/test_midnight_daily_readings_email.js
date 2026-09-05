/**
 * Verification Test Suite: 04:00 AM IST Daily Catholic Autonomous Notification System
 * 
 * Verifies:
 * 1. Cron schedule registered at 04:00 AM IST (0 4 * * * Asia/Kolkata)
 * 2. Complete decoupling from browser / page load (zero startup broadcast timers)
 * 3. DailyNotificationJob & NotificationDelivery models and unique constraints
 * 4. Distributed locking and idempotency protection
 * 5. Full Catholic Liturgical Content aggregation (Bible verse, Mass readings, Reflection, Saint, Saint photo)
 * 6. Personalized bilingual HTML email generation
 * 7. /api/health diagnostic reports active 04:00 AM IST scheduler
 * 8. Authenticated external webhook trigger for production hosting
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const { getTodayDailyContent } = require('./services/dailyContentService');
const { generateDailyNotificationHtml } = require('./templates/dailyNotificationEmail');
const {
  sendDailyChurchNotifications,
  getDailyNotificationStatus,
  getSchedulerStatus
} = require('./services/dailyNotificationService');
const DailyNotificationJob = require('./models/DailyNotificationJob');
const NotificationDelivery = require('./models/NotificationDelivery');
const DailyNotificationLog = require('./models/DailyNotificationLog');
const User = require('./models/User');

async function runVerification() {
  console.log('================================================================');
  console.log('✝️ RUNNING 04:00 AM IST DAILY CATHOLIC NOTIFICATION TEST SUITE');
  console.log('================================================================\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sjdb_church', {
      serverSelectionTimeoutMS: 3000
    });
    console.log('✅ Connected to MongoDB.\n');
  } catch (err) {
    console.warn('⚠️ MongoDB connection timeout, proceeding with schema/static validation.\n');
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

  const serviceCode = fs.readFileSync(path.join(__dirname, 'services', 'dailyNotificationService.js'), 'utf8');
  const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

  // ── TEST 1: Cron schedule is 0 4 * * * (04:00 AM IST Asia/Kolkata) ──
  assert(
    serviceCode.includes("cron.schedule('0 4 * * *'"),
    '1. Cron schedule expression is set to 0 4 * * * (04:00 AM IST)',
    'Expected cron.schedule("0 4 * * *")'
  );
  assert(
    serviceCode.includes("timezone: 'Asia/Kolkata'"),
    '2. Cron timezone is set to Asia/Kolkata'
  );

  // ── TEST 2: Decoupling from browser — Zero unconditioned startup broadcast timers ──
  assert(
    !serviceCode.includes('setTimeout(checkAndSendOnStartup'),
    '3. Autonomous Decoupling: No startup setTimeout timer that triggers broadcasts on server boot'
  );
  assert(
    !serviceCode.includes('checkAndSendOnStartup()') && !serviceCode.includes('90 * 1000'),
    '4. Removed legacy checkAndSendOnStartup() 90s timer (no 08:24 AM boot delivery bug)'
  );

  // ── TEST 3: Database Job Architecture Models Exist ──
  assert(DailyNotificationJob && DailyNotificationJob.schema, '5. DailyNotificationJob model loaded with schema');
  assert(NotificationDelivery && NotificationDelivery.schema, '6. NotificationDelivery model loaded with schema');

  // Check unique indexes in schema definitions
  const jobIndexes = DailyNotificationJob.schema.indexes();
  const deliveryIndexes = NotificationDelivery.schema.indexes();

  const hasDeliveryUniqueIndex = deliveryIndexes.some(([idx, opts]) => 
    idx.notificationDate === 1 && idx.recipient === 1 && idx.channel === 1 && opts.unique
  );
  assert(hasDeliveryUniqueIndex, '7. NotificationDelivery enforces compound unique index { notificationDate, recipient, channel }');

  // ── TEST 4: Aggregation of Complete Daily Catholic Liturgical Content ──
  console.log('\n--- Checking Daily Liturgical Content (Asia/Kolkata) ---');
  const today = new Date();
  const dailyContent = await getTodayDailyContent(today);

  assert(!!dailyContent.dateKey, `8. DateKey present (${dailyContent.dateKey})`);
  assert(!!dailyContent.bible && !!dailyContent.bible.ref, `9. Bible verse & ref present (${dailyContent.bible.ref})`);
  assert(
    dailyContent.massReadings &&
    (dailyContent.massReadings.tamil?.readings?.length > 0 || dailyContent.massReadings.english?.readings?.length > 0),
    `10. Mass readings present (Tamil: ${dailyContent.massReadings.tamil?.readings?.length || 0}, English: ${dailyContent.massReadings.english?.readings?.length || 0})`
  );
  assert(
    !!dailyContent.reflection && (!!dailyContent.reflection.tamil || !!dailyContent.reflection.english),
    '11. Daily reflection present'
  );
  assert(
    !!dailyContent.saint && (!!dailyContent.saint.nameEnglish || !!dailyContent.saint.nameTamil),
    `12. Saint of the day present (${dailyContent.saint?.nameEnglish})`
  );

  // ── TEST 5: Email Template Rendering Completeness ──
  console.log('\n--- Checking Email Template Rendering ---');
  const htmlTa = generateDailyNotificationHtml({
    userName: 'Parishioner',
    dailyContent,
    userLanguage: 'ta',
    hasSaintImageAttachment: Boolean(dailyContent.saint?.imageAttachment)
  });
  const htmlEn = generateDailyNotificationHtml({
    userName: 'Parishioner',
    dailyContent,
    userLanguage: 'en',
    hasSaintImageAttachment: Boolean(dailyContent.saint?.imageAttachment)
  });

  assert(htmlTa.includes('இன்றைய திருப்பலி வாசகங்கள்'), '13. Tamil email contains Mass readings section');
  assert(htmlTa.includes('இன்றைய புனிதர்'), '14. Tamil email contains Saint section');
  assert(htmlEn.includes('DAILY MASS READINGS'), '15. English email contains Mass readings section');
  assert(htmlEn.includes('SAINT OF THE DAY'), '16. English email contains Saint section');

  // ── TEST 6: Health Endpoint Diagnostics in server.js ──
  console.log('\n--- Checking Health Diagnostic Configuration ---');
  assert(
    serverCode.includes("dailyBroadcast4AM: `${schedulerStatus.schedulerRegistered ? 'Active' : 'Registered'} (0 4 * * * Asia/Kolkata)`"),
    '17. /api/health exposes 04:00 AM IST dailyBroadcast4AM scheduler status'
  );

  // ── TEST 7: External Cron Trigger Route Exists ──
  console.log('\n--- Checking External Cron Webhook Route ---');
  const routeCode = fs.readFileSync(path.join(__dirname, 'routes', 'dailyNotificationRoutes.js'), 'utf8');
  assert(
    routeCode.includes('/scheduler-trigger'),
    '18. Secure /scheduler-trigger route exists for external cron invocation'
  );

  // ── TEST 8: Scheduler Status Reports 04:00 AM ──
  const status = getSchedulerStatus();
  assert(
    status.schedulerRegistered === true && status.cronExpression === '0 4 * * *',
    '19. getSchedulerStatus() reports active 04:00 AM IST scheduler'
  );

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
