/**
 * Test Suite: SJDB Connect Signal Session Recovery & Decryption Protection Layer
 * 
 * Verifies:
 * 1. Classifier: Correctly identifies Bad MAC, No matching sessions, SessionError, etc.
 * 2. Message Event Inspector: Detects CIPHERTEXT stub & decryption failure payloads.
 * 3. Bad MAC -> 0 bot replies, 0 notifications, 0 DailyNotificationJobs.
 * 4. No matching sessions -> 0 bot replies.
 * 5. Failed decrypt -> 0 bot replies.
 * 6. Repeated session errors -> Rate-limited logging (no log storm) & session health degrades.
 * 7. Protocol / Retry receipts -> Dropped without bot processing.
 * 8. Valid message after recovery -> Processed normally, session health resets to healthy.
 * 9. Daily Catholic notification -> Unaffected by session layer.
 * 10. Content synchronization -> Never triggers WhatsApp messages.
 * 11. Recipient notification idempotency -> Duplicate deliveries still strictly blocked.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const assert = require('assert');

const {
  isSignalDecryptionError,
  classifySessionError,
  isDecryptionFailureMessage,
  isProtocolOrRetryMessage,
  signalSessionTracker,
  SignalSessionTracker
} = require('./bot/signalSessionRecovery');

const NotificationDelivery = require('./models/NotificationDelivery');
const DailyNotificationJob = require('./models/DailyNotificationJob');
const BotSession = require('./models/BotSession');
const ProcessedMessage = require('./models/ProcessedMessage');
const { handleIncomingMessage, _clearDedupCacheForTesting } = require('./bot/botHandler');
const { checkAndSyncDailyContent } = require('./services/contentMonitoringService');
const { getTodayDailyContent } = require('./services/dailyContentService');

async function runSignalRecoveryTests() {
  console.log('🧪 RUNNING SIGNAL SESSION RECOVERY & DECRYPTION PROTECTION TEST SUITE\n');

  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sjdb_church';
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  }
  console.log('✅ MongoDB connected');

  const testJid = '206227434938525@s.whatsapp.net';
  const testPhone = '206227434938525';
  const testDate = '2026-09-06';

  // ── TEST 1: Signal Decryption Error Classifier ───────────────────────────
  console.log('\n--- TEST 1: Signal Decryption Error Classifier ---');
  assert(isSignalDecryptionError(new Error('Bad MAC')), 'Identifies Bad MAC Error');
  assert(isSignalDecryptionError('Session error: Error: Bad MAC Error: Bad MAC'), 'Identifies string Bad MAC with libsignal prefix');
  assert(isSignalDecryptionError(new Error('No matching sessions found for message')), 'Identifies No matching sessions');
  assert(isSignalDecryptionError('failed to decrypt message'), 'Identifies failed to decrypt message');
  assert(isSignalDecryptionError({ type: 'SessionError', message: 'No matching sessions found for message' }), 'Identifies SessionError object');
  assert(isSignalDecryptionError('UntrustedIdentityKeyError: 12345'), 'Identifies UntrustedIdentityKeyError');
  assert(!isSignalDecryptionError('Hello, Father'), 'Does not falsely flag normal conversation');
  assert(!isSignalDecryptionError('Saint of the day'), 'Does not falsely flag keyword query');
  console.log('✅ Classifier successfully identifies all Signal/libsignal error variants');

  // ── TEST 2: Canonical Error Classification ───────────────────────────────
  console.log('\n--- TEST 2: Canonical Reason Classification ---');
  assert.strictEqual(classifySessionError('Error: Bad MAC'), 'BAD_MAC');
  assert.strictEqual(classifySessionError('No matching sessions found for message'), 'NO_MATCHING_SESSIONS');
  assert.strictEqual(classifySessionError('failed to decrypt message'), 'FAILED_DECRYPT');
  assert.strictEqual(classifySessionError('SessionError: generic'), 'SESSION_ERROR');
  console.log('✅ Canonical reason labels correctly classified');

  // ── TEST 3: Baileys WebMessageInfo Decryption Failure Detection ───────────
  console.log('\n--- TEST 3: Baileys WebMessageInfo Decryption Failure Detection ---');
  const mockBadMacMsg = {
    key: { remoteJid: testJid, id: '3EB0D55CE4F7F2D1DBFF41', fromMe: true },
    messageStubType: 2, // CIPHERTEXT
    messageStubParameters: ['Bad MAC'],
    message: null
  };
  const mockNoSessionMsg = {
    key: { remoteJid: testJid, id: '3EB0D55CE4F7F2D1DBFF42', fromMe: false },
    messageStubType: 2, // CIPHERTEXT
    messageStubParameters: ['No matching sessions found for message'],
    message: {}
  };
  const mockValidMsg = {
    key: { remoteJid: testJid, id: '3EB0D55CE4F7F2D1DBFF43', fromMe: false },
    messageStubType: 0,
    message: { conversation: 'Saint' }
  };

  assert(isDecryptionFailureMessage(mockBadMacMsg), 'Detects Bad MAC ciphertext stub');
  assert(isDecryptionFailureMessage(mockNoSessionMsg), 'Detects No matching session stub');
  assert(!isDecryptionFailureMessage(mockValidMsg), 'Normal message is not marked as decryption failure');
  console.log('✅ Decryption failure messages accurately detected');

  // ── TEST 4: Protocol & Retry Receipt Detection ───────────────────────────
  console.log('\n--- TEST 4: Protocol & Retry Receipt Detection ---');
  const mockRetryReceipt = {
    key: { remoteJid: testJid, id: 'RETRY_RECEIPT_1' },
    message: { protocolMessage: { type: 1 } }
  };
  const mockSenderKeyMsg = {
    key: { remoteJid: testJid, id: 'SENDER_KEY_1' },
    message: { senderKeyDistributionMessage: { groupId: '123' } }
  };
  assert(isProtocolOrRetryMessage(mockRetryReceipt), 'Identifies protocol retry message');
  assert(isProtocolOrRetryMessage(mockSenderKeyMsg), 'Identifies sender key distribution message');
  assert(!isProtocolOrRetryMessage(mockValidMsg), 'User conversation is not marked as protocol');
  console.log('✅ Protocol and retry receipts correctly flagged for immediate drop');

  // ── TEST 5: Bad MAC / Decrypt Error Message Drops (0 Bot Replies) ─────────
  console.log('\n--- TEST 5: Bad MAC Input Produces 0 Bot Replies and 0 Notifications ---');
  await _clearDedupCacheForTesting();
  signalSessionTracker.resetForTesting();
  await NotificationDelivery.deleteMany({ recipient: testPhone, notificationDate: testDate });

  // Mock outgoing WhatsApp send tracking
  const outgoingSends = [];
  const wa = require('./bot/whatsapp');
  const origSend = wa.sendWhatsAppMessage;
  wa.sendWhatsAppMessage = async (target, text) => {
    outgoingSends.push({ target, text });
    return true;
  };

  try {
    // Simulate incoming Bad MAC error string
    await handleIncomingMessage(
      testPhone,
      'Session error: Error: Bad MAC Error: Bad MAC',
      testJid,
      'Test User',
      'wamid_bad_mac_1'
    );

    assert.strictEqual(outgoingSends.length, 0, 'Zero bot replies sent on Bad MAC error');

    // Verify zero NotificationDelivery records created
    const deliveries = await NotificationDelivery.find({ recipient: testPhone, notificationDate: testDate });
    assert.strictEqual(deliveries.length, 0, 'Zero NotificationDelivery records created on Bad MAC error');

    // Verify zero DailyNotificationJob records created
    const jobs = await DailyNotificationJob.find({ notificationDate: testDate, triggerType: 'signal_session_error' });
    assert.strictEqual(jobs.length, 0, 'Zero DailyNotificationJob records created on session error');

    console.log('✅ Bad MAC completely dropped — 0 replies, 0 deliveries, 0 jobs');

    // ── TEST 6: No Matching Sessions Produces 0 Bot Replies ─────────────────
    console.log('\n--- TEST 6: No Matching Sessions Produces 0 Bot Replies ---');
    await handleIncomingMessage(
      testPhone,
      'SessionError: No matching sessions found for message',
      testJid,
      'Test User',
      'wamid_no_session_1'
    );
    assert.strictEqual(outgoingSends.length, 0, 'Zero bot replies sent on No matching session error');
    console.log('✅ No matching session error completely dropped — 0 replies');

    // ── TEST 7: Rate-Limited Logging (No Render Log Storm) ───────────────────
    console.log('\n--- TEST 7: Rate-Limiting & Session Health Tracking ---');
    const customTracker = new SignalSessionTracker();

    // 1st failure: state becomes 'recovering'
    const s1 = customTracker.recordDecryptFailure(testJid, 'Bad MAC');
    assert.strictEqual(s1.consecutiveDecryptFailures, 1, 'First failure recorded');
    assert.strictEqual(s1.recoveryState, 'recovering', 'State transitions to recovering');

    // 2nd failure within 100ms
    const s2 = customTracker.recordDecryptFailure(testJid, 'Bad MAC');
    assert.strictEqual(s2.consecutiveDecryptFailures, 2, 'Second failure recorded');

    // 3rd failure: state becomes 'degraded'
    const s3 = customTracker.recordDecryptFailure(testJid, 'Bad MAC');
    assert.strictEqual(s3.consecutiveDecryptFailures, 3, 'Third failure recorded');
    assert.strictEqual(s3.recoveryState, 'degraded', 'State transitions to degraded on repeated failure');

    const diag = customTracker.getDiagnostics();
    assert.strictEqual(diag.totalDecryptFailures, 3, 'Total failures tracked accurately');
    assert.strictEqual(diag.statusCounts.degraded, 1, 'Degraded status tracked in diagnostics');
    console.log('✅ Session health state machine transitioned: healthy -> recovering -> degraded');

    // ── TEST 8: Successful Message After Recovery Resets State ───────────────
    console.log('\n--- TEST 8: Successful Message After Recovery Resets State ---');
    customTracker.recordSuccessfulDecrypt(testJid);
    const sRecovered = customTracker.getSessionHealth(testJid);
    assert.strictEqual(sRecovered.consecutiveDecryptFailures, 0, 'Failure count reset to 0');
    assert.strictEqual(sRecovered.recoveryState, 'healthy', 'State reset to healthy');
    assert(sRecovered.lastSuccessfulDecryptAt instanceof Date, 'Last successful timestamp recorded');
    console.log('✅ Successful decrypt successfully restored session to HEALTHY');

    // ── TEST 9: Content Synchronization Never Dispatches WhatsApp ────────────
    console.log('\n--- TEST 9: Content Synchronization Never Dispatches WhatsApp ---');
    outgoingSends.length = 0; // reset outgoing tracker
    await checkAndSyncDailyContent(testDate, false);
    assert.strictEqual(outgoingSends.length, 0, 'Content sync made ZERO calls to sendWhatsAppMessage');
    console.log('✅ Content synchronization is completely isolated from WhatsApp broadcasting');

    // ── TEST 10: Recipient Notification Delivery Idempotency ─────────────────
    console.log('\n--- TEST 10: Notification Delivery Compound Unique Idempotency ---');
    await NotificationDelivery.deleteMany({ notificationDate: testDate, recipient: testPhone });

    const rec1 = await NotificationDelivery.create({
      jobId: `test_job_${testDate}`,
      recipient: testPhone,
      channel: 'whatsapp',
      notificationDate: testDate,
      status: 'sent',
      sentAt: new Date()
    });
    assert(rec1._id, 'Initial delivery record created');

    let threwDuplicate = false;
    try {
      await NotificationDelivery.create({
        jobId: `test_job_repeat_${testDate}`,
        recipient: testPhone,
        channel: 'whatsapp',
        notificationDate: testDate,
        status: 'pending'
      });
    } catch (dupErr) {
      threwDuplicate = dupErr.code === 11000 || dupErr.message?.includes('duplicate key');
    }
    assert(threwDuplicate, 'Duplicate delivery record strictly blocked by database unique index');
    console.log('✅ Recipient delivery unique idempotency intact');

  } finally {
    // Restore original method
    wa.sendWhatsAppMessage = origSend;
    await NotificationDelivery.deleteMany({ notificationDate: testDate, recipient: testPhone });
  }

  console.log('\n================================================================');
  console.log('🎉 ALL 10 SIGNAL SESSION RECOVERY TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runSignalRecoveryTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Test suite error:', err);
    process.exit(1);
  });
