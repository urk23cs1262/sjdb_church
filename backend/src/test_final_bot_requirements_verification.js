/**
 * Verification Test Suite: Canonical Links (st-jb-church.vercel.app) & English-First Bot Interaction
 */

const mongoose = require('mongoose');
const { getBaseClientUrl, getSiteUrl, SITE_ROUTES } = require('./config/siteRoutes');
const { generateSaintInfoMessage, generateDailyLinksMessage } = require('./services/whatsappDailyFormatter');
const { getTodayDailyContent } = require('./services/dailyContentService');
const { handleIncomingMessage } = require('./bot/botHandler');
const BotSession = require('./models/BotSession');

async function runTests() {
  console.log('========================================================================');
  console.log('🚀 RUNNING FINAL BOT REQUIREMENTS TESTS: LINKS & ENGLISH-FIRST FLOW');
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

  // ── TEST 1: Canonical Base URL & Routes ──────────────────────────────────────
  const baseUrl = getBaseClientUrl();
  assert(baseUrl === 'https://st-jb-church.vercel.app', `Base Client URL is https://st-jb-church.vercel.app (${baseUrl})`);

  const expectedRoutes = [
    { key: 'DAILY_READINGS', route: SITE_ROUTES.DAILY_READINGS, expected: 'https://st-jb-church.vercel.app/bible-verse#readings' },
    { key: 'DAILY_VERSE', route: SITE_ROUTES.DAILY_VERSE, expected: 'https://st-jb-church.vercel.app/bible-verse#verse' },
    { key: 'DAILY_REFLECTION', route: SITE_ROUTES.DAILY_REFLECTION, expected: 'https://st-jb-church.vercel.app/bible-verse#reflection' },
    { key: 'SAINT_OF_THE_DAY', route: SITE_ROUTES.SAINT_OF_THE_DAY, expected: 'https://st-jb-church.vercel.app/bible-verse#saint-of-the-day' },
    { key: 'EVENTS', route: SITE_ROUTES.EVENTS, expected: 'https://st-jb-church.vercel.app/events' },
    { key: 'ANNOUNCEMENTS', route: SITE_ROUTES.ANNOUNCEMENTS, expected: 'https://st-jb-church.vercel.app/announcements' },
    { key: 'PROFILE', route: SITE_ROUTES.PROFILE, expected: 'https://st-jb-church.vercel.app/dashboard/profile' },
    { key: 'MASS_TIMINGS', route: SITE_ROUTES.MASS_TIMINGS, expected: 'https://st-jb-church.vercel.app/mass-timings' },
    { key: 'PRIESTS', route: SITE_ROUTES.PRIESTS, expected: 'https://st-jb-church.vercel.app/priests' }
  ];

  for (const { key, route, expected } of expectedRoutes) {
    const fullUrl = getSiteUrl(route);
    assert(fullUrl === expected, `Route ${key} resolves exactly to ${expected}`);
  }

  // ── TEST 2: Saint Message & Links Message Canonical URL Parity ──────────────
  const dailyContent = await getTodayDailyContent(new Date());
  const saintMsgEn = generateSaintInfoMessage({ dailyContent, language: 'en' });
  assert(saintMsgEn.includes('https://st-jb-church.vercel.app/bible-verse#saint-of-the-day'), 'Saint message includes exact canonical URL with https://st-jb-church.vercel.app');

  const linksMsgEn = generateDailyLinksMessage({ dailyContent, language: 'en' });
  assert(linksMsgEn.includes('https://st-jb-church.vercel.app/bible-verse#verse'), 'Links message has https://st-jb-church.vercel.app/bible-verse#verse');
  assert(linksMsgEn.includes('https://st-jb-church.vercel.app/bible-verse#readings'), 'Links message has https://st-jb-church.vercel.app/bible-verse#readings');
  assert(linksMsgEn.includes('https://st-jb-church.vercel.app/bible-verse#reflection'), 'Links message has https://st-jb-church.vercel.app/bible-verse#reflection');
  assert(linksMsgEn.includes('https://st-jb-church.vercel.app/bible-verse#saint-of-the-day'), 'Links message has https://st-jb-church.vercel.app/bible-verse#saint-of-the-day');

  // ── TEST 3: Verified User Greeting in English & Case-Insensitivity ──────────
  const mockPhone = '919876543299';
  const mockJid = `${mockPhone}@s.whatsapp.net`;

  // Test case permutations of greeting on verified user
  const greetings = ['Hi', 'HI', 'hi', 'hI', 'Hello', 'HELLO', 'menu', 'MENU'];

  const { _clearDedupCacheForTesting } = require('./bot/botHandler');

  for (const greet of greetings) {
    // Fresh verified session start
    await BotSession.deleteMany({ phoneNumber: mockPhone });
    await BotSession.create({
      phoneNumber: mockPhone,
      isVerified: true,
      providedPhone: '9876543299',
      step: 'done',
      isOnboarded: true,
      language: 'en'
    });
    _clearDedupCacheForTesting();
    
    // Mock WA capture
    let capturedReply = '';
    const originalSend = require('./bot/whatsapp').sendWhatsAppMessage;
    require('./bot/whatsapp').sendWhatsAppMessage = async (target, text) => {
      capturedReply = text;
      return true;
    };

    await handleIncomingMessage(mockPhone, greet, mockJid, 'John');

    assert(capturedReply.includes('Welcome to SJDB Connect!'), `Greeting "${greet}" returns English welcome header`);
    assert(capturedReply.includes('How can I help you today?'), `Greeting "${greet}" has "How can I help you today?"`);
    assert(capturedReply.includes('1️⃣ 📖 *Daily Bible*'), `Greeting "${greet}" contains "1️⃣ 📖 *Daily Bible*"`);
    assert(capturedReply.includes('2️⃣ ⛪ *Mass Timings*'), `Greeting "${greet}" contains "2️⃣ ⛪ *Mass Timings*"`);
    assert(capturedReply.includes('3️⃣ 🕊️ *Services*'), `Greeting "${greet}" contains "3️⃣ 🕊️ *Services*"`);
    assert(capturedReply.includes('4️⃣ 📅 *Events*'), `Greeting "${greet}" contains "4️⃣ 📅 *Events*"`);
    assert(capturedReply.includes('5️⃣ 📢 *Announcements*'), `Greeting "${greet}" contains "5️⃣ 📢 *Announcements*"`);
    assert(capturedReply.includes('6️⃣ 📜 *Church Information*'), `Greeting "${greet}" contains "6️⃣ 📜 *Church Information*"`);
    assert(capturedReply.includes('7️⃣ 🌟 *Saint of the Day*'), `Greeting "${greet}" contains "7️⃣ 🌟 *Saint of the Day*"`);
    assert(capturedReply.includes('8️⃣ ❓ *Help*'), `Greeting "${greet}" contains "8️⃣ ❓ *Help*"`);
    assert(capturedReply.includes('reply with a number or ask your question naturally'), `Greeting "${greet}" contains reply guidance`);

    // Restore
    require('./bot/whatsapp').sendWhatsAppMessage = originalSend;
  }

  // ── TEST 4: Switching Daily Catholic Content Language to Tamil ───────────────
  let capturedTamilReply = '';
  const originalSend = require('./bot/whatsapp').sendWhatsAppMessage;
  require('./bot/whatsapp').sendWhatsAppMessage = async (target, text) => {
    capturedTamilReply = text;
    return true;
  };

  _clearDedupCacheForTesting();
  await handleIncomingMessage(mockPhone, 'TAMIL', mockJid, 'John');
  assert(capturedTamilReply.includes('Daily Catholic Content Language set to Tamil (தமிழ்)'), 'Switching to "TAMIL" confirms Catholic content language in Tamil');

  const updatedSession = await BotSession.findOne({ phoneNumber: mockPhone });
  assert(updatedSession.language === 'ta', 'Session language updated to "ta"');

  _clearDedupCacheForTesting();
  // Verify next MENU request remains in English (Bot interface is English only)
  let capturedMenuReply = '';
  require('./bot/whatsapp').sendWhatsAppMessage = async (target, text) => {
    capturedMenuReply = text;
    return true;
  };

  await handleIncomingMessage(mockPhone, 'MENU', mockJid, 'John');
  assert(capturedMenuReply.includes('Welcome to SJDB Connect!'), 'Subsequent "MENU" request UI remains in English');
  assert(capturedMenuReply.includes('1️⃣ 📖 *Daily Bible*'), 'Menu has English "Daily Bible"');

  // Clean up test session
  await BotSession.deleteMany({ phoneNumber: mockPhone });
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
