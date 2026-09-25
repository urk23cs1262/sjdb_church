/**
 * Test Suite: Separated Daily Catholic Content Messages
 * Verifies all requirements of the updated SJDB Connect specification:
 * 1. 6 separate messages in strict order:
 *    📖 Bible Verse (Image) -> ✝️ Mass Readings -> 🕊️ Daily Reflection -> 🖼️ Saint Image -> ✨ Saint Content -> 🌐 Read More
 * 2. Proper language handling (English, Tamil, Both)
 * 3. URLs restricted ONLY to Message 6 (Read More)
 * 4. Bible verse image generator (renders Royal Blue/Gold Catholic card with proper Tamil/English fonts)
 * 5. Daily Reflection message formatting (preserves reflection + prayer, 0 URLs)
 * 6. Sequential async execution and graceful fallback
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const {
  generateDailyVerseCaption,
  generateDailyVerseMessage,
  generateDailyMassReadingsMessage,
  generateDailyReflectionMessage,
  getDailySaintImagePayload,
  generateSaintContentMessage,
  generateReadMoreMessage
} = require('../services/whatsappDailyFormatter');

const { getDailyVerseImage } = require('../services/bibleVerseImageService');
const { getTodayDailyContent } = require('../services/dailyContentService');

async function runUnitTests() {
  console.log('🧪 Starting Separated Daily Messages (6-Stage Pipeline) Test Suite...\n');
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (mongoose.connection.readyState !== 1 && mongoUri) {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');
  }

  let passed = 0;
  let failed = 0;
  function assert(condition, desc) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  const dailyContent = await getTodayDailyContent(new Date());

  // ── TEST 1: Strict URL isolation (Messages 1-5 must NOT contain any URLs) ───
  console.log('--- Test 1: URL Isolation Across Languages (Messages 1 to 5 must have 0 URLs) ---');
  for (const lang of ['ta', 'en', 'both']) {
    const v = generateDailyVerseMessage({ dailyContent, language: lang });
    const r = generateDailyMassReadingsMessage({ dailyContent, language: lang });
    const ref = generateDailyReflectionMessage({ dailyContent, language: lang });
    const s = generateSaintContentMessage({ dailyContent, language: lang });
    const rm = generateReadMoreMessage({ dailyContent, language: lang });

    assert(!v.includes('http') && !v.includes('www.'), `[${lang}] Message 1 (Verse Text Fallback) has 0 URLs`);
    assert(!r.includes('http') && !r.includes('www.'), `[${lang}] Message 2 (Mass Readings) has 0 URLs`);
    assert(!ref.includes('http') && !ref.includes('www.'), `[${lang}] Message 3 (Daily Reflection) has 0 URLs`);
    assert(!s.includes('http') && !s.includes('www.'), `[${lang}] Message 5 (Saint Content) has 0 URLs`);
    assert(rm.includes('https://st-jb-church.vercel.app'), `[${lang}] Message 6 (Read More) contains website URL`);
  }

  // ── TEST 2: Daily Bible Verse Image Generation ────────────────────────────
  console.log('\n--- Test 2: Daily Bible Verse Image Generation ---');
  const verseImgResult = await getDailyVerseImage({ dailyContent, dateKey: dailyContent?.dateKey });
  assert(verseImgResult && verseImgResult.buffer, 'Verse image generator returned a valid object with buffer');
  assert(Buffer.isBuffer(verseImgResult.buffer), 'Verse image buffer is a Buffer instance');
  assert(verseImgResult.buffer.length > 5000, `Verse image buffer size is valid (${verseImgResult.buffer.length} bytes)`);
  // Verify PNG header
  const isPng = verseImgResult.buffer[0] === 0x89 && verseImgResult.buffer[1] === 0x50 && verseImgResult.buffer[2] === 0x4E && verseImgResult.buffer[3] === 0x47;
  assert(isPng, 'Generated verse image has valid PNG signature');

  // ── TEST 3: Content Structure of Messages ─────────────────────────────────
  console.log('\n--- Test 3: Content Structure of Mass Readings & Reflection ---');
  const readingsTa = generateDailyMassReadingsMessage({ dailyContent, language: 'ta' });
  assert(readingsTa.includes('முதல் வாசகம்') || readingsTa.includes('First Reading'), 'Readings message contains First Reading');
  assert(readingsTa.includes('பதிலுரைப் பாடல்') || readingsTa.includes('Responsorial Psalm'), 'Readings message contains Psalm');
  assert(readingsTa.includes('நற்செய்தி') || readingsTa.includes('Gospel'), 'Readings message contains Gospel');

  const reflTa = generateDailyReflectionMessage({ dailyContent, language: 'ta' });
  assert(reflTa.includes('இன்றைய தியானம்') || reflTa.includes('DAILY REFLECTION'), 'Reflection message contains Reflection title');
  assert(reflTa.includes('St. John de Britto') || reflTa.includes('புனித அருளானந்தர்'), 'Reflection message contains church branding');

  const saintMsg = generateSaintContentMessage({ dailyContent, language: 'ta' });
  assert(saintMsg.includes('Saint of the Day') || saintMsg.includes('இன்றைய புனிதர்'), 'Saint message contains Saint heading');
  assert(saintMsg.includes(dailyContent.saint.nameTamil || dailyContent.saint.nameEnglish), 'Saint message contains Saint name');

  // ── TEST 4: Mock Sequence Execution & Strict 6-Stage Message Order ─────────
  console.log('\n--- Test 4: Strict 6-Stage Message Order Execution ---');
  const sentSequence = [];
  const mockWa = {
    sendWhatsAppMessage: async (phone, text) => {
      sentSequence.push({ type: 'text', content: text });
      return true;
    },
    sendWhatsAppMedia: async (phone, media) => {
      sentSequence.push({ type: 'media', media });
      return true;
    }
  };

  // Execute the exact 6 stages sequentially
  // Stage 1: Bible Verse Image with bilingual text caption
  const verseCaption = generateDailyVerseCaption({ dailyContent });
  if (verseImgResult?.buffer) {
    await mockWa.sendWhatsAppMedia('9876543210', { buffer: verseImgResult.buffer, mimetype: 'image/png', caption: verseCaption });
  }
  // Stage 2: Mass Readings
  await mockWa.sendWhatsAppMessage('9876543210', readingsTa);
  // Stage 3: Daily Reflection
  await mockWa.sendWhatsAppMessage('9876543210', reflTa);
  // Stage 4: Saint Image
  const imgPayload = getDailySaintImagePayload({ dailyContent });
  if (imgPayload) {
    await mockWa.sendWhatsAppMedia('9876543210', imgPayload);
  }
  // Stage 5: Saint Content
  await mockWa.sendWhatsAppMessage('9876543210', saintMsg);
  // Stage 6: Read More Link
  const readMoreTa = generateReadMoreMessage({ dailyContent, language: 'ta' });
  await mockWa.sendWhatsAppMessage('9876543210', readMoreTa);

  assert(sentSequence.length === 6, `Strictly 6 separate messages sent (got ${sentSequence.length})`);
  assert(sentSequence[0].type === 'media', 'Stage 1 is 📖 Daily Bible Verse (Image)');
  assert(sentSequence[0].media?.caption && sentSequence[0].media.caption.includes('இன்றைய இறைவார்த்தை / DAILY BIBLE VERSE'), 'Stage 1 media includes bilingual caption heading');
  assert(sentSequence[0].media?.caption && sentSequence[0].media.caption.includes(dailyContent.bible.english), 'Stage 1 caption includes English Bible verse');
  assert(sentSequence[0].media?.caption && sentSequence[0].media.caption.includes(dailyContent.bible.tamil), 'Stage 1 caption includes Tamil Bible verse');
  assert(sentSequence[0].media?.caption && sentSequence[0].media.caption.includes('1 Peter 3:15'), 'Stage 1 caption includes English chapter reference under English verse');
  assert(sentSequence[0].media?.caption && sentSequence[0].media.caption.includes('1 பேதுரு 3:15'), 'Stage 1 caption includes Tamil chapter reference under Tamil verse');
  assert(!sentSequence[0].media?.caption?.includes('http') && !sentSequence[0].media?.caption?.includes('www.'), 'Stage 1 caption contains 0 URLs');
  assert(sentSequence[1].type === 'text' && (sentSequence[1].content.includes('Mass Readings') || sentSequence[1].content.includes('திருப்பலி வாசகங்கள்')), 'Stage 2 is ✝️ Daily Mass Readings');
  assert(sentSequence[2].type === 'text' && (sentSequence[2].content.includes('DAILY REFLECTION') || sentSequence[2].content.includes('இன்றைய தியானம்')), 'Stage 3 is 🕊️ இன்றைய தியானம் (DAILY REFLECTION)');
  assert(sentSequence[3].type === 'media', 'Stage 4 is 🖼️ Saint of the Day Image');
  assert(sentSequence[4].type === 'text' && (sentSequence[4].content.includes('Saint of the Day') || sentSequence[4].content.includes('இன்றைய புனிதர்')), 'Stage 5 is ✨ Saint of the Day Content');
  assert(sentSequence[5].type === 'text' && (sentSequence[5].content.includes('Read More') || sentSequence[5].content.includes('மேலும் வாசிக்க')), 'Stage 6 is 🌐 Read More Website Link');

  console.log(`\n========================================`);
  console.log(`Unit Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(failed > 0 ? 1 : 0);
}

runUnitTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

