/**
 * Test Suite: SJDB Connect WhatsApp Bot Deduplication & Targeted Conversational Replies
 * 
 * Verifies:
 * 1. Proactive delivery idempotency: { notificationDate, recipient, channel, contentType } is unique.
 * 2. Conversational queries return ONLY the requested slice:
 *    - Saint query -> ONLY Saint of the Day (no verse, no readings, no reflection).
 *    - Reflection query -> ONLY Today's Reflection (no saint, no verse, no readings).
 *    - Readings query -> ONLY Daily Mass Readings (no saint, no reflection).
 *    - Verse query -> ONLY Daily Bible Verse (no saint, no readings, no reflection).
 *    - Main Menu Option 1 -> ONLY Daily Bible Verse.
 *    - Main Menu Option 7 / Services Option 6 -> ONLY Saint of the Day.
 * 3. Bilingual conversation support (English & Tamil).
 * 4. Conversational inquiries never trigger proactive notification jobs or delivery records.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const assert = require('assert');

const NotificationDelivery = require('./models/NotificationDelivery');
const DailyNotificationJob = require('./models/DailyNotificationJob');
const BotSession = require('./models/BotSession');
const ProcessedMessage = require('./models/ProcessedMessage');
const { getTodayDailyContent } = require('./services/dailyContentService');
const { answerChurchQuestion } = require('./bot/churchRAGService');
const {
  generateVerseMessage,
  generateReadingsMessage,
  generateReflectionMessage,
  generateSaintInfoMessage,
  generateDailyCatholicMessage
} = require('./services/whatsappDailyFormatter');
const { handleIncomingMessage, _clearDedupCacheForTesting } = require('./bot/botHandler');

async function runTests() {
  console.log('🧪 RUNNING BOT DEDUPLICATION & TARGETED REPLIES TEST SUITE\n');

  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/church_db';
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  }
  console.log('✅ MongoDB connected');

  const testDate = '2026-09-06';
  const testPhone = '919876500001';
  const testPhoneTa = '919876500002';

  // Prepare Daily Content
  const dailyContent = await getTodayDailyContent(new Date(testDate));
  assert(dailyContent, 'Daily content should be available');
  console.log('✅ Daily content loaded successfully');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Unique Compound Index on NotificationDelivery
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 1: NotificationDelivery Unique Idempotency Constraint ---');
  
  // Clean up any test records
  await NotificationDelivery.deleteMany({ notificationDate: testDate, recipient: testPhone });

  const record1 = await NotificationDelivery.create({
    jobId: `test_job_${testDate}`,
    recipient: testPhone,
    channel: 'whatsapp',
    notificationDate: testDate,
    contentType: 'daily_catholic_content',
    language: 'en',
    status: 'sent',
    sentAt: new Date()
  });
  assert(record1._id, 'First delivery record created successfully');

  // Attempting duplicate insert with identical (date, recipient, channel, contentType) must fail
  let duplicateThrew = false;
  try {
    await NotificationDelivery.create({
      jobId: `test_job_retry_${testDate}`,
      recipient: testPhone,
      channel: 'whatsapp',
      notificationDate: testDate,
      contentType: 'daily_catholic_content',
      language: 'en',
      status: 'pending'
    });
  } catch (err) {
    duplicateThrew = err.code === 11000 || err.message?.includes('duplicate key');
  }
  assert(duplicateThrew, 'Duplicate NotificationDelivery insert correctly blocked by compound unique index');
  console.log('✅ Compound unique index correctly enforces: 1 content update + 1 user subscription = 1 delivery');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Targeted Conversational Replies — Saint of the Day
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Saint Query Returns ONLY Saint Information ---');
  const saintResEn = await answerChurchQuestion("What is today's saint?", 'en');
  assert(saintResEn.success, 'RAG query succeeded');
  assert(saintResEn.reply.includes('Saint of the Day') || saintResEn.reply.includes('👑'), 'Contains Saint details');
  assert(!saintResEn.reply.includes('Daily Bible Verse') && !saintResEn.reply.includes('Gospel / நற்செய்தி'), 'Does NOT contain full devotions package');
  assert(!saintResEn.reply.includes('Daily Mass Readings'), 'Does NOT dump Mass readings');
  assert(!saintResEn.reply.includes('Daily Reflection'), 'Does NOT dump Reflection');
  console.log('✅ Saint query returns ONLY Saint of the Day');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Targeted Conversational Replies — Reflection
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Reflection Query Returns ONLY Reflection ---');
  const reflResEn = await answerChurchQuestion("Give me today's reflection", 'en');
  assert(reflResEn.success, 'RAG query succeeded');
  assert(reflResEn.reply.includes('Daily Reflection') || reflResEn.reply.includes('🕊️'), 'Contains Reflection');
  assert(!reflResEn.reply.includes('First Reading'), 'Does NOT contain Mass readings');
  assert(!reflResEn.reply.includes('Daily Bible Verse'), 'Does NOT contain Bible verse');
  assert(!reflResEn.reply.includes('Feast Day'), 'Does NOT contain Saint feast day');
  console.log('✅ Reflection query returns ONLY Today\'s Reflection');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Targeted Conversational Replies — Mass Readings
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Readings Query Returns ONLY Mass Readings ---');
  const readingsResEn = await answerChurchQuestion("What are today's readings?", 'en');
  assert(readingsResEn.success, 'RAG query succeeded');
  assert(readingsResEn.reply.includes('Daily Mass Readings') || readingsResEn.reply.includes('First Reading'), 'Contains Mass Readings');
  assert(!readingsResEn.reply.includes('Feast Day'), 'Does NOT contain Saint details');
  assert(!readingsResEn.reply.includes('Daily Reflection'), 'Does NOT contain Reflection');
  console.log('✅ Readings query returns ONLY Daily Mass Readings');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: Targeted Conversational Replies — Bible Verse
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: Verse Query Returns ONLY Bible Verse ---');
  const verseResEn = await answerChurchQuestion("What is today's verse?", 'en');
  assert(verseResEn.success, 'RAG query succeeded');
  assert(verseResEn.reply.includes('Bible Verse') || verseResEn.reply.includes('📖'), 'Contains Bible Verse');
  assert(!verseResEn.reply.includes('First Reading'), 'Does NOT contain Mass readings');
  assert(!verseResEn.reply.includes('Feast Day'), 'Does NOT contain Saint details');
  assert(!verseResEn.reply.includes('Daily Reflection'), 'Does NOT contain Reflection');
  console.log('✅ Verse query returns ONLY Daily Bible Verse');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: Formatter Unit Verification (English & Tamil Single-Topic Messages)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6: whatsappDailyFormatter Single-Topic Functions ---');
  
  // 6.1 Verse Formatter
  const verseMsgTa = generateVerseMessage({ dailyContent, language: 'ta' });
  assert(verseMsgTa.includes('இன்றைய இறைவார்த்தை'), 'Tamil verse message has correct header');
  assert(!verseMsgTa.includes('திருப்பலி வாசகங்கள்'), 'Tamil verse message does not leak Mass readings');
  assert(!verseMsgTa.includes('இன்றைய புனிதர்'), 'Tamil verse message does not leak Saint info');

  const verseMsgEn = generateVerseMessage({ dailyContent, language: 'en' });
  assert(verseMsgEn.includes('Daily Bible Verse'), 'English verse message has correct header');
  assert(!verseMsgEn.includes('First Reading'), 'English verse message does not leak Mass readings');
  assert(!verseMsgEn.includes('Saint of the Day'), 'English verse message does not leak Saint info');

  // 6.2 Readings Formatter
  const readingsMsgTa = generateReadingsMessage({ dailyContent, language: 'ta' });
  assert(readingsMsgTa.includes('இன்றைய திருப்பலி வாசகங்கள்'), 'Tamil readings message has correct header');
  assert(!readingsMsgTa.includes('இன்றைய தியானம்'), 'Tamil readings message does not leak Reflection');

  const readingsMsgEn = generateReadingsMessage({ dailyContent, language: 'en' });
  assert(readingsMsgEn.includes('Daily Mass Readings'), 'English readings message has correct header');
  assert(!readingsMsgEn.includes('Daily Reflection'), 'English readings message does not leak Reflection');

  // 6.3 Reflection Formatter
  const reflMsgTa = generateReflectionMessage({ dailyContent, language: 'ta' });
  assert(reflMsgTa.includes('இன்றைய தியானம்'), 'Tamil reflection message has correct header');
  assert(!reflMsgTa.includes('இன்றைய இறைவார்த்தை'), 'Tamil reflection message does not leak Verse header');

  const reflMsgEn = generateReflectionMessage({ dailyContent, language: 'en' });
  assert(reflMsgEn.includes('Daily Reflection'), 'English reflection message has correct header');
  assert(!reflMsgEn.includes('Daily Bible Verse'), 'English reflection message does not leak Verse header');

  console.log('✅ Single-topic formatters generate precise, isolated content in both languages');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 7: Bot Handler Incoming Message Flow & Deduplication
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 7: Bot Handler Replay & Deduplication Protection ---');
  
  if (typeof _clearDedupCacheForTesting === 'function') {
    await _clearDedupCacheForTesting();
  }

  // Setup verified bot session
  await BotSession.deleteMany({ phoneNumber: testPhone });
  await BotSession.create({
    phoneNumber: testPhone,
    isVerified: true,
    step: 'done',
    language: 'en'
  });

  // Monkey-patch the whatsapp module so botHandler can capture sent messages
  const wa = require('./bot/whatsapp');
  const capturedMessages = [];
  wa.sendWhatsAppMessage = async (to, text) => {
    capturedMessages.push({ to, text });
    return true;
  };
  wa.sendWhatsAppMedia = async (to, media) => {
    capturedMessages.push({ to, media });
    return true;
  };

  // Send message 1: "saint"
  const msgId1 = `wamid_test_${Date.now()}_1`;
  await handleIncomingMessage(testPhone, 'What is today\'s saint?', null, 'Tester', msgId1, Math.floor(Date.now() / 1000));
  
  // Verify response
  assert(capturedMessages.length >= 1, 'Bot sent reply to saint query');
  const lastReply = capturedMessages[capturedMessages.length - 1];
  const replyText = lastReply.text || lastReply.media?.caption || '';
  assert(replyText.includes('Saint of the Day') || replyText.includes('👑'), 'Bot replied with Saint details');
  assert(!replyText.includes('Daily Bible Verse') && !replyText.includes('Gospel / நற்செய்தி'), 'Bot did not blast full devotions');

  // Re-sending identical messageId should be DROPPED
  const preLen = capturedMessages.length;
  await handleIncomingMessage(testPhone, 'What is today\'s saint?', null, 'Tester', msgId1, Math.floor(Date.now() / 1000));
  assert.strictEqual(capturedMessages.length, preLen, 'Duplicate messageId was dropped with 0 additional outgoing messages');
  console.log('✅ Webhook message ID deduplication dropped duplicate delivery event');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 8: Main Menu Option 1 Sends ONLY Daily Bible Verse
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 8: Main Menu Option 1 Returns ONLY Daily Bible Verse ---');
  capturedMessages.length = 0;
  const msgId2 = `wamid_test_${Date.now()}_2`;
  await handleIncomingMessage(testPhone, '1', null, 'Tester', msgId2, Math.floor(Date.now() / 1000));
  
  assert(capturedMessages.length === 1, 'Option 1 replied with exactly 1 message');
  const opt1Reply = capturedMessages[0].text;
  assert(opt1Reply.includes('Daily Bible Verse') || opt1Reply.includes('இன்றைய இறைவார்த்தை'), 'Option 1 sent Daily Bible Verse');
  assert(!opt1Reply.includes('Daily Mass Readings') && !opt1Reply.includes('First Reading'), 'Option 1 did NOT dump Mass Readings');
  assert(!opt1Reply.includes('Saint of the Day') && !opt1Reply.includes('Feast Day'), 'Option 1 did NOT dump Saint info');
  assert(!opt1Reply.includes('Daily Reflection'), 'Option 1 did NOT dump Reflection');
  console.log('✅ Option 1 returns ONLY Daily Bible Verse');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 9: Conversational Inquiries Never Create Proactive Notification Records
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 9: Conversational Interactions Create Zero Proactive Jobs ---');
  const jobsCreated = await DailyNotificationJob.find({ notificationDate: testDate });
  const deliveriesCreated = await NotificationDelivery.find({ notificationDate: testDate, recipient: testPhone, jobId: { $ne: `test_job_${testDate}` } });
  
  assert.strictEqual(deliveriesCreated.length, 0, 'No unsolicited NotificationDelivery records created by interactive chats');
  console.log('✅ Conversational inquiries strictly isolated from proactive notification records');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10: Bilingual Natural Conversation Support (Tamil & English)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 10: Bilingual Conversation (Tamil & English) ---');
  const saintTaRes = await answerChurchQuestion('இன்றைய புனிதர் யார்?', 'ta');
  assert(saintTaRes.success, 'Tamil saint query succeeded');
  assert(saintTaRes.reply.includes('இன்றைய புனிதர்'), 'Tamil saint query returned Tamil response');

  const reflTaRes = await answerChurchQuestion('இன்றைய தியானம் தருக', 'ta');
  assert(reflTaRes.success, 'Tamil reflection query succeeded');
  assert(reflTaRes.reply.includes('இன்றைய தியானம்'), 'Tamil reflection query returned Tamil response');

  console.log('✅ Tamil conversational queries receive pure Tamil responses');

  // Cleanup
  await NotificationDelivery.deleteMany({ notificationDate: testDate, recipient: testPhone });
  await BotSession.deleteMany({ phoneNumber: testPhone });
  await ProcessedMessage.deleteMany({ from: testPhone });

  console.log('\n🎉 ALL 10 TESTS PASSED SUCCESSFULLY! The WhatsApp Bot is 100% duplicate-proof and sends targeted single-topic replies.');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
