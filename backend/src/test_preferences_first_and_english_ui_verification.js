require('dotenv').config();
const mongoose = require('mongoose');
const BotSession = require('./models/BotSession');
const User = require('./models/User');
const { handleIncomingMessage, _clearDedupCacheForTesting } = require('./bot/botHandler');
const { getBaseClientUrl, SITE_ROUTES } = require('./config/siteRoutes');
const { generateDailyCatholicMessage, generateSaintInfoMessage } = require('./services/whatsappDailyFormatter');
const { getTodayDailyContent } = require('./services/dailyContentService');

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passedAssertions++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failedAssertions++;
  }
}

async function runTests() {
  console.log('========================================================================');
  console.log('🧪 RUNNING PREFERENCES-FIRST & ENGLISH-ONLY BOT UI VERIFICATION');
  console.log('========================================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/church_db');
  }

  const testPhone = '919444455555';
  await BotSession.deleteMany({ phoneNumber: testPhone });
  _clearDedupCacheForTesting();

  const mockSentMessages = [];
  require('./bot/whatsapp').sendWhatsAppMessage = async (to, text) => {
    mockSentMessages.push(text);
    return true;
  };
  require('./bot/whatsapp').sendWhatsAppMedia = async (to, media) => {
    mockSentMessages.push('[MEDIA_IMAGE]');
    return true;
  };

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Initial "Hi" from unverified user -> prompts for Phone Verification
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Initial "Hi" from Unverified User ---');
  mockSentMessages.length = 0;
  _clearDedupCacheForTesting();

  await handleIncomingMessage(testPhone, 'Hi', testPhone, 'Francis');

  assert(mockSentMessages.length === 1, 'Received exactly 1 response to initial "Hi"');
  const verifyMsg = mockSentMessages[0] || '';
  assert(verifyMsg.includes('Phone Number Verification'), 'Initial response contains Phone Number Verification');
  assert(verifyMsg.includes('10-digit mobile phone number'), 'Initial response asks for 10-digit mobile number');
  assert(!verifyMsg.includes('Preferences'), 'Preferences is NOT shown before phone number verification');

  let session = await BotSession.findOne({ phoneNumber: testPhone });
  assert(session.isVerified === false, 'Session isVerified is initially false');
  assert(session.step === 'phone_verification', 'Session step is phone_verification');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: User provides 10-digit number -> Verified + Exact Preferences Msg
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Phone Verification -> Exact Preferences Message ---');
  mockSentMessages.length = 0;
  _clearDedupCacheForTesting();

  await handleIncomingMessage(testPhone, '9876543210', testPhone, 'Francis');

  assert(mockSentMessages.length === 1, 'Received exactly 1 response after phone submission');
  const prefMsg = mockSentMessages[0] || '';
  assert(prefMsg.includes('Phone Number Verified!') || prefMsg.includes('Phone number verified.'), 'Response confirms Phone Number Verified');
  assert(prefMsg.includes('SJDB Connect Preferences'), 'Response contains "SJDB Connect Preferences" header');
  assert(prefMsg.includes('1️⃣ Daily Bible Verse'), 'Preferences list includes 1. Daily Bible Verse');
  assert(prefMsg.includes('2️⃣ Saint of the Day'), 'Preferences list includes 2. Saint of the Day');
  assert(prefMsg.includes('3️⃣ Daily Mass Readings & Reflection'), 'Preferences list includes 3. Daily Mass Readings & Reflection');
  assert(prefMsg.includes('4️⃣ Church Events'), 'Preferences list includes 4. Church Events');
  assert(prefMsg.includes('5️⃣ Parish Announcements'), 'Preferences list includes 5. Parish Announcements');
  assert(prefMsg.includes('6️⃣ Birthday Wishes'), 'Preferences list includes 6. Birthday Wishes');
  assert(prefMsg.includes('7️⃣ All of the above'), 'Preferences list includes 7. All of the above');
  assert(prefMsg.includes('➡️ Type *Menu* for Quick Commands'), 'Preferences footer has Menu command');
  assert(prefMsg.includes('➡️ Type *Services* for Help Desk'), 'Preferences footer has Services command');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert(session.isVerified === true, 'Session is now isVerified: true');
  assert(session.step === 'preferences', 'Session step is now "preferences"');
  assert(session.providedPhone === '9876543210', 'Session providedPhone is 9876543210');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: User selects services (e.g. "1, 2, 3") -> Language Prompt
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Preferences Selection (1, 2, 3) -> Language Prompt ---');
  mockSentMessages.length = 0;
  _clearDedupCacheForTesting();

  await handleIncomingMessage(testPhone, '1, 2, 3', testPhone, 'Francis');

  assert(mockSentMessages.length === 1, 'Received language selection prompt');
  const langPrompt = mockSentMessages[0] || '';
  assert(langPrompt.includes('Daily Catholic Content Language'), 'Language prompt header is Daily Catholic Content Language');
  assert(langPrompt.includes('1️⃣ Tamil (தமிழ்)'), 'Language prompt has option 1 Tamil');
  assert(langPrompt.includes('2️⃣ English'), 'Language prompt has option 2 English');
  assert(langPrompt.includes('3️⃣ Both (Tamil + English)'), 'Language prompt has option 3 Both');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert(session.step === 'language', 'Session step is now "language"');
  assert(session.preferences.includes('verse') && session.preferences.includes('saint') && session.preferences.includes('mass'), 'Preferences saved correctly');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: User selects Catholic Content Language ("1" / Tamil) -> Confirmation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Catholic Content Language (1 / Tamil) -> Confirmation Card ---');
  mockSentMessages.length = 0;
  _clearDedupCacheForTesting();

  await handleIncomingMessage(testPhone, '1', testPhone, 'Francis');

  assert(mockSentMessages.length === 2, 'Received Confirmation Card and Assistance guide on onboarding completion');
  const confirmMsg = mockSentMessages[0] || '';
  assert(confirmMsg.includes("You're all set!"), 'Confirmation includes "You\'re all set!"');
  assert(confirmMsg.includes('Your Subscribed Services:'), 'Confirmation includes Subscribed Services header');
  assert(confirmMsg.includes('Daily Catholic Content Language: *Tamil (தமிழ்)*'), 'Confirmation shows Daily Catholic Content Language: Tamil');
  assert(confirmMsg.includes('4:00 AM IST'), 'Confirmation mentions 4:00 AM IST');
  assert(confirmMsg.includes('➡️ Type *Menu* for Quick Commands'), 'Confirmation has Menu quick command');
  assert(confirmMsg.includes('➡️ Type *Services* for Help Desk'), 'Confirmation has Services quick command');
  assert(mockSentMessages[1].includes('SJDB Connect Assistance'), 'Assistance message is delivered');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert(session.step === 'done', 'Session step is now "done"');
  assert(session.isOnboarded === true, 'Session isOnboarded is true');
  assert(session.language === 'ta', 'Session language is saved as "ta"');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Verified User asks for "Menu" -> English Quick Commands (UI English)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: English Quick Commands Menu ---');
  mockSentMessages.length = 0;
  _clearDedupCacheForTesting();

  await handleIncomingMessage(testPhone, 'MENU', testPhone, 'Francis');

  assert(mockSentMessages.length === 1, 'Received Menu response');
  const menuMsg = mockSentMessages[0] || '';
  assert(menuMsg.includes('Welcome to SJDB Connect!'), 'Menu header is English');
  assert(menuMsg.includes('1️⃣ 📖 *Daily Bible*'), 'Menu option 1 is English Daily Bible');
  assert(menuMsg.includes('2️⃣ ⛪ *Mass Timings*'), 'Menu option 2 is English Mass Timings');
  assert(menuMsg.includes('3️⃣ 🕊️ *Services*'), 'Menu option 3 is English Services');
  assert(menuMsg.includes('4️⃣ 📅 *Events*'), 'Menu option 4 is English Events');
  assert(menuMsg.includes('5️⃣ 📢 *Announcements*'), 'Menu option 5 is English Announcements');
  assert(menuMsg.includes('6️⃣ 📜 *Church Information*'), 'Menu option 6 is English Church Information');
  assert(menuMsg.includes('7️⃣ 🌟 *Saint of the Day*'), 'Menu option 7 is English Saint of the Day');
  assert(menuMsg.includes('8️⃣ ❓ *Help*'), 'Menu option 8 is English Help');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Verified User asks for "Services" -> English 14-Option Help Desk
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6: English Services / Help Desk ---');
  mockSentMessages.length = 0;
  _clearDedupCacheForTesting();

  await handleIncomingMessage(testPhone, 'SERVICES', testPhone, 'Francis');

  assert(mockSentMessages.length === 1, 'Received Services response');
  const servMsg = mockSentMessages[0] || '';
  assert(servMsg.includes('SJDB Connect – Services & Help Desk'), 'Services header is English');
  assert(servMsg.includes('1️⃣ ⛪ *Mass Timings*'), 'Services option 1 is Mass Timings');
  assert(servMsg.includes('1️⃣4️⃣ 📞 *Contact Church*'), 'Services option 14 is Contact Church');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: Number Selection with "ALL" and "7"
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 7: ALL / 7 in Preferences Selection ---');
  session.step = 'preferences';
  await session.save();
  mockSentMessages.length = 0;
  _clearDedupCacheForTesting();

  await handleIncomingMessage(testPhone, 'ALL', testPhone, 'Francis');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert(session.preferences.length === 6, '"ALL" selected all 6 services');
  assert(session.preferences.includes('birthday') && session.preferences.includes('events'), '"ALL" includes birthday and events');
  assert(session.step === 'language', 'Transitioned to language prompt');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8: Catholic Content Language Switching and Scripture Rendering
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 8: Catholic Content Language Switching & Devotions ---');
  session.step = 'done';
  session.language = 'ta';
  await session.save();

  const dailyContent = await getTodayDailyContent(new Date());
  const taCatholicMsg = generateDailyCatholicMessage({ dailyContent, language: 'ta' });
  assert(taCatholicMsg.includes('புனித ஜான் டி பிரிட்டோ திருத்தலம்') || taCatholicMsg.includes('இன்றைய'), 'Tamil devotions render Tamil liturgical content');

  const enCatholicMsg = generateDailyCatholicMessage({ dailyContent, language: 'en' });
  assert(enCatholicMsg.includes("St. John de britto Church") && enCatholicMsg.includes('DAILY BIBLE VERSE'), 'English devotions render English liturgical content');

  console.log('\n========================================================================');
  console.log(`🏁 TEST RESULTS: ${passedAssertions} Passed, ${failedAssertions} Failed`);
  console.log('========================================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
