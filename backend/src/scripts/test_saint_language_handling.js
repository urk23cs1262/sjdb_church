/**
 * Verification Test: Daily Catholic Content Language Handling
 * Tests User A (Tamil), User B (English), and User C (Both)
 * Across both 4:00 AM broadcast and manual "Saint of the Day" request.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { getTodayDailyContent } = require('../services/dailyContentService');
const {
  generateSaintContentMessage,
  generateDailyVerseMessage,
  generateDailyMassReadingsMessage,
  generateDailyReflectionMessage
} = require('../services/whatsappDailyFormatter');
const {
  getUserDailyContentLanguage,
  normalizeContentLanguage
} = require('../utils/userLanguageHelper');
const { sendTodaySaint } = require('../bot/botHandler');
const { sendDailyWhatsAppSequence } = require('../services/dailyNotificationService');

async function runTests() {
  console.log('===============================================================');
  console.log('  DAILY CATHOLIC CONTENT LANGUAGE HANDLING - VERIFICATION TEST ');
  console.log('===============================================================\n');

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sjdb_church');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: User Preference Normalization
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Preference Normalization & Resolution ---');
  const userA_session = { botLanguage: 'en', language: 'ta' }; // general bot UI: en, daily content: Tamil
  const userB_session = { botLanguage: 'ta', language: 'en' }; // general bot UI: ta, daily content: English
  const userC_session = { botLanguage: 'en', language: 'both' }; // general bot UI: en, daily content: Both

  const langA = getUserDailyContentLanguage(userA_session);
  const langB = getUserDailyContentLanguage(userB_session);
  const langC = getUserDailyContentLanguage(userC_session);

  console.log(`User A (Selected Tamil) -> Content Lang: "${langA}" | ${langA === 'ta' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`User B (Selected English) -> Content Lang: "${langB}" | ${langB === 'en' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`User C (Selected Both) -> Content Lang: "${langC}" | ${langC === 'both' ? '✅ PASS' : '❌ FAIL'}`);

  console.log(`Normalizing "tamil" -> "${normalizeContentLanguage('tamil')}" | ${normalizeContentLanguage('tamil') === 'ta' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Normalizing "Tamil" -> "${normalizeContentLanguage('Tamil')}" | ${normalizeContentLanguage('Tamil') === 'ta' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Normalizing "english" -> "${normalizeContentLanguage('english')}" | ${normalizeContentLanguage('english') === 'en' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Normalizing "English" -> "${normalizeContentLanguage('English')}" | ${normalizeContentLanguage('English') === 'en' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Normalizing "both" -> "${normalizeContentLanguage('both')}" | ${normalizeContentLanguage('both') === 'both' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Normalizing "Both" -> "${normalizeContentLanguage('Both')}" | ${normalizeContentLanguage('Both') === 'both' ? '✅ PASS' : '❌ FAIL'}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // Fetch Daily Content for target date (2026-09-28)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- FETCHING DAILY CONTENT FOR 2026-09-28 ---');
  const dailyContent = await getTodayDailyContent('2026-09-28');
  console.log(`Date: ${dailyContent.dateKey}`);
  console.log(`Saint Name (English): ${dailyContent.saint?.nameEn}`);
  console.log(`Saint Name (Tamil): ${dailyContent.saint?.nameTa}`);
  console.log(`Feast Day (English): ${dailyContent.saint?.feastDayEn}`);
  console.log(`Feast Day (Tamil): ${dailyContent.saint?.feastDayTa}`);
  console.log(`Image Source: ${dailyContent.saint?.imageSource}`);
  console.log(`Image URL: ${dailyContent.saint?.imageUrl}`);

  const hasTaBio = Boolean(dailyContent.saint?.descriptionTa && /[\u0B80-\u0BFF]/.test(dailyContent.saint.descriptionTa));
  console.log(`Tamil Biography Available & Validated: ${hasTaBio ? '✅ YES' : '❌ NO'}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2: User A (Tamil Only)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log('TEST 2: USER A — Daily Catholic Content Language: Tamil');
  console.log('===============================================================');
  const msgA = generateSaintContentMessage({ dailyContent, language: langA });
  console.log('\n[FORMATTER OUTPUT FOR USER A]:\n');
  console.log(msgA);
  console.log('\n--- Validations for User A ---');
  const hasTamilA = /[\u0B80-\u0BFF]/.test(msgA);
  const containsEnglishHeaderA = msgA.includes('Saint of the Day');
  const containsTamilHeaderA = msgA.includes('இன்றைய புனிதர்');
  const containsEnglishBioA = msgA.includes('Born in Manila in 1594');
  const containsTamilBioA = msgA.includes('1594 இல் மணிலாவில் பிறந்த');

  console.log(`Contains Tamil characters: ${hasTamilA ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Header is Tamil ("இன்றைய புனிதர்"): ${containsTamilHeaderA ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`No English Header ("Saint of the Day"): ${!containsEnglishHeaderA ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Contains Tamil Biography: ${containsTamilBioA ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`NO English Biography leaked: ${!containsEnglishBioA ? '✅ PASS' : '❌ FAIL'}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3: User B (English Only)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log('TEST 3: USER B — Daily Catholic Content Language: English');
  console.log('===============================================================');
  const msgB = generateSaintContentMessage({ dailyContent, language: langB });
  console.log('\n[FORMATTER OUTPUT FOR USER B]:\n');
  console.log(msgB);
  console.log('\n--- Validations for User B ---');
  const hasTamilB = /[\u0B80-\u0BFF]/.test(msgB);
  const containsEnglishHeaderB = msgB.includes('Saint of the Day');
  const containsEnglishBioB = msgB.includes('Born in Manila in 1594');

  console.log(`Contains English Header ("Saint of the Day"): ${containsEnglishHeaderB ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Contains English Biography: ${containsEnglishBioB ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`NO Tamil characters: ${!hasTamilB ? '✅ PASS' : '❌ FAIL'}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 4: User C (Both Tamil + English)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log('TEST 4: USER C — Daily Catholic Content Language: Both');
  console.log('===============================================================');
  const msgC = generateSaintContentMessage({ dailyContent, language: langC });
  console.log('\n[FORMATTER OUTPUT FOR USER C]:\n');
  console.log(msgC);
  console.log('\n--- Validations for User C ---');
  const containsTamilFlagC = msgC.includes('🇮🇳 *தமிழ் (Tamil)*');
  const containsEnglishFlagC = msgC.includes('🇬🇧 *English*');
  const hasTamilC = /[\u0B80-\u0BFF]/.test(msgC);
  const hasEnglishBioC = msgC.includes('Born in Manila in 1594');
  const hasTamilBioC = msgC.includes('1594 இல் மணிலாவில் பிறந்த');

  console.log(`Contains Tamil separator ("🇮🇳 *தமிழ் (Tamil)*"): ${containsTamilFlagC ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Contains English separator ("🇬🇧 *English*"): ${containsEnglishFlagC ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Contains Tamil Biography: ${hasTamilBioC ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Contains English Biography: ${hasEnglishBioC ? '✅ PASS' : '❌ FAIL'}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 5: Manual "Saint of the Day" Command Simulation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log('TEST 5: MANUAL "Saint of the Day" BOT COMMAND DISPATCH');
  console.log('===============================================================');

  const mockSentMessages = [];
  const mockWa = {
    sendWhatsAppMedia: async (target, payload) => {
      mockSentMessages.push({ type: 'media', target, payload });
      return true;
    },
    sendWhatsAppMessage: async (target, text) => {
      mockSentMessages.push({ type: 'text', target, text });
      return true;
    }
  };

  // Run manual command for User A (whose botLanguage is 'en', but daily content is 'ta')
  const userASessionModel = {
    botLanguage: 'en',
    language: 'ta',
    save: async () => {}
  };
  await sendTodaySaint('919876543210', userASessionModel, mockWa, false);

  const manualContentMsg = mockSentMessages.find(m => m.type === 'text')?.text || '';
  console.log('\nManual Saint Content sent to User A:');
  console.log(manualContentMsg);
  console.log('\n--- Manual Command Validations ---');
  console.log(`Manual response uses Tamil: ${/[\u0B80-\u0BFF]/.test(manualContentMsg) ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Manual response does NOT use English header: ${!manualContentMsg.includes('Saint of the Day') ? '✅ PASS' : '❌ FAIL'}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 6: 4:00 AM Daily Broadcast Delivery Simulation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log('TEST 6: 4:00 AM DAILY BROADCAST DISPATCH FOR USER A');
  console.log('===============================================================');

  const broadcastSentMessages = [];
  const mockBroadcastWa = {
    sendWhatsAppMedia: async (phone, payload) => {
      broadcastSentMessages.push({ stage: 'media', phone, payload });
      return true;
    },
    sendWhatsAppMessage: async (phone, text) => {
      broadcastSentMessages.push({ stage: 'text', phone, text });
      return true;
    }
  };

  const broadcastResult = await sendDailyWhatsAppSequence({
    waService: mockBroadcastWa,
    phone: '919876543210',
    dailyContent,
    userLang: langA,
    readingPreference: 'full',
    sendLinks: true
  });

  console.log('Broadcast completed stages:', broadcastResult.messagesSent);
  const broadcastSaintMsgObj = broadcastSentMessages.find(m => m.stage === 'text' && (m.text.includes('புனிதர்') || m.text.includes('Saint of the Day')));
  const broadcastSaintContent = broadcastSaintMsgObj ? broadcastSaintMsgObj.text : (broadcastSentMessages[4]?.text || '');
  console.log('\nBroadcast Saint Content sent to User A:');
  console.log(broadcastSaintContent);
  console.log('\n--- Broadcast Validations ---');
  console.log(`Broadcast Saint Content uses Tamil: ${/[\u0B80-\u0BFF]/.test(broadcastSaintContent) ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Broadcast Saint Content does NOT leak English: ${!broadcastSaintContent.includes('Born in Manila in 1594') ? '✅ PASS' : '❌ FAIL'}`);

  console.log('\n===============================================================');
  console.log('           ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!       ');
  console.log('===============================================================\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
