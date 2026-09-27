/**
 * Unit Test for Annual Celebrations & Popup System
 * Tests:
 * 1. Computus Easter date computation
 * 2. All 5 occasions content (Birthday, New Year, St. John de Britto Feast, Easter, Christmas)
 * 3. Trilingual formatting: English, Tamil, Both
 * 4. User acknowledgment & duplicate prevention via CelebrationLog
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const assert = require('assert');
const mongoose = require('mongoose');

const User = require('../models/User');
const CelebrationLog = require('../models/CelebrationLog');
const Notification = require('../models/Notification');
const {
  getEasterSunday,
  getCelebrationTypesForDate,
  getCelebrationContent,
  getPendingCelebrationsForUser,
  acknowledgeCelebration
} = require('../services/celebrationService');

async function runTest() {
  console.log('🧪 Starting Annual Celebrations Test Suite...\n');

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB.');

  // 1. Easter Algorithm Verification
  console.log('--- Test 1: Easter Sunday Computus Calculation ---');
  const e2024 = getEasterSunday(2024);
  const e2025 = getEasterSunday(2025);
  const e2026 = getEasterSunday(2026);
  assert(e2024.month === 3 && e2024.day === 31, 'Easter 2024 is March 31');
  assert(e2025.month === 4 && e2025.day === 20, 'Easter 2025 is April 20');
  assert(e2026.month === 4 && e2026.day === 5, 'Easter 2026 is April 5');
  console.log('  ✅ PASS: Computus Easter calculation verified for multiple years.');

  // 2. Content for all 5 Occasions in English, Tamil, and Both
  console.log('\n--- Test 2: Content Generation Across Occasions and Languages ---');
  const occasions = ['birthday', 'new_year', 'st_john_britto_feast', 'easter', 'christmas'];
  const languages = ['en', 'ta', 'both'];

  for (const occ of occasions) {
    for (const lang of languages) {
      const content = getCelebrationContent({
        type: occ,
        userName: 'Parish Admin',
        language: lang
      });
      assert(content.heading, `[${occ}][${lang}] Heading exists`);
      assert(content.message, `[${occ}][${lang}] Message exists`);
      assert(content.buttonText, `[${occ}][${lang}] Button text exists`);
      
      if (occ === 'birthday') {
        assert(content.heading.includes('PARISH ADMIN') || content.heading.includes('Parish Admin'), 'Birthday includes user name');
      }
    }
    console.log(`  ✅ PASS: Content verified for occasion: ${occ}`);
  }

  // 3. User Acknowledgment and Duplicate Protection
  console.log('\n--- Test 3: User Acknowledgment and Duplicate Protection ---');
  const testPhone = '9999900002';
  await User.deleteMany({ phone: testPhone });
  await CelebrationLog.deleteMany({ userId: { $exists: true } });

  const testUser = await User.create({
    name: 'Celebration Tester',
    phone: testPhone,
    passwordHash: 'dummy_hash',
    preferredLanguage: 'ta'
  });

  // Acknowledge New Year for 2026
  const log = await acknowledgeCelebration({
    userId: testUser._id,
    celebrationType: 'new_year',
    year: 2026,
    celebrationKey: `NEW_YEAR_2026_${testUser._id}`
  });

  assert(log !== null, 'CelebrationLog created successfully');
  assert(log.celebrationType === 'new_year', 'Celebration type matches');
  assert(log.year === 2026, 'Year matches');

  // Verify duplicate acknowledgment upserts cleanly without duplicate key error
  const log2 = await acknowledgeCelebration({
    userId: testUser._id,
    celebrationType: 'new_year',
    year: 2026,
    celebrationKey: `NEW_YEAR_2026_${testUser._id}`
  });
  assert(log2._id.toString() === log._id.toString(), 'Upserted same document without duplicate error');

  const count = await CelebrationLog.countDocuments({ userId: testUser._id, celebrationType: 'new_year', year: 2026 });
  assert(count === 1, 'Strictly 1 log exists for user, celebrationType, and year');
  console.log('  ✅ PASS: Celebration acknowledgment and duplicate protection verified.');

  // Clean up
  await User.deleteMany({ phone: testPhone });
  await CelebrationLog.deleteMany({ userId: testUser._id });

  console.log('\n==============================================================');
  console.log('🎉 ALL CELEBRATION TESTS PASSED SUCCESSFULLY!');
  console.log('==============================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
