const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');
const BotSession = require('../src/models/BotSession');
const whatsapp = require('../src/bot/whatsapp');
const { handleIncomingMessage, _clearDedupCacheForTesting } = require('../src/bot/botHandler');

async function runTests() {
  console.log('--- 🧪 STARTING STRICT ONBOARDING GATE TESTS ---');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sjdb_church');

  // Backfill admin user NIVESH ARN
  await User.updateMany({ role: { $in: ['admin', 'priest'] } }, {
    dailyCatholicSetupCompleted: true,
    dailyCatholicSubscribed: true,
    dailyCatholicLanguage: 'english'
  });
  console.log('✅ Admin users backfilled with dailyCatholicSetupCompleted: true, dailyCatholicSubscribed: true, dailyCatholicLanguage: english');

  const testPhone = '919999988888';
  const testPhoneFormatted = `${testPhone}@s.whatsapp.net`;

  // Clean previous test data
  await BotSession.deleteMany({ phoneNumber: { $in: [testPhoneFormatted, testPhone] } });
  await User.deleteOne({ phone: '9999988888' });

  let sentMessages = [];
  whatsapp.sendWhatsAppMessage = async (to, text) => {
    sentMessages.push({ to, text });
    return true;
  };
  whatsapp.sendWhatsAppMedia = async (to, media) => {
    sentMessages.push({ to, media });
    return true;
  };

  // Helper to simulate incoming bot message
  async function simulateMsg(text) {
    sentMessages = [];
    await _clearDedupCacheForTesting();
    await handleIncomingMessage(
      testPhoneFormatted,
      text,
      testPhoneFormatted,
      'Tester',
      `TEST_${Date.now()}_${Math.floor(Math.random() * 100000)}`
    );
    return sentMessages;
  }

  // 1. User sends "Hi" -> starts onboarding flow at Step 1 (Bot Language)
  console.log('\n[TEST 1] User sends "Hi"');
  let replies = await simulateMsg('Hi');
  let session = await BotSession.findOne({ phoneNumber: { $in: [testPhoneFormatted, testPhone] } });
  console.assert(session.step === 'bot_language', `Expected step bot_language, got ${session.step}`);
  console.assert(session.dailyCatholicSetupCompleted === false, 'Expected dailyCatholicSetupCompleted false');
  console.assert(session.dailyCatholicSubscribed === false, 'Expected dailyCatholicSubscribed false');
  console.log('✅ Bot answered with Step 1 prompt. Session step: bot_language');

  // 2. Verify daily Catholic eligibility check strictly excludes this pending user
  let rawUsers = await User.find({
    isActive: { $ne: false },
    dailyCatholicSetupCompleted: true,
    dailyCatholicSubscribed: true,
    dailyCatholicLanguage: { $in: ['english', 'tamil', 'both', 'en', 'ta'] }
  }).lean();
  let rawSessions = await BotSession.find({
    step: 'done',
    isOnboarded: true,
    dailyCatholicSetupCompleted: true,
    dailyCatholicSubscribed: true,
    dailyCatholicLanguage: { $in: ['english', 'tamil', 'both', 'en', 'ta'] }
  }).lean();
  console.assert(!rawSessions.some(s => s.phoneNumber === testPhoneFormatted || s.phoneNumber === testPhone), 'Pending user must NOT be in daily scheduler sessions query');
  console.log('✅ Pending user at Step 1 is strictly excluded from 4 AM daily broadcast query');

  // 3. User returns after 2 days and sends "Hello" -> restores Step 1 prompt
  console.log('\n[TEST 2] User returns after days and sends "Hello" at Step 1');
  replies = await simulateMsg('Hello');
  session = await BotSession.findOne({ phoneNumber: { $in: [testPhoneFormatted, testPhone] } });
  console.assert(session.step === 'bot_language', 'Session should still be at bot_language');
  console.assert(replies[0]?.text.includes('1️⃣ English'), 'Bot should re-prompt Step 1 bot language');
  console.log('✅ Bot restored Step 1 prompt without error');

  // 4. User chooses English (1) -> moves to Step 2 (Phone verification)
  console.log('\n[TEST 3] User selects 1 for English');
  replies = await simulateMsg('1');
  session = await BotSession.findOne({ phoneNumber: { $in: [testPhoneFormatted, testPhone] } });
  console.assert(session.step === 'phone_verification', `Expected phone_verification, got ${session.step}`);
  console.log('✅ User advanced to Step 2 (phone_verification)');

  // 5. User leaves chat, returns later and sends "Hi" -> restores Step 2 prompt
  console.log('\n[TEST 4] User returns later and sends "Hi" at Step 2');
  replies = await simulateMsg('Hi');
  session = await BotSession.findOne({ phoneNumber: { $in: [testPhoneFormatted, testPhone] } });
  console.assert(session.step === 'phone_verification', 'Should still be phone_verification');
  console.assert(replies[0]?.text.includes('Welcome back') && replies[0]?.text.includes('Phone Number Verification'), 'Should welcome back and prompt phone');
  console.log('✅ Bot restored Step 2 prompt on greeting');

  // 6. User enters 10-digit phone number -> moves to Step 3 (OTP verification)
  console.log('\n[TEST 5] User enters phone number 9999988888');
  replies = await simulateMsg('9999988888');
  session = await BotSession.findOne({ phoneNumber: { $in: [testPhoneFormatted, testPhone] } });
  console.assert(session.step === 'otp_verification', `Expected otp_verification, got ${session.step}`);
  const otp = session.pendingOtp;
  console.assert(otp && otp.length === 6, `OTP should be 6 digits, got ${otp}`);
  console.log(`✅ User advanced to Step 3 (otp_verification), OTP: ${otp}`);

  // 7. User leaves chat, returns later and sends "Hi" -> restores Step 3 prompt
  console.log('\n[TEST 6] User returns later and sends "Hi" at Step 3');
  replies = await simulateMsg('Hi');
  session = await BotSession.findOne({ phoneNumber: { $in: [testPhoneFormatted, testPhone] } });
  console.assert(session.step === 'otp_verification', 'Should still be otp_verification');
  console.assert(replies[0]?.text.includes('Welcome back') && replies[0]?.text.includes('OTP'), 'Should restore OTP step');
  console.log('✅ Bot restored Step 3 OTP prompt on greeting');

  // 8. User enters OTP -> verified, moves to Step 5 (Preferences)
  console.log('\n[TEST 7] User enters valid OTP');
  replies = await simulateMsg(otp);
  session = await BotSession.findOne({ phoneNumber: { $in: [testPhoneFormatted, testPhone] } });
  console.assert(session.step === 'preferences', `Expected preferences, got ${session.step}`);
  console.assert(session.isVerified === true, 'Session isVerified should be true');
  console.log('✅ Phone verified, advanced to Step 5 (preferences)');

  // 9. User leaves chat, returns later and sends "Hi" -> restores Step 5 prompt
  console.log('\n[TEST 8] User returns later and sends "Hi" at Step 5');
  replies = await simulateMsg('Hi');
  session = await BotSession.findOne({ phoneNumber: { $in: [testPhoneFormatted, testPhone] } });
  console.assert(session.step === 'preferences', 'Should still be preferences');
  console.assert(replies[0]?.text.includes('Welcome back') && replies[0]?.text.includes('Preferences'), 'Should restore Preferences step');
  console.log('✅ Bot restored Step 5 Preferences prompt on greeting');

  // 10. User selects preferences "7" (All) -> moves to Step 6 (Daily Catholic Content Language)
  console.log('\n[TEST 9] User selects preferences 7');
  replies = await simulateMsg('7');
  session = await BotSession.findOne({ phoneNumber: { $in: [testPhoneFormatted, testPhone] } });
  console.assert(session.step === 'language', `Expected language step, got ${session.step}`);
  console.log('✅ Preferences saved, advanced to Step 6 (Daily Catholic Content Language)');

  // 11. User leaves chat at Step 6. Verify they are STILL excluded from Daily Catholic broadcast!
  rawSessions = await BotSession.find({
    step: 'done',
    isOnboarded: true,
    dailyCatholicSetupCompleted: true,
    dailyCatholicSubscribed: true,
    dailyCatholicLanguage: { $in: ['english', 'tamil', 'both', 'en', 'ta'] }
  }).lean();
  console.assert(!rawSessions.some(s => s.phoneNumber === testPhoneFormatted || s.phoneNumber === testPhone), 'User at Step 6 MUST NOT be eligible for daily broadcast');
  console.log('✅ User at pending Step 6 is strictly excluded from 4 AM daily broadcast');

  // 12. User returns later and sends "Hi" -> restores Step 6 language prompt
  console.log('\n[TEST 10] User returns later and sends "Hi" at Step 6');
  replies = await simulateMsg('Hi');
  session = await BotSession.findOne({ phoneNumber: { $in: [testPhoneFormatted, testPhone] } });
  console.assert(session.step === 'language', 'Should still be language');
  console.assert(replies[0]?.text.includes('Welcome back') && replies[0]?.text.includes('Daily Catholic Content Language'), 'Should restore Step 6 prompt');
  console.log('✅ Bot restored Step 6 Daily Catholic Content Language prompt on greeting');

  // 13. User completes Step 6 by selecting 1 (Tamil)
  console.log('\n[TEST 11] User completes Step 6 with selection 1 (Tamil)');
  replies = await simulateMsg('1');
  session = await BotSession.findOne({ phoneNumber: { $in: [testPhoneFormatted, testPhone] } });
  console.assert(session.step === 'done', `Expected done step, got ${session.step}`);
  console.assert(session.isOnboarded === true, 'Expected isOnboarded true');
  console.assert(session.dailyCatholicSetupCompleted === true, 'Expected dailyCatholicSetupCompleted true');
  console.assert(session.dailyCatholicSubscribed === true, 'Expected dailyCatholicSubscribed true');
  console.assert(session.dailyCatholicLanguage === 'tamil', `Expected dailyCatholicLanguage tamil, got ${session.dailyCatholicLanguage}`);
  console.assert(replies[0]?.text.includes("You're all set"), "Should send You're all set message");
  console.assert(replies[1]?.text.includes("How to use SJDB Connect"), "Should send How to use guide");
  console.log('✅ Onboarding completed! Flags: dailyCatholicSetupCompleted=true, dailyCatholicSubscribed=true, dailyCatholicLanguage=tamil');

  // 14. Now verify they ARE included in 4 AM Daily Catholic broadcast scheduler query!
  rawSessions = await BotSession.find({
    step: 'done',
    isOnboarded: true,
    dailyCatholicSetupCompleted: true,
    dailyCatholicSubscribed: true,
    dailyCatholicLanguage: { $in: ['english', 'tamil', 'both', 'en', 'ta'] }
  }).lean();
  console.assert(rawSessions.some(s => s.phoneNumber === testPhoneFormatted || s.phoneNumber === testPhone), 'Completed user MUST be eligible for daily broadcast');
  console.log('✅ Fully completed user is now eligible for 4 AM daily broadcast');

  // 15. User switches language to English by sending "English"
  console.log('\n[TEST 12] User sends "English" to change daily content language');
  replies = await simulateMsg('English');
  session = await BotSession.findOne({ phoneNumber: { $in: [testPhoneFormatted, testPhone] } });
  console.assert(session.dailyCatholicLanguage === 'english', `Expected dailyCatholicLanguage english, got ${session.dailyCatholicLanguage}`);
  console.log('✅ Daily Catholic Language changed to english successfully');

  // 16. User switches language to "Both"
  console.log('\n[TEST 13] User sends "Both"');
  replies = await simulateMsg('Both');
  session = await BotSession.findOne({ phoneNumber: { $in: [testPhoneFormatted, testPhone] } });
  console.assert(session.dailyCatholicLanguage === 'both', `Expected dailyCatholicLanguage both, got ${session.dailyCatholicLanguage}`);
  console.log('✅ Daily Catholic Language changed to both successfully');

  // 17. User sends "STOP" -> unsubscribes
  console.log('\n[TEST 14] User sends "STOP"');
  replies = await simulateMsg('STOP');
  session = await BotSession.findOne({ phoneNumber: { $in: [testPhoneFormatted, testPhone] } });
  console.assert(session.step === 'stopped', 'Expected step stopped');
  console.assert(session.dailyCatholicSetupCompleted === false, 'Expected dailyCatholicSetupCompleted false');
  console.assert(session.dailyCatholicSubscribed === false, 'Expected dailyCatholicSubscribed false');
  rawSessions = await BotSession.find({
    step: 'done',
    isOnboarded: true,
    dailyCatholicSetupCompleted: true,
    dailyCatholicSubscribed: true,
    dailyCatholicLanguage: { $in: ['english', 'tamil', 'both', 'en', 'ta'] }
  }).lean();
  console.assert(!rawSessions.some(s => s.phoneNumber === testPhoneFormatted || s.phoneNumber === testPhone), 'Stopped user must NOT be in daily query');
  console.log('✅ Unsubscribed user has dailyCatholicSubscribed=false and is excluded from 4 AM broadcast');

  // Clean test user
  await BotSession.deleteMany({ phoneNumber: { $in: [testPhoneFormatted, testPhone] } });
  await User.deleteOne({ phone: '9999988888' });

  await mongoose.disconnect();
  console.log('\n🎉 ALL STRICT ONBOARDING GATE TESTS PASSED WITH 100% SUCCESS!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
