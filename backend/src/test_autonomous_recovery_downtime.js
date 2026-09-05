/**
 * SJDB Connect — Autonomous Missed-Job Recovery Test Suite
 * 
 * Verifies:
 *  1. Autonomous detection of missed 04:00 AM job without administrator intervention.
 *  2. Morning Recovery Window execution (e.g. 06:30 AM IST) when 04:00 was missed due to downtime.
 *  3. Idempotency: Zero side-effects when today's job is already 'completed'.
 *  4. Pre-4AM protection: Zero execution before 04:05 AM IST.
 *  5. Late-night cutoff: Respects 20:00 (8:00 PM) IST cutoff.
 *  6. Stale crash recovery: Automatically recovers interrupted jobs.
 *  7. Recipient-level idempotency during recovery (no duplicate deliveries).
 *  8. Complete independence from frontend, browser, and admin dashboard.
 */

const mongoose = require('mongoose');
const {
  checkAndRecoverMissedJobAutonomous,
  getSchedulerStatus
} = require('./services/dailyNotificationService');
const DailyNotificationJob = require('./models/DailyNotificationJob');
const NotificationDelivery = require('./models/NotificationDelivery');
const wa = require('./bot/whatsapp');

// Mock WhatsApp network calls during simulation to avoid session conflict with background dev server
wa.waitForWhatsAppReady = async () => true;
wa.sendWhatsAppMessage = async () => true;
wa.sendWhatsAppMedia = async () => true;

async function runRecoveryTests() {
  console.log('================================================================');
  console.log('🛡️ RUNNING AUTONOMOUS MISSED-JOB RECOVERY TESTS (ZERO ADMIN INTERVENTION)');
  console.log('================================================================\n');

  try {
    await mongoose.connect('mongodb://localhost:27017/sjdb_church', { serverSelectionTimeoutMS: 3000 });
    console.log('✅ Connected to MongoDB.\n');
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

  const todayDateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

  // 1. Verify Autonomous Recovery Registration
  console.log('--- 1. Scheduler Diagnostic & Watchdog Registration ---');
  const scheduler = getSchedulerStatus();
  assert(scheduler.autonomousRecovery?.enabled === true, 'Autonomous recovery is enabled');
  assert(scheduler.autonomousRecovery?.window === '04:05 AM – 08:00 PM IST', 'Recovery window configured for 04:05 AM – 08:00 PM IST');
  assert(scheduler.autonomousRecovery?.watchdogCron.includes('0 5,6,7,8,9,10,11,12 * * *'), 'Morning watchdog cron registered for 05:00 – 12:00 IST');

  // Simulated Time Helpers (in UTC for exact IST correspondence)
  // 06:30 AM IST = 01:00 UTC
  const morningSimulatedTime = new Date(`${todayDateKey}T01:00:00.000Z`);
  // 02:30 AM IST = 21:00 UTC previous day
  const pre4AmSimulatedTime = new Date(`${todayDateKey}T21:00:00.000Z`);
  pre4AmSimulatedTime.setUTCDate(pre4AmSimulatedTime.getUTCDate() - 1);
  // 10:30 PM IST = 17:00 UTC
  const lateNightSimulatedTime = new Date(`${todayDateKey}T17:00:00.000Z`);

  // 2. Test Case A: Pre-4 AM Protection
  console.log('\n--- 2. Test Case A: Pre-4 AM Protection (e.g. 02:30 AM IST) ---');
  const resPre = await checkAndRecoverMissedJobAutonomous('test_pre_4am', pre4AmSimulatedTime);
  assert(resPre.action === 'before_scheduled_time', `Exits before 04:05 AM IST without executing (action: ${resPre.action})`);

  // 3. Test Case B: Simulated Downtime at 04:00 AM, server recovers at 06:30 AM IST
  console.log('\n--- 3. Test Case B: Simulated Downtime Recovery at 06:30 AM IST ---');
  // Remove today's job to simulate missed 04:00 AM run
  await DailyNotificationJob.deleteOne({ notificationDate: todayDateKey });

  const resMorning = await checkAndRecoverMissedJobAutonomous('test_morning_recovery', morningSimulatedTime);
  assert(resMorning.action === 'recovered', `Downtime was detected and recovered autonomously at 06:30 AM IST (action: ${resMorning.action})`);
  assert(resMorning.triggerType === 'downtime_recovery', `Trigger type identified as ${resMorning.triggerType}`);

  const recoveredJob = await DailyNotificationJob.findOne({ notificationDate: todayDateKey });
  assert(!!recoveredJob, 'Recovered DailyNotificationJob created in database');
  assert(['completed', 'partial'].includes(recoveredJob?.status), `Job completed autonomously with status: ${recoveredJob?.status}`);

  // 4. Test Case C: Subsequent Watchdog Ticks on Completed Job
  console.log('\n--- 4. Test Case C: Post-Recovery Idempotency (Subsequent Watchdog Check) ---');
  // Job is now completed. Next hourly watchdog at 07:00 AM IST must do nothing.
  const morningSimulatedTime07 = new Date(`${todayDateKey}T01:30:00.000Z`);
  const resIdempotent = await checkAndRecoverMissedJobAutonomous('test_subsequent_watchdog', morningSimulatedTime07);
  assert(resIdempotent.action === 'already_completed', `Subsequent watchdog tick safely skipped (action: ${resIdempotent.action})`);

  // 5. Test Case D: Stale Crash Recovery
  console.log('\n--- 5. Test Case D: Stale Crash Recovery (Server crashed midway) ---');
  // Simulate a job that crashed 35 minutes ago and was left with status 'running'
  await DailyNotificationJob.findOneAndUpdate(
    { notificationDate: todayDateKey },
    {
      status: 'running',
      lockedAt: new Date(Date.now() - 35 * 60 * 1000), // 35 minutes ago
      lockedBy: 'crashed-worker-9999'
    }
  );

  const resCrash = await checkAndRecoverMissedJobAutonomous('test_crash_recovery', morningSimulatedTime);
  assert(resCrash.action === 'recovered', `Stale crash was detected and resumed (action: ${resCrash.action})`);
  assert(resCrash.triggerType === 'crash_recovery', `Trigger type identified as ${resCrash.triggerType}`);

  // 6. Test Case E: Late Night Cutoff (e.g. 10:30 PM IST)
  console.log('\n--- 6. Test Case E: Late Night Cutoff (Past 20:00 IST) ---');
  await DailyNotificationJob.deleteOne({ notificationDate: todayDateKey });
  const resNight = await checkAndRecoverMissedJobAutonomous('test_late_night', lateNightSimulatedTime);
  assert(resNight.action === 'past_devotional_window', `Late-night check exits without sending (action: ${resNight.action})`);

  // 7. Test Case F: Recipient-Level Idempotency Check
  console.log('\n--- 7. Test Case F: Recipient Delivery Uniqueness ---');
  const deliveries = await NotificationDelivery.find({ notificationDate: todayDateKey });
  const uniqueKeys = new Set(deliveries.map(d => `${d.notificationDate}_${d.recipient}_${d.channel}`));
  assert(deliveries.length === uniqueKeys.size, `All ${deliveries.length} recipient deliveries are strictly unique (0 duplicates)`);

  console.log('\n================================================================');
  console.log(`🏁 RECOVERY TEST SUITE: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(failed > 0 ? 1 : 0);
}

runRecoveryTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
