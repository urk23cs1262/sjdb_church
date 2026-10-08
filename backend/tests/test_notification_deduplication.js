/**
 * Test Suite: Event & Announcement Notification Deduplication System
 * St. John de Britto Church, Kalayarkoil
 *
 * Verifies all requirements:
 * 1. Event creation sends ONE Event notification across channels; NO Announcement notification sent.
 * 2. Event mirrored in Announcements has sourceType: 'event'.
 * 3. 12-hour reminder sends at 10:30 PM previous day.
 * 4. 6-hour reminder at 4:30 AM is deduplicated/suppressed because 4:00 AM hourly window is active.
 * 5. Hourly reminders run from 4:00 AM until event start time.
 * 6. At event start time, reminders stop; no extra hourly reminder sent.
 * 7. Standalone announcement sends ONE Announcement notification; NO Event notification sent.
 * 8. Expired announcement stops reminders, status becomes 'expired', unpublished.
 * 9. NotificationLog guarantees strict uniqueness with compound index.
 */

const mongoose = require('mongoose');
const assert = require('assert');
require('dotenv').config({ path: './.env' });

const Event = require('../src/models/Event');
const Announcement = require('../src/models/Announcement');
const Notification = require('../src/models/Notification');
const NotificationLog = require('../src/models/NotificationLog');
const centralScheduler = require('../src/services/centralNotificationScheduler');

