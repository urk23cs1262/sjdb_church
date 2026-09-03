require('dotenv').config();
const mongoose = require('mongoose');
const BotSession = require('./models/BotSession');
const User = require('./models/User');
const { clearAllBotSubscribers } = require('./controllers/botController');
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
  console.log('🧪 RUNNING CLEAR / START FRESH ADMIN ACTION & FRESH FLOW TEST SUITE');
  console.log('========================================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sjdb_church');
  }

  // 1. Setup Test Data: 1 Bot session and 1 User
  const testPhone = '919888877777';
  await BotSession.deleteMany({ phoneNumber: testPhone });
  
  await BotSession.create({
    phoneNumber: testPhone,
    isVerified: true,
    providedPhone: '9888877777',
    step: 'done',
    isOnboarded: true,
    language: 'en',
    preferences: ['verse', 'saint']
  });

  const existingUsersCountBefore = await User.countDocuments();

  // 2. Trigger Clear / Start Fresh
  console.log('--- TEST 1: Admin triggers Clear / Start Fresh ---');
  let mockResData = null;
  const mockReq = {};
  const mockRes = {
    json: (data) => {
      mockResData = data;
    },
    status: (code) => ({
      json: (data) => {
        mockResData = { status: code, ...data };
      }
    })
  };

  await clearAllBotSubscribers(mockReq, mockRes);

  assert(mockResData && mockResData.success === true, 'Clear / Start Fresh returned success: true');
  assert(mockResData.message && mockResData.message.includes('Fresh bot reset complete'), 'Confirmation message mentions fresh bot reset complete');

  // Verify DB state
  const botSessionsCount = await BotSession.countDocuments();
  assert(botSessionsCount === 0, 'All BotSession records cleared (count = 0)');

  const userWithPrefs = await User.countDocuments({ 'botPreferences.0': { $exists: true } });
  assert(userWithPrefs === 0, 'All User botPreferences cleared');

  const existingUsersCountAfter = await User.countDocuments();
  assert(existingUsersCountAfter === existingUsersCountBefore, 'No user accounts were deleted (safe operation)');

  // 3. Test Fresh-User Flow after reset
  console.log('\n--- TEST 2: Fresh-User Interaction Flow After Reset ---');
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

  // Step 2a: User texts "Hi" -> Prompt for Number Verification
  capturedMessages.length = 0;
  await handleIncomingMessage(testPhone, 'Hi', testPhone, 'Francis');

  assert(capturedMessages.length === 1, 'Received exactly 1 response to initial "Hi"');
  assert(capturedMessages[0].includes('Phone Number Verification'), 'Prompts for Phone Number Verification');
  assert(capturedMessages[0].includes('10-digit mobile phone number'), 'Asks for 10-digit mobile phone number');

  // Step 2b: User sends 10-digit number -> Verified + Exact Preferences message
  capturedMessages.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, '9888877777', testPhone, 'Francis');

  assert(capturedMessages.length === 1, 'Received exactly 1 response after phone submission');
  const prefMsg = capturedMessages[0] || '';
  assert(prefMsg.includes('Phone Number Verified!'), 'Acknowledges Phone Number Verified');
  assert(prefMsg.includes('SJDB Connect Preferences'), 'Includes "SJDB Connect Preferences" header');
  assert(prefMsg.includes('1️⃣ Daily Bible Verse'), 'Includes option 1 Daily Bible Verse');
  assert(prefMsg.includes('7️⃣ All of the above'), 'Includes option 7 All of the above');
  assert(prefMsg.includes('➡️ Type *Menu* for Quick Commands'), 'Includes Menu footer command');
  assert(prefMsg.includes('➡️ Type *Services* for Help Desk') || prefMsg.includes('➡️ Type *Services* for Services'), 'Includes Services footer command');

  let session = await BotSession.findOne({ phoneNumber: testPhone });
  assert(session && session.isVerified === true, 'Session isVerified is true');
  assert(session && session.step === 'preferences', 'Session step is "preferences"');

  // Step 2c: User selects "7 / ALL" -> Catholic Content Language prompt
  capturedMessages.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, 'ALL', testPhone, 'Francis');

  assert(capturedMessages.length === 1, 'Received language selection prompt');
  const langMsg = capturedMessages[0] || '';
  assert(langMsg.includes('Daily Catholic Content Language'), 'Contains Daily Catholic Content Language header');
  assert(langMsg.includes('1️⃣ Tamil (தமிழ்)'), 'Option 1 is Tamil');
  assert(langMsg.includes('2️⃣ English'), 'Option 2 is English');
  assert(langMsg.includes('3️⃣ Both (Tamil + English)'), 'Option 3 is Both');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert(session && session.step === 'language', 'Session step is "language"');
  assert(session.preferences.length === 6, 'All 6 preferences saved correctly');

  // Step 2d: User selects "2" (English) -> Confirmation card + Assistance guide delivered
  capturedMessages.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, '2', testPhone, 'Francis');

  assert(capturedMessages.length === 1, 'Received Confirmation Card in exactly 1 message (no chained assistance message)');
  const confirmMsg = capturedMessages[0] || '';
  assert(confirmMsg.includes("You're all set!"), 'Confirmation includes "You\'re all set!"');
  assert(confirmMsg.includes('Daily Catholic Content Language: *English*'), 'Confirmation shows Daily Catholic Content Language: English');
  assert(confirmMsg.includes('4:00 AM IST'), 'Confirmation mentions 4:00 AM IST broadcast');
  assert(confirmMsg.includes('➡️ Type *Menu* for Quick Commands'), 'Confirmation has ➡️ Type *Menu* for Quick Commands');
  assert(confirmMsg.includes('➡️ Type *Services* for Help Desk'), 'Confirmation has ➡️ Type *Services* for Help Desk');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert(session && session.step === 'done', 'Session step is "done"');
  assert(session.isOnboarded === true, 'Session isOnboarded is true');
  assert(session.language === 'en', 'Session language is "en"');

  // Step 2e: User asks for Menu -> English Quick Commands Menu
  capturedMessages.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, 'MENU', testPhone, 'Francis');

  assert(capturedMessages.length === 1, 'Received Menu response');
  assert(capturedMessages[0].includes('Welcome to SJDB Connect!'), 'Menu header is English');
  assert(capturedMessages[0].includes('1️⃣ 📖 *Daily Bible*'), 'Menu option 1 is Daily Bible');

  // Clean up test session
  await BotSession.deleteMany({ phoneNumber: testPhone });

  console.log('\n========================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
