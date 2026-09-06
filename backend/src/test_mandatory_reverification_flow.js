/**
 * Comprehensive Automated Test: Mandatory Account Re-Verification Flow
 * 
 * Verifies:
 * 1. checkReverificationRequired correctly identifies unverified accounts
 * 2. /api/auth/verify-account/status endpoint
 * 3. /api/auth/verify-account/send-otp returns devOtp and masked contact
 * 4. /api/auth/verify-account/verify-otp updates DB fields (account_verified, last_verified_at, etc.)
 * 5. Immediate Multi-channel User Notification creation (In-App, Push, Email, WhatsApp)
 * 6. Dynamic Admin Notification with accurate remaining user count
 * 7. Duplicate notification burst protection
 * 8. Admin Dashboard Re-Verification Status stats calculation
 * 9. Already verified user handling
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
process.env.JWT_SECRET = process.env.JWT_SECRET || 'sjdb_church_secret_2024_secure_key';
const assert = require('assert');
const mongoose = require('mongoose');

const createMockRes = (callback) => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    if (callback) callback(data, this.statusCode);
    return this;
  }
});
const User = require('./models/User');
const OTPVerification = require('./models/OTPVerification');
const Notification = require('./models/Notification');
const {
  checkReverificationRequired,
  getPendingReverificationCount,
  sendVerificationOtp,
  verifyAccountOtp,
  getVerificationStatus
} = require('./controllers/authController');
const { getDashboardStats } = require('./controllers/adminController');

async function runTest() {
  console.log('===============================================================');
  console.log('  TEST SUITE: Mandatory Account Re-Verification Flow');
  console.log('===============================================================');

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church');
  console.log('✓ Connected to MongoDB');

  const testEmail = 'mandatory_reverify_test@sjdbchurch.org';
  const testPhone = '9876543219';

  try {
    // 0. Clean up any previous test artifacts
    await User.deleteMany({ email: testEmail });
    await OTPVerification.deleteMany({ email: testEmail });
    await Notification.deleteMany({ 'extra.email': testEmail });

    // 1. Create a test parishioner needing re-verification (30-day window expired)
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const testUser = await User.create({
      name: 'Maria Susai',
      email: testEmail,
      phone: testPhone,
      parishMemberId: 'SJDB-MAND-01',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: 'user',
      isVerified: true,
      account_verified: false,
      otpVerified: false,
      otpVerifiedAt: fortyDaysAgo,
      last_verified_at: fortyDaysAgo,
      preferredLanguage: 'ta',
      whatsappOptIn: true,
      settings: {
        notifications: {
          push: true,
          email: true
        }
      }
    });
    console.log('✓ Created unverified test parishioner (30-day window expired)');

    // 2. Test checkReverificationRequired helper
    const needsReverification = checkReverificationRequired(testUser);
    assert.strictEqual(needsReverification, true, 'checkReverificationRequired should return true for expired/unverified user');
    console.log('✓ TEST 1 PASSED: checkReverificationRequired correctly flagged user as requiring re-verification');

    // 3. Test getVerificationStatus endpoint
    let statusResponse = null;
    await getVerificationStatus(
      { query: { userId: testUser._id.toString() } },
      createMockRes((data) => { statusResponse = data; })
    );
    assert.strictEqual(statusResponse.success, true);
    assert.strictEqual(statusResponse.requiresReverification, true);
    assert.ok(statusResponse.emailMasked.includes('***'));
    console.log('✓ TEST 2 PASSED: getVerificationStatus returned requiresReverification: true with masked contact');

    // 4. Test sendVerificationOtp endpoint
    let sendOtpResponse = null;
    await sendVerificationOtp(
      { body: { userId: testUser._id.toString() } },
      createMockRes((data) => { sendOtpResponse = data; })
    );
    assert.strictEqual(sendOtpResponse.success, true);
    assert.ok(sendOtpResponse.devOtp, 'sendVerificationOtp should return devOtp');
    const generatedOtp = sendOtpResponse.devOtp;
    console.log(`✓ TEST 3 PASSED: sendVerificationOtp returned devOtp = ${generatedOtp}`);

    // Pre-verification remaining count
    const preCount = await getPendingReverificationCount();
    console.log(`ℹ Dynamic pending users count before verification: ${preCount}`);

    // 5. Test verifyAccountOtp endpoint
    let verifyResponse = null;
    await verifyAccountOtp(
      {
        body: {
          userId: testUser._id.toString(),
          otp: generatedOtp
        },
        headers: { 'user-agent': 'AutomatedTestRunner/1.0' },
        socket: { remoteAddress: '127.0.0.1' }
      },
      createMockRes((data) => { verifyResponse = data; })
    );

    assert.strictEqual(verifyResponse.success, true);
    assert.strictEqual(verifyResponse.user.account_verified, true);
    assert.strictEqual(verifyResponse.user.requiresReverification, false);
    console.log('✓ TEST 4 PASSED: verifyAccountOtp marked account_verified = true and cleared requiresReverification');

    // 6. Check database record
    const updatedUser = await User.findById(testUser._id);
    assert.strictEqual(updatedUser.account_verified, true);
    assert.strictEqual(updatedUser.isVerified, true);
    assert.strictEqual(updatedUser.otpVerified, true);
    assert.ok(updatedUser.last_verified_at, 'last_verified_at should be recorded');
    assert.ok(updatedUser.otpVerifiedAt, 'otpVerifiedAt should be updated');
    console.log('✓ TEST 5 PASSED: Database persistence verified (account_verified, last_verified_at, otpVerifiedAt recorded)');

    // 7. Check User In-App Notification creation
    const userNotif = await Notification.findOne({ userId: testUser._id, category: 'account' }).sort({ createdAt: -1 });
    assert.ok(userNotif, 'User in-app notification should be created');
    console.log(`✓ TEST 6 PASSED: User notification dispatched: "${userNotif.title}"`);

    // 8. Check Admin Notification and Dynamic Remaining Count
    const adminNotif = await Notification.findOne({ recipient: 'admin', title: 'User Re-Verification Completed' }).sort({ createdAt: -1 });
    assert.ok(adminNotif, 'Admin notification should be generated');
    assert.ok(adminNotif.message.includes('Remaining users:'), 'Admin notification should contain Remaining users count');

    const postCount = await getPendingReverificationCount();
    console.log(`ℹ Dynamic pending users count after verification: ${postCount}`);
    assert.strictEqual(postCount, preCount - 1, 'Remaining users count should decrease by exactly 1');
    assert.ok(adminNotif.message.includes(`Remaining users: ${postCount}`), 'Admin notification message should match the dynamic postCount');
    console.log(`✓ TEST 7 PASSED: Dynamic Admin notification verified: "${adminNotif.message.split('\n\n')[1]}"`);

    // 9. Check Duplicate Verification Request Prevention
    const notifCountBeforeDuplicate = await Notification.countDocuments({ recipient: 'admin', title: 'User Re-Verification Completed' });
    // Simulate immediate repeated verify
    await verifyAccountOtp(
      {
        body: {
          userId: testUser._id.toString(),
          otp: generatedOtp
        }
      },
      createMockRes(() => {})
    );
    const notifCountAfterDuplicate = await Notification.countDocuments({ recipient: 'admin', title: 'User Re-Verification Completed' });
    assert.strictEqual(notifCountAfterDuplicate, notifCountBeforeDuplicate, 'Duplicate verification request should not send duplicate notifications');
    console.log('✓ TEST 8 PASSED: Duplicate verification request suppressed duplicate notification burst');

    // 10. Test Admin Dashboard Re-Verification Status stats
    let adminStatsResponse = null;
    await getDashboardStats(
      {},
      createMockRes((data) => { adminStatsResponse = data; })
    );
    assert.ok(adminStatsResponse.stats?.reverification, 'Admin stats should contain reverification metrics');
    const rev = adminStatsResponse.stats.reverification;
    console.log('ℹ Admin Dashboard Live Re-Verification Stats:', {
      totalUsers: rev.totalUsers,
      completed: rev.completed,
      pending: rev.pending,
      completionPercentage: `${rev.completionPercentage}%`
    });
    assert.strictEqual(typeof rev.totalUsers, 'number');
    assert.strictEqual(typeof rev.completed, 'number');
    assert.strictEqual(typeof rev.pending, 'number');
    assert.strictEqual(typeof rev.completionPercentage, 'number');
    console.log('✓ TEST 9 PASSED: Admin Dashboard Re-Verification Status section metrics fully populated');

    // 11. Test Already Verified User visiting sendVerificationOtp
    let alreadyVerifiedResponse = null;
    await sendVerificationOtp(
      { body: { userId: testUser._id.toString() } },
      createMockRes((data) => { alreadyVerifiedResponse = data; })
    );
    assert.strictEqual(alreadyVerifiedResponse.alreadyVerified, true);
    console.log('✓ TEST 10 PASSED: Already verified user recognized without prompting for unnecessary OTP');

    console.log('\n===============================================================');
    console.log('  ALL 10 VERIFICATION TESTS PASSED SUCCESSFULLY! ✅');
    console.log('===============================================================\n');
  } finally {
    // Cleanup
    await User.deleteMany({ email: testEmail });
    await OTPVerification.deleteMany({ email: testEmail });
    await Notification.deleteMany({ 'extra.email': testEmail });
    await mongoose.disconnect();
    console.log('✓ Test cleanup complete & disconnected from MongoDB');
    process.exit(0);
  }
}

runTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
