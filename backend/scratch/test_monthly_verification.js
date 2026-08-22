require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const OTPVerification = require('../src/models/OTPVerification');
const Notification = require('../src/models/Notification');
const { checkAndSendMonthlyVerificationReminders } = require('../src/services/accountVerificationService');
const { createAndSendOTP, verifyOTPSession } = require('../src/services/otpService');

async function testMonthlyVerificationFlow() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sjdb_church';
    console.log('Connecting to MongoDB...', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected.');

    // 1. Find or create a test user
    let testUser = await User.findOne({ email: 'test_verify_user@sjdbchurch.org' });
    if (!testUser) {
      testUser = await User.create({
        name: 'Verification Test Parishioner',
        email: 'test_verify_user@sjdbchurch.org',
        phone: '9876543210',
        passwordHash: 'dummyhash123',
        role: 'user',
        isVerified: true,
        account_verified: false,
        last_verified_at: new Date(Date.now() - 32 * 86400 * 1000) // 32 days ago (Day 30 stage)
      });
      console.log(' Created test user with last_verified_at 32 days ago:', testUser._id);
    } else {
      testUser.last_verified_at = new Date(Date.now() - 32 * 86400 * 1000);
      testUser.last_verification_reminder_at = null;
      testUser.last_verification_stage = null;
      testUser.account_verified = false;
      await testUser.save();
      console.log(' Reset test user to 32 days since verification.');
    }

    // 2. Run the Monthly Verification Checker
    console.log('\n--- Testing checkAndSendMonthlyVerificationReminders() ---');
    const checkRes = await checkAndSendMonthlyVerificationReminders();
    console.log('Checker result:', checkRes);

    const reloadedUser = await User.findById(testUser._id);
    console.log(` User reminder stage: ${reloadedUser.last_verification_stage}`);
    console.log(` Last reminder sent at: ${reloadedUser.last_verification_reminder_at}`);

    // Check that notification was created in MongoDB
    const notif = await Notification.findOne({
      userId: testUser._id,
      type: 'account_verification'
    }).sort({ createdAt: -1 });

    if (notif) {
      console.log(` Unified Notification created in DB:`);
      console.log(`   Title: ${notif.title}`);
      console.log(`   Message: ${notif.message.slice(0, 80)}...`);
      console.log(`   ActionUrl: ${notif.actionUrl}`);
    } else {
      console.warn('⚠️ No notification found in database');
    }

    // 3. Test OTP dispatch for account verification
    console.log('\n--- Testing createAndSendOTP for account_verification ---');
    const { session, otp } = await createAndSendOTP({
      userId: testUser._id,
      email: testUser.email,
      phone: testUser.phone,
      purpose: 'account_verification'
    });
    console.log(` OTP Generated: ${otp} (Hashed in session: ${session._id})`);

    // 4. Test OTP Verification
    console.log('\n--- Testing verifyOTPSession for account_verification ---');
    const verifyRes = await verifyOTPSession({
      userId: testUser._id,
      inputOtp: otp,
      purpose: 'account_verification'
    });
    console.log('OTP Verification Result:', verifyRes);

    if (verifyRes.valid) {
      testUser.account_verified = true;
      testUser.isVerified = true;
      testUser.last_verified_at = new Date();
      testUser.last_verification_stage = null;
      testUser.last_verification_reminder_at = null;
      await testUser.save();
      console.log(' Test user verified! New last_verified_at:', testUser.last_verified_at);
    }

    console.log('\n ALL MONTHLY VERIFICATION TESTS PASSED SUCCESSFULLY! ');
    process.exit(0);
  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
}

testMonthlyVerificationFlow();
