const assert = require('assert');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const {
  prepareSaintForDbStorage,
  saveSaintToDatabase,
  getISTDateParts
} = require('../src/services/saintService');
const SiteSettings = require('../src/models/SiteSettings');

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING OPTIMIZATION & COMPATIBILITY VERIFICATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  }

  // TEST 1: prepareSaintForDbStorage removes raw buffers
  test('prepareSaintForDbStorage strips binary buffers and imageAttachment', () => {
    const rawBuffer = Buffer.from('FAKE_IMAGE_DATA_1234567890'.repeat(100));
    const mockSaint = {
      date: '2026-10-15',
      saintName: 'St. Theresa of Jesus',
      englishName: 'St. Theresa of Jesus',
      tamilName: 'இயேசுவின் புனித தெரசா',
      feastDay: 'Thursday, October 15, 2026',
      celebrationType: 'Memorial',
      description: 'Test description paragraph 1.\n\nTest description paragraph 2.',
      descriptionTa: 'தமிழ் விளக்கம் பத்தி 1.\n\nதமிழ் விளக்கம் பத்தி 2.',
      image: 'https://www.vaticannews.va/content/dam/vaticannews/santi/sample.jpg',
      imageUrl: 'https://www.vaticannews.va/content/dam/vaticannews/santi/sample.jpg',
      remoteUrl: 'https://www.vaticannews.va/content/dam/vaticannews/santi/sample.jpg',
      imageAttachment: {
        filename: 'saint.jpg',
        content: rawBuffer,
        cid: 'saintImage'
      },
      primaryImageResult: {
        url: 'https://www.vaticannews.va/content/dam/vaticannews/santi/sample.jpg',
        buffer: rawBuffer
      },
      primarySaint: {
        name: 'St. Theresa of Jesus',
        image: 'https://www.vaticannews.va/content/dam/vaticannews/santi/sample.jpg',
        imageAttachment: { content: rawBuffer }
      },
      otherSaints: [
        {
          name: 'St. Secondary',
          image: 'https://en.wikipedia.org/wiki/Special:FilePath/saint.jpg',
          imageAttachment: { content: rawBuffer }
        }
      ]
    };

    const prepared = prepareSaintForDbStorage(mockSaint);

    // Verify binary buffers are deleted
    assert.strictEqual(prepared.imageAttachment, undefined, 'imageAttachment should be deleted');
    assert.strictEqual(prepared.primaryImageResult.buffer, undefined, 'primaryImageResult.buffer should be deleted');
    assert.strictEqual(prepared.primarySaint.imageAttachment, undefined, 'primarySaint.imageAttachment should be deleted');
    assert.strictEqual(prepared.otherSaints[0].imageAttachment, undefined, 'otherSaints[0].imageAttachment should be deleted');

    // Verify all critical metadata is preserved
    assert.strictEqual(prepared.saintName, 'St. Theresa of Jesus');
    assert.strictEqual(prepared.tamilName, 'இயேசுவின் புனித தெரசா');
    assert.strictEqual(prepared.celebrationType, 'Memorial');
    assert.strictEqual(prepared.image, 'https://www.vaticannews.va/content/dam/vaticannews/santi/sample.jpg');
    assert.strictEqual(prepared.descriptionTa.includes('தமிழ்'), true);
  });

  // TEST 2: Missing image fallback handling
  test('prepareSaintForDbStorage provides dignified fallback if image is missing', () => {
    const mockSaintNoImage = {
      date: '2026-10-15',
      saintName: 'Unknown Saint',
      description: 'Test description'
    };

    const prepared = prepareSaintForDbStorage(mockSaintNoImage);
    assert.ok(prepared.image, 'image should have fallback URL');
    assert.ok(prepared.imageUrl, 'imageUrl should have fallback URL');
    assert.strictEqual(prepared.imageFallback, true, 'imageFallback flag should be true');
    assert.ok(prepared.image.includes('wikipedia.org') || prepared.image.includes('Holy_Spirit') || prepared.image.includes('Britto'), 'Must use dignified fallback image URL');
  });

  // Connect to DB for integration tests
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri);

  // TEST 3: Database persistence and size comparison
  await asyncTest('Database persistence saves clean JSON under 40 KB without buffer strings', async () => {
    const rawBuffer = Buffer.alloc(150 * 1024, 0xFF); // 150 KB dummy buffer
    const testDate = '2099-12-31'; // Future date for isolation
    const mockSaint = {
      date: testDate,
      saintName: 'St. Test Saint',
      englishName: 'St. Test Saint',
      tamilName: 'புனித சோதனை',
      feastDay: 'Thursday, December 31, 2099',
      celebrationType: 'Feast',
      description: 'First paragraph.\n\nSecond paragraph.',
      descriptionTa: 'முதல் பத்தி.\n\nஇரண்டாம் பத்தி.',
      image: 'https://www.vaticannews.va/content/dam/vaticannews/santi/test.jpg',
      imageUrl: 'https://www.vaticannews.va/content/dam/vaticannews/santi/test.jpg',
      imageAttachment: {
        filename: 'saint.jpg',
        content: rawBuffer,
        cid: 'saintImage'
      }
    };

    // Save using the newly optimized function
    await saveSaintToDatabase(mockSaint, false);

    // Read back directly from MongoDB
    const savedDoc = await SiteSettings.findOne({ key: `daily_saint_cache_${testDate}` }).lean();
    assert.ok(savedDoc, 'Saved document must exist in database');
    assert.ok(savedDoc.value, 'Saved document must have value string');

    // Confirm buffer was NOT serialized
    assert.strictEqual(savedDoc.value.includes('"type":"Buffer"'), false, 'Database value MUST NOT contain Buffer JSON');
    assert.strictEqual(savedDoc.value.includes('imageAttachment'), false, 'Database value MUST NOT contain imageAttachment');

    const parsed = JSON.parse(savedDoc.value);
    assert.strictEqual(parsed.saintName, 'St. Test Saint');
    assert.strictEqual(parsed.image, 'https://www.vaticannews.va/content/dam/vaticannews/santi/test.jpg');
    assert.strictEqual(parsed.descriptionTa, 'முதல் பத்தி.\n\nஇரண்டாம் பத்தி.');

    console.log(`   -> Optimized document size in DB: ${savedDoc.value.length} bytes (raw buffer was 153,600 bytes)`);
    assert.ok(savedDoc.value.length < 2000, 'Payload size should be under 2 KB without buffer');

    // Clean up test document
    await SiteSettings.deleteOne({ key: `daily_saint_cache_${testDate}` });
  });

  // TEST 4: WhatsApp Formatter works smoothly with optimized saint
  test('whatsappDailyFormatter handles saint object without imageAttachment.content', () => {
    const {
      getDailySaintImagePayload,
      generateSaintContentMessage,
      generateDailyCatholicMessage
    } = require('../src/services/whatsappDailyFormatter');

    const mockSaint = {
      name: 'St. Theresa of Jesus',
      saintName: 'St. Theresa of Jesus',
      nameEn: 'St. Theresa of Jesus',
      nameTa: 'இயேசுவின் புனித தெரசா',
      feastDay: 'Thursday, October 15, 2026',
      celebrationType: 'Memorial',
      description: 'Saint Teresa of Avila was a great Spanish mystic.',
      descriptionEn: 'Saint Teresa of Avila was a great Spanish mystic.',
      descriptionTa: 'அவிலாவின் புனித தெரசா ஒரு சிறந்த எசுப்பானிய ஞானி.',
      image: 'https://www.vaticannews.va/content/dam/sample.jpg',
      imageUrl: 'https://www.vaticannews.va/content/dam/sample.jpg'
    };

    const mockDailyContent = {
      dateKey: '2026-10-15',
      formattedDate: 'Thursday, October 15, 2026',
      saint: mockSaint,
      readings: {
        sections: [
          { heading: 'First Reading', text: 'Romans 8:1-11' }
        ]
      },
      verse: {
        verseTextEn: 'The Lord is my shepherd.',
        referenceEn: 'Psalm 23:1'
      }
    };

    // 4a: Test Image Payload generator returns valid media payload (local disk file buffer or remote URL)
    const imgPayload = getDailySaintImagePayload({ dailyContent: mockDailyContent, language: 'en' });
    assert.ok(imgPayload, 'Image payload must be generated');
    assert.ok(imgPayload.url || imgPayload.buffer, 'Image payload must contain either a remote URL or a local file buffer');
    assert.ok(imgPayload.caption, 'Image payload must include a caption');

    // 4b: Test Saint Content message formatting
    const saintMsg = generateSaintContentMessage({ dailyContent: mockDailyContent, language: 'en' });
    assert.ok(saintMsg, 'Saint content message should be generated');
    assert.ok(saintMsg.includes('St. Theresa') || saintMsg.includes('Theresa'), 'Must include saint name');

    // 4c: Test Full Catholic Daily Message
    const fullMsg = generateDailyCatholicMessage({ dailyContent: mockDailyContent, language: 'en' });
    assert.ok(fullMsg, 'Full daily message should be generated');
  });

  await mongoose.disconnect();

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
