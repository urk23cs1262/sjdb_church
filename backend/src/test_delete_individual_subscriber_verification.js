require('dotenv').config();
const mongoose = require('mongoose');
const BotSession = require('./models/BotSession');
const User = require('./models/User');
const { deleteSubscriber, getSubscribers } = require('./controllers/botController');
const { handleIncomingMessage, _clearDedupCacheForTesting } = require('./bot/botHandler');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('========================================================================');
  console.log('🧪 RUNNING INDIVIDUAL SUBSCRIBER DELETE VERIFICATION TEST SUITE');
  console.log('========================================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sjdb_church');
  }

  const phoneA = '919111122222';
  const phoneB = '919333344444';

  // Step 0: Clean up
  await BotSession.deleteMany({ phoneNumber: { $in: [phoneA, phoneB] } });
  await User.deleteMany({ email: { $in: ['test_user_a@church.com', 'test_user_b@church.com'] } });

  // Create User A
  const userA = await User.create({
    name: 'User Alpha',
    email: 'test_user_a@church.com',
    passwordHash: 'passwordhash123',
    phone: phoneA,
    whatsappOptIn: true,
    botPreferences: ['verse', 'saint', 'mass'],
    preferredLanguage: 'en'
  });

  // Create BotSession for User A
  await BotSession.create({
    phoneNumber: phoneA,
    providedPhone: phoneA.slice(-10),
    isVerified: true,
    step: 'done',
    isOnboarded: true,
    preferences: ['verse', 'saint', 'mass'],
    language: 'en',
    linkedUserId: userA._id
  });

  // Create User B
  const userB = await User.create({
    name: 'User Beta',
    email: 'test_user_b@church.com',
    passwordHash: 'passwordhash123',
    phone: phoneB,
    whatsappOptIn: true,
    botPreferences: ['verse', 'saint', 'events', 'announcements'],
    preferredLanguage: 'en'
  });

  // Create BotSession for User B
  await BotSession.create({
    phoneNumber: phoneB,
    providedPhone: phoneB.slice(-10),
    isVerified: true,
    step: 'done',
    isOnboarded: true,
    preferences: ['verse', 'saint', 'events', 'announcements'],
    language: 'en',
    linkedUserId: userB._id
  });

  console.log('--- TEST 1: Delete Subscriber Alpha only ---');
  let mockResData = null;
  const mockReq = { params: { phone: phoneA } };
  const mockRes = {
    json: (data) => { mockResData = data; },
    status: (code) => ({ json: (data) => { mockResData = { status: code, ...data }; } })
  };

  await deleteSubscriber(mockReq, mockRes);

  assert(mockResData && mockResData.success === true, 'deleteSubscriber returned success: true');
  assert(mockResData.message.includes('Subscriber removed from notifications successfully'), 'Response confirms notification removal');

  // Verify User A state
  const sessionA = await BotSession.findOne({ phoneNumber: phoneA });
  assert(sessionA === null, 'BotSession for User A was deleted');

  const updatedUserA = await User.findById(userA._id);
  assert(updatedUserA !== null, 'User A main account was NOT deleted (safe)');
  assert(updatedUserA.whatsappOptIn === false, 'User A whatsappOptIn set to false');
  assert(updatedUserA.botPreferences.length === 0, 'User A botPreferences cleared');

  // Verify User B state (Untouched)
  console.log('\n--- TEST 2: Verify User Beta remains untouched ---');
  const sessionB = await BotSession.findOne({ phoneNumber: phoneB });
  assert(sessionB !== null, 'BotSession for User B is still intact');
  assert(sessionB.preferences.length === 4, 'User B preferences intact (4 items)');

  const updatedUserB = await User.findById(userB._id);
  assert(updatedUserB.whatsappOptIn === true, 'User B whatsappOptIn is still true');
  assert(updatedUserB.botPreferences.length === 4, 'User B botPreferences intact');

  // Step 3: Re-interaction test for deleted User A (starts fresh)
  console.log('\n--- TEST 3: User Alpha Re-interacts with WhatsApp Bot ---');
  const capturedMessages = [];
  require('./bot/whatsapp').sendWhatsAppMessage = async (to, text) => {
    capturedMessages.push(text);
    return true;
  };
  require('./bot/whatsapp').sendWhatsAppMedia = async (to, media) => {
    capturedMessages.push('[MEDIA_IMAGE]');
    return true;
  };

  _clearDedupCacheForTesting();

  // 3a. User A texts "Hi"
  capturedMessages.length = 0;
  await handleIncomingMessage(phoneA, 'Hi', phoneA, 'User Alpha');

  assert(capturedMessages.length === 1, 'Received response to "Hi"');
  assert(capturedMessages[0].includes('Phone Number Verification'), 'Deleted user is prompted for phone verification');

  // 3b. User A verifies number
  capturedMessages.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(phoneA, phoneA.slice(-10), phoneA, 'User Alpha');

  assert(capturedMessages.length === 1, 'Received response after number verification');
  assert(capturedMessages[0].includes('SJDB Connect Preferences'), 'Prompted with English Preferences Menu');

  // 3c. User A selects 1,2
  capturedMessages.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(phoneA, '1,2', phoneA, 'User Alpha');

  assert(capturedMessages.length === 1, 'Received Catholic Content Language prompt');
  assert(capturedMessages[0].includes('Daily Catholic Content Language'), 'Contains Language prompt');

  // 3d. User A selects English
  capturedMessages.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(phoneA, '2', phoneA, 'User Alpha');

  assert(capturedMessages.length === 1, 'Received Confirmation Card in exactly 1 message (no chained assistance message)');
  assert(capturedMessages[0].includes("You're all set!"), 'Re-onboarding confirmation received');
  assert(capturedMessages[0].includes('Daily Catholic Content Language: *English*'), 'Language set to English');

  const reSessionA = await BotSession.findOne({ phoneNumber: phoneA });
  assert(reSessionA && reSessionA.step === 'done', 'User A is now successfully re-subscribed');
  assert(reSessionA.preferences.length === 2, 'User A has 2 selected preferences');

  // Cleanup
  await BotSession.deleteMany({ phoneNumber: { $in: [phoneA, phoneB] } });
  await User.deleteMany({ email: { $in: ['test_user_a@church.com', 'test_user_b@church.com'] } });

  console.log('\n========================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
