const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { getDailySaint } = require('../src/services/saintService');
const { getTodayDailyContent } = require('../src/services/dailyContentService');
const { 
  getDailySaintImagePayload, 
  generateSaintContentMessage,
  generateSaintImageCaption
} = require('../src/services/whatsappDailyFormatter');
const { getUserDailyContentLanguage } = require('../src/utils/userLanguageHelper');

async function runTests() {
  console.log('🧪 Starting Saint of the Day & User Language Verification...\n');

  // 1. Direct getDailySaint check
  console.log('1️⃣ Testing getDailySaint()...');
  const saint = getDailySaint();
  assert(saint, 'getDailySaint() returned null/undefined');
  assert(saint.name, 'Saint has no English name');
  assert(saint.nameTa, 'Saint has no Tamil name');
  assert(saint.image, 'Saint has no image URL');
  console.log(`✅ Saint Name (En): ${saint.name}`);
  console.log(`✅ Saint Name (Ta): ${saint.nameTa}`);
  console.log(`✅ Saint Image: ${saint.image}`);

  // 2. getTodayDailyContent check
  console.log('\n2️⃣ Testing getTodayDailyContent()...');
  const dailyContent = await getTodayDailyContent(new Date());
  assert(dailyContent, 'dailyContent returned null/undefined');
  assert(dailyContent.saint, 'dailyContent.saint is missing');
  assert(dailyContent.saint.nameEnglish || dailyContent.saint.nameEn, 'dailyContent.saint English name missing');
  assert(dailyContent.saint.nameTamil || dailyContent.saint.nameTa, 'dailyContent.saint Tamil name missing');
  console.log(`✅ Daily Content Saint: ${dailyContent.saint.nameEnglish} / ${dailyContent.saint.nameTamil}`);
  console.log(`✅ Saint Image: ${dailyContent.saint.image}`);
  console.log(`✅ Saint Attachment Buffer: ${dailyContent.saint.imageAttachment?.content ? 'YES (' + dailyContent.saint.imageAttachment.content.length + ' bytes)' : 'NO'}`);

  // 3. Testing getDailySaintImagePayload
  console.log('\n3️⃣ Testing getDailySaintImagePayload()...');
  const payloadEn = getDailySaintImagePayload({ dailyContent, language: 'en' });
  assert(payloadEn, 'Image payload for English is null');
  assert(payloadEn.buffer || payloadEn.url, 'Payload has neither buffer nor url');
  assert(payloadEn.caption.includes('Saint of the Day'), 'English caption missing "Saint of the Day"');
  console.log(`✅ English Image Payload: Buffer=${Boolean(payloadEn.buffer)}, Caption:\n   ${payloadEn.caption.replace(/\n/g, '\n   ')}`);

  const payloadBoth = getDailySaintImagePayload({ dailyContent, language: 'both' });
  assert(payloadBoth, 'Image payload for Both is null');
  assert(payloadBoth.caption.includes('Saint of the Day • இன்றைய புனிதர்'), 'Bilingual caption missing');
  console.log(`✅ Bilingual Image Payload: Buffer=${Boolean(payloadBoth.buffer)}, Caption:\n   ${payloadBoth.caption.replace(/\n/g, '\n   ')}`);

  const payloadTa = getDailySaintImagePayload({ dailyContent, language: 'ta' });
  assert(payloadTa, 'Image payload for Tamil is null');
  assert(payloadTa.caption.includes('இன்றைய புனிதர்'), 'Tamil caption missing "இன்றைய புனிதர்"');
  console.log(`✅ Tamil Image Payload: Buffer=${Boolean(payloadTa.buffer)}, Caption:\n   ${payloadTa.caption.replace(/\n/g, '\n   ')}`);

  // 4. Testing generateSaintContentMessage
  console.log('\n4️⃣ Testing generateSaintContentMessage()...');
  const contentEn = generateSaintContentMessage({ dailyContent, language: 'en' });
  assert(contentEn.includes('✨ *Saint of the Day*'), 'English content missing "✨ *Saint of the Day*"');
  assert(contentEn.includes('St. John de Britto Church, Kalayarkoil'), 'English footer missing');
  console.log('✅ English Content format verified.');

  const contentBoth = generateSaintContentMessage({ dailyContent, language: 'both' });
  assert(contentBoth.includes('🇮🇳 *தமிழ் (Tamil)*'), 'Bilingual content missing Tamil section');
  assert(contentBoth.includes('🇬🇧 *English*'), 'Bilingual content missing English section');
  console.log('✅ Bilingual Content format verified.');

  const contentTa = generateSaintContentMessage({ dailyContent, language: 'ta' });
  assert(contentTa.includes('✨ *இன்றைய புனிதர்*'), 'Tamil content missing "✨ *இன்றைய புனிதர்*"');
  assert(contentTa.includes('புனித அருளானந்தர் திருத்தலம்'), 'Tamil footer missing');
  console.log('✅ Tamil Content format verified.');

  // 5. Testing User Language Resolution Logic
  console.log('\n5️⃣ Testing User Language Resolution with session.botLanguage vs session.language...');
  
  // Scenario A: User has session.botLanguage = 'ta', but session.language = 'en', asks 'Saint of th day'
  const sessionUserEn = {
    botLanguage: 'ta',
    language: 'en'
  };
  const rawTextA = 'Saint of th day';
  const hasTamilScriptA = Boolean(rawTextA && /[\u0B80-\u0BFF]/.test(rawTextA));
  const chosenLangA = getUserDailyContentLanguage(sessionUserEn);
  const resolvedLangA = hasTamilScriptA ? (chosenLangA === 'both' ? 'both' : 'ta') : chosenLangA;
  assert.strictEqual(resolvedLangA, 'en', `Expected 'en', got '${resolvedLangA}'`);
  console.log(`✅ Scenario A (User daily lang = 'en', asks '${rawTextA}'): Resolved to '${resolvedLangA}' (English)`);

  // Scenario B: User has session.botLanguage = 'ta', session.language = 'both', asks 'Saint of th day'
  const sessionUserBoth = {
    botLanguage: 'ta',
    language: 'both'
  };
  const rawTextB = 'Saint of th day';
  const hasTamilScriptB = Boolean(rawTextB && /[\u0B80-\u0BFF]/.test(rawTextB));
  const chosenLangB = getUserDailyContentLanguage(sessionUserBoth);
  const resolvedLangB = hasTamilScriptB ? (chosenLangB === 'both' ? 'both' : 'ta') : chosenLangB;
  assert.strictEqual(resolvedLangB, 'both', `Expected 'both', got '${resolvedLangB}'`);
  console.log(`✅ Scenario B (User daily lang = 'both', asks '${rawTextB}'): Resolved to '${resolvedLangB}' (Bilingual)`);

  // Scenario C: User has session.language = 'ta', asks 'Saint of the day'
  const sessionUserTa = {
    botLanguage: 'en',
    language: 'ta'
  };
  const rawTextC = 'Saint of the day';
  const hasTamilScriptC = Boolean(rawTextC && /[\u0B80-\u0BFF]/.test(rawTextC));
  const chosenLangC = getUserDailyContentLanguage(sessionUserTa);
  const resolvedLangC = hasTamilScriptC ? (chosenLangC === 'both' ? 'both' : 'ta') : chosenLangC;
  assert.strictEqual(resolvedLangC, 'ta', `Expected 'ta', got '${resolvedLangC}'`);
  console.log(`✅ Scenario C (User daily lang = 'ta', asks '${rawTextC}'): Resolved to '${resolvedLangC}' (Tamil)`);

  // Scenario D: User asks in Tamil script 'இன்றைய புனிதர் யார்?'
  const rawTextD = 'இன்றைய புனிதர் யார்?';
  const hasTamilScriptD = Boolean(rawTextD && /[\u0B80-\u0BFF]/.test(rawTextD));
  const chosenLangD = getUserDailyContentLanguage(sessionUserEn);
  const resolvedLangD = hasTamilScriptD ? (chosenLangD === 'both' ? 'both' : 'ta') : chosenLangD;
  assert.strictEqual(resolvedLangD, 'ta', `Expected 'ta', got '${resolvedLangD}'`);
  console.log(`✅ Scenario D (User types in Tamil script '${rawTextD}'): Resolved to '${resolvedLangD}' (Tamil)`);

  // 6. Regex Query Matching Check for 'Saint of th day' and variations
  console.log('\n6️⃣ Testing Regex Query Matching for typos and variations...');
  const testQueries = [
    'Saint of th day',
    'saint of the day',
    'today saint',
    "today's saint",
    'saint today',
    'saint of day',
    'saints',
    'இன்றைய புனிதர்',
    'இன்றைய புனிதர் யார்?'
  ];

  const saintRegex = /\b(saint\s*of\s*(the|th)?\s*day|today'?s?\s*saint|saint\s*today|saint\s*of\s*day|who\s*is\s*today'?s?\s*saint|tell\s*me\s*about\s*(today'?s?\s*)?saint)\b/i;
  const saintExactRegex = /^(saint|saints|புனிதர்|இன்றைய புனிதர்)$/i;
  const saintTamilRegex = /(இன்றைய புனிதர்|புனிதர் யார்|இன்றைய புனிதரைப் பற்றி|புனிதரைப் பற்றி)/;

  for (const q of testQueries) {
    const norm = q.toLowerCase().trim();
    const matched = saintRegex.test(norm) || saintExactRegex.test(norm) || saintTamilRegex.test(q);
    assert(matched, `Query failed to match: "${q}"`);
    console.log(`✅ Matched query: "${q}"`);
  }

  console.log('\n🎉 ALL SAINT OF THE DAY & USER LANGUAGE TESTS PASSED PERFECTLY!\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
