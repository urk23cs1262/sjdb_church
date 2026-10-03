/**
 * Verification Test Suite for:
 * 1. Event Registration & UI State Response
 * 2. Database Unique Compound Index & Duplicate Protection
 * 3. Registration Count Calculation & Limit Enforcement
 * 4. Image URL Normalization across Vercel/Render
 * 5. Tomorrow's Events & Announcements Reminder Service (6:00 AM IST)
 */

const mongoose = require('mongoose');
const assert = require('assert');
require('dotenv').config();

const Event = require('../src/models/Event');
const EventRegistration = require('../src/models/EventRegistration');
const Announcement = require('../src/models/Announcement');
const User = require('../src/models/User');
const { registerUserForEvent, withdrawUserRegistration } = require('../src/services/eventRegistrationService');
const { resolveBackendImageUrl } = require('../src/utils/imageUrlHelper');
const {
  getTomorrowContent,
  buildReminderContent,
  getKolkataDateString,
  runTomorrowReminder
} = require('../src/services/tomorrowReminderService');

async function runTestSuite() {
  console.log('='.repeat(80));
  console.log('🧪 RUNNING PRODUCTION EVENTS & TOMORROW REMINDER TEST SUITE');
  console.log('='.repeat(80));

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church';
  await mongoose.connect(mongoUri);
  console.log(' Connected to MongoDB:', mongoUri);

  let passed = 0;
  let total = 0;

  async function it(title, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: ${title}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${title}`);
      console.error('    Error:', err.message);
    }
  }

  // Clean test artifacts
  await Event.deleteMany({ title: { $regex: /^TEST_EVENT/ } });
  await EventRegistration.deleteMany({ name: { $regex: /^TEST_/ } });
  await Announcement.deleteMany({ title: { $regex: /^TEST_ANN/ } });
  await User.deleteMany({ email: { $regex: /^test_events_/ } });

  const testUser = await User.create({
    name: 'TEST_USER_ONE',
    email: 'test_events_user1@sjdb.test',
    phone: '+919876543210',
    role: 'user',
    passwordHash: 'dummy_hash_for_test',
    isActive: true,
    preferredLanguage: 'ta'
  });

  const tomorrowStr = getKolkataDateString(1);
  const tomorrowDate = new Date(tomorrowStr + 'T15:00:00+05:30');

  const testEvent = await Event.create({
    title: 'TEST_EVENT Blood Donation',
    titleTa: 'குருதிக்கொடை முகாம்',
    description: 'Annual church blood donation camp',
    date: tomorrowDate,
    time: '3:00 PM',
    venue: 'Parish Community Hall',
    category: 'community',
    registrationRequired: true,
    registrationLimit: 2,
    isPublished: true,
    image: '/api/files/658b1234567890abcdef1234'
  });

  // TEST 1: Register for event returns complete state immediately
  await it('registerUserForEvent returns registered: true and registration object immediately', async () => {
    const res = await registerUserForEvent({
      eventId: testEvent._id,
      user: testUser,
      registrationData: { name: 'Test Participant', phone: '9876543210', comingFrom: 'Main Parish' }
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.registered, true);
    assert.ok(res.registration);
    assert.strictEqual(res.registration.name, 'Test Participant');
    assert.strictEqual(res.registrationCount, 1);

    // Verify DB state
    const regInDb = await EventRegistration.findOne({ eventId: testEvent._id, userId: testUser._id });
    assert.ok(regInDb, 'Registration document must exist in EventRegistration collection');
  });

  // TEST 2: Duplicate registration is rejected with ALREADY_REGISTERED
  await it('Duplicate registration attempt returns ALREADY_REGISTERED error with status 409', async () => {
    let caughtErr = null;
    try {
      await registerUserForEvent({
        eventId: testEvent._id,
        user: testUser,
        registrationData: { name: 'Test Participant' }
      });
    } catch (err) {
      caughtErr = err;
    }
    assert.ok(caughtErr, 'Must throw duplicate error');
    assert.strictEqual(caughtErr.code, 'ALREADY_REGISTERED');
    assert.strictEqual(caughtErr.statusCode, 409);
  });

  // TEST 3: Withdrawal works and decrements count
  await it('withdrawUserRegistration removes record and returns registered: false', async () => {
    const res = await withdrawUserRegistration({
      eventId: testEvent._id,
      userId: testUser._id
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.registered, false);
    assert.strictEqual(res.registrationCount, 0);

    const regInDb = await EventRegistration.findOne({ eventId: testEvent._id, userId: testUser._id });
    assert.strictEqual(regInDb, null, 'Registration document must be deleted');
  });

  // TEST 4: Can re-register cleanly after withdrawal
  await it('Can successfully re-register after withdrawal', async () => {
    const res = await registerUserForEvent({
      eventId: testEvent._id,
      user: testUser,
      registrationData: { name: 'Re-registered User' }
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.registered, true);
    assert.strictEqual(res.registrationCount, 1);
  });

  // TEST 5: Image normalization across Vercel / Render
  await it('resolveBackendImageUrl converts relative paths to production Render host in prod', () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const url1 = resolveBackendImageUrl('/api/files/658b1234567890abcdef1234');
    assert.strictEqual(url1, 'https://st-jb-church.onrender.com/api/files/658b1234567890abcdef1234');

    const url2 = resolveBackendImageUrl('http://localhost:5000/uploads/events/banner.jpg');
    assert.strictEqual(url2, 'https://st-jb-church.onrender.com/uploads/events/banner.jpg');

    const url3 = resolveBackendImageUrl('https://res.cloudinary.com/demo/image.png');
    assert.strictEqual(url3, 'https://res.cloudinary.com/demo/image.png');

    const url4 = resolveBackendImageUrl('');
    assert.strictEqual(url4, '');

    process.env.NODE_ENV = prevNodeEnv;
  });

  // TEST 6: Tomorrow content detection
  await it('getTomorrowContent correctly identifies tomorrow events and announcements in IST', async () => {
    const testAnn = await Announcement.create({
      title: 'TEST_ANN Parish Feast Celebration',
      titleTa: 'திருவிழா அறிவிப்பு',
      content: 'Important feast announcement',
      date: tomorrowDate,
      isPublished: true
    });

    const content = await getTomorrowContent(tomorrowStr);
    assert.ok(content.events.some(e => e._id.toString() === testEvent._id.toString()));
    assert.ok(content.announcements.some(a => a._id.toString() === testAnn._id.toString()));
  });

  // TEST 7: Reminder message formatting in Tamil and English
  await it('buildReminderContent generates consolidated messages with public event links', () => {
    const content = buildReminderContent({
      events: [testEvent],
      announcements: [{ title: 'TEST_ANN Notice', titleTa: 'அறிவிப்பு' }],
      targetDateStr: tomorrowStr,
      lang: 'ta'
    });

    assert.ok(content.waText.includes('குருதிக்கொடை முகாம்') || content.waText.includes('TEST_EVENT'));
    assert.ok(content.waText.includes('https://st-jb-church.vercel.app/events'));
    assert.ok(content.emailHtml.includes('St. John de Britto Church'));
  });

  // TEST 8: Dry-run execution of tomorrow reminder
  await it('runTomorrowReminder dryRun processes successfully without throwing', async () => {
    const res = await runTomorrowReminder({
      targetDate: tomorrowStr,
      dryRun: true,
      testUser,
      force: true
    });
    assert.strictEqual(res.success, true);
    assert.ok(res.stats.eligibleUsers >= 1);
  });

  // Cleanup test records
  await Event.deleteMany({ title: { $regex: /^TEST_EVENT/ } });
  await EventRegistration.deleteMany({ name: { $regex: /^TEST_/ } });
  await Announcement.deleteMany({ title: { $regex: /^TEST_ANN/ } });
  await User.deleteMany({ email: { $regex: /^test_events_/ } });

  console.log('\n' + '='.repeat(80));
  console.log(`RESULTS: ${passed} / ${total} tests passed!`);
  console.log('='.repeat(80));

  await mongoose.disconnect();
  process.exit(passed === total ? 0 : 1);
}

runTestSuite().catch(err => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});
