/**
 * SJDB Church — Daily Catholic Content Notification Reset Migration Script
 * =========================================================================
 *
 * PURPOSE:
 *   Establish a clean, fresh state for the automated Daily Catholic Content
 *   delivery system. Run this ONCE before the first midnight delivery to
 *   ensure all users are opted-in and stale delivery logs are cleared.
 *
 * WHAT THIS SCRIPT DOES:
 *   1. Sets whatsappOptIn = true for all active users
 *   2. Sets settings.notifications.whatsapp = true for all active users
 *   3. Sets settings.notifications.email = true for all active users
 *   4. Sets settings.notifications.inApp = true for all active users
 *   5. Sets settings.notifications.push = true for all active users
 *   6. Sets botPreferences to the full default set for all active users
 *   7. Deletes ALL DailyNotificationLog records (clean slate for re-delivery)
 *
 * WHAT THIS SCRIPT DOES NOT DO:
 *   - Does NOT delete user accounts
 *   - Does NOT change passwords, phone numbers, or email addresses
 *   - Does NOT touch WhatsApp Baileys auth sessions
 *   - Does NOT change payment, sacrament, or church record data
 *   - Does NOT change user name, role, dob, or any profile fields
 *   - Does NOT delete BotSession records (bot conversation history)
 *
 * USAGE:
 *   cd backend
 *   node src/scripts/reset_daily_notification_preferences.js
 *
 * SAFETY:
 *   This script is REPEATABLE - running it multiple times is safe.
 *   Each run produces the same result (idempotent).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({ isActive: Boolean, whatsappOptIn: Boolean, botPreferences: [String], readingPreference: String, sendLinks: Boolean, settings: Object }, { strict: false });
const dailyNotificationLogSchema = new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId, dateKey: String, status: String }, { strict: false });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const DailyNotificationLog = mongoose.models.DailyNotificationLog || mongoose.model('DailyNotificationLog', dailyNotificationLogSchema);

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) { console.error('MONGODB_URI not set.'); process.exit(1); }

  console.log('\n===================================================');
  console.log('  SJDB Church - Daily Notification Reset Migration');
  console.log('===================================================\n');
  console.log('Connecting to database...');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.\n');

  const totalUsers = await User.countDocuments({ isActive: { $ne: false } });
  const totalLogs = await DailyNotificationLog.countDocuments({});
  console.log('Found ' + totalUsers + ' active users');
  console.log('Found ' + totalLogs + ' existing DailyNotificationLog records\n');

  console.log('Step 1: Restoring whatsappOptIn=true for all active users...');
  const waResult = await User.updateMany(
    { isActive: { $ne: false } },
    { $set: { whatsappOptIn: true, botPreferences: ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday'], readingPreference: 'full', sendLinks: true } }
  );
  console.log('  ' + waResult.modifiedCount + ' users updated\n');

  console.log('Step 2: Enabling all notification channels in user settings...');
  const settingsResult = await User.updateMany(
    { isActive: { $ne: false } },
    {
      $set: {
        'settings.notifications.whatsapp': true,
        'settings.notifications.email': true,
        'settings.notifications.inApp': true,
        'settings.notifications.push': true,
        'settings.notifications.saintOfTheDay': true,
        'settings.notifications.massSchedule': true,
        'settings.notifications.eventReminders': true
      }
    }
  );
  console.log('  ' + settingsResult.modifiedCount + ' users updated\n');

  console.log('Step 3: Clearing all DailyNotificationLog records...');
  const logResult = await DailyNotificationLog.deleteMany({});
  console.log('  ' + logResult.deletedCount + ' log records deleted\n');

  console.log('===================================================');
  console.log('  Migration Complete!');
  console.log('===================================================');
  console.log('  Users restored to opt-in:       ' + waResult.modifiedCount);
  console.log('  Users with channels re-enabled: ' + settingsResult.modifiedCount);
  console.log('  Stale delivery logs deleted:    ' + logResult.deletedCount);
  console.log('');
  console.log('  Next steps:');
  console.log('  - All active users will get Daily Catholic Content at 12:00 AM IST');
  console.log('  - To test now: POST /api/daily-notifications/trigger-now');
  console.log('  - Recovery if missed: POST /api/daily-notifications/recover-missed');
  console.log('===================================================\n');

  await mongoose.disconnect();
  console.log('Done.\n');
}

run().catch(err => { console.error('Migration failed:', err.message); process.exit(1); });