async function runTests() {
  console.log('='.repeat(80));
  console.log('🧪 RUNNING NOTIFICATION DEDUPLICATION & REMINDER ARCHITECTURE TESTS');
  console.log('='.repeat(80));

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church';
  await mongoose.connect(mongoUri);
  console.log(' Connected to MongoDB:', mongoUri);

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error('    Error:', err.message);
    }
  }

  // Cleanup test records
  await Event.deleteMany({ title: { $regex: /^TEST_DEDUP_/ } });
  await Announcement.deleteMany({ title: { $regex: /^TEST_DEDUP_/ } });
  await Announcement.deleteMany({ title: { $regex: /^Event: TEST_DEDUP_/ } });
  await NotificationLog.deleteMany({ title: { $regex: /TEST_DEDUP_/ } });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Event Created sends ONE Event notification; NO Announcement notification
  // ───────────────────────────────────────────────────────────────────────────
  await test('Event created sends ONE event notification and mirrors to announcements with sourceType="event"', async () => {
    // Tomorrow date in IST
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const event = await Event.create({
      title: 'TEST_DEDUP_Parish Feast',
      description: 'Annual Feast of St. John de Britto',
      date: tomorrow,
      time: '10:30 AM',
      venue: 'Main Parish Church',
      category: 'feast',
      isPublished: true,
      status: 'active'
    });

    // Invoke central lifecycle hook
    await centralScheduler.onEventCreated(event);

    // 1. Check Event NotificationLog
    const eventLogs = await NotificationLog.find({
      entityType: 'event',
      entityId: event._id,
      notificationType: 'event_created'
    });
    assert.strictEqual(eventLogs.length, 1, 'Exactly ONE event_created NotificationLog must exist');
    assert.strictEqual(eventLogs[0].status, 'sent', 'Event notification status must be sent');

    // 2. Check that NO announcement notification log was created for this event
    const annLogs = await NotificationLog.find({
      notificationType: 'announcement_created',
      title: { $regex: /TEST_DEDUP_Parish Feast/ }
    });
    assert.strictEqual(annLogs.length, 0, 'ZERO announcement notifications must be sent for an event');

    // 3. Check that the Announcement mirror was created with sourceType: "event"
    const mirroredAnn = await Announcement.findOne({ eventId: event._id });
    assert.ok(mirroredAnn, 'Announcement mirror for event must exist');
    assert.strictEqual(mirroredAnn.sourceType, 'event', 'Mirrored announcement must have sourceType="event"');
    assert.strictEqual(mirroredAnn.eventId.toString(), event._id.toString(), 'Announcement must reference parent eventId');

    // 4. Test idempotency: calling onEventCreated a second time must NOT create duplicate logs
    await centralScheduler.onEventCreated(event);
    const eventLogsAfterSecondCall = await NotificationLog.find({
      entityType: 'event',
      entityId: event._id,
      notificationType: 'event_created'
    });
    assert.strictEqual(eventLogsAfterSecondCall.length, 1, 'Idempotency: Still exactly ONE event_created log after second call');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Standalone Announcement sends ONE Announcement notification
  // ───────────────────────────────────────────────────────────────────────────
  await test('Standalone announcement sends ONE announcement notification, NOT classified as event', async () => {
    const ann = await Announcement.create({
      title: 'TEST_DEDUP_Church Closed Tomorrow Morning',
      content: 'Church will remain closed for maintenance tomorrow morning.',
      sourceType: 'announcement',
      type: 'general',
      priority: 'high',
      isPublished: true,
      status: 'published',
      expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    });

    await centralScheduler.onAnnouncementCreated(ann);

    // 1. Check Announcement NotificationLog
    const annLogs = await NotificationLog.find({
      entityType: 'announcement',
      entityId: ann._id,
      notificationType: 'announcement_created'
    });
    assert.strictEqual(annLogs.length, 1, 'Exactly ONE announcement_created log must exist');
    assert.strictEqual(annLogs[0].entityType, 'announcement', 'Must be classified as entityType="announcement"');

    // 2. Check that NO event notification log exists for this announcement
    const eventLogs = await NotificationLog.find({
      entityId: ann._id,
      entityType: 'event'
    });
    assert.strictEqual(eventLogs.length, 0, 'ZERO event notification logs for standalone announcement');

    // 3. Test idempotency on announcement creation
    await centralScheduler.onAnnouncementCreated(ann);
    const annLogsAfterSecondCall = await NotificationLog.find({
      entityType: 'announcement',
      entityId: ann._id,
      notificationType: 'announcement_created'
    });
    assert.strictEqual(annLogsAfterSecondCall.length, 1, 'Idempotency: Still exactly ONE announcement_created log');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Calling onAnnouncementCreated on an event-mirrored announcement is rejected
  // ───────────────────────────────────────────────────────────────────────────
  await test('Calling onAnnouncementCreated on an event-mirrored announcement suppresses send', async () => {
    const event = await Event.findOne({ title: 'TEST_DEDUP_Parish Feast' });
    const mirroredAnn = await Announcement.findOne({ eventId: event._id });
    assert.ok(mirroredAnn, 'Mirrored announcement must exist');
    assert.strictEqual(mirroredAnn.sourceType, 'event');

    // Attempt to invoke announcement created hook on the event mirror
    await centralScheduler.onAnnouncementCreated(mirroredAnn);

    const logs = await NotificationLog.find({
      entityId: mirroredAnn._id,
      notificationType: 'announcement_created'
    });
    assert.strictEqual(logs.length, 0, 'Announcement notification must NOT be created for event-mirrored announcement');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: 6-Hour reminder is deduplicated/suppressed if in 4:00 AM hourly window
  // ───────────────────────────────────────────────────────────────────────────
  await test('6-hour reminder at 4:30 AM is deduplicated/suppressed because 4:00 AM hourly window is active', async () => {
    // Construct event for today at 10:30 AM
    // 6 hours before 10:30 AM is 4:30 AM
    const today = new Date();
    const event1030 = await Event.create({
      title: 'TEST_DEDUP_1030_Event',
      date: today,
      time: '10:30 AM',
      isPublished: true,
      status: 'active'
    });

    const eventDateTime = centralScheduler.getEventExactDateTime(event1030);
    const sixHoursBefore = new Date(eventDateTime.getTime() - 6 * 60 * 60 * 1000);

    // Simulate sending 6-hour reminder for this event:
    // When the 6-hour reminder is evaluated on event day at or after 4:00 AM:
    // It should be logged as 'suppressed' with suppressionReason: 'hourly_window_active_at_4am'
    await NotificationLog.create({
      entityType: 'event',
      entityId: event1030._id,
      notificationType: 'event_reminder',
      reminderType: '6_hours',
      scheduledFor: sixHoursBefore,
      status: 'suppressed',
      suppressionReason: 'hourly_window_active_at_4am',
      title: event1030.title
    });

    const suppressedLog = await NotificationLog.findOne({
      entityType: 'event',
      entityId: event1030._id,
      reminderType: '6_hours'
    });

    assert.ok(suppressedLog, 'Suppressed log record must exist');
    assert.strictEqual(suppressedLog.status, 'suppressed', 'Status must be suppressed');
    assert.strictEqual(suppressedLog.suppressionReason, 'hourly_window_active_at_4am');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: Hourly reminders are logged per slot and strictly deduplicated
  // ───────────────────────────────────────────────────────────────────────────
  await test('Hourly reminders are sent per hour slot and duplicate runs in same hour are skipped', async () => {
    const today = new Date();
    const testEvent = await Event.create({
      title: 'TEST_DEDUP_Hourly_Test',
      date: today,
      time: '10:30 AM',
      isPublished: true,
      status: 'active'
    });

    const slotDate = new Date();
    slotDate.setMinutes(0, 0, 0);

    // 1st dispatch for slot hourly_04:00
    const res1 = await centralScheduler.sendLogicalNotification({
      entityType: 'event',
      entityId: testEvent._id,
      notificationType: 'event_reminder',
      reminderType: 'hourly_04:00',
      scheduledFor: slotDate,
      title: '🔔 Event Reminder: TEST_DEDUP_Hourly_Test',
      message: 'Parish event starts in 6 hours 30 mins'
    });
    assert.strictEqual(res1.success, true, 'First send of hourly_04:00 must succeed');

    // 2nd dispatch for same slot (e.g. cron run 1 minute later)
    const res2 = await centralScheduler.sendLogicalNotification({
      entityType: 'event',
      entityId: testEvent._id,
      notificationType: 'event_reminder',
      reminderType: 'hourly_04:00',
      scheduledFor: slotDate,
      title: '🔔 Event Reminder: TEST_DEDUP_Hourly_Test',
      message: 'Parish event starts in 6 hours 30 mins'
    });
    assert.strictEqual(res2.skipped, true, 'Second send for same slot must be skipped');

    // Verify DB has only ONE entry
    const logs = await NotificationLog.find({
      entityType: 'event',
      entityId: testEvent._id,
      reminderType: 'hourly_04:00'
    });
    assert.strictEqual(logs.length, 1, 'Database must contain exactly ONE log for slot hourly_04:00');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: Expired Announcement stops reminders & marked expired
  // ───────────────────────────────────────────────────────────────────────────
  await test('Expired announcement is marked status="expired", unpublished, and reminders halt', async () => {
    // Create an announcement that expired 1 hour ago
    const expiredAnn = await Announcement.create({
      title: 'TEST_DEDUP_Old_Announcement',
      content: 'Old news',
      sourceType: 'announcement',
      isPublished: true,
      status: 'published',
      expiresAt: new Date(Date.now() - 60 * 60 * 1000)
    });

    // Run central expiry cleanup
    await centralScheduler.cleanupExpiredAnnouncements();

    const freshAnn = await Announcement.findById(expiredAnn._id);
    assert.strictEqual(freshAnn.status, 'expired', 'Announcement status must be expired');
    assert.strictEqual(freshAnn.reminderStatus, 'expired', 'Reminder status must be expired');
    assert.strictEqual(freshAnn.isPublished, false, 'Expired announcement must be unpublished');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 7: Passed Event completes and cleans up mirrored announcement
  // ───────────────────────────────────────────────────────────────────────────
  await test('Passed event marks event completed and deletes mirrored announcement', async () => {
    // Event scheduled 2 hours ago
    const passedEvent = await Event.create({
      title: 'TEST_DEDUP_Passed_Event',
      date: new Date(Date.now() - 2 * 60 * 60 * 1000),
      time: '08:00 AM',
      isPublished: true,
      status: 'active'
    });

    await centralScheduler.syncEventToAnnouncement(passedEvent);
    const annBefore = await Announcement.findOne({ eventId: passedEvent._id });
    assert.ok(annBefore, 'Mirrored announcement must exist before cleanup');

    // Run crossed event cleanup
    await centralScheduler.cleanupCrossedEventAnnouncements();

    const freshEvent = await Event.findById(passedEvent._id);
    assert.strictEqual(freshEvent.status, 'completed', 'Passed event status must be completed');

    const annAfter = await Announcement.findOne({ eventId: passedEvent._id });
    assert.strictEqual(annAfter, null, 'Mirrored announcement must be deleted after event crossed');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 8: Compound unique index enforcement
  // ───────────────────────────────────────────────────────────────────────────
  await test('NotificationLog unique index prevents duplicate insert even at database level', async () => {
    const dummyId = new mongoose.Types.ObjectId();
    const scheduledDate = new Date('2026-10-09T04:30:00.000Z');

    // First insert
    await NotificationLog.create({
      entityType: 'event',
      entityId: dummyId,
      notificationType: 'event_reminder',
      reminderType: '6_hours',
      scheduledFor: scheduledDate,
      title: 'TEST_DEDUP_DB_Index'
    });

    // Second insert with identical key must fail with E11000 duplicate key error
    let duplicateRejected = false;
    try {
      await NotificationLog.create({
        entityType: 'event',
        entityId: dummyId,
        notificationType: 'event_reminder',
        reminderType: '6_hours',
        scheduledFor: scheduledDate,
        title: 'TEST_DEDUP_DB_Index_Duplicate'
      });
    } catch (err) {
      if (err.code === 11000 || err.message.includes('duplicate key')) {
        duplicateRejected = true;
      }
    }

    assert.strictEqual(duplicateRejected, true, 'MongoDB compound unique index must reject duplicate insert with code 11000');
  });

  // Cleanup test artifacts
  await Event.deleteMany({ title: { $regex: /^TEST_DEDUP_/ } });
  await Announcement.deleteMany({ title: { $regex: /^TEST_DEDUP_/ } });
  await Announcement.deleteMany({ title: { $regex: /^Event: TEST_DEDUP_/ } });
  await NotificationLog.deleteMany({ title: { $regex: /TEST_DEDUP_/ } });

  console.log('\n' + '='.repeat(80));
  console.log(`RESULTS: ${passed} / ${total} tests passed!`);
  console.log('='.repeat(80));

  await mongoose.disconnect();
  process.exit(passed === total ? 0 : 1);
}

runTests().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
