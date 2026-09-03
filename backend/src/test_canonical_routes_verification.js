/**
 * Verification Test Suite: Canonical Route Single Source of Truth & Link Accuracy
 */

const mongoose = require('mongoose');
const { SITE_ROUTES, EXTERNAL_LINKS, getSiteUrl, getBaseClientUrl } = require('./config/siteRoutes');
const { answerChurchQuestion } = require('./bot/churchRAGService');
const { generateDailyLinksMessage } = require('./services/whatsappDailyFormatter');
const { formatAnnouncementWhatsApp, formatEventWhatsApp } = require('./services/whatsappBroadcastHelper');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING CANONICAL ROUTES & WHATSAPP BOT LINK TESTS');
  console.log('====================================================\n');

  try {
    await mongoose.connect('mongodb://localhost:27017/sjdb_church', { serverSelectionTimeoutMS: 2000 });
    console.log('Connected to MongoDB for fast test execution.\n');
  } catch (err) {
    console.log('MongoDB not connected locally, continuing with in-memory fallbacks.\n');
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

  const base = getBaseClientUrl();
  assert(base === 'https://st-jb-church.vercel.app', 'Base client URL resolves to canonical production domain');

  // Test 1: Route Keys in siteRoutes.js
  assert(getSiteUrl(SITE_ROUTES.DAILY_READINGS) === 'https://st-jb-church.vercel.app/bible-verse#readings', 'Daily Readings route matches /bible-verse#readings');
  assert(getSiteUrl(SITE_ROUTES.DAILY_VERSE) === 'https://st-jb-church.vercel.app/bible-verse#verse', 'Daily Verse route matches /bible-verse#verse');
  assert(getSiteUrl(SITE_ROUTES.DAILY_REFLECTION) === 'https://st-jb-church.vercel.app/bible-verse#reflection', 'Daily Reflection route matches /bible-verse#reflection');
  assert(getSiteUrl(SITE_ROUTES.SAINT_OF_THE_DAY) === 'https://st-jb-church.vercel.app/bible-verse#saint-of-the-day', 'Saint of the Day route matches /bible-verse#saint-of-the-day');
  assert(getSiteUrl(SITE_ROUTES.MASS_TIMINGS) === 'https://st-jb-church.vercel.app/mass-timings', 'Mass Timings route matches /mass-timings');
  assert(getSiteUrl(SITE_ROUTES.PRIESTS) === 'https://st-jb-church.vercel.app/priests', 'Priests route matches /priests');
  assert(getSiteUrl(SITE_ROUTES.ABOUT) === 'https://st-jb-church.vercel.app/about', 'About route matches /about');
  assert(getSiteUrl(SITE_ROUTES.EVENTS) === 'https://st-jb-church.vercel.app/events', 'Events route matches /events');
  assert(getSiteUrl(SITE_ROUTES.ANNOUNCEMENTS) === 'https://st-jb-church.vercel.app/announcements', 'Announcements route matches /announcements');
  assert(getSiteUrl(SITE_ROUTES.CONTACT) === 'https://st-jb-church.vercel.app/contact', 'Contact route matches /contact');
  assert(getSiteUrl(SITE_ROUTES.PROFILE) === 'https://st-jb-church.vercel.app/dashboard/profile', 'Profile route matches /dashboard/profile');
  assert(getSiteUrl(SITE_ROUTES.NOTIFICATIONS) === 'https://st-jb-church.vercel.app/dashboard/notifications', 'Notifications route matches /dashboard/notifications');
  assert(getSiteUrl(SITE_ROUTES.BOOKINGS) === 'https://st-jb-church.vercel.app/dashboard/booking', 'Bookings route matches /dashboard/booking');
  assert(getSiteUrl(SITE_ROUTES.REGISTER) === 'https://st-jb-church.vercel.app/register', 'Register route matches /register');
  assert(EXTERNAL_LINKS.GOOGLE_MAPS.includes('maps.google.com'), 'Google Maps external link is valid');

  // Test 2: RAG Service Services Menu Query
  const servicesRes = await answerChurchQuestion('services', 'en');
  assert(servicesRes.success === true, 'Services query succeeds');
  assert(servicesRes.reply.includes('1️⃣ ⛪ *Mass Timings*'), 'Services menu has option 1');
  assert(servicesRes.reply.includes('1️⃣4️⃣ 📞 *Contact Church*'), 'Services menu has option 14');

  // Test 3: RAG Service Natural Query Responses & URLs
  const massQueryRes = await answerChurchQuestion('when is mass?', 'en');
  assert(massQueryRes.reply.includes('/mass-timings'), 'Mass query includes /mass-timings link');

  const saintQueryRes = await answerChurchQuestion('who is the saint today?', 'en');
  assert(saintQueryRes.reply.includes('/bible-verse#saint-of-the-day'), 'Saint query includes /bible-verse#saint-of-the-day link');

  const readingsQueryRes = await answerChurchQuestion("what are today's readings?", 'en');
  assert(readingsQueryRes.reply.includes('/bible-verse#readings'), 'Readings query includes /bible-verse#readings link');

  const locQueryRes = await answerChurchQuestion('where is the church located?', 'en');
  assert(locQueryRes.reply.includes('maps.google.com'), 'Location query includes Google Maps link');
  assert(locQueryRes.reply.includes('/contact'), 'Location query includes /contact link');

  const priestsQueryRes = await answerChurchQuestion('who is the parish priest?', 'en');
  assert(priestsQueryRes.reply.includes('/priests'), 'Priests query includes /priests link');

  // Test 4: Daily Links Formatter
  const dailyLinksTa = generateDailyLinksMessage({ language: 'ta' });
  assert(dailyLinksTa.includes('/bible-verse#verse'), 'Daily links (Ta) has /bible-verse#verse');
  assert(dailyLinksTa.includes('/bible-verse#readings'), 'Daily links (Ta) has /bible-verse#readings');
  assert(dailyLinksTa.includes('/bible-verse#reflection'), 'Daily links (Ta) has /bible-verse#reflection');
  assert(dailyLinksTa.includes('/bible-verse#saint-of-the-day'), 'Daily links (Ta) has /bible-verse#saint-of-the-day');

  const dailyLinksEn = generateDailyLinksMessage({ language: 'en' });
  assert(dailyLinksEn.includes('/bible-verse#verse'), 'Daily links (En) has /bible-verse#verse');
  assert(dailyLinksEn.includes('/bible-verse#readings'), 'Daily links (En) has /bible-verse#readings');
  assert(dailyLinksEn.includes('/bible-verse#reflection'), 'Daily links (En) has /bible-verse#reflection');
  assert(dailyLinksEn.includes('/bible-verse#saint-of-the-day'), 'Daily links (En) has /bible-verse#saint-of-the-day');

  // Test 5: Broadcast Helper Formatter
  const annMsg = formatAnnouncementWhatsApp({ title: 'Parish Festival Notice', content: 'Details here' });
  assert(annMsg.includes('/announcements'), 'Announcement broadcast includes /announcements');

  const evMsg = formatEventWhatsApp({ title: 'Youth Meet 2026', date: new Date(), time: '10:00 AM' });
  assert(evMsg.includes('/events'), 'Event broadcast includes /events');

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
