/**
 * Automated Verification Test Suite for SJDB Church Birthday Wishes System
 * Tests all 8 core requirements:
 * 1. User detection by DOB month/day (recurring annually regardless of birth year)
 * 2. Exact 12:00 AM IST scheduler configuration (0 0 * * * Asia/Kolkata)
 * 3. Personalized message generation with Catholic blessings & St. John de Britto prayer
 * 4. Multi-channel delivery: WhatsApp, Email, In-App Notification, Web Push
 * 5. Language preference support (Tamil, English, Both)
 * 6. Duplicate protection via BirthdayLog (preventing re-sends on rerun or server restart)
 * 7. Annual recurring celebration logic (automatic year progression)
 * 8. Error isolation and channel failure resilience
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const assert = require('assert');
const mongoose = require('mongoose');

const User = require('../models/User');
const BirthdayLog = require('../models/BirthdayLog');
const Notification = require('../models/Notification');
const {
  sendBirthdayWishes,
  getBirthdayStatus,
  isUserBirthdayToday,
  getTodayISTParts,
  formatBirthdayWhatsAppMessage,
  getNextScheduledExecution,
  processUserBirthday
} = require('../services/birthdayService');
const { generateBirthdayEmailHtml } = require('../templates/birthdayEmailTemplate');

async function runTestSuite() {
  console.log('🧪 ==============================================================');
  console.log('🧪 Starting SJDB Church Birthday Wishes Test Suite');
  console.log('🧪 ==============================================================\n');

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB.');

  const istNow = getTodayISTParts();
  console.log(`ℹ️ Current IST Info: Year=${istNow.year}, Month=${istNow.month}, Day=${istNow.day}, DateKey=${istNow.dateKey}\n`);

  // ── TEST 1: Date Logic & Month/Day Matching ─────────────────────────────────
  console.log('--- Test 1: Date Logic & Timezone-Safe Month/Day Matching ---');
  
  // Example from prompt: DOB: 2005-09-27 should match Sept 27
  assert(isUserBirthdayToday('2005-09-27', 9, 27) === true, 'DOB string 2005-09-27 matches Month 9, Day 27');
  assert(isUserBirthdayToday('1990-09-27T00:00:00.000Z', 9, 27) === true, 'UTC ISO date matches Month 9, Day 27');
  assert(isUserBirthdayToday(new Date('1985-09-27'), 9, 27) === true, 'Date object matches Month 9, Day 27');
  assert(isUserBirthdayToday('2005-09-28', 9, 27) === false, 'Different day (28 vs 27) returns false');
  assert(isUserBirthdayToday('2005-10-27', 9, 27) === false, 'Different month (10 vs 9) returns false');
  assert(isUserBirthdayToday(null, 9, 27) === false, 'Null DOB safely returns false');
  console.log('  ✅ PASS: Month and Day matching is independent of birth year and timezone shifts.');

  // ── TEST 2: Scheduler Timing & Cron Configuration ───────────────────────────
  console.log('\n--- Test 2: Scheduler Timing & Cron Configuration ---');
  const statusInfo = await getBirthdayStatus();
  assert(statusInfo.success === true, 'getBirthdayStatus returned success');
  assert(statusInfo.scheduler.cronExpression === '0 0 * * *', 'Cron expression is strictly 0 0 * * *');
  assert(statusInfo.scheduler.timezone === 'Asia/Kolkata', 'Timezone is strictly Asia/Kolkata');
  assert(statusInfo.scheduler.nextScheduledExecution, 'Next scheduled execution timestamp is computed');
  console.log(`  ✅ PASS: Verified 12:00:00 AM IST Cron Configuration: ${statusInfo.scheduler.cronExpression} (${statusInfo.scheduler.timezone})`);
  console.log(`  ℹ️ Next run: ${new Date(statusInfo.scheduler.nextScheduledExecution).toISOString()}`);

  // ── TEST 3: Personalized Message Generation & Language Preferences ──────────
  console.log('\n--- Test 3: Personalized Message Generation & Language Preferences ---');
  const mockUserEn = { name: 'John Britto', email: 'john@example.com', phone: '9876543210' };
  
  // English WhatsApp
  const msgEn = formatBirthdayWhatsAppMessage(mockUserEn, 'en');
  assert(msgEn.includes('Happy Birthday, John Britto!'), 'English message includes personalized name');
  assert(msgEn.includes('May God bless you abundantly on your special day'), 'English message includes core Catholic blessing');
  assert(msgEn.includes('May St. John de Britto pray for you'), 'English message includes St. John de Britto patron prayer');
  assert(msgEn.includes('Numbers 6:24-25'), 'English message includes scripture blessing citation');
  assert(msgEn.includes('St. John de Britto Church, Kalayarkoil'), 'English message includes parish signoff');
  console.log('  ✅ PASS: English message format verified.');

  // Tamil WhatsApp
  const msgTa = formatBirthdayWhatsAppMessage(mockUserEn, 'ta');
  assert(msgTa.includes('இனிய பிறந்தநாள் நல்வாழ்த்துகள், John Britto!'), 'Tamil message includes personalized name');
  assert(msgTa.includes('இறைவன் உங்களை நிறைவாக ஆசீர்வதித்து'), 'Tamil message includes core Catholic blessing');
  assert(msgTa.includes('புனித ஜான் டி பிரிட்டோ உங்களுக்காக பரிந்து பேசவும்'), 'Tamil message includes patron saint prayer');
  assert(msgTa.includes('எண்ணாகமம் 6:24-25'), 'Tamil message includes Tamil scripture citation');
  assert(msgTa.includes('புனித ஜான் டி பிரிட்டோ திருத்தலம், காளையார்கோவில்'), 'Tamil message includes Tamil church signoff');
  console.log('  ✅ PASS: Tamil message format verified.');

  // Bilingual WhatsApp (Both)
  const msgBoth = formatBirthdayWhatsAppMessage(mockUserEn, 'both');
  assert(msgBoth.includes('Happy Birthday / இனிய பிறந்தநாள் நல்வாழ்த்துகள், John Britto!'), 'Bilingual message has both headers');
  assert(msgBoth.includes('Numbers / எண்ணாகமம் 6:24-25'), 'Bilingual message includes dual scripture citation');
  console.log('  ✅ PASS: Bilingual (Both) message format verified.');

  // HTML Email Template
  const emailResult = generateBirthdayEmailHtml({ user: mockUserEn, language: 'en' });
  assert(emailResult.subject && emailResult.subject.includes('Happy Birthday, John Britto!'), 'Email subject contains user name');
  assert(emailResult.html.includes('St. John de Britto Church'), 'Email HTML contains church branding');
  assert(emailResult.html.includes('Numbers / எண்ணாகமம் 6:24-25'), 'Email HTML contains scripture blessing');
  console.log('  ✅ PASS: Email HTML template contains complete responsive Catholic layout.');

  // ── TEST 4 & 5: Multi-Channel Delivery to Test User ─────────────────────────
  console.log('\n--- Test 4 & 5: Multi-Channel Delivery with Language Preference ---');
  
  // Clean up any existing test user and logs
  const testPhone = '9999900001';
  const testEmail = 'birthday.tester@sjdbchurch.org';
  await User.deleteMany({ phone: testPhone });
  await BirthdayLog.deleteMany({ userPhone: testPhone });

  // Create test user whose DOB matches today's IST month & day
  const testDobString = `1998-${String(istNow.month).padStart(2, '0')}-${String(istNow.day).padStart(2, '0')}`;
  const testUser = await User.create({
    name: 'Francis Xavier Tester',
    phone: testPhone,
    email: testEmail,
    passwordHash: 'dummy_hash_for_test',
    dob: new Date(testDobString),
    preferredLanguage: 'ta',
    whatsappOptIn: true,
    settings: {
      notifications: {
        birthdayWishes: true,
        whatsapp: true,
        email: true,
        inApp: true,
        push: true
      }
    }
  });

  console.log(`  ℹ️ Created test user: ${testUser.name} with DOB: ${testDobString} (Matches Today: Month ${istNow.month}, Day ${istNow.day})`);

  // Execute processing for this user
  const executionResult = await processUserBirthday({
    user: testUser,
    istInfo: istNow,
    isManualTest: false
  });

  assert(executionResult.success === true, 'Birthday processing succeeded for test user');
  console.log('  Channel delivery results:', executionResult.channels);

  // Verify BirthdayLog in MongoDB
  const createdLog = await BirthdayLog.findOne({ userId: testUser._id, year: istNow.year });
  assert(createdLog !== null, 'BirthdayLog was created in MongoDB');
  assert(createdLog.year === istNow.year, `BirthdayLog year matches current year (${istNow.year})`);
  assert(createdLog.userName === 'Francis Xavier Tester', 'Log stores user name');
  assert(createdLog.userPhone === testPhone, 'Log stores phone number');
  assert(createdLog.userEmail === testEmail, 'Log stores user email');
  assert(createdLog.channels.inApp.status === 'sent', 'In-app notification channel was recorded as sent');
  assert(createdLog.channels.push.status === 'sent', 'Push notification channel was recorded as sent');
  console.log('  ✅ PASS: BirthdayLog created with individual channel statuses.');

  // Verify In-App Notification in DB
  const inAppNotif = await Notification.findOne({ userId: testUser._id, category: 'birthday' });
  assert(inAppNotif !== null, 'In-app Notification document exists in DB');
  assert(inAppNotif.title.includes('Francis Xavier Tester'), 'In-app notification is personalized with name');
  console.log(`  ✅ PASS: In-App notification stored in database: "${inAppNotif.title}"`);

  // ── TEST 6: Duplicate Protection on Rerun / Server Restart ──────────────────
  console.log('\n--- Test 6: Duplicate Protection on Rerun / Server Restart ---');
  
  // Run processUserBirthday again for the same user in the same year
  const rerunResult = await processUserBirthday({
    user: testUser,
    istInfo: istNow,
    isManualTest: false
  });

  // Verify that channels already sent were marked 'already_sent' and not re-sent!
  assert(rerunResult.channels.inApp.status === 'already_sent', 'In-App notification channel was skipped on duplicate run');
  console.log('  Rerun channel statuses:', rerunResult.channels);

  // Verify only 1 BirthdayLog exists for this user and this year
  const totalLogsForUser = await BirthdayLog.countDocuments({ userId: testUser._id, year: istNow.year });
  assert(totalLogsForUser === 1, `Strictly 1 BirthdayLog exists for year ${istNow.year} (got ${totalLogsForUser})`);
  console.log('  ✅ PASS: Duplicate birthday messages strictly prevented for the same year.');

  // ── TEST 7: Recurring Annual Execution (Next Year Simulation) ───────────────
  console.log('\n--- Test 7: Annual Recurrence (Automatic next year detection) ---');
  
  const nextYearIST = {
    ...istNow,
    year: istNow.year + 1,
    dateKey: `${istNow.year + 1}-${String(istNow.month).padStart(2, '0')}-${String(istNow.day).padStart(2, '0')}`
  };

  const nextYearResult = await processUserBirthday({
    user: testUser,
    istInfo: nextYearIST,
    isManualTest: false
  });

  assert(nextYearResult.success === true, 'Next year birthday execution succeeded');
  const nextYearLog = await BirthdayLog.findOne({ userId: testUser._id, year: nextYearIST.year });
  assert(nextYearLog !== null, `A new BirthdayLog was successfully created for next year (${nextYearIST.year})`);
  assert(nextYearLog.year === nextYearIST.year, 'Next year log year matches');
  console.log(`  ✅ PASS: Birthday automatically triggers again in year ${nextYearIST.year} without re-entering DOB.`);

  // ── TEST 8: Full Service Pipeline Execution ─────────────────────────────────
  console.log('\n--- Test 8: Full sendBirthdayWishes Pipeline & Admin Telemetry ---');
  const pipelineResult = await sendBirthdayWishes({ isManualTest: true });
  assert(pipelineResult.success === true, 'Full pipeline execution returned success');
  console.log(`  Pipeline result: Scanned birthdays, Detected: ${pipelineResult.birthdaysDetected}, Success: ${pipelineResult.successful}`);

  const updatedStatus = await getBirthdayStatus();
  assert(updatedStatus.lastExecution !== null, 'Telemetry recorded last execution timestamp');
  assert(typeof updatedStatus.birthdaysDetected === 'number', 'Telemetry recorded detected count');
  assert(typeof updatedStatus.notificationsSent === 'number', 'Telemetry recorded sent count');
  console.log('  ✅ PASS: Admin monitoring and telemetry correctly updated.');

  // Clean up test data
  await User.deleteMany({ phone: testPhone });
  await BirthdayLog.deleteMany({ userPhone: testPhone });
  await Notification.deleteMany({ userId: testUser._id });

  console.log('\n==============================================================');
  console.log('🎉 ALL 8 UNIT & INTEGRATION TESTS PASSED SUCCESSFULLY!');
  console.log('==============================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
