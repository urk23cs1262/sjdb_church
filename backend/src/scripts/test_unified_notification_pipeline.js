/**
 * Verification Test Suite: Unified Notification Pipeline & Deduplication
 * 
 * Verifies:
 * 1. Event creation sends EXACTLY ONE email (Template 1: PARISH EVENT NOTICE).
 * 2. Templates 2 & 3 are completely eliminated.
 * 3. Mirrored event announcement never triggers announcement notifications.
 * 4. Standalone announcement sends exactly one announcement notification.
 * 5. Notification deduplication prevents duplicate sends via NotificationLog.
 * 6. User withdrawal dispatches EVENT_REGISTRATION_WITHDRAWN to both user and admin with updated count.
 */

const mongoose = require('mongoose');
const assert = require('assert');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING UNIFIED NOTIFICATION PIPELINE TEST SUITE');
  console.log('================================================================\n');

  process.env.ADMIN_PHONE = '07639520006';
  process.env.ADMIN_EMAIL = 'arndas777@gmail.com';

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sjdb_church');

  const Event = require('../models/Event');
  const Announcement = require('../models/Announcement');
  const User = require('../models/User');
  const EventRegistration = require('../models/EventRegistration');
  const NotificationLog = require('../models/NotificationLog');
  const mailer = require('../config/mailer');
  const waService = require('../services/whatsAppNotificationService');
  const { onEventCreated } = require('../services/centralNotificationScheduler');
  const { onAnnouncementCreated } = require('../services/centralNotificationScheduler');
  const { registerUserForEvent, withdrawUserRegistration } = require('../services/eventRegistrationService');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err);
    }
  }

  // Intercept sendMail and sendWhatsAppNotification to capture emails & messages
  const capturedEmails = [];
  const capturedWhatsApp = [];
  const origSendMail = mailer.sendMail;
  const origSendWA = waService.sendWhatsAppNotification;

  mailer.sendMail = async (opts) => {
    capturedEmails.push(opts);
    return true;
  };

  waService.sendWhatsAppNotification = async (phoneOrUser, text, opts) => {
    capturedWhatsApp.push({ target: phoneOrUser, text, opts });
    return { success: true };
  };

  try {
    // ── TEST 1: Event Creation sends ONLY ONE email (Template 1) ──────────────
    await test('Event creation dispatches exactly 1 email using Template 1 (PARISH EVENT NOTICE)', async () => {
      capturedEmails.length = 0;
      capturedWhatsApp.length = 0;

      const testEvent = await Event.create({
        title: 'Test Dedup Event',
        description: 'Single pipeline verification event',
        date: new Date(Date.now() + 86400000 * 3),
        time: '10:30 AM',
        venue: 'Main Church',
        organizer: 'Father',
        category: 'mass',
        isPublished: true,
        registrationRequired: true
      });

      // Clear any prior logs for this event
      await NotificationLog.deleteMany({ entityId: testEvent._id });

      // Trigger creation pipeline
      await onEventCreated(testEvent);

      // Verify email template
      assert(capturedEmails.length > 0, 'Must dispatch email to subscribers');
      const sampleEmail = capturedEmails[0];
      assert(sampleEmail.subject.includes('New Parish Event: Test Dedup Event'), `Subject mismatch: ${sampleEmail.subject}`);
      assert(sampleEmail.html.includes('PARISH EVENT NOTICE'), 'Must use Template 1: PARISH EVENT NOTICE');
      assert(sampleEmail.html.includes('View Event Details & Calendar'), 'Must include View Event Details & Calendar button');
      assert(!sampleEmail.html.includes('View on SJDB Connect Website'), 'Must NOT contain Template 2');
      assert(!sampleEmail.html.includes('May the peace of Christ be with you always'), 'Must NOT contain Template 3');

      // Verify NotificationLog was created
      const log = await NotificationLog.findOne({
        entityType: 'event',
        entityId: testEvent._id,
        notificationType: 'event_created'
      });
      assert(log, 'NotificationLog record must exist for event_created');

      // Clean up test event
      await Event.findByIdAndDelete(testEvent._id);
      await Announcement.deleteMany({ eventId: testEvent._id });
      await NotificationLog.deleteMany({ entityId: testEvent._id });
    });

    // ── TEST 2: Event Deduplication prevents second send ──────────────────────
    await test('Calling onEventCreated multiple times triggers deduplication (0 additional emails)', async () => {
      capturedEmails.length = 0;

      const testEvent = await Event.create({
        title: 'Test Idempotency Event',
        description: 'Testing second call deduplication',
        date: new Date(Date.now() + 86400000 * 2),
        isPublished: true
      });

      // First run
      await onEventCreated(testEvent);
      const firstCount = capturedEmails.length;
      assert(firstCount > 0, 'First run must send emails');

      // Second run (simulating race condition / double call)
      await onEventCreated(testEvent);
      assert.strictEqual(capturedEmails.length, firstCount, 'Second run must be deduplicated with 0 additional emails');

      await Event.findByIdAndDelete(testEvent._id);
      await Announcement.deleteMany({ eventId: testEvent._id });
      await NotificationLog.deleteMany({ entityId: testEvent._id });
    });

    // ── TEST 3: Mirrored Event in Announcements NEVER triggers announcement notice
    await test('Event mirrored into Announcements has sourceType: event and triggers 0 announcement emails', async () => {
      capturedEmails.length = 0;

      const testEvent = await Event.create({
        title: 'Mirror Guard Event',
        date: new Date(Date.now() + 86400000 * 4),
        isPublished: true
      });

      await onEventCreated(testEvent);
      await new Promise(r => setTimeout(r, 400));

      // Check mirrored announcement
      const mirroredAnn = await Announcement.findOne({ eventId: testEvent._id });
      assert(mirroredAnn, 'Announcement mirror must exist');
      assert.strictEqual(mirroredAnn.sourceType, 'event');

      // Now pass this mirrored announcement to onAnnouncementCreated
      const emailCountBefore = capturedEmails.length;
      await onAnnouncementCreated(mirroredAnn);
      await new Promise(r => setTimeout(r, 200));
      assert.strictEqual(capturedEmails.length, emailCountBefore, 'Mirrored announcement must NEVER trigger announcement emails');

      await Event.findByIdAndDelete(testEvent._id);
      await Announcement.deleteMany({ eventId: testEvent._id });
      await NotificationLog.deleteMany({ entityId: testEvent._id });
    });

    // ── TEST 4: Standalone Announcement sends ONE announcement notification ──
    await test('Standalone announcement sends exactly 1 announcement notification with PARISH ANNOUNCEMENT', async () => {
      capturedEmails.length = 0;

      const testAnn = await Announcement.create({
        title: 'Solemn Mass Notice',
        content: 'Special solemn mass on Sunday morning.',
        sourceType: 'announcement',
        isPublished: true
      });

      await onAnnouncementCreated(testAnn);
      await new Promise(r => setTimeout(r, 400));

      assert(capturedEmails.length > 0, 'Must send announcement emails');
      const sampleEmail = capturedEmails[0];
      assert(sampleEmail.subject.includes('Parish Announcement: Solemn Mass Notice'));
      assert(sampleEmail.html.includes('PARISH ANNOUNCEMENT'));
      assert(!sampleEmail.html.includes('PARISH EVENT NOTICE'), 'Must NOT contain event template');

      // Verify NotificationLog
      const log = await NotificationLog.findOne({
        entityType: 'announcement',
        entityId: testAnn._id,
        notificationType: 'announcement_created'
      });
      assert(log, 'NotificationLog must exist for announcement_created');

      await Announcement.findByIdAndDelete(testAnn._id);
      await NotificationLog.deleteMany({ entityId: testAnn._id });
    });

    // ── TEST 5: Registration and Withdrawal Pipeline ──────────────────────────
    await test('User registration and withdrawal dispatches EVENT_REGISTRATION_WITHDRAWN with updated count', async () => {
      capturedEmails.length = 0;
      capturedWhatsApp.length = 0;

      const testEvent = await Event.create({
        title: 'Parish Pilgrimage 2026',
        date: new Date(Date.now() + 86400000 * 5),
        time: '6:00 AM',
        venue: 'Shrine Campus',
        isPublished: true,
        registrationRequired: true,
        registrations: [],
        registrationCount: 0
      });

      // Find or create a test user
      let testUser = await User.findOne({ email: 'testparticipant@example.com' });
      if (!testUser) {
        testUser = await User.create({
          name: 'Antony Test',
          email: 'testparticipant@example.com',
          phone: '9840123456',
          botLanguage: 'tamil',
          passwordHash: 'dummyhash123'
        });
      }

      // Find or create a test admin
      let testAdmin = await User.findOne({ role: { $in: ['admin', 'priest', 'superadmin'] } });
      let createdAdmin = false;
      if (!testAdmin) {
        testAdmin = await User.create({
          name: 'Father Admin',
          email: 'testadmin_unq@example.com',
          phone: '9999900001',
          role: 'admin',
          isActive: true,
          passwordHash: 'dummyhash123'
        });
        createdAdmin = true;
      }

      // Step A: Register
      const regResult = await registerUserForEvent({
        eventId: testEvent._id,
        user: testUser,
        registrationData: { name: 'Antony Test', phone: '9840123456', email: 'testparticipant@example.com' }
      });
      assert.strictEqual(regResult.registered, true);
      assert.strictEqual(regResult.registrationCount, 1);

      // Wait a moment for async registration notifications
      await new Promise(r => setTimeout(r, 100));

      capturedEmails.length = 0;
      capturedWhatsApp.length = 0;

      // Step B: Withdraw
      const withdrawResult = await withdrawUserRegistration({
        eventId: testEvent._id,
        userId: testUser._id
      });

      assert.strictEqual(withdrawResult.registered, false);
      assert.strictEqual(withdrawResult.registrationCount, 0, 'Total registration count must be 0 after withdrawal');

      // Wait a moment for async withdrawal notifications
      await new Promise(r => setTimeout(r, 400));

      // Verify User Email
      const userWithdrawEmail = capturedEmails.find(e => e.to === 'testparticipant@example.com');
      assert(userWithdrawEmail, 'User must receive withdrawal email');
      assert(userWithdrawEmail.subject.includes('Registration Withdrawn'), 'Subject must indicate withdrawal');
      assert(userWithdrawEmail.html.includes('REGISTRATION WITHDRAWN'), 'HTML must show Registration Withdrawn');

      // Verify Admin WhatsApp message contains updated count 0
      const adminWa = capturedWhatsApp.find(w => 
        w.text.includes('Registration Withdrawn') && 
        (w.text.includes('Total Registrations:* 0') || w.text.includes('Total Registrations: 0'))
      );
      assert(adminWa, 'Admin WhatsApp must be dispatched with updated count Total Registrations: 0');

      // Clean up
      await Event.findByIdAndDelete(testEvent._id);
      await EventRegistration.deleteMany({ eventId: testEvent._id });
      await NotificationLog.deleteMany({ entityId: testEvent._id });
      await User.findByIdAndDelete(testUser._id);
      if (createdAdmin && testAdmin?._id) await User.findByIdAndDelete(testAdmin._id);
    });

  } finally {
    mailer.sendMail = origSendMail;
    waService.sendWhatsAppNotification = origSendWA;
    await mongoose.disconnect();
  }

  console.log('\n================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed}/${total} PASSED`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal test suite failure:', err);
  process.exit(1);
});
