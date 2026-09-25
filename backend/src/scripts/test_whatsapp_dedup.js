/**
 * Automated Verification Script: WhatsApp Bot Deduplication & Smart Reply System
 * Tests all scenarios required by the SJDB Connect specification.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

// Mock WhatsApp module to record all outbound sends safely
const outboundMessages = [];
const outboundMedia = [];

const mockWa = {
  sendWhatsAppMessage: async (recipient, text) => {
    outboundMessages.push({ recipient, text, sentAt: new Date() });
    return true;
  },
  sendWhatsAppMedia: async (recipient, media) => {
    outboundMedia.push({ recipient, media, sentAt: new Date() });
    return true;
  },
  getConnectionStatus: () => ({ connected: true, status: 'connected' })
};

// Override require cache for bot/whatsapp
const waPath = require.resolve('../bot/whatsapp');
require.cache[waPath] = {
  id: waPath,
  filename: waPath,
  loaded: true,
  exports: mockWa
};

// Override require cache for config/mailer to run test without SMTP timeouts
const mailerPath = require.resolve('../config/mailer');
require.cache[mailerPath] = {
  id: mailerPath,
  filename: mailerPath,
  loaded: true,
  exports: {
    sendMail: async () => ({ success: true, messageId: 'mock-email-123' })
  }
};

const User = require('../models/User');
const BotSession = require('../models/BotSession');
const ProcessedMessage = require('../models/ProcessedMessage');
const DailyNotificationLog = require('../models/DailyNotificationLog');
const SiteSettings = require('../models/SiteSettings');

const { sendDailyChurchNotifications, getDailyNotificationStatus, checkAndSendOnStartup } = require('../services/dailyNotificationService');
const { handleIncomingMessage, resetBotCachesAndSessions } = require('../bot/botHandler');
const { getISTDateParts } = require('../services/saintService');

async function runTests() {
  console.log('🧪 Starting SJDB Connect WhatsApp Deduplication Test Suite...\n');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/sjdb_church';
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB for testing.');
  }

  const todayIst = getISTDateParts(new Date()).dateKey;
  const testPhone = '919876543210';
  const testPhone10 = '9876543210';

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Clean test state
    await resetBotCachesAndSessions();
    await DailyNotificationLog.deleteMany({ dateKey: todayIst });
    await ProcessedMessage.deleteMany({});
    await SiteSettings.deleteOne({ key: `daily_broadcast_lock_${todayIst}` });

    // ── SCENARIO 1: Normal Daily Broadcast Deduplication ───────────────────────
    console.log('\n--- Scenario 1: Normal Daily Broadcast Deduplication ---');
    // Create a registered user and an overlapping bot session
    const existingUser = await User.findOneAndUpdate(
      { phone: `+91/${testPhone10}` },
      {
        name: 'Test Parishioner',
        phone: `+91/${testPhone10}`,
        email: 'testparish@sjdb.church',
        isActive: true,
        whatsappOptIn: true,
        mass_reflection_language: 'ta',
        readingPreference: 'full',
        sendLinks: true
      },
      { upsert: true, new: true }
    );

    // Overlapping bot session with JID format
    await BotSession.findOneAndUpdate(
      { phoneNumber: `${testPhone}@s.whatsapp.net` },
      {
        phoneNumber: `${testPhone}@s.whatsapp.net`,
        step: 'done',
        isOnboarded: true,
        linkedUserId: existingUser._id,
        language: 'ta'
      },
      { upsert: true, new: true }
    );

    outboundMessages.length = 0;
    outboundMedia.length = 0;

    // First broadcast run
    const run1 = await sendDailyChurchNotifications({ force: false });
    assert(run1.success === true, 'First broadcast execution succeeded');
    const userDeliveriesRun1 = outboundMessages.filter(m => m.recipient.includes(testPhone10));
    const userMediaRun1 = outboundMedia.filter(m => m.recipient.includes(testPhone10));

    assert(userDeliveriesRun1.length === 4, `4 separate text messages sent to user (got ${userDeliveriesRun1.length})`);
    assert(userMediaRun1.length === 2, `2 separate media messages sent to user (Verse Image & Saint Image) (got ${userMediaRun1.length})`);

    // Verify exact content of each separated message in strict order
    assert(userMediaRun1[0].media && (userMediaRun1[0].media.buffer || userMediaRun1[0].media.url), 'Stage 1 is Daily Bible Verse Image');
    assert(userDeliveriesRun1[0].text.includes('Mass Readings') || userDeliveriesRun1[0].text.includes('திருப்பலி வாசகங்கள்'), 'Stage 2 is Daily Mass Readings');
    assert(userDeliveriesRun1[1].text.includes('DAILY REFLECTION') || userDeliveriesRun1[1].text.includes('இன்றைய தியானம்'), 'Stage 3 is Daily Reflection');
    assert(userMediaRun1[1].media, 'Stage 4 is Saint of the Day Image');
    assert(userDeliveriesRun1[2].text.includes('Saint of the Day') || userDeliveriesRun1[2].text.includes('இன்றைய புனிதர்'), 'Stage 5 is Saint of the Day Content');
    assert(userDeliveriesRun1[3].text.includes('Read More') || userDeliveriesRun1[3].text.includes('மேலும் வாசிக்க'), 'Stage 6 is Read More Link');

    // Verify DB delivery log
    const log1 = await DailyNotificationLog.find({ dateKey: todayIst, recipientPhone10: testPhone10 });
    assert(log1.length === 1, `Exactly 1 DailyNotificationLog created for phone10 (found ${log1.length})`);
    assert(log1[0].status === 'sent', `Log status is 'sent'`);
    assert(log1[0].channels?.whatsapp?.messagesSent?.length >= 4, `Delivery log records all stages: ${log1[0].channels?.whatsapp?.messagesSent?.join(', ')}`);

    // Second broadcast run (should skip duplicate)
    const run2 = await sendDailyChurchNotifications({ force: false });
    assert(run2.skippedCount >= 1 || run2.skipped === true, 'Second broadcast execution skipped existing delivery');
    const log2 = await DailyNotificationLog.find({ dateKey: todayIst, recipientPhone10: testPhone10 });
    assert(log2.length === 1, 'Still exactly 1 DailyNotificationLog in DB after 2nd run');

    // ── SCENARIO 2: Server Restart / Startup Check ─────────────────────────────
    console.log('\n--- Scenario 2: Server Restart / Startup Check ---');
    const startupRes = await checkAndSendOnStartup();
    assert(startupRes && startupRes.skipped === true, 'Startup check detected existing deliveries and skipped duplicate broadcast');

    // ── SCENARIO 3: Duplicate Cron / Concurrent Execution ──────────────────────
    console.log('\n--- Scenario 3: Duplicate Cron / Concurrent Execution ---');
    // Test atomic unique constraint by simulating concurrent inserts on the same idempotencyKey
    const testIdempotencyKey = `daily-catholic:${todayIst}:concurrent-test`;
    let claim1Success = false;
    let claim2Success = false;

    try {
      await DailyNotificationLog.create({
        idempotencyKey: testIdempotencyKey,
        dateKey: todayIst,
        recipientPhone10: '1111111111',
        status: 'claiming'
      });
      claim1Success = true;
    } catch (e) {
      claim1Success = false;
    }

    try {
      await DailyNotificationLog.create({
        idempotencyKey: testIdempotencyKey,
        dateKey: todayIst,
        recipientPhone10: '1111111111',
        status: 'claiming'
      });
      claim2Success = true;
    } catch (e) {
      claim2Success = false; // Expected: duplicate key error E11000
    }

    assert(claim1Success === true && claim2Success === false, 'Atomic unique constraint on idempotencyKey prevented concurrent double claim');
    await DailyNotificationLog.deleteOne({ idempotencyKey: testIdempotencyKey });

    // ── SCENARIO 4: Duplicate Incoming WhatsApp Message ID ─────────────────────
    console.log('\n--- Scenario 4: Duplicate Incoming WhatsApp Message ID ---');
    outboundMessages.length = 0;
    const testMsgId = `BAILEYS_MSG_${Date.now()}`;

    // Send first event
    await handleIncomingMessage(testPhone, 'hello', null, 'Test Parishioner', testMsgId);
    const repliesAfterFirst = outboundMessages.length;
    assert(repliesAfterFirst === 1, `First incoming message processed (replies: ${repliesAfterFirst})`);

    // Send duplicate event with same messageId
    await handleIncomingMessage(testPhone, 'hello', null, 'Test Parishioner', testMsgId);
    const repliesAfterSecond = outboundMessages.length;
    assert(repliesAfterSecond === repliesAfterFirst, `Duplicate message ID immediately dropped (no second reply, total replies: ${repliesAfterSecond})`);

    const processedRecord = await ProcessedMessage.findOne({ messageId: testMsgId });
    assert(processedRecord !== null, 'Message ID successfully persisted in ProcessedMessage collection');

    // ── SCENARIO 5: Explicit User Requests & No Unnecessary Chaining ────────────
    console.log('\n--- Scenario 5: Explicit User Requests & No Unnecessary Chaining ---');
    outboundMessages.length = 0;
    outboundMedia.length = 0;

    // Explicit request for today's Bible verse (image only)
    await handleIncomingMessage(testPhone, "Today's Bible Verse", null, 'Test Parishioner', `MSG_VERSE_1_${Date.now()}`);
    assert(outboundMedia.length === 1, 'Responded to explicit Bible verse request with 1 image');
    assert(outboundMessages.length === 0, 'Did not send text messages when verse image was requested');

    // User explicitly requests the verse AGAIN
    const countBeforeSecondVerse = outboundMedia.length;
    await handleIncomingMessage(testPhone, "Send today's Bible verse again", null, 'Test Parishioner', `MSG_VERSE_2_${Date.now()}`);
    const countAfterSecondVerse = outboundMedia.length;
    assert(countAfterSecondVerse > countBeforeSecondVerse, 'Permitted repeated Bible verse because it was explicitly requested again');

    // Explicit request for Mass readings (text only)
    outboundMessages.length = 0;
    outboundMedia.length = 0;
    await handleIncomingMessage(testPhone, "Today's Mass Readings", null, 'Test Parishioner', `MSG_READ_1_${Date.now()}`);
    const readingsReply = outboundMessages[outboundMessages.length - 1]?.text || '';
    assert(readingsReply.includes('வாசகங்கள்') || readingsReply.includes('Mass Readings'), 'Responded specifically to Mass readings request without unnecessary chaining');
    assert(outboundMedia.length === 0, 'Did NOT send media for Mass readings');

    // Explicit request for Daily Reflection (text only)
    outboundMessages.length = 0;
    outboundMedia.length = 0;
    await handleIncomingMessage(testPhone, "Daily Reflection", null, 'Test Parishioner', `MSG_REFL_1_${Date.now()}`);
    const reflReply = outboundMessages[outboundMessages.length - 1]?.text || '';
    assert(reflReply.includes('DAILY REFLECTION') || reflReply.includes('இன்றைய தியானம்'), 'Responded specifically to Daily Reflection request');
    assert(!reflReply.includes('First Reading') && !reflReply.includes('முதல் வாசகம்'), 'Did NOT chain Mass readings to reflection');
    assert(outboundMedia.length === 0, 'Did NOT send media for Daily Reflection');

    // Explicit request for Saint of the Day (Image + Content)
    outboundMessages.length = 0;
    outboundMedia.length = 0;
    await handleIncomingMessage(testPhone, "Saint of the Day", null, 'Test Parishioner', `MSG_SAINT_1_${Date.now()}`);
    assert(outboundMedia.length === 1, 'Sent Saint Image for Saint request');
    assert(outboundMessages.length === 1 && (outboundMessages[0].text.includes('Saint') || outboundMessages[0].text.includes('புனிதர்')), 'Sent Saint Content for Saint request');

    // ── SCENARIO 6: Invalid Input Streak Policy ────────────────────────────────
    console.log('\n--- Scenario 6: Invalid Input Streak Policy ---');
    outboundMessages.length = 0;
    const sessionToTest = await BotSession.findOne({ phoneNumber: testPhone });
    if (sessionToTest) {
      sessionToTest.invalidInputStreak = 0;
      await sessionToTest.save();
    }

    // Invalid input 1
    await handleIncomingMessage(testPhone, 'xyz789_unknown_input', null, 'Test Parishioner', `MSG_INV_1_${Date.now()}`);
    const invReply1 = outboundMessages[outboundMessages.length - 1]?.text || '';
    assert(!invReply1.includes('1️⃣ 📖 Daily Bible Verse') && (invReply1.includes('அடையாளம் காண முடியவில்லை') || invReply1.includes("didn't recognize")), 'Invalid input 1 gave concise error without dumping full main menu');

    // Invalid input 2
    await handleIncomingMessage(testPhone, 'another_bad_command', null, 'Test Parishioner', `MSG_INV_2_${Date.now()}`);
    const invReply2 = outboundMessages[outboundMessages.length - 1]?.text || '';
    assert(invReply2.includes('வழிகாட்டல்') || invReply2.includes('Guidance'), 'Invalid input 2 gave guidance without dumping menu');

    // Invalid input 3
    await handleIncomingMessage(testPhone, 'third_bad_command', null, 'Test Parishioner', `MSG_INV_3_${Date.now()}`);
    const invReply3 = outboundMessages[outboundMessages.length - 1]?.text || '';
    assert(invReply3.includes('+91 96556 39144') || invReply3.includes('Help'), 'Invalid input 3 provided office help contact and capped repetition');

    // Valid command resets streak
    await handleIncomingMessage(testPhone, '2', null, 'Test Parishioner', `MSG_VALID_RESET_${Date.now()}`);
    const sessionAfterReset = await BotSession.findOne({ phoneNumber: testPhone });
    assert(sessionAfterReset.invalidInputStreak === 0, 'Entering valid command successfully reset invalidInputStreak to 0');

    // ── SCENARIO 7: Existing User Greeting (No Onboarding Restart) ──────────────
    console.log('\n--- Scenario 7: Existing User Greeting ---');
    outboundMessages.length = 0;
    await handleIncomingMessage(testPhone, 'HI', null, 'Test Parishioner', `MSG_GREET_${Date.now()}`);
    const greetingReply = outboundMessages[outboundMessages.length - 1]?.text || '';
    assert(!greetingReply.includes('OTP') && !greetingReply.includes('Step 1') && !greetingReply.includes('Choose your preferred language'), 'Did not restart onboarding or ask for OTP for existing user');
    assert(greetingReply.includes('வணக்கம்') || greetingReply.includes('Hello'), 'Delivered polite personalized greeting');
    assert(!greetingReply.includes('1️⃣ 📖 Daily Bible Verse') && !greetingReply.includes('Quick Commands'), 'Did NOT flood chat with full Main Menu on simple "HI"');

    // ── SCENARIO 8: Admin Dashboard Refresh Safety ─────────────────────────────
    console.log('\n--- Scenario 8: Admin Dashboard Refresh Safety ---');
    outboundMessages.length = 0;
    const statusBefore = await getDailyNotificationStatus();
    assert(statusBefore.success === true, 'Admin status call succeeded');
    assert(outboundMessages.length === 0, 'Admin status / refresh call triggered ZERO outbound messages or broadcasts');

    // ── SUMMARY ────────────────────────────────────────────────────────────────
    console.log('\n========================================');
    console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test execution error:', err);
    process.exit(1);
  }
}

runTests();
