/**
 * Test: Account Re-verification OTP Auto-Fill Verification
 * Validates that /api/auth/verify-account/send-otp returns devOtp
 * and that /api/auth/verify-account/verify-otp successfully verifies with devOtp.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const OTPVerification = require('./models/OTPVerification');
const { sendVerificationOtp, verifyAccountOtp } = require('./controllers/authController');

async function runTest() {
  console.log('--- Testing Account Re-verification devOtp Auto-Fill ---');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church');
  console.log('✓ Connected to MongoDB');

  try {
    // Find or create test parishioner
    const testEmail = 'test_reverify_autofill@sjdbchurch.org';
    let user = await User.findOne({ email: testEmail });
    if (!user) {
      user = await User.create({
        name: 'AutoFill Test Parishioner',
        email: testEmail,
        phone: '9876543210',
        parishMemberId: 'SJDB-TEST-99',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
        isVerified: true,
        isActive: true,
        role: 'user'
      });
      console.log('✓ Created temporary test user');
    }

    // Clear old test OTPs
    await OTPVerification.deleteMany({ userId: user._id });

    // 1. Simulate sendVerificationOtp request
    let responseData = null;
    let statusCode = 200;
    const reqSend = {
      body: { emailOrUsername: testEmail }
    };
    const resSend = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };

    await sendVerificationOtp(reqSend, resSend);

    console.log('sendVerificationOtp response:', {
      success: responseData?.success,
      hasDevOtp: Boolean(responseData?.devOtp),
      devOtp: responseData?.devOtp,
      emailMasked: responseData?.emailMasked
    });

    if (!responseData?.success) {
      throw new Error(`sendVerificationOtp failed: ${responseData?.message}`);
    }

    if (!responseData?.devOtp) {
      throw new Error('FAIL: devOtp was not returned in sendVerificationOtp response!');
    }

    console.log(`✓ SUCCESS: sendVerificationOtp returned devOtp = ${responseData.devOtp}`);

    // 2. Simulate verifyAccountOtp with devOtp
    let verifyResponseData = null;
    const reqVerify = {
      body: {
        userId: responseData.userId,
        otp: responseData.devOtp
      }
    };
    const resVerify = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        verifyResponseData = data;
        return this;
      }
    };

    await verifyAccountOtp(reqVerify, resVerify);

    console.log('verifyAccountOtp response:', verifyResponseData);

    if (!verifyResponseData?.success) {
      throw new Error(`verifyAccountOtp failed: ${verifyResponseData?.message}`);
    }

    console.log('✓ SUCCESS: verifyAccountOtp successfully verified using devOtp!');
    console.log('\nAll tests PASSED for Account Re-verification devOtp Auto-Fill!');
  } finally {
    // Cleanup
    await User.deleteOne({ email: 'test_reverify_autofill@sjdbchurch.org' });
    await OTPVerification.deleteMany({ email: 'test_reverify_autofill@sjdbchurch.org' });
    await mongoose.disconnect();
    console.log('✓ Cleanup complete & disconnected from MongoDB');
  }
}

runTest().catch(err => {
  console.error('Test FAILED:', err);
  process.exit(1);
});
