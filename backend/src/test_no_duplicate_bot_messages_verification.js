/**
 * Verification Test Suite: No Duplicate Bot Messages, Message ID Idempotency & Live Data Retrieval
 */

require('dotenv').config();
const mongoose = require('mongoose');
const BotSession = require('./models/BotSession');
const User = require('./models/User');
const Event = require('./models/Event');
const Announcement = require('./models/Announcement');
const Priest = require('./models/Priest');
const { handleIncomingMessage, _clearDedupCacheForTesting } = require('./bot/botHandler');
const { getSiteUrl, SITE_ROUTES, EXTERNAL_LINKS } = require('./config/siteRoutes');
const { answerChurchQuestion } = require('./bot/churchRAGService');

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

async function runVerification() {
  console.log('========================================================================');
  console.log('🧪 RUNNING NO DUPLICATE BOT MESSAGES & LIVE DATA VERIFICATION TEST');
  console.log('========================================================================\n');

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sjdb_church';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('📦 Connected to MongoDB for test verification.\n');
  } catch (e) {
    console.warn('⚠️ MongoDB connection warning:', e.message);
  }

  const testPhone = '919999988888';
  const testJid = `${testPhone}@s.whatsapp.net`;
  await BotSession.deleteMany({ phoneNumber: testPhone });
  _clearDedupCacheForTesting();

  const mockSent = [];
  const wa = require('./bot/whatsapp');
  wa.sendWhatsAppMessage = async (to, text) => {
    mockSent.push({ type: 'text', to, text });
    return true;
  };
  wa.sendWhatsAppMedia = async (to, media) => {
    mockSent.push({ type: 'media', to, media });
    return true;
  };

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUITE 1: STRICT CONVERSATION FLOW (1 Message per Action, Then Wait)
  // Verification -> Preferences -> Language -> Confirmation -> Wait
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST SUITE 1: Clean Onboarding Flow (1 Action = 1 Response) ---');

  // Step 1: Initial "Hi" from unverified user
  mockSent.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, 'Hi', testJid, 'Thomas', 'msg_001');

  assert(mockSent.length === 1, 'Initial greeting returns exactly 1 message');
  assert(mockSent[0].text.includes('Phone Number Verification'), 'Message prompts for Phone Number Verification');
  assert(!mockSent[0].text.includes('Preferences'), 'Does not send Preferences prematurely');

  // Step 2: User provides 10-digit number
  mockSent.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, '9876543210', testJid, 'Thomas', 'msg_002');

  assert(mockSent.length === 1, 'Phone verification returns exactly 1 message');
  assert(mockSent[0].text.includes('Phone Number Verified!') || mockSent[0].text.includes('Phone number verified.'), 'Message confirms Phone Number Verified');
  assert(mockSent[0].text.includes('SJDB Connect Preferences'), 'Message presents Preferences menu');

  // Step 3: User selects "7" (All Preferences)
  mockSent.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, '7', testJid, 'Thomas', 'msg_003');

  assert(mockSent.length === 1, 'Selecting "7" returns exactly 1 message (Language prompt)');
  assert(mockSent[0].text.includes('Daily Catholic Content Language'), 'Message is Language selection prompt');
  assert(!mockSent[0].text.includes('Assistance'), 'Does NOT send assistance/services message');

  // Step 4: User selects "2" (English)
  mockSent.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, '2', testJid, 'Thomas', 'msg_004');

  assert(mockSent.length === 2, 'Setup completion sends Confirmation card followed by Assistance guide');
  assert(mockSent[0].text.includes("You're all set!"), 'First message includes "You\'re all set!" confirmation');
  assert(mockSent[0].text.includes('Daily Catholic Content Language: *English*'), 'Shows Daily Catholic Content Language: English');
  assert(mockSent[0].text.includes('➡️ Type *Menu* for Quick Commands'), 'Includes Quick Commands hint');
  assert(mockSent[0].text.includes('➡️ Type *Services* for Help Desk'), 'Includes Help Desk hint');
  assert(mockSent[1].text.includes('SJDB Connect Assistance'), 'Second message is SJDB Connect Assistance overview');

  // Verify session state is done and onboarded
  let session = await BotSession.findOne({ phoneNumber: testPhone });
  assert(session.step === 'done', 'Session step is now "done"');
  assert(session.isOnboarded === true, 'Session isOnboarded is true');
  assert(session.language === 'en', 'Session language is "en"');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUITE 2: MESSAGE ID IDEMPOTENCY & DUPLICATE PROTECTION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST SUITE 2: Message ID Idempotency & Webhook Retry Protection ---');

  mockSent.length = 0;
  // Send unique message ID 'msg_unique_100'
  await handleIncomingMessage(testPhone, 'Menu', testJid, 'Thomas', 'msg_unique_100');
  assert(mockSent.length === 1, 'Initial request with msg_unique_100 processed once');

  // Resend identical message ID 'msg_unique_100' (simulating webhook network redelivery)
  mockSent.length = 0;
  await handleIncomingMessage(testPhone, 'Menu', testJid, 'Thomas', 'msg_unique_100');
  assert(mockSent.length === 0, 'Duplicate webhook event with same message ID is silently dropped (0 duplicate replies)');

  // Send duplicate text within rapid 1.5s window
  mockSent.length = 0;
  await handleIncomingMessage(testPhone, 'Menu', testJid, 'Thomas');
  assert(mockSent.length === 0, 'Rapid duplicate text message is dropped (0 duplicate replies)');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUITE 3: SINGLE-RESPONSE COMMANDS & LIVE DATA RETRIEVAL
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST SUITE 3: Single-Response Commands & Live Data Retrieval ---');

  // 1. MENU command
  mockSent.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, 'MENU', testJid, 'Thomas', 'msg_menu');
  assert(mockSent.length === 1, 'MENU command produces exactly 1 response');
  assert(mockSent[0].text.includes('Welcome to SJDB Connect!'), 'MENU returns Main Menu');
  assert(mockSent[0].text.includes('1️⃣ 📖 *Daily Bible*'), 'MENU has Daily Bible');

  // 2. SERVICES command
  mockSent.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, 'SERVICES', testJid, 'Thomas', 'msg_services');
  assert(mockSent.length === 1, 'SERVICES command produces exactly 1 response');
  assert(mockSent[0].text.includes('SJDB Connect – Services & Help Desk'), 'SERVICES returns Services menu');
  assert(mockSent[0].text.includes('1️⃣4️⃣ 📞 *Contact Church*'), 'SERVICES has 1-14 options');

  // 3. MASS TIMINGS command ('2' or 'mass timings')
  mockSent.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, '2', testJid, 'Thomas', 'msg_mass');
  assert(mockSent.length === 1, 'Mass timings selection produces exactly 1 response');
  assert(mockSent[0].text.includes('Holy Mass Timings'), 'Mass timings response contains schedule');
  assert(mockSent[0].text.includes('https://st-jb-church.vercel.app/mass-timings'), 'Mass timings response contains canonical URL /mass-timings');

  // 4. READINGS / DAILY BIBLE command ('1' or 'readings')
  mockSent.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, '1', testJid, 'Thomas', 'msg_readings');
  assert(mockSent.length === 1, 'Readings command produces exactly 1 response (no chained saint card)');
  assert(/(DAILY MASS READINGS|DAILY BIBLE VERSE|Daily Catholic Devotions)/i.test(mockSent[0].text), 'Readings message contains Scripture readings');
  assert(mockSent[0].text.includes('https://st-jb-church.vercel.app/bible-verse#readings'), 'Readings message contains canonical URL /bible-verse#readings');

  // 5. SAINT OF THE DAY command ('7' or "today's saint")
  mockSent.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, '7', testJid, 'Thomas', 'msg_saint');
  assert(mockSent.length === 1, 'Saint of the Day produces exactly 1 response (single media message with caption or text)');
  const saintContent = mockSent[0].type === 'media' ? (mockSent[0].media.caption || '') : (mockSent[0].text || '');
  assert(saintContent.includes('Saint of the Day') || saintContent.includes('புனிதர்'), 'Saint response contains Saint of the Day info');
  assert(saintContent.includes('https://st-jb-church.vercel.app/bible-verse#saint-of-the-day'), 'Saint response contains canonical URL /bible-verse#saint-of-the-day');

  // 6. CHURCH LOCATION ('10' or 'where is the church')
  mockSent.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, '10', testJid, 'Thomas', 'msg_loc');
  assert(mockSent.length === 1, 'Location command produces exactly 1 response');
  assert(mockSent[0].text.includes('Kalayarkoil — 630551'), 'Location contains church address');
  assert(mockSent[0].text.includes(EXTERNAL_LINKS.GOOGLE_MAPS), 'Location contains Google Maps URL');
  assert(mockSent[0].text.includes('https://st-jb-church.vercel.app/contact'), 'Location contains canonical URL /contact');

  // 7. CHURCH PRIESTS ('12' or 'who is the parish priest')
  mockSent.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, '12', testJid, 'Thomas', 'msg_priests');
  assert(mockSent.length === 1, 'Priests command produces exactly 1 response');
  assert(mockSent[0].text.includes('Parish Priests & Clergy'), 'Priests response contains Clergy details');
  assert(mockSent[0].text.includes('https://st-jb-church.vercel.app/priests'), 'Priests response contains canonical URL /priests');

  // 8. CHURCH CONTACT ('14' or 'contact church')
  mockSent.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, '14', testJid, 'Thomas', 'msg_contact');
  assert(mockSent.length === 1, 'Contact command produces exactly 1 response');
  assert(mockSent[0].text.includes('Parish Contact & Office Hours'), 'Contact response contains Office details');
  assert(mockSent[0].text.includes('96556 39144'), 'Contact response contains phone number');
  assert(mockSent[0].text.includes('https://st-jb-church.vercel.app/contact'), 'Contact response contains canonical URL /contact');

  // 9. NATURAL QUESTION: "What time is Mass tomorrow?"
  mockSent.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, 'What time is Mass tomorrow?', testJid, 'Thomas', 'msg_nat_mass');
  assert(mockSent.length === 1, 'Natural Mass query produces exactly 1 response');
  assert(mockSent[0].text.includes('Mass') && mockSent[0].text.includes('6:00 AM'), 'Natural Mass query returns live Mass timings');
  assert(mockSent[0].text.includes('https://st-jb-church.vercel.app/mass-timings'), 'Natural Mass query includes canonical link /mass-timings');

  // 10. NATURAL QUESTION: "Where is the church located?"
  mockSent.length = 0;
  _clearDedupCacheForTesting();
  await handleIncomingMessage(testPhone, 'Where is the church located?', testJid, 'Thomas', 'msg_nat_loc');
  assert(mockSent.length === 1, 'Natural Location query produces exactly 1 response');
  assert(mockSent[0].text.includes('Kalayarkoil') && mockSent[0].text.includes('maps.google.com'), 'Natural Location query returns address & Google Maps link');

  // Clean up
  await BotSession.deleteMany({ phoneNumber: testPhone });

  console.log('\n========================================================================');
  console.log(`🏁 TEST RESULTS: ${passedAssertions} Passed, ${failedAssertions} Failed`);
  console.log('========================================================================\n');

  await mongoose.disconnect();

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
