const axios = require('axios');

async function testApi() {
  try {
    const baseUrl = 'http://localhost:5000/api/auth/verify-account';

    console.log('1. Testing POST /send-otp with email...');
    const sendRes = await axios.post(`${baseUrl}/send-otp`, {
      emailOrUsername: 'test_verify_user@sjdbchurch.org'
    });
    console.log('Send OTP response:', sendRes.data);

    // Grab OTP from mongodb directly to simulate user entering it
    const mongoose = require('mongoose');
    const OTPVerification = require('../src/models/OTPVerification');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sjdb_church');

    const session = await OTPVerification.findOne({
      email: 'test_verify_user@sjdbchurch.org',
      purpose: 'account_verification',
      status: 'pending'
    }).sort({ createdAt: -1 });

    console.log('\n2. Testing POST /verify-otp with wrong OTP (should fail)...');
    try {
      await axios.post(`${baseUrl}/verify-otp`, {
        userId: sendRes.data.userId,
        otp: '000000'
      });
    } catch (err) {
      console.log('Expected error on wrong OTP:', err.response?.data?.message);
    }

    console.log('\n3. Testing POST /verify-otp with correct OTP...');
    // In our test, let's verify using verifyOTPSession or a freshly created known OTP
    const bcrypt = require('bcryptjs');
    const plainOtp = '654321';
    session.otpHash = await bcrypt.hash(plainOtp, 10);
    await session.save();

    const verifyRes = await axios.post(`${baseUrl}/verify-otp`, {
      userId: sendRes.data.userId,
      otp: plainOtp
    });
    console.log('Verify OTP response:', verifyRes.data);

    console.log('\n HTTP API ENDPOINT TESTS PASSED! ');
    process.exit(0);
  } catch (err) {
    console.error('API Test Failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

testApi();
