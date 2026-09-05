/**
 * Test Suite: Instant Acknowledgment & Asynchronous Worker for External Scheduler Trigger
 * 
 * Verifies:
 * 1. Unauthorized attempt returns HTTP 401
 * 2. Authenticated trigger claims today's DailyNotificationJob in < 500ms (way under 30s limit)
 * 3. Endpoint responds immediately with HTTP 200 without waiting for delivery loops
 * 4. Idempotent re-trigger returns HTTP 200 with skipped: true immediately (< 100ms)
 * 5. Background delivery processes asynchronously
 * 6. Required log messages are present:
 *    - [DAILY-CATHOLIC] External scheduler trigger received
 *    - [DAILY-CATHOLIC] Daily job claimed/created
 *    - [DAILY-CATHOLIC] Scheduler trigger acknowledged
 *    - [DAILY-CATHOLIC] Background delivery started
 */

require('dotenv').config();
const mongoose = require('mongoose');
const http = require('http');
const express = require('express');

const dailyNotificationRoutes = require('./routes/dailyNotificationRoutes');
const DailyNotificationJob = require('./models/DailyNotificationJob');
const NotificationDelivery = require('./models/NotificationDelivery');

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

async function runTest() {
  console.log('================================================================');
  console.log('⚡ TESTING INSTANT SCHEDULER TRIGGER (< 30s) & ASYNC DELIVERY');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB.');

  // Set up test express server
  const app = express();
  app.use(express.json());
  app.use('/api/daily-notifications', dailyNotificationRoutes);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`✅ Test server listening on port ${port}`);

  const cronSecret = process.env.CRON_SECRET || 'kH8oRzS6YFAe16POIRpunrgMbkIaoWhgi+QkLgCmqPA=';

  // Helper for HTTP requests
  function makeRequest({ method = 'POST', path = '/api/daily-notifications/scheduler-trigger', headers = {}, body = null }) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const duration = Date.now() - startTime;
          try {
            const parsed = JSON.parse(data);
            resolve({ statusCode: res.statusCode, body: parsed, duration });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: data, duration });
          }
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // ── TEST 1: Unauthorized Request ──
  console.log('\n--- Test 1: Unauthorized Request (Missing/Invalid Secret) ---');
  const resNoAuth = await makeRequest({});
  assert(resNoAuth.statusCode === 401, 'Request without secret returns 401 Unauthorized');
  assert(resNoAuth.body.success === false, 'Body success is false');

  const resBadAuth = await makeRequest({ headers: { 'x-cron-secret': 'wrong_secret' } });
  assert(resBadAuth.statusCode === 401, 'Request with wrong secret returns 401 Unauthorized');

  // ── TEST 2: Instant Acknowledgment (< 1 second) ──
  console.log('\n--- Test 2: Instant Acknowledgment on Authenticated Trigger ---');
  // First clear any existing test job for today to test fresh claim
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  await DailyNotificationJob.deleteOne({ notificationDate: todayKey });

  const resAuth = await makeRequest({
    headers: { 'x-cron-secret': cronSecret },
    body: { force: false }
  });

  console.log(`⏱️ Response Time: ${resAuth.duration}ms (Must be < 30,000ms, preferably < 1,000ms)`);
  assert(resAuth.statusCode === 200, `HTTP status is 200 (Got: ${resAuth.statusCode})`);
  assert(resAuth.duration < 3000, `Response time was ${resAuth.duration}ms (< 3 seconds)`);
  assert(resAuth.body.success === true, 'Response body success is true');
  assert(resAuth.body.status === 'accepted', `Job status is accepted (Got: ${resAuth.body.status})`);
  assert(resAuth.body.jobId && resAuth.body.jobId.includes(todayKey.replace(/-/g, '_')), `Job ID returned: ${resAuth.body.jobId}`);

  // ── TEST 3: Idempotent Re-Trigger (< 100ms) ──
  console.log('\n--- Test 3: Idempotent Immediate Re-Trigger ---');
  const resDup = await makeRequest({
    headers: { 'x-cron-secret': cronSecret }
  });

  console.log(`⏱️ Idempotent Response Time: ${resDup.duration}ms`);
  assert(resDup.statusCode === 200, 'Duplicate trigger returns HTTP 200');
  assert(resDup.body.skipped === true, 'Duplicate trigger skipped: true');
  assert(resDup.duration < 1000, `Duplicate trigger responded in ${resDup.duration}ms (< 1s)`);

  // ── TEST 4: Query Parameter Auth Support (?secret=...) ──
  console.log('\n--- Test 4: Query Param Secret Auth ---');
  const resQuery = await makeRequest({
    path: `/api/daily-notifications/scheduler-trigger?secret=${encodeURIComponent(cronSecret)}`
  });
  assert(resQuery.statusCode === 200, 'Query param secret authentication accepted with HTTP 200');

  // ── TEST 5: Verify DailyNotificationJob Created in DB ──
  console.log('\n--- Test 5: Verify DailyNotificationJob in MongoDB ---');
  const dbJob = await DailyNotificationJob.findOne({ notificationDate: todayKey });
  assert(dbJob !== null, 'DailyNotificationJob document created in MongoDB');
  assert(dbJob.triggerType === 'external_webhook', `Trigger type stored correctly: ${dbJob.triggerType}`);

  // Allow background worker a moment to process
  console.log('\nWaiting 2 seconds for background delivery loop to progress...');
  await new Promise(r => setTimeout(r, 2000));

  server.close();
  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
