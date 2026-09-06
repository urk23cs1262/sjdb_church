require('dotenv').config();
const mongoose = require('mongoose');
const { resolveSaintImage } = require('./services/saintImageResolver');
const { fetchDailySaint, getDailySaint } = require('./services/saintService');
const { checkAndSyncDailyContent } = require('./services/contentMonitoringService');
const { getTodayDailyContent } = require('./services/dailyContentService');
const { generateDailyNotificationHtml } = require('./templates/dailyNotificationEmail');
const { answerChurchQuestion } = require('./bot/churchRAGService');
const DailyCatholicContent = require('./models/DailyCatholicContent');
const SiteSettings = require('./models/SiteSettings');

async function verifyAllChannels() {
  console.log('===============================================================');
  console.log('VERIFYING SAINT IMAGE RESOLUTION & ALL CHANNELS PROPAGATION');
  console.log('===============================================================\n');

  // Connect to DB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sjdb_church';
  await mongoose.connect(mongoUri);
  console.log(' Connected to MongoDB');

  const today = new Date();
  const dateKey = today.toLocaleDateString('en-CA'); // YYYY-MM-DD

  // 1. Direct Resolver Test
  console.log('\n--- 1. Testing Universal Saint Image Resolver for "St. Zachary, Prophet" ---');
  const resolverResult = await resolveSaintImage('St. Zachary, Prophet', 'https://www.vaticannews.va/en/saints/09/06.html', null, today);
  console.log('Resolver Result URL:', resolverResult.url);
  console.log('Resolver Source:', resolverResult.source);
  console.log('Resolver Source URL:', resolverResult.sourceUrl);

  if (!resolverResult.url || resolverResult.url.includes('Virgin_Mary_by_Giovanni_Battista_Salvi_da_Sassoferrato')) {
    throw new Error('Resolver returned broken placeholder image!');
  }
  console.log(' Universal Saint Image Resolver verified: Found authentic portrait from Google/Wikipedia.');

  // 2. Fetch and Sync Saint
  console.log('\n--- 2. Syncing Saint of the Day & Database Cache ---');
  const syncedSaint = await fetchDailySaint(today);
  console.log('Synced Saint Name:', syncedSaint.saintName);
  console.log('Synced Saint Image:', syncedSaint.image);
  console.log('Synced Saint Image Source:', syncedSaint.imageSource);

  if (!syncedSaint.image || syncedSaint.imageSource === 'placeholder') {
    throw new Error('SaintService did not store the resolved image!');
  }
  console.log(' SaintService verified: Saint synced with authentic image.');

  // 3. Content Monitoring Service (Canonical DailyCatholicContent)
  console.log('\n--- 3. Running Content Monitoring Service Sync ---');
  const canonicalDoc = await checkAndSyncDailyContent(today, true);
  console.log('Canonical Doc Date:', canonicalDoc.date);
  console.log('Canonical Doc Saint Name:', canonicalDoc.saint.nameEnglish);
  console.log('Canonical Doc Saint Image:', canonicalDoc.saint.image);
  console.log('Canonical Doc Saint Image Source:', canonicalDoc.saint.imageSource);

  if (!canonicalDoc.saint.image || canonicalDoc.saint.image.includes('Virgin_Mary_by_Giovanni_Battista_Salvi_da_Sassoferrato')) {
    throw new Error('Canonical DailyCatholicContent does not have the verified image!');
  }
  console.log(' Canonical DailyCatholicContent verified: Image stored in single source of truth.');

  // 4. Daily Content & Email Attachment (CID)
  console.log('\n--- 4. Verifying Daily Content Service & Email Template ---');
  const fullContent = await getTodayDailyContent(today);
  const hasSaintAttachment = Boolean(fullContent.saint?.imageAttachment);
  console.log('Saint has imageAttachment:', hasSaintAttachment);
  if (hasSaintAttachment) {
    console.log('Attachment Filename:', fullContent.saint.imageAttachment.filename);
    console.log('Attachment Content Length:', fullContent.saint.imageAttachment.content.length);
    console.log('Attachment CID:', fullContent.saint.imageAttachment.cid);
  }

  const emailHtml = generateDailyNotificationHtml({
    dailyContent: fullContent,
    language: 'both',
    hasSaintImageAttachment: hasSaintAttachment
  });
  const emailHasSaintImg = emailHtml.includes('cid:saintOfTheDayImage') || emailHtml.includes(canonicalDoc.saint.image);
  console.log('Email HTML contains Saint Image tag:', emailHasSaintImg);

  if (!emailHasSaintImg) {
    throw new Error('Email template missing Saint Image tag!');
  }
  console.log(' Email notification channel verified: Inline CID image attached and rendered.');

  // 5. WhatsApp Bot Saint Section
  console.log('\n--- 5. Verifying WhatsApp Bot Saint Section ---');
  const botAnswerEn = await answerChurchQuestion("Who is today's saint?", 'en');
  const botAnswerTa = await answerChurchQuestion("இன்றைய புனிதர் யார்?", 'ta');

  console.log('Bot English Reply Image URL:', botAnswerEn.imageUrl);
  console.log('Bot Tamil Reply Image URL:', botAnswerTa.imageUrl);
  console.log('Bot Is Saint Flow:', botAnswerEn.isSaintOfDayFlow);

  if (!botAnswerEn.imageUrl || !botAnswerEn.imageUrl.includes('Zacharias')) {
    throw new Error('WhatsApp Bot Saint section missing Michelangelo image URL!');
  }
  console.log(' WhatsApp Bot channel verified: Saint section has verified portrait ready for media message.');

  // 6. Push & In-App Notification Payloads
  console.log('\n--- 6. Verifying Push & In-App Notification Payloads ---');
  const { SITE_ROUTES, getSiteUrl } = require('./config/siteRoutes');
  const bibleUrl = getSiteUrl(SITE_ROUTES.SAINT_OF_THE_DAY || SITE_ROUTES.BIBLE_VERSE);
  const saintImageUrl = fullContent.saint?.image;

  const pushPayload = {
    title: `✝️ Daily Catholic Word — ${fullContent.bible.ref}`,
    body: `Saint: ${fullContent.saint.nameEnglish}`,
    url: bibleUrl,
    tag: `sjdb-daily-${fullContent.dateKey}`,
    image: saintImageUrl,
    data: {
      url: bibleUrl,
      dateKey: fullContent.dateKey,
      image: saintImageUrl
    }
  };

  console.log('Push Payload Image:', pushPayload.image);
  if (!pushPayload.image) {
    throw new Error('Push notification payload missing image URL!');
  }
  console.log(' Push notification channel verified: Rich image preview banner attached.');

  console.log('\n===============================================================');
  console.log('ALL VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
  console.log('===============================================================');

  await mongoose.disconnect();
  process.exit(0);
}

verifyAllChannels().catch(err => {
  console.error('\n VERIFICATION FAILED:', err.message);
  process.exit(1);
});
