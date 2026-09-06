const mongoose = require('mongoose');
const assert = require('assert');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('./models/User');
const BotSession = require('./models/BotSession');
const Notification = require('./models/Notification');
const BirthdayDeliveryLog = require('./models/BirthdayDeliveryLog');

const {
  sendBirthdayWishes,
  getBirthdayMessages,
  getISTDateParts,
  isUserBirthdayToday,
  resolveBirthdayLanguage,
  isLeapYear,
  birthdayCronTask
} = require('./services/birthdayService');

// Mock WhatsApp and Mailer
const sentWhatsApp = [];
const wa = require('./bot/whatsapp');
wa.sendWhatsAppMessage = async (to, message) => {
  sentWhatsApp.push({ to, message });
  return true;
};

const sentEmails = [];
const mailer = require('./config/mailer');
mailer.sendMail = async (mailOptions) => {
  sentEmails.push(mailOptions);
  return { messageId: 'mock-mail-id' };
};

async function runBirthdayTests() {
  console.log('======================================================================');
  console.log('  SJDB CONNECT BIRTHDAY NOTIFICATION SYSTEM TEST SUITE');
  console.log('======================================================================');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  const testPrefix = 'bday_test_' + Date.now();
  const testPhone1 = '919998881111';
  const testPhone2 = '919998882222';
  const testPhone3 = '919998883333';

  // Clean up any previous test artifacts
  await User.deleteMany({ phone: { $in: [testPhone1, testPhone2, testPhone3] } });
  await BotSession.deleteMany({ phoneNumber: { $in: [testPhone1, testPhone2, testPhone3] } });
  await BirthdayDeliveryLog.deleteMany({ recipient: { $in: [testPhone1, testPhone2, testPhone3, 'bday1@test.com', 'bday2@test.com'] } });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Midnight 12:00 AM IST Cron Registration
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 1: Midnight 12:00 AM IST Cron Registration ---');
  const serviceFileContent = require('fs').readFileSync(require('path').resolve(__dirname, './services/birthdayService.js'), 'utf8');
  assert(serviceFileContent.includes("cron.schedule('0 0 * * *'"), 'Must schedule at 0 0 * * * (12:00 AM midnight)');
  assert(serviceFileContent.includes("timezone: 'Asia/Kolkata'"), 'Timezone must strictly be Asia/Kolkata (IST)');
  console.log('✓ TEST 1 PASSED: Cron job is scheduled at sharply 12:00 AM (0 0 * * *) Asia/Kolkata.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Asia/Kolkata (IST) Date Parts Calculation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Asia/Kolkata (IST) Date Extraction ---');
  const istNow = getISTDateParts(new Date());
  assert(typeof istNow.year === 'number' && istNow.year >= 2025, 'Year must be valid number');
  assert(typeof istNow.month === 'number' && istNow.month >= 1 && istNow.month <= 12, 'Month must be between 1 and 12');
  assert(typeof istNow.day === 'number' && istNow.day >= 1 && istNow.day <= 31, 'Day must be between 1 and 31');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(istNow.dateKey), 'dateKey must match YYYY-MM-DD');
  console.log(`✓ TEST 2 PASSED: Current IST dateKey is ${istNow.dateKey} (Day: ${istNow.day}, Month: ${istNow.month}, Year: ${istNow.year}).`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: DOB Matching by Day and Month (Ignoring Birth Year)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: DOB Matching by Day and Month (Ignoring Year) ---');
  const mockToday = { year: 2026, month: 9, day: 6, dateKey: '2026-09-06' };
  assert(isUserBirthdayToday(new Date('1990-09-06'), mockToday) === true, 'DOB 1990-09-06 must match 2026-09-06');
  assert(isUserBirthdayToday(new Date('2005-09-06'), mockToday) === true, 'DOB 2005-09-06 must match 2026-09-06');
  assert(isUserBirthdayToday(new Date('1985-09-07'), mockToday) === false, 'Different day (07) must NOT match');
  assert(isUserBirthdayToday(new Date('1985-10-06'), mockToday) === false, 'Different month (10) must NOT match');
  console.log('✓ TEST 3 PASSED: Day and month correctly matched regardless of birth year.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Leap-Day (February 29) Policy in Non-Leap and Leap Years
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Leap-Day (Feb 29) Policy ---');
  // Non-leap year (e.g. 2026): Feb 29 celebrants celebrated on Feb 28
  const nonLeapFeb28 = { year: 2026, month: 2, day: 28, dateKey: '2026-02-28' };
  assert(!isLeapYear(2026), '2026 is a non-leap year');
  assert(isUserBirthdayToday(new Date('2000-02-29'), nonLeapFeb28) === true, 'Feb 29 birth in non-leap year celebrated on Feb 28');
  assert(isUserBirthdayToday(new Date('1996-02-28'), nonLeapFeb28) === true, 'Feb 28 birth in non-leap year celebrated on Feb 28');

  // Leap year (e.g. 2028): Feb 29 celebrants celebrated on Feb 29
  const leapFeb28 = { year: 2028, month: 2, day: 28, dateKey: '2028-02-28' };
  const leapFeb29 = { year: 2028, month: 2, day: 29, dateKey: '2028-02-29' };
  assert(isLeapYear(2028), '2028 is a leap year');
  assert(isUserBirthdayToday(new Date('2000-02-29'), leapFeb28) === false, 'Feb 29 birth in leap year NOT celebrated on Feb 28');
  assert(isUserBirthdayToday(new Date('2000-02-29'), leapFeb29) === true, 'Feb 29 birth in leap year celebrated on Feb 29');
  console.log('✓ TEST 4 PASSED: Leap-day policy verified for both non-leap (Feb 28) and leap (Feb 29) years.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Missing and Invalid DOB Handling
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: Missing and Invalid DOB Handling ---');
  assert(isUserBirthdayToday(null, mockToday) === false, 'Null DOB returns false');
  assert(isUserBirthdayToday(undefined, mockToday) === false, 'Undefined DOB returns false');
  assert(isUserBirthdayToday('not-a-date', mockToday) === false, 'Invalid string DOB returns false');
  assert(isUserBirthdayToday(new Date('invalid'), mockToday) === false, 'Invalid Date object returns false');
  console.log('✓ TEST 5 PASSED: Missing/invalid DOB values handled safely without exceptions.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Exact Message Templates & Personalization (Name Included)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6: Exact Message Templates & Personalization ---');
  const tamilMsg = getBirthdayMessages('அருள்', 'ta');
  assert(tamilMsg.text.includes('🎂🎉 *பிறந்தநாள் வாழ்த்துக்கள், அருள்!* 🎉🎂'), 'Tamil title must include user name');
  assert(tamilMsg.text.includes('அன்புள்ள *அருள்*,'), 'Tamil greeting must include user name');
  assert(tamilMsg.text.includes('புனித அருளானந்தர் தேவாலயத்தின் சார்பாக எங்கள் அன்பான வாழ்த்துக்களைத் தெரிவித்துக் கொள்கிறோம். 🙏'), 'Tamil body matches church blessing');
  assert(tamilMsg.text.includes('— *SJDB CONNECT*'), 'Tamil footer matches SJDB CONNECT');
  assert(tamilMsg.text.includes('புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்'), 'Tamil church name matches');

  const englishMsg = getBirthdayMessages('Arul', 'en');
  assert(englishMsg.text.includes('🎂🎉 *Happy Birthday, Arul!* 🎉🎂'), 'English title must include user name');
  assert(englishMsg.text.includes('Dear *Arul*,'), 'English greeting must include user name');
  assert(englishMsg.text.includes('Warm birthday wishes to you from *St. John de Britto Church*. 🙏'), 'English body matches church blessing');
  assert(englishMsg.text.includes('— *SJDB CONNECT*'), 'English footer matches SJDB CONNECT');
  assert(englishMsg.text.includes('St. John de Britto Church, Kalayarkoil'), 'English church name matches');
  console.log('✓ TEST 6 PASSED: Exact Tamil and English church templates match user specification.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: Language Priority: Bot Language vs Catholic Language
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 7: Language Determination (Bot Language Independent of Catholic Content Language) ---');
  // Create User 1: Bot Language = Tamil, Catholic Language = English
  const user1 = new User({
    name: 'Arul Tamil',
    phone: testPhone1,
    email: 'bday1@test.com',
    dob: new Date('1992-09-06'),
    preferredLanguage: 'ta',
    mass_reflection_language: 'en',
    passwordHash: 'dummyhash',
    isActive: true
  });
  await user1.save();

  const session1 = new BotSession({
    phoneNumber: testPhone1,
    linkedUserId: user1._id,
    language: 'ta',              // Bot Language = Tamil
    catholicLanguage: 'en',      // Daily Catholic Language = English
    step: 'done'
  });
  await session1.save();

  const lang1 = await resolveBirthdayLanguage(user1);
  assert.strictEqual(lang1, 'ta', 'Birthday wish must follow Bot Language (ta), NOT Catholic language (en)');

  // Create User 2: Bot Language = English, Catholic Language = Tamil
  const user2 = new User({
    name: 'Arul English',
    phone: testPhone2,
    email: 'bday2@test.com',
    dob: new Date('1994-09-06'),
    preferredLanguage: 'en',
    mass_reflection_language: 'ta',
    passwordHash: 'dummyhash',
    isActive: true
  });
  await user2.save();

  const session2 = new BotSession({
    phoneNumber: testPhone2,
    linkedUserId: user2._id,
    language: 'en',              // Bot Language = English
    catholicLanguage: 'ta',      // Daily Catholic Language = Tamil
    step: 'done'
  });
  await session2.save();

  const lang2 = await resolveBirthdayLanguage(user2);
  assert.strictEqual(lang2, 'en', 'Birthday wish must follow Bot Language (en), NOT Catholic language (ta)');
  console.log('✓ TEST 7 PASSED: Birthday wishes strictly follow Bot Language independent of Catholic content language.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8: Multi-Channel Dispatching (WhatsApp, Email, In-App, Push)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 8: Multi-Channel Dispatching ---');
  sentWhatsApp.length = 0;
  sentEmails.length = 0;

  // Run job targeting 2026-09-06
  const targetDate = new Date('2026-09-06T00:00:00.000+05:30');
  const run1Summary = await sendBirthdayWishes({ targetDate });

  assert(run1Summary.totalFound >= 2, 'Should find at least user1 and user2');
  assert(run1Summary.sentWhatsApp >= 2, 'Should dispatch WhatsApp to user1 and user2');
  assert(run1Summary.sentEmail >= 2, 'Should dispatch Email to user1 and user2');
  assert(run1Summary.sentInApp >= 2, 'Should create In-App notifications for user1 and user2');

  // Verify User 1 WhatsApp received Tamil text with user name
  const waUser1 = sentWhatsApp.find(w => w.to === testPhone1);
  assert(waUser1, 'WhatsApp sent to User 1');
  assert(waUser1.message.includes('பிறந்தநாள் வாழ்த்துக்கள், Arul Tamil!'), 'User 1 WhatsApp in Tamil with name');

  // Verify User 2 WhatsApp received English text with user name
  const waUser2 = sentWhatsApp.find(w => w.to === testPhone2);
  assert(waUser2, 'WhatsApp sent to User 2');
  assert(waUser2.message.includes('Happy Birthday, Arul English!'), 'User 2 WhatsApp in English with name');

  // Verify In-App notifications
  const notifUser1 = await Notification.findOne({ userId: user1._id, type: 'birthday' });
  assert(notifUser1, 'In-App notification created for User 1');
  assert(notifUser1.title.includes('பிறந்தநாள் வாழ்த்துக்கள்'), 'In-App notification in Tamil');

  const notifUser2 = await Notification.findOne({ userId: user2._id, type: 'birthday' });
  assert(notifUser2, 'In-App notification created for User 2');
  assert(notifUser2.title.includes('Happy Birthday'), 'In-App notification in English');

  console.log('✓ TEST 8 PASSED: All enabled channels (WhatsApp, Email, In-App) successfully dispatched in respective languages.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 9: Channel Opt-Out & Inactive Account Respect
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 9: Channel Opt-Out & Inactive Account Respect ---');
  // Create User 3: WhatsApp disabled, Birthday wishes disabled globally
  const user3 = new User({
    name: 'Opted Out User',
    phone: testPhone3,
    email: 'optout@test.com',
    dob: new Date('1995-09-06'),
    settings: {
      notifications: {
        birthdayWishes: false // Global opt-out
      }
    },
    passwordHash: 'dummyhash',
    isActive: true
  });
  await user3.save();

  sentWhatsApp.length = 0;
  sentEmails.length = 0;
  const optOutSummary = await sendBirthdayWishes({ targetDate });

  const waUser3 = sentWhatsApp.find(w => w.to === testPhone3);
  assert(!waUser3, 'Opted-out user must NOT receive WhatsApp');
  const emailUser3 = sentEmails.find(e => e.to === 'optout@test.com');
  assert(!emailUser3, 'Opted-out user must NOT receive Email');

  // Inactive user test
  user3.isActive = false;
  user3.settings.notifications.birthdayWishes = true;
  await user3.save();

  sentWhatsApp.length = 0;
  await sendBirthdayWishes({ targetDate });
  const waUser3Inactive = sentWhatsApp.find(w => w.to === testPhone3);
  assert(!waUser3Inactive, 'Inactive user must NOT receive birthday wishes');
  console.log('✓ TEST 9 PASSED: Notification opt-outs and inactive accounts strictly respected.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 10: Strict Idempotency & Duplicate Prevention (BirthdayDeliveryLog)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 10: Idempotency & Duplicate Prevention ---');
  sentWhatsApp.length = 0;
  sentEmails.length = 0;

  // Run the scheduler again for the same date (e.g. server restart or re-trigger)
  const duplicateRunSummary = await sendBirthdayWishes({ targetDate });

  assert.strictEqual(sentWhatsApp.length, 0, 'No duplicate WhatsApp messages sent');
  assert.strictEqual(sentEmails.length, 0, 'No duplicate emails sent');
  assert(duplicateRunSummary.skippedDuplicate >= 2, 'Duplicate run must report skipped duplicates');

  // Verify BirthdayDeliveryLog entries exist with correct jobId
  const logUser1WA = await BirthdayDeliveryLog.findOne({
    birthdayDate: '2026-09-06',
    userId: user1._id,
    channel: 'whatsapp'
  });
  assert(logUser1WA, 'Delivery log for User 1 WhatsApp exists');
  assert.strictEqual(logUser1WA.jobId, 'birthday_2026-09-06', 'jobId must be birthday_YYYY-MM-DD');
  assert.strictEqual(logUser1WA.status, 'sent', 'status must be sent');
  assert.strictEqual(logUser1WA.language, 'ta', 'language logged as ta');

  console.log('✓ TEST 10 PASSED: Duplicate runs strictly prevented via BirthdayDeliveryLog idempotency.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 11: Conversational Birthday Queries in WhatsApp Bot (Case-Insensitive)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 11: Conversational Birthday Queries in WhatsApp Bot ---');
  const { testBotMessage } = require('./controllers/botController');

  // Test 11a: Birthday keyword in testBotMessage simulator
  let mockResBody = null;
  const mockReqBday = {
    body: {
      from: testPhone1,
      text: 'HAPPY BIRTHDAY',
      sessionState: { step: 'done', language: 'ta', catholicLanguage: 'ta' }
    }
  };
  const mockRes = {
    json: (data) => { mockResBody = data; }
  };
  await testBotMessage(mockReqBday, mockRes);
  assert(mockResBody && mockResBody.success, 'testBotMessage must return success');
  assert(mockResBody.botReply.includes('பிறந்தநாள் வாழ்த்துக்கள்') || mockResBody.botReply.includes('Happy Birthday'),
    'Simulator must recognize uppercase HAPPY BIRTHDAY and return blessings');

  // Test 11b: Conversational handler with user whose birthday is today
  const waModule = require('./bot/whatsapp');
  let lastSentReply = '';
  const origSendMsg = waModule.sendWhatsAppMessage;
  waModule.sendWhatsAppMessage = async (to, text) => {
    lastSentReply = text;
    return true;
  };

  const { handleIncomingMessage } = require('./bot/botHandler');

  // Ensure user1 has today's DOB
  const now = new Date();
  user1.dob = new Date(1995, now.getMonth(), now.getDate());
  await user1.save();

  // Reset session to done state
  const botSession1 = await BotSession.findOne({ phoneNumber: testPhone1 });
  botSession1.step = 'done';
  botSession1.isVerified = true;
  botSession1.linkedUserId = user1._id;
  botSession1.language = 'ta';
  await botSession1.save();

  // Send "today is my birthday"
  await handleIncomingMessage(testPhone1, 'Today is my birthday', null, 'Arul Tamil');
  assert(lastSentReply.includes('பிறந்தநாள் வாழ்த்துக்கள்') && lastSentReply.includes(user1.name),
    'Bot must recognize user birthday today and send personalized blessing');

  // Restore waModule.sendWhatsAppMessage
  waModule.sendWhatsAppMessage = origSendMsg;
  console.log('✓ TEST 11 PASSED: WhatsApp bot conversational birthday queries handle greetings and registered DOB dynamically.');

  // Clean up test data
  await User.deleteMany({ phone: { $in: [testPhone1, testPhone2, testPhone3] } });
  await BotSession.deleteMany({ phoneNumber: { $in: [testPhone1, testPhone2, testPhone3] } });
  await Notification.deleteMany({ userId: { $in: [user1._id, user2._id, user3._id] } });
  await BirthdayDeliveryLog.deleteMany({ recipient: { $in: [testPhone1, testPhone2, testPhone3, 'bday1@test.com', 'bday2@test.com', 'optout@test.com'] } });
  await mongoose.disconnect();

  console.log('\n======================================================================');
  console.log('  ALL 11 BIRTHDAY NOTIFICATION TESTS PASSED SUCCESSFULLY! ✅');
  console.log('======================================================================');
  process.exit(0);
}

runBirthdayTests().catch(err => {
  console.error('❌ Birthday test suite failed with error:', err);
  process.exit(1);
});
