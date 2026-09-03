/**
 * Verification Test: Phone Number Verification First Before Chatting Flow
 */

const mongoose = require('mongoose');
const { handleIncomingMessage, _clearDedupCacheForTesting } = require('./bot/botHandler');
const BotSession = require('./models/BotSession');
const User = require('./models/User');

async function runTests() {
  console.log('========================================================================');
  console.log('🧪 RUNNING PHONE VERIFICATION FIRST BEFORE CHATTING TEST SUITE');
  console.log('========================================================================\n');

  try {
    await mongoose.connect('mongodb://localhost:27017/sjdb_church', { serverSelectionTimeoutMS: 2000 });
  } catch (e) {
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

  const testPhone = '919555123456';
  const testJid = `${testPhone}@s.whatsapp.net`;

  // Step 0: Ensure fresh unverified session
  await BotSession.deleteOne({ phoneNumber: testPhone });
  _clearDedupCacheForTesting();

  // ── TEST 1: User sends "Hi" for the first time -> MUST prompt for Phone Verification ─────
  let capturedReplies = [];
  const originalSend = require('./bot/whatsapp').sendWhatsAppMessage;
  require('./bot/whatsapp').sendWhatsAppMessage = async (target, text) => {
    capturedReplies.push(text);
    return true;
  };

  await handleIncomingMessage(testPhone, 'Hi', testJid, 'New Visitor');

  assert(capturedReplies.length === 1, 'Received exactly 1 response to initial "Hi"');
  assert(capturedReplies[0].includes('Phone Number Verification'), 'Initial response contains "Phone Number Verification"');
  assert(capturedReplies[0].includes('10-digit mobile number'), 'Initial response asks for 10-digit mobile number');
  assert(!capturedReplies[0].includes('1️⃣ 📖 *Daily Bible*'), 'Main menu is NOT shown before verification');

  const sessionStep1 = await BotSession.findOne({ phoneNumber: testPhone });
  assert(sessionStep1.isVerified === false, 'Session isVerified is false');
  assert(sessionStep1.step === 'phone_verification', 'Session step is "phone_verification"');

  // ── TEST 2: User tries sending another question before verifying -> still prompts for verification ─────
  capturedReplies = [];
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, 'What time is Mass?', testJid, 'New Visitor');

  assert(capturedReplies.length === 1, 'Received response to unverified inquiry');
  assert(capturedReplies[0].includes('Phone Number Verification'), 'Unverified inquiry is gated by Phone Number Verification');

  // ── TEST 3: User sends their 10-digit mobile number -> Verifies and unlocks Main Menu ─────
  capturedReplies = [];
  _clearDedupCacheForTesting();
  const inputMobile = '9876543210';
  await handleIncomingMessage(testPhone, inputMobile, testJid, 'New Visitor');
  assert(capturedReplies.length === 1, 'Received verification acknowledgement and Preferences menu in 1 message');
  assert(capturedReplies[0].includes('Phone Number Verified!') || capturedReplies[0].includes('Phone number verified.'), 'Message confirms phone number verified');
  assert(capturedReplies[0].includes('SJDB Connect Preferences'), 'Message presents the Preferences Menu');
  assert(capturedReplies[0].includes('1️⃣ Daily Bible Verse'), 'Preferences menu includes "1️⃣ Daily Bible Verse"');
  assert(capturedReplies[0].includes('7️⃣ All of the above'), 'Preferences menu includes "7️⃣ All of the above"');

  const sessionStep2 = await BotSession.findOne({ phoneNumber: testPhone });
  assert(sessionStep2.isVerified === true, 'Session is now verified (isVerified: true)');
  assert(sessionStep2.providedPhone === '9876543210', 'Session providedPhone is saved as 9876543210');

  // Complete onboarding: select 7 (All) -> 2 (English) -> done
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, '7', testJid, 'New Visitor');
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, '2', testJid, 'New Visitor');

  // ── TEST 4: Verified User sends "Hi" -> Directly opens Main Menu without re-asking ─────
  capturedReplies = [];
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, 'Hi', testJid, 'New Visitor');

  assert(capturedReplies.length === 1, 'Verified user gets 1 response to "Hi"');
  assert(!capturedReplies[0].includes('Phone Number Verification'), 'Verified user is NOT asked for verification again');
  assert(capturedReplies[0].includes('Welcome to SJDB Connect!'), 'Verified user directly gets Main Menu');

  // ── TEST 5: Verified User asks questions (e.g. Mass Timings) -> Directly answered ─────
  capturedReplies = [];
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, '2', testJid, 'New Visitor');

  assert(capturedReplies.length === 1, 'Verified user selecting Option 2 gets Mass Timings');
  assert(capturedReplies[0].includes('Holy Mass Timings'), 'Option 2 returns Holy Mass Timings timetable');
  assert(capturedReplies[0].includes('https://st-jb-church.vercel.app/mass-timings'), 'Option 2 includes canonical URL');

  // ── TEST 6: User sends "VERIFY" -> Allows re-verification ─────────────────────
  capturedReplies = [];
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, 'VERIFY', testJid, 'New Visitor');

  assert(capturedReplies.length === 1, 'VERIFY command returns 1 response');
  assert(capturedReplies[0].includes('Phone Number Verification'), 'VERIFY command re-prompts for phone number');
  const sessionStep3 = await BotSession.findOne({ phoneNumber: testPhone });
  assert(sessionStep3.isVerified === false, 'Session isVerified reset to false');

  // Clean up
  await BotSession.deleteOne({ phoneNumber: testPhone });
  require('./bot/whatsapp').sendWhatsAppMessage = originalSend;

  console.log('\n========================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================');

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
