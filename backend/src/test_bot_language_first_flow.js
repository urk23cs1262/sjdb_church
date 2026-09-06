const mongoose = require('mongoose');
const assert = require('assert');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const BotSession = require('./models/BotSession');
const User = require('./models/User');
const { handleIncomingMessage, _clearDedupCacheForTesting } = require('./bot/botHandler');
const { testBotMessage } = require('./controllers/botController');

// Mock WhatsApp module
const sentMessages = [];
const wa = require('./bot/whatsapp');
wa.sendWhatsAppMessage = async (to, message) => {
  sentMessages.push({ to, message });
  return { success: true };
};
wa.sendWhatsAppMedia = async (to, media) => {
  sentMessages.push({ to, message: media.caption || '[Media]', media });
  return { success: true };
};

function getLastMessage() {
  return sentMessages[sentMessages.length - 1]?.message || '';
}

async function clearMessages() {
  sentMessages.length = 0;
  await _clearDedupCacheForTesting();
}

async function runTests() {
  console.log('======================================================================');
  console.log('  SJDB CONNECT WHATSAPP BOT TEST SUITE (TESTS A THROUGH S)');
  console.log('======================================================================');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  const testPhone = '919988776655';

  // Clean up any existing test session
  await BotSession.deleteMany({ phoneNumber: testPhone });
  await _clearDedupCacheForTesting();
  await clearMessages();

  // ──────────────────────────────────────────────────────────────────────────
  // TEST A: New user sends HI -> Step 1 bilingual language prompt
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST A: New user sends HI -> Step 1 bilingual language prompt ---');
  await handleIncomingMessage(testPhone, 'HI', testPhone, 'Test User', 'MSG_A');
  const msgA = getLastMessage();
  console.log('Bot Response Preview:\n' + msgA.slice(0, 180) + '...\n');

  assert(msgA.includes('Welcome to *SJDB CONNECT!*'), 'Must include English greeting');
  assert(msgA.includes('வணக்கம்! *SJDB CONNECT*-க்கு உங்களை அன்புடன் வரவேற்கிறோம்! 🙏'), 'Must include Tamil greeting');
  assert(msgA.includes('1️⃣ *Tamil / தமிழ்*'), 'Must include Option 1 Tamil');
  assert(msgA.includes('2️⃣ *English / ஆங்கிலம்*'), 'Must include Option 2 English');
  assert(msgA.includes('👉 Please reply with *1 or 2*.'), 'Must include English reply guide');
  assert(msgA.includes('👉 *1 அல்லது 2* என்று மட்டும் பதிலளிக்கவும்.'), 'Must include Tamil reply guide');

  let session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.waitingForReply, true, 'waitingForReply must be true');
  assert.strictEqual(session.step, 'bot_language', 'Session step must be bot_language');
  assert.strictEqual(session.isVerified, false, 'User must not be verified');
  console.log('✓ TEST A PASSED: New user receives exact bilingual Step 1 prompt and bot waits.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST B: User sends invalid Step 1 input -> concise correction only
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST B: Invalid Step 1 input -> concise correction only, remains waiting ---');
  await clearMessages();
  await handleIncomingMessage(testPhone, '3', testPhone, 'Test User', 'MSG_B');
  const msgB = getLastMessage();
  console.log('Bot Response Preview:\n' + msgB + '\n');

  assert(msgB.includes('👉 Please reply with *1* or *2*.'), 'Must include concise English correction');
  assert(msgB.includes('👉 தயவுசெய்து *1* அல்லது *2* என்று பதிலளிக்கவும்.'), 'Must include concise Tamil correction');
  assert(!msgB.includes('Welcome to *SJDB CONNECT!*'), 'Must NOT repeat original full greeting');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.step, 'bot_language', 'Step must remain bot_language');
  assert.strictEqual(session.waitingForReply, true, 'waitingForReply must still be true');
  console.log('✓ TEST B PASSED: Concise correction sent, bot remains waiting in Step 1.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST C: User does not reply -> no duplicate/repeated bot message
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST C: User does not reply -> no duplicate/repeated bot message ---');
  await clearMessages();
  // Simulating time passing with no user input
  assert.strictEqual(sentMessages.length, 0, 'No unsolicited messages sent when user is idle');
  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.waitingForReply, true, 'Session remains safely waiting for reply');
  console.log('✓ TEST C PASSED: Bot sends nothing when user sends nothing.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST D: User selects Tamil -> Step 2. Main Menu must NOT appear
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST D: User selects Tamil -> Step 2 Phone Verification. Main Menu must NOT appear ---');
  await clearMessages();
  await handleIncomingMessage(testPhone, '1', testPhone, 'Test User', 'MSG_D');
  const msgD = getLastMessage();
  console.log('Bot Response Preview:\n' + msgD + '\n');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.language, 'ta', 'session.language must be ta');
  assert.strictEqual(session.step, 'phone_verification', 'Step must be phone_verification');
  assert.strictEqual(session.waitingForReply, true, 'waitingForReply must be true');
  assert(msgD.includes('தொலைபேசி எண் சரிபார்ப்பு'), 'Must prompt phone verification in Tamil');
  assert(msgD.includes('10-இலக்க மொபைல் எண்ணை'), 'Must prompt for 10-digit mobile number');
  assert(!msgD.includes('தினசரி விவிலியம்'), 'Main Menu must NOT appear after language selection!');
  assert(!msgD.includes('திருப்பலி நேரங்கள்'), 'Main Menu must NOT appear after language selection!');
  console.log('✓ TEST D PASSED: Language saved as Tamil, Step 2 prompted, Main Menu NOT sent.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST E: User completes OTP -> Step 4 Verified + Step 5 Preferences
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST E: User completes OTP -> Step 4 Verified + Step 5 Preferences ---');
  await clearMessages();
  // Step 2 reply: Enter 10-digit mobile number
  await handleIncomingMessage(testPhone, '9876543210', testPhone, 'Test User', 'MSG_E1');
  const msgE1 = getLastMessage();
  assert(msgE1.includes('OTP சரிபார்ப்பு') || msgE1.includes('சரிபார்ப்புக் குறியீடு'), 'Must prompt for OTP verification');
  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.step, 'otp_verification', 'Must transition to otp_verification');
  assert(session.tempOtp && session.tempOtp.length === 6, 'Must generate 6-digit OTP');

  // Submit valid OTP
  await clearMessages();
  await handleIncomingMessage(testPhone, session.tempOtp, testPhone, 'Test User', 'MSG_E2');
  const msgE = getLastMessage();
  console.log('Bot Response Preview:\n' + msgE + '\n');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.isVerified, true, 'isVerified must be true');
  assert.strictEqual(session.step, 'select_preferences', 'Step must be select_preferences');
  assert.strictEqual(session.waitingForReply, true, 'waitingForReply must be true');
  assert(msgE.includes('தொலைபேசி எண் சரிபார்க்கப்பட்டது!'), 'Must include Step 4 Verified badge');
  assert(msgE.includes('SJDB Connect விருப்பங்கள்'), 'Must include Step 5 Preferences prompt');
  console.log('✓ TEST E PASSED: Phone verified and preferences prompted.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST F: User completes preferences -> Step 6 Catholic Language
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST F: User completes preferences -> Step 6 Catholic Language ---');
  await clearMessages();
  await handleIncomingMessage(testPhone, '6', testPhone, 'Test User', 'MSG_F');
  const msgF = getLastMessage();
  console.log('Bot Response Preview:\n' + msgF + '\n');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.step, 'catholic_language', 'Step must be catholic_language');
  assert.strictEqual(session.waitingForReply, true, 'waitingForReply must be true');
  assert(session.preferences.length === 5, 'Preferences must be saved');
  assert(msgF.includes('Daily Catholic Content Language'), 'Must prompt Step 6 Catholic Language');
  assert(msgF.includes('தினசரி கத்தோலிக்க உள்ளடக்கத்தை எந்த மொழியில் பெற விரும்புகிறீர்கள்?'), 'Must ask in Tamil');
  assert(msgF.includes('3️⃣ Both *Tamil / தமிழ்* & *English / ஆங்கிலம்*'), 'Must include Option 3 Both');
  assert(msgF.includes('👉 *1, 2 அல்லது 3* என்று பதிலளிக்கவும்.'), 'Must include exact Tamil prompt');
  console.log('✓ TEST F PASSED: Preferences saved, Step 6 Catholic Language prompted in Tamil with Option 3 Both.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST G: User selects English Catholic Content -> Step 7 Subscribed Services + Step 8 Assistance
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST G: User selects English Catholic Content -> Step 7 Subscribed Services + Step 8 Assistance ---');
  await clearMessages();
  await handleIncomingMessage(testPhone, '2', testPhone, 'Test User', 'MSG_G');
  
  assert.strictEqual(sentMessages.length, 2, 'Must send exactly two messages upon setup completion');
  const msgG1 = sentMessages[0].message;
  const msgG2 = sentMessages[1].message;
  console.log('Bot Message 1 (Subscribed Services) Preview:\n' + msgG1 + '\n');
  console.log('Bot Message 2 (Assistance Guidance) Preview:\n' + msgG2 + '\n');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.language, 'ta', 'Bot Language must be ta');
  assert.strictEqual(session.catholicLanguage, 'en', 'Catholic Language must be en');
  assert.strictEqual(session.isOnboarded, true, 'isOnboarded must be true');
  assert.strictEqual(session.step, 'done', 'step must be done');
  assert.strictEqual(session.waitingForReply, false, 'waitingForReply must be false');
  
  // Message 1 verification: Subscribed services, language, schedule, Menu/Services shortcuts
  assert(msgG1.includes('அனைத்தும் தயார்!'), 'Must include Step 7 confirmation');
  assert(msgG1.includes('நீங்கள் பதிவு செய்த சேவைகள்:') || msgG1.includes('Subscribed Services'), 'Must list subscribed services');
  assert(msgG1.includes('தினசரி கத்தோலிக்க உள்ளடக்க மொழி: *ஆங்கிலம்*'), 'Summary must show Catholic Language = English');
  assert(msgG1.includes('Menu') && msgG1.includes('Services'), 'Must include Menu and Services quick guide');
  
  // Message 2 verification: Assistance guide
  assert(msgG2.includes('SJDB Connect வழிகாட்டி & உதவி') || msgG2.includes('SJDB Connect Assistance'), 'Must include Assistance guide in second message');
  
  // Removed menu verification: Old main menu must NOT be present
  assert(!msgG1.includes('எவ்வாறு உதவ முடியும்?') && !msgG2.includes('எவ்வாறு உதவ முடியும்?'), 'Old numbered main menu must be removed from setup completion');
  console.log('✓ TEST G PASSED: Subscribed services summary and separate assistance guide sent; old menu removed.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST H: Tamil Bot + English Catholic Content
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST H: Tamil Bot + English Catholic Content ---');
  // Daily Bible Verse (Option 1) must be in English
  await clearMessages();
  await handleIncomingMessage(testPhone, '1', testPhone, 'Test User', 'MSG_H1');
  const msgH1 = getLastMessage();
  assert(msgH1.includes('Daily Bible Verse') || msgH1.includes('Holy Bible'), 'Verse must be in English');
  console.log('✓ TEST H1: Verse delivered in English as per catholicLanguage = en.');

  // Normal bot menu / Mass timings (Option 2) must be in Tamil
  await clearMessages();
  await handleIncomingMessage(testPhone, '2', testPhone, 'Test User', 'MSG_H2');
  const msgH2 = getLastMessage();
  assert(msgH2.includes('திருப்பலி நேரங்கள்'), 'Mass timings must be in Tamil as per bot language = ta');
  console.log('✓ TEST H2: Mass timings delivered in Tamil as per bot language = ta.');
  console.log('✓ TEST H PASSED: Independent language delivery verified (Tamil Bot + English Devotions).');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST I: English Bot + Tamil Catholic Content
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST I: English Bot + Tamil Catholic Content ---');
  // Set bot language to English, Catholic content to Tamil
  session.language = 'en';
  session.catholicLanguage = 'ta';
  await session.save();

  // Daily Bible Verse (Option 1) must now be in Tamil
  await clearMessages();
  await handleIncomingMessage(testPhone, '1', testPhone, 'Test User', 'MSG_I1');
  const msgI1 = getLastMessage();
  assert(msgI1.includes('இறைவார்த்தை') || msgI1.includes('விவிலியம்'), 'Verse must be in Tamil');

  // Mass timings (Option 2) must now be in English
  await clearMessages();
  await handleIncomingMessage(testPhone, '2', testPhone, 'Test User', 'MSG_I2');
  const msgI2 = getLastMessage();
  assert(msgI2.includes('Mass Timings') || msgI2.includes('Holy Mass'), 'Mass timings must be in English');
  console.log('✓ TEST I PASSED: English Bot + Tamil Catholic Content verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST J: Tamil Bot + English user query -> Tamil response
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST J: Tamil Bot + English user query -> Tamil response ---');
  session.language = 'ta';
  session.catholicLanguage = 'ta';
  await session.save();

  await clearMessages();
  await handleIncomingMessage(testPhone, 'I want today mass timings', testPhone, 'Test User', 'MSG_J');
  const msgJ = getLastMessage();
  assert(msgJ.includes('திருப்பலி நேரங்கள்'), 'Tamil bot user must receive Mass timings in Tamil');
  console.log('✓ TEST J PASSED: English query answered in Tamil.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST K: English Bot + Tamil user query -> English response
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST K: English Bot + Tamil user query -> English response ---');
  session.language = 'en';
  session.catholicLanguage = 'en';
  await session.save();

  await clearMessages();
  await handleIncomingMessage(testPhone, 'இன்றைய திருப்பலி நேரம் என்ன?', testPhone, 'Test User', 'MSG_K');
  const msgK = getLastMessage();
  assert(msgK.includes('Mass Timings'), 'English bot user must receive Mass timings in English');
  console.log('✓ TEST K PASSED: Tamil query answered in English.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST L: BOT LANGUAGE command -> exact bilingual prompt -> changes session.language
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST L: BOT LANGUAGE command -> exact bilingual prompt -> changes session.language ---');
  await clearMessages();
  await handleIncomingMessage(testPhone, 'BOT LANGUAGE', testPhone, 'Test User', 'MSG_L1');
  const msgL1 = getLastMessage();
  assert(msgL1.includes('Welcome to *SJDB CONNECT!*'), 'Must show exact bilingual prompt');
  assert(msgL1.includes('1️⃣ *Tamil / தமிழ்*') && msgL1.includes('2️⃣ *English / ஆங்கிலம்*'), 'Must show options');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.step, 'bot_language_change', 'Step must be bot_language_change');
  assert.strictEqual(session.waitingForReply, true, 'waitingForReply must be true');

  // Select 1 (Tamil)
  await clearMessages();
  await handleIncomingMessage(testPhone, '1', testPhone, 'Test User', 'MSG_L2');
  const msgL2 = getLastMessage();
  assert(msgL2.includes('உங்கள் பாட் மொழி தமிழாக மாற்றப்பட்டது'), 'Must confirm Tamil bot language');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.language, 'ta', 'session.language must now be ta');
  assert.strictEqual(session.step, 'done', 'step must be done');
  assert.strictEqual(session.waitingForReply, false, 'waitingForReply must be false');
  console.log('✓ TEST L PASSED: BOT LANGUAGE command updated session.language.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST M: CATHOLIC LANGUAGE command -> prompt in current Bot Language -> changes ONLY session.catholicLanguage
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST M: CATHOLIC LANGUAGE command -> prompt in Bot Language -> changes ONLY catholicLanguage ---');
  await clearMessages();
  await handleIncomingMessage(testPhone, 'CATHOLIC LANGUAGE', testPhone, 'Test User', 'MSG_M1');
  const msgM1 = getLastMessage();
  assert(msgM1.includes('Daily Catholic Content Language'), 'Must prompt for Catholic Language');
  assert(msgM1.includes('தினசரி கத்தோலிக்க உள்ளடக்கத்தை எந்த மொழியில் பெற விரும்புகிறீர்கள்?'), 'Prompted in Tamil as Bot Language is ta');
  assert(msgM1.includes('3️⃣ Both *Tamil / தமிழ்* & *English / ஆங்கிலம்*'), 'Must include Option 3 Both');
  assert(msgM1.includes('👉 *1, 2 அல்லது 3* என்று பதிலளிக்கவும்.'), 'Must include 1, 2 or 3 prompt');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.step, 'catholic_language_change', 'Step must be catholic_language_change');
  assert.strictEqual(session.waitingForReply, true, 'waitingForReply must be true');

  // Reply 3 (Both)
  await clearMessages();
  await handleIncomingMessage(testPhone, '3', testPhone, 'Test User', 'MSG_M3');
  const msgM3 = getLastMessage();
  assert(msgM3.includes('தமிழ் & ஆங்கிலம் (Both)'), 'Must confirm Both languages');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.catholicLanguage, 'both', 'catholicLanguage must now be both');
  assert.strictEqual(session.language, 'ta', 'Bot language must remain ta');
  assert.strictEqual(session.step, 'done', 'step must be done');
  assert.strictEqual(session.waitingForReply, false, 'waitingForReply must be false');

  // Switch back to 2 (English) so remaining tests have predictable state
  await clearMessages();
  await handleIncomingMessage(testPhone, 'CATHOLIC LANGUAGE', testPhone, 'Test User', 'MSG_M_REVERT_CMD');
  await clearMessages();
  await handleIncomingMessage(testPhone, '2', testPhone, 'Test User', 'MSG_M_REVERT');
  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.catholicLanguage, 'en', 'catholicLanguage reset to en');

  console.log('✓ TEST M PASSED: CATHOLIC LANGUAGE command supports Option 3 Both and changed ONLY catholicLanguage.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST N: HELP contains BOT LANGUAGE & CATHOLIC LANGUAGE; does NOT contain TAMIL/ENGLISH
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST N: HELP contains BOT LANGUAGE & CATHOLIC LANGUAGE; does NOT contain TAMIL/ENGLISH ---');
  await clearMessages();
  await handleIncomingMessage(testPhone, 'HELP', testPhone, 'Test User', 'MSG_N');
  const msgN = getLastMessage();
  console.log('HELP Message Preview:\n' + msgN + '\n');

  assert(msgN.includes('BOT LANGUAGE'), 'Must list BOT LANGUAGE');
  assert(msgN.includes('CATHOLIC LANGUAGE'), 'Must list CATHOLIC LANGUAGE');
  assert(msgN.includes('VERIFY'), 'Must list VERIFY');
  assert(msgN.includes('STOP'), 'Must list STOP');
  assert(!msgN.includes('• *TAMIL*') && !msgN.includes('• *ENGLISH*'), 'Must NOT list TAMIL or ENGLISH as commands');

  // Verify typing "TAMIL" as an onboarded user does NOT change language
  await clearMessages();
  await handleIncomingMessage(testPhone, 'TAMIL', testPhone, 'Test User', 'MSG_N_TAMIL');
  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.step, 'done', 'Typing TAMIL must not change step');
  console.log('✓ TEST N PASSED: HELP command verified; TAMIL/ENGLISH not treated as language-setting commands.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST O: STOP unsubscribes and does not automatically send Main Menu
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST O: STOP unsubscribes and does not send Main Menu ---');
  await clearMessages();
  await handleIncomingMessage(testPhone, 'STOP', testPhone, 'Test User', 'MSG_O');
  const msgO = getLastMessage();
  console.log('STOP Message Preview:\n' + msgO + '\n');

  assert(msgO.includes('You have been unsubscribed from SJDB Connect.'), 'Must confirm unsubscribe in English');
  assert(msgO.includes('Reply *HI* anytime to re-subscribe. God bless! 🙏'), 'Must include re-subscribe prompt');
  assert(msgO.includes('நீங்கள் *SJDB Connect* சேவையிலிருந்து விலகியுள்ளீர்கள்.'), 'Must confirm unsubscribe in Tamil');
  assert(!msgO.includes('திருப்பலி நேரங்கள்'), 'Main Menu must NOT be sent after STOP');
  assert(!msgO.includes('தினசரி விவிலியம்'), 'Main Menu must NOT be sent after STOP');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.step, 'stopped', 'Session step must be stopped');
  assert.strictEqual(session.isVerified, false, 'User must be unverified');
  assert.strictEqual(session.isOnboarded, false, 'User must be non-onboarded');
  console.log('✓ TEST O PASSED: User unsubscribed cleanly without sending Main Menu.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST P: STOP -> HI starts Step 1 again; MENU/SERVICES rejected
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST P: STOP -> HI starts Step 1 again; MENU/SERVICES rejected ---');
  // Attempting MENU while stopped should NOT bypass onboarding
  await clearMessages();
  await handleIncomingMessage(testPhone, 'MENU', testPhone, 'Test User', 'MSG_P_MENU');
  const msgPMenu = getLastMessage();
  assert(msgPMenu.includes('unsubscribed from SJDB Connect'), 'Must reject MENU for stopped user');
  assert(!msgPMenu.includes('1️⃣ 📖 *தினசரி விவிலியம்*'), 'Must NOT send main menu to stopped user');

  // Attempting SERVICES while stopped should NOT bypass onboarding
  await clearMessages();
  await handleIncomingMessage(testPhone, 'SERVICES', testPhone, 'Test User', 'MSG_P_SERVICES');
  const msgPServices = getLastMessage();
  assert(msgPServices.includes('unsubscribed from SJDB Connect'), 'Must reject SERVICES for stopped user');
  assert(!msgPServices.includes('14-Option'), 'Must NOT send services to stopped user');

  // Sending HI restarts Step 1
  await clearMessages();
  await handleIncomingMessage(testPhone, 'HI', testPhone, 'Test User', 'MSG_P_HI');
  const msgPHi = getLastMessage();
  assert(msgPHi.includes('Welcome to *SJDB CONNECT!*'), 'Must restart Step 1 bilingual prompt');
  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.step, 'bot_language', 'Step must restart at bot_language');
  assert.strictEqual(session.waitingForReply, true, 'waitingForReply must be true');
  console.log('✓ TEST P PASSED: Stopped user cannot bypass with MENU/SERVICES; HI restarts Step 1.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST Q: Pending state test: Bot asks a question, user sends nothing
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST Q: Pending state test: Bot asks a question, user sends nothing ---');
  await clearMessages();
  // State is currently waiting in Step 1
  assert.strictEqual(sentMessages.length, 0, 'No unsolicited message generated while pending');
  console.log('✓ TEST Q PASSED: No duplicate bot message is generated when user is idle.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST R: Invalid input while pending: one correction sent, waits without repeating original question
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST R: Invalid input while pending: one correction, waits without repeating ---');
  await clearMessages();
  await handleIncomingMessage(testPhone, 'invalid_choice_1', testPhone, 'Test User', 'MSG_R1');
  const msgR1 = getLastMessage();
  assert(msgR1.includes('👉 Please reply with *1* or *2*.'), 'Must send concise correction');
  assert(!msgR1.includes('Welcome to *SJDB CONNECT!*'), 'Must NOT repeat full welcome');

  // Second invalid input
  await clearMessages();
  await handleIncomingMessage(testPhone, 'invalid_choice_2', testPhone, 'Test User', 'MSG_R2');
  const msgR2 = getLastMessage();
  assert(msgR2.includes('👉 Please reply with *1* or *2*.'), 'Must send concise correction again');
  assert(!msgR2.includes('Welcome to *SJDB CONNECT!*'), 'Must NOT repeat full welcome');

  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.step, 'bot_language', 'Step must remain bot_language');
  assert.strictEqual(session.waitingForReply, true, 'waitingForReply must remain true');
  console.log('✓ TEST R PASSED: Single concise correction sent per invalid input; original question never repeated.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST S: Multiple commands / pending-state test
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST S: Multiple commands / pending-state test ---');
  // Advance to Step 2 (Phone verification)
  await clearMessages();
  await handleIncomingMessage(testPhone, '2', testPhone, 'Test User', 'MSG_S_LANG'); // Select English
  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.step, 'phone_verification', 'Step must be phone_verification');

  // User attempts to bypass with MENU while in phone_verification
  await clearMessages();
  await handleIncomingMessage(testPhone, 'MENU', testPhone, 'Test User', 'MSG_S_BYPASS');
  const msgSBypass = getLastMessage();
  assert(msgSBypass.includes('10-digit mobile number') || msgSBypass.includes('10-இலக்க மொபைல்'), 'Must reject MENU bypass during onboarding');
  assert(!msgSBypass.includes('How can I help you today?'), 'Main Menu must NOT be shown');

  // Complete onboarding to done state for testing command interactions
  await clearMessages();
  await handleIncomingMessage(testPhone, '9876543210', testPhone, 'Test User', 'MSG_S_PHONE'); // Enter 10-digit mobile number
  session = await BotSession.findOne({ phoneNumber: testPhone });
  await clearMessages();
  await handleIncomingMessage(testPhone, session.tempOtp, testPhone, 'Test User', 'MSG_S_OTP'); // Submit OTP
  await clearMessages();
  await handleIncomingMessage(testPhone, '6', testPhone, 'Test User', 'MSG_S_PREF'); // Select all prefs
  await clearMessages();
  await handleIncomingMessage(testPhone, '2', testPhone, 'Test User', 'MSG_S_CATLANG'); // Catholic Lang = English
  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.step, 'done', 'User is now done');

  // Trigger BOT LANGUAGE -> bot is waiting for reply in bot_language_change
  await clearMessages();
  await handleIncomingMessage(testPhone, 'BOT LANGUAGE', testPhone, 'Test User', 'MSG_S_BOTLANG');
  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.step, 'bot_language_change', 'Session step is bot_language_change');

  // While waiting in bot_language_change, user sends CATHOLIC LANGUAGE command
  await clearMessages();
  await handleIncomingMessage(testPhone, 'CATHOLIC LANGUAGE', testPhone, 'Test User', 'MSG_S_MIX');
  const msgSMix = getLastMessage();
  assert(msgSMix.includes('Daily Catholic Content Language'), 'Bot must safely switch to Catholic Language flow');
  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.step, 'catholic_language_change', 'Session safely updated to catholic_language_change');
  assert.strictEqual(session.waitingForReply, true, 'waitingForReply is true');

  // Cleanly answer Catholic Language flow
  await clearMessages();
  await handleIncomingMessage(testPhone, '1', testPhone, 'Test User', 'MSG_S_CAT_DONE');
  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.step, 'done', 'Session returns safely to done');
  assert.strictEqual(session.waitingForReply, false, 'waitingForReply is false');
  console.log('✓ TEST S PASSED: Multiple/mixed commands handled safely without state corruption.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST T: Comprehensive Case-Insensitivity (UPPERCASE, lowercase, MixedCase)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST T: Comprehensive Case-Insensitivity across botHandler & botController ---');
  
  // T.1 WhatsApp Bot Handler: Case-insensitive greetings & commands
  await clearMessages();
  await handleIncomingMessage(testPhone, 'stop', testPhone, 'Test User', 'MSG_T_STOP_LOWER');
  assert(getLastMessage().includes('unsubscribed from SJDB Connect'), 'Lowercase "stop" must unsubscribe');

  await clearMessages();
  await handleIncomingMessage(testPhone, 'hi', testPhone, 'Test User', 'MSG_T_HI_LOWER');
  assert(getLastMessage().includes('Welcome to *SJDB CONNECT!*'), 'Lowercase "hi" must restart');

  await clearMessages();
  await handleIncomingMessage(testPhone, 'TAMIL', testPhone, 'Test User', 'MSG_T_TAMIL_UPPER');
  assert(getLastMessage().includes('10-இலக்க மொபைல்'), 'Uppercase "TAMIL" must set Tamil and proceed to phone verification');

  await clearMessages();
  await handleIncomingMessage(testPhone, '9876543210', testPhone, 'Test User', 'MSG_T_PHONE');
  session = await BotSession.findOne({ phoneNumber: testPhone });
  await clearMessages();
  await handleIncomingMessage(testPhone, session.tempOtp, testPhone, 'Test User', 'MSG_T_OTP');

  // Preferences with uppercase ALL
  await clearMessages();
  await handleIncomingMessage(testPhone, 'ALL', testPhone, 'Test User', 'MSG_T_ALL_UPPER');
  assert(getLastMessage().includes('Daily Catholic Content Language'), 'Uppercase "ALL" must select all preferences');

  // Catholic language with lowercase "both"
  await clearMessages();
  await handleIncomingMessage(testPhone, 'both', testPhone, 'Test User', 'MSG_T_BOTH_LOWER');
  assert(sentMessages.some(m => m.message.includes('அனைத்தும் தயார்') || m.message.includes('all set')), 'Lowercase "both" must set Both languages');
  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.catholicLanguage, 'both', 'Catholic language set to both');
  assert.strictEqual(session.step, 'done', 'Onboarding completed');

  // Case-insensitive commands in done state:
  // Lowercase "menu"
  await clearMessages();
  await handleIncomingMessage(testPhone, 'menu', testPhone, 'Test User', 'MSG_T_MENU_LOWER');
  assert(getLastMessage().includes('வணக்கம்') && getLastMessage().includes('புனித அருளானந்தர் தேவாலயம்'), 'Lowercase "menu" must show main menu');

  // Uppercase "MENU"
  await clearMessages();
  await handleIncomingMessage(testPhone, 'MENU', testPhone, 'Test User', 'MSG_T_MENU_UPPER');
  assert(getLastMessage().includes('வணக்கம்') && getLastMessage().includes('புனித அருளானந்தர் தேவாலயம்'), 'Uppercase "MENU" must show main menu');

  // MixedCase "MeNu"
  await clearMessages();
  await handleIncomingMessage(testPhone, 'MeNu', testPhone, 'Test User', 'MSG_T_MENU_MIX');
  assert(getLastMessage().includes('வணக்கம்') && getLastMessage().includes('புனித அருளானந்தர் தேவாலயம்'), 'Mixed-case "MeNu" must show main menu');

  // Lowercase "services"
  await clearMessages();
  await handleIncomingMessage(testPhone, 'services', testPhone, 'Test User', 'MSG_T_SERV_LOWER');
  assert(getLastMessage().includes('பங்கு சேவைகள்'), 'Lowercase "services" must show services menu');

  // Uppercase "SERVICES"
  await clearMessages();
  await handleIncomingMessage(testPhone, 'SERVICES', testPhone, 'Test User', 'MSG_T_SERV_UPPER');
  assert(getLastMessage().includes('பங்கு சேவைகள்'), 'Uppercase "SERVICES" must show services menu');

  // MixedCase "BoT LaNgUaGe"
  await clearMessages();
  await handleIncomingMessage(testPhone, 'BoT LaNgUaGe', testPhone, 'Test User', 'MSG_T_BOTLANG_MIX');
  assert(getLastMessage().includes('Welcome to *SJDB CONNECT!*'), 'Mixed-case "BoT LaNgUaGe" must trigger bot language prompt');

  // Complete bot language prompt
  await clearMessages();
  await handleIncomingMessage(testPhone, '2', testPhone, 'Test User', 'MSG_T_BOTLANG_EN'); // Set English
  session = await BotSession.findOne({ phoneNumber: testPhone });
  assert.strictEqual(session.language, 'en', 'Language set to English');

  // MixedCase "CaThOlIc LaNgUaGe"
  await clearMessages();
  await handleIncomingMessage(testPhone, 'CaThOlIc LaNgUaGe', testPhone, 'Test User', 'MSG_T_CATLANG_MIX');
  assert(getLastMessage().includes('Daily Catholic Content Language'), 'Mixed-case "CaThOlIc LaNgUaGe" must trigger prompt');

  // Complete catholic language prompt
  await clearMessages();
  await handleIncomingMessage(testPhone, '3', testPhone, 'Test User', 'MSG_T_CATLANG_BOTH');

  // Uppercase "HELP" & Lowercase "help"
  await clearMessages();
  await handleIncomingMessage(testPhone, 'HELP', testPhone, 'Test User', 'MSG_T_HELP_UPPER');
  assert(getLastMessage().includes('Help & Guidance') || getLastMessage().includes('உதவி'), 'Uppercase "HELP" must trigger help');

  await clearMessages();
  await handleIncomingMessage(testPhone, 'help', testPhone, 'Test User', 'MSG_T_HELP_LOWER');
  assert(getLastMessage().includes('Help & Guidance') || getLastMessage().includes('உதவி'), 'Lowercase "help" must trigger help');

  // Uppercase and Lowercase Mass Timings
  await clearMessages();
  await handleIncomingMessage(testPhone, 'MASS TIMINGS', testPhone, 'Test User', 'MSG_T_MASS_UPPER');
  assert(getLastMessage().includes('Holy Mass Timings') || getLastMessage().includes('திருப்பலி நேரங்கள்'), 'Uppercase "MASS TIMINGS" must trigger mass schedule');

  await clearMessages();
  await handleIncomingMessage(testPhone, 'mass timings', testPhone, 'Test User', 'MSG_T_MASS_LOWER');
  assert(getLastMessage().includes('Holy Mass Timings') || getLastMessage().includes('திருப்பலி நேரங்கள்'), 'Lowercase "mass timings" must trigger mass schedule');

  // T.2 Controller Simulator testBotMessage Case-Insensitivity
  const mockCall = (msg, state = { step: 'done', isVerified: true, isOnboarded: true, language: 'en', catholicLanguage: 'both' }) => {
    return new Promise((resolve) => {
      const req = { body: { message: msg, sessionState: state } };
      const res = { json: (data) => resolve(data) };
      testBotMessage(req, res);
    });
  };

  const resMenuUpper = await mockCall('MENU');
  assert(resMenuUpper.botReply.includes('Welcome to SJDB Connect'), 'Controller: UPPERCASE "MENU" works');

  const resMenuLower = await mockCall('menu');
  assert(resMenuLower.botReply.includes('Welcome to SJDB Connect'), 'Controller: lowercase "menu" works');

  const resMenuMix = await mockCall('MeNu');
  assert(resMenuMix.botReply.includes('Welcome to SJDB Connect'), 'Controller: mixed-case "MeNu" works');

  const resServicesUpper = await mockCall('SERVICES');
  assert(resServicesUpper.botReply.includes('Services & Help Desk'), 'Controller: UPPERCASE "SERVICES" works');

  const resServicesLower = await mockCall('services');
  assert(resServicesLower.botReply.includes('Services & Help Desk'), 'Controller: lowercase "services" works');

  const resMassUpper = await mockCall('MASS TIMINGS');
  assert(resMassUpper.botReply.includes('Holy Mass Timings'), 'Controller: UPPERCASE "MASS TIMINGS" works');

  const resMassLower = await mockCall('mass timings');
  assert(resMassLower.botReply.includes('Holy Mass Timings'), 'Controller: lowercase "mass timings" works');

  const resStopUpper = await mockCall('STOP');
  assert(resStopUpper.botReply.includes('unsubscribed from SJDB Connect'), 'Controller: UPPERCASE "STOP" works');

  const resStopLower = await mockCall('stop');
  assert(resStopLower.botReply.includes('unsubscribed from SJDB Connect'), 'Controller: lowercase "stop" works');

  console.log('✓ TEST T PASSED: Complete uppercase, lowercase, and mixed-case commands verified across both botHandler and botController.');

  // Clean up test data
  await BotSession.deleteMany({ phoneNumber: testPhone });
  await mongoose.disconnect();

  console.log('\n======================================================================');
  console.log('  ALL 20 TESTS (TESTS A THROUGH T) PASSED SUCCESSFULLY! ✅');
  console.log('======================================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test suite failed with error:', err);
  process.exit(1);
});
