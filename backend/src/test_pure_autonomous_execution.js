/**
 * SJDB Connect — Autonomous 04:00 AM Production Simulation Test
 * 
 * Simulates:
 *  - Browser CLOSED
 *  - Website CLOSED
 *  - Admin CLOSED
 *  - No "Broadcast Now" button clicked
 *  - Pure autonomous invocation of 04:00 AM IST scheduler mechanism
 */

const mongoose = require('mongoose');
const { sendDailyChurchNotifications, getSchedulerStatus } = require('./services/dailyNotificationService');
const DailyNotificationJob = require('./models/DailyNotificationJob');
const NotificationDelivery = require('./models/NotificationDelivery');

async function runAutonomousSimulation() {
  console.log('================================================================');
  console.log('🤖 SIMULATING 04:00 AM AUTONOMOUS DISPATCH (ZERO BROWSER / ZERO ADMIN)');
  console.log('================================================================\n');

  try {
    await mongoose.connect('mongodb://localhost:27017/sjdb_church', { serverSelectionTimeoutMS: 3000 });
    console.log('✅ Connected to MongoDB.');
  } catch (err) {
    console.warn('⚠️ MongoDB connection notice:', err.message);
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      if (details) console.error(`   Details: ${details}`);
      failed++;
    }
  }

  // 1. Verify Scheduler Configuration
  const scheduler = getSchedulerStatus();
  assert(scheduler.schedulerRegistered === true, 'Scheduler is active and registered');
  assert(scheduler.cronExpression === '0 4 * * *', 'Cron expression is 0 4 * * *');
  assert(scheduler.timezone === 'Asia/Kolkata', 'Timezone is strictly Asia/Kolkata');
  assert(scheduler.scheduleTime === '04:00 AM IST', 'Schedule time is 04:00 AM IST');

  // 2. Invoke Autonomous 04:00 AM Scheduler Trigger
  console.log('\n--- 2. Triggering Autonomous Scheduler Run ---');
  const run1 = await sendDailyChurchNotifications({
    triggerType: 'cron_scheduler',
    force: true // Allow fresh run for test
  });

  assert(run1.success === true, 'Autonomous 04:00 AM job executed successfully', JSON.stringify(run1));
  assert(!!run1.jobId, `Job ID generated: ${run1.jobId}`);
  assert(!!run1.dateKey, `Date key resolved: ${run1.dateKey}`);

  // 3. Verify Database Job State
  console.log('\n--- 3. Verifying Database Records ---');
  const jobRecord = await DailyNotificationJob.findOne({ notificationDate: run1.dateKey });
  assert(!!jobRecord, 'DailyNotificationJob record exists in database');
  if (jobRecord) {
    assert(jobRecord.triggerType === 'cron_scheduler', `Trigger type recorded as ${jobRecord.triggerType}`);
    assert(['completed', 'partial', 'running'].includes(jobRecord.status), `Job status valid: ${jobRecord.status}`);
    assert(jobRecord.logs.length > 0, `Audit logs present (${jobRecord.logs.length} entries)`);
    assert(!!jobRecord.lockedBy, `Locked by worker ID: ${jobRecord.lockedBy}`);
  }

  // 4. Verify Idempotency on Second Invocations (Simulating duplicate trigger / double-cron)
  console.log('\n--- 4. Testing Duplicate Trigger Idempotency ---');
  const run2 = await sendDailyChurchNotifications({
    triggerType: 'cron_scheduler',
    force: false // Normal operational mode
  });

  assert(run2.success === true, 'Duplicate run handled gracefully');
  assert(run2.skipped === true, 'Duplicate run was SKIPPED by idempotency guard');
  assert(run2.reason === 'already_completed' || run2.reason === 'already_running', `Skip reason: ${run2.reason}`);

  // 5. Verify NotificationDelivery Compound Index
  console.log('\n--- 5. Verifying Recipient-Level Idempotency ---');
  const deliveries = await NotificationDelivery.find({ notificationDate: run1.dateKey });
  console.log(`Found ${deliveries.length} recipient delivery records for ${run1.dateKey}.`);

  // Verify no duplicates exist in deliveries
  const seenKeys = new Set();
  let hasDuplicate = false;
  for (const d of deliveries) {
    const key = `${d.notificationDate}_${d.recipient}_${d.channel}`;
    if (seenKeys.has(key)) {
      hasDuplicate = true;
      break;
    }
    seenKeys.add(key);
  }
  assert(!hasDuplicate, 'Zero duplicate delivery records across (notificationDate + recipient + channel)');

  console.log('\n================================================================');
  console.log(`🏁 SIMULATION COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(failed > 0 ? 1 : 0);
}

runAutonomousSimulation().catch(err => {
  console.error('Simulation error:', err);
  process.exit(1);
});
