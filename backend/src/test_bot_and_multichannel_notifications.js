const mongoose = require('mongoose');
const assert = require('assert');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('./models/User');
const OTPVerification = require('./models/OTPVerification');
const Notification = require('./models/Notification');
const { createAndSendOTP } = require('./services/otpService');
const { sendPendingVerificationReminders } = require('./services/accountVerificationService');
const { forceGlobalOtpReverification } = require('./controllers/adminController');
const { handleIncomingMessage } = require('./bot/botHandler');
const wa = require('./bot/whatsapp');

async function runTests() {
  console.log('--- STARTING BOT & MULTI-CHANNEL RE-VERIFICATION TEST ---');
  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/sjdb_church';
  await mongoose.connect(MONGO_URI);
  console.log(' Connected to MongoDB');

  // Track all outbound dispatches
  const waMessages = [];
  const origSendWhatsAppMessage = wa.sendWhatsAppMessage;
  const origSendWhatsAppToUser = wa.sendWhatsAppToUser;

  wa.sendWhatsAppMessage = async (target, text) => {
    waMessages.push({ target, text });
    return true;
  };
  wa.sendWhatsAppToUser = async (userObj, text) => {
    waMessages.push({ user: userObj.name || userObj._id, text });
    return true;
  };

  const testEmail = `test_bot_user_${Date.now()}@example.com`;
  const testPhone = '9876543210';
  let testUser = null;

  try {
    // 1. Create a test parishioner
    testUser = await User.create({
      name: 'Joseph Vijay',
      email: testEmail,
      phone: testPhone,
      passwordHash: '$2a$10$dummyhashedpasswordfortestingpurposesonly0000000',
      parishMemberId: 'PARISH-TEST-001',
      account_verified: false,
      isVerified: false,
      otpVerified: false,
      role: 'user',
      preferredLanguage: 'en',
      settings: { notifications: { push: true, email: true } }
    });

    console.log(' Created test parishioner:', testUser._id);

    // =========================================================================
    // TEST 1: createAndSendOTP sends WhatsApp bot message & multi-channel alerts
    // =========================================================================
    waMessages.length = 0;
    const otpRes = await createAndSendOTP({
      userId: testUser._id,
      phone: testUser.phone,
      email: testUser.email,
      purpose: 'account_verification'
    });

    assert.ok(otpRes.otp, 'OTP code generated');
    assert.strictEqual(otpRes.otp.length, 6, 'OTP code is 6 digits');

    // Check WhatsApp bot message dispatch
    assert.ok(waMessages.length > 0, 'WhatsApp bot message was dispatched for account_verification');
    const waOtp = waMessages.find(m => m.text && m.text.includes(otpRes.otp));
    assert.ok(waOtp, 'WhatsApp message contains plain 6-digit OTP');
    assert.ok(waOtp.text.includes('/verify-account'), 'WhatsApp message contains direct /verify-account link');
    console.log('✓ TEST 1 PASSED: createAndSendOTP sent WhatsApp bot message with OTP and direct link');

    // Check In-App notification
    const inAppNotif = await Notification.findOne({
      userId: testUser._id,
      type: 'account_verification'
    }).sort({ createdAt: -1 });

    assert.ok(inAppNotif, 'In-app notification created for account_verification');
    assert.strictEqual(inAppNotif.actionUrl, '/verify-account', 'In-app notification actionUrl is /verify-account');
    console.log('✓ TEST 2 PASSED: In-app notification created with actionUrl: /verify-account');

    // =========================================================================
    // TEST 2: WhatsApp Bot incoming message for 'reverify' intent
    // =========================================================================
    waMessages.length = 0;
    await handleIncomingMessage('919876543210', 'reverify account', '919876543210@s.whatsapp.net', 'Joseph Vijay');
    assert.ok(waMessages.length > 0, 'Bot replied to reverify inquiry');
    const reverifyReply = waMessages[0];
    assert.ok(reverifyReply.text.includes('/verify-account'), 'Bot reply contains direct /verify-account portal link');
    assert.ok(reverifyReply.text.includes('St. John de britto Church'), 'Bot reply contains parish heading');
    console.log('✓ TEST 3 PASSED: WhatsApp Bot handler replied with /verify-account on reverify intent');

    // =========================================================================
    // TEST 3: forceGlobalOtpReverification triggers WhatsApp bot broadcast
    // =========================================================================
    waMessages.length = 0;
    const fakeReq = {
      user: { _id: new mongoose.Types.ObjectId(), name: 'Pastor Admin', role: 'admin' },
      ip: '127.0.0.1',
      headers: {}
    };
    let jsonResult = null;
    const fakeRes = {
      json: (data) => { jsonResult = data; },
      status: () => fakeRes
    };

    await forceGlobalOtpReverification(fakeReq, fakeRes);
    assert.ok(jsonResult && jsonResult.success, 'forceGlobalOtpReverification succeeded');

    // Wait a brief moment for async broadcast promises to kick off
    await new Promise(r => setTimeout(r, 600));

    assert.ok(waMessages.length > 0, 'WhatsApp bot broadcast was initiated on global OTP reset');
    const broadcastMsg = waMessages.find(m => m.text && m.text.includes('/verify-account'));
    assert.ok(broadcastMsg, 'Broadcast message directs parishioners to /verify-account');
    console.log('✓ TEST 4 PASSED: forceGlobalOtpReverification dispatched WhatsApp bot broadcast');

    // Verify broadcast in-app notification points to /verify-account
    const globalInApp = await Notification.findOne({
      title: 'Security Advisory: Account Re-verification & OTP Required'
    }).sort({ createdAt: -1 });
    assert.ok(globalInApp, 'Global in-app notification exists');
    assert.strictEqual(globalInApp.actionUrl, '/verify-account', 'Global in-app actionUrl is /verify-account');
    console.log('✓ TEST 5 PASSED: Global in-app notification actionUrl is /verify-account');

    console.log('\n ALL 5 BOT & MULTI-CHANNEL RE-VERIFICATION TESTS PASSED SUCCESSFULLY! ');
  } finally {
    // Restore originals
    wa.sendWhatsAppMessage = origSendWhatsAppMessage;
    wa.sendWhatsAppToUser = origSendWhatsAppToUser;

    if (testUser) {
      await User.deleteOne({ _id: testUser._id });
      await OTPVerification.deleteMany({ userId: testUser._id });
      await Notification.deleteMany({ userId: testUser._id });
    }
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error(' TEST FAILED:', err);
  process.exit(1);
});
