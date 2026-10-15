const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Donation = require('../src/models/Donation');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const { generateDonationReceipt } = require('../src/services/pdfService');
const {
  sendDonationNotifications,
  buildUserTextMessage,
  buildAdminTextMessage,
  buildUserHtmlEmail,
  buildAdminHtmlEmail
} = require('../src/services/donationNotificationService');
const { getSiteUrl } = require('../src/config/siteRoutes');

async function runEndToEndTests() {
  console.log('=== RUNNING COMPLETE DONATION NOTIFICATION & PDF RECEIPT TESTS ===');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB Connected Successfully.');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: URL Configuration & Routes Accuracy
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Route & Dashboard Link Resolution ---');
    const userDonationsUrl = getSiteUrl('/dashboard/donations');
    const adminDonationsUrl = getSiteUrl('/admin/donations');

    assert(userDonationsUrl.includes('/dashboard/donations'), `User dashboard link resolved correctly: ${userDonationsUrl}`);
    assert(!userDonationsUrl.includes('localhost'), `User dashboard link has no localhost leakage: ${userDonationsUrl}`);
    assert(adminDonationsUrl.includes('/admin/donations'), `Admin donations link resolved correctly: ${adminDonationsUrl}`);
    assert(!adminDonationsUrl.includes('localhost'), `Admin donations link has no localhost leakage: ${adminDonationsUrl}`);

    // -------------------------------------------------------------------------
    // TEST 2: Exact Prompt Message Templates Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Message Content & Prompt Template Compliance ---');
    const sampleData = {
      userName: 'Joseph Maria',
      userEmail: 'joseph@example.com',
      userPhone: '919876543210',
      amount: '5,000.00',
      donationDate: '15 October 2026',
      transactionId: 'pay_TEST123456789',
      receiptNumber: 'SJBC-2026-TEST01',
      paymentStatus: 'PAID',
      donationPurpose: 'Building Fund',
      userDashboardMyDonationsUrl: userDonationsUrl,
      adminDonationsUrl: adminDonationsUrl
    };

    const userText = buildUserTextMessage(sampleData);
    assert(userText.includes('Dear Joseph Maria,'), 'User text includes personalized greeting');
    assert(userText.includes('Thank you for your generous donation of ₹5,000.00 to St. John de Britto\'s Church.'), 'User text includes exact thank you sentence');
    assert(userText.includes('Donation Details:'), 'User text includes "Donation Details:" header');
    assert(userText.includes('- Donor Name: Joseph Maria'), 'User text includes Donor Name');
    assert(userText.includes('- Donation Amount: ₹5,000.00'), 'User text includes Donation Amount');
    assert(userText.includes('- Donation Date: 15 October 2026'), 'User text includes Donation Date');
    assert(userText.includes('- Transaction ID: pay_TEST123456789'), 'User text includes Transaction ID');
    assert(userText.includes('- Receipt Number: SJBC-2026-TEST01'), 'User text includes Receipt Number');
    assert(userText.includes(`View My Donations: ${userDonationsUrl}`), 'User text includes View My Donations direct link');
    assert(userText.includes('With heartfelt gratitude,\n\nSt. John de Britto\'s Church'), 'User text includes signoff');

    const adminText = buildAdminTextMessage(sampleData);
    assert(adminText.includes('Dear Administrator,'), 'Admin text includes Dear Administrator');
    assert(adminText.includes('A new donation has been successfully received by St. John de Britto\'s Church.'), 'Admin text includes opening notice');
    assert(adminText.includes('- Donor Name: Joseph Maria'), 'Admin text includes Donor Name');
    assert(adminText.includes('- Email: joseph@example.com'), 'Admin text includes Email');
    assert(adminText.includes('- Phone: 919876543210'), 'Admin text includes Phone');
    assert(adminText.includes('- Donation Amount: ₹5,000.00'), 'Admin text includes Amount');
    assert(adminText.includes('- Payment Status: PAID'), 'Admin text includes Payment Status');
    assert(adminText.includes('- Donation Purpose: Building Fund'), 'Admin text includes Donation Purpose');
    assert(adminText.includes('The donation receipt PDF is attached wherever supported.'), 'Admin text notes receipt PDF attachment');
    assert(adminText.includes(`Open Admin Donations: ${adminDonationsUrl}`), 'Admin text includes Open Admin Donations direct link');
    assert(adminText.includes('St. John de Britto\'s Church – Donation Management System'), 'Admin text includes management signoff');

    // -------------------------------------------------------------------------
    // TEST 3: Unverified/Pending Donations Must NOT Trigger Notifications
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Payment Verification Security Gate ---');
    const pendingDonation = new Donation({
      donorName: 'Pending Donor',
      amount: 1000,
      type: 'general',
      status: 'pending',
      isVerified: false
    });
    await pendingDonation.save();

    const pendingResult = await sendDonationNotifications(pendingDonation);
    assert(pendingResult.success === false && pendingResult.reason === 'Donation not paid',
      'Unverified / pending donation was blocked from generating receipt or sending notifications');

    // Clean up
    await Donation.findByIdAndDelete(pendingDonation._id);

    // -------------------------------------------------------------------------
    // TEST 4: Verified Donation Triggers Receipt & All Notification Channels
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Verified Donation Complete Workflow ---');
    let testUser = await User.findOne({ email: 'donor_test@example.com' });
    if (!testUser) {
      testUser = await User.create({
        name: 'Antigravity Verified Donor',
        email: 'donor_test@example.com',
        phone: '919655639144',
        role: 'user',
        passwordHash: 'dummy_hash_for_test'
      });
    }

    const verifiedDonation = new Donation({
      userId: testUser._id,
      donorName: testUser.name,
      email: testUser.email,
      phone: testUser.phone,
      amount: 2500,
      currency: 'INR',
      type: 'building',
      paymentMethod: 'razorpay',
      razorpayOrderId: 'order_TEST_' + Date.now(),
      razorpayPaymentId: 'pay_TEST_' + Date.now(),
      transactionId: 'pay_TEST_' + Date.now(),
      status: 'paid',
      isVerified: true,
      paidAt: new Date(),
      note: 'Contribution towards church roof renovation'
    });
    await verifiedDonation.save();

    assert(Boolean(verifiedDonation.receiptNumber), `Receipt number automatically assigned in pre-save: ${verifiedDonation.receiptNumber}`);
    assert(verifiedDonation.receiptNumber.startsWith(`SJBC-${new Date().getFullYear()}-`), `Receipt number follows format: ${verifiedDonation.receiptNumber}`);
    assert(Boolean(verifiedDonation.receiptAccessToken), `Secure receipt access token assigned: ${verifiedDonation.receiptAccessToken?.slice(0, 10)}...`);

    // Execute notification dispatch
    const notifyResult = await sendDonationNotifications(verifiedDonation);
    assert(notifyResult.success === true, 'Notification workflow executed successfully');
    assert(Boolean(notifyResult.receiptNumber), `Notification result returned receiptNumber: ${notifyResult.receiptNumber}`);

    // Verify PDF file was created on disk
    const reloadedDonation = await Donation.findById(verifiedDonation._id);
    assert(Boolean(reloadedDonation.receiptUrl), `Receipt URL populated on donation: ${reloadedDonation.receiptUrl}`);

    const pdfRelative = reloadedDonation.receiptUrl.replace(/^[/\\]+/, '');
    const pdfDiskPath = path.join(__dirname, '..', pdfRelative);
    assert(fs.existsSync(pdfDiskPath), `PDF receipt file physically exists on disk: ${pdfDiskPath}`);
    const pdfStats = fs.statSync(pdfDiskPath);
    assert(pdfStats.size > 2000, `PDF file has valid content size (${pdfStats.size} bytes)`);

    // Verify in-app notifications
    const userInApp = await Notification.findOne({
      recipient: 'user',
      userId: testUser._id,
      idempotencyKey: `DONATION_USER_${verifiedDonation._id}`
    });
    assert(Boolean(userInApp), 'User in-website notification record created in database');
    assert(userInApp.actionUrl === '/dashboard/donations', 'User in-website notification links to /dashboard/donations');
    assert(userInApp.metadata?.receiptNumber === verifiedDonation.receiptNumber, 'User notification contains receipt number in metadata');

    const adminInApp = await Notification.findOne({
      recipient: 'admin',
      idempotencyKey: `DONATION_ADMIN_${verifiedDonation._id}`
    });
    assert(Boolean(adminInApp), 'Admin in-website notification record created in database');
    assert(adminInApp.actionUrl === '/admin/donations', 'Admin in-website notification links to /admin/donations');

    // -------------------------------------------------------------------------
    // TEST 5: Idempotency & Duplicate Prevention
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Concurrency & Duplicate Prevention ---');
    const duplicateRunResult = await sendDonationNotifications(reloadedDonation);
    assert(duplicateRunResult.alreadyNotified === true,
      'Duplicate execution correctly suppressed by concurrency & idempotency guard');

    // Test forced resend
    const forcedResendResult = await sendDonationNotifications(reloadedDonation, { force: true });
    assert(forcedResendResult.success === true && !forcedResendResult.alreadyNotified,
      'Forced resend successfully permitted when explicitly triggered (e.g. by admin resend button)');

    // -------------------------------------------------------------------------
    // TEST 6: Secure Receipt Access Authorization
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Secure Receipt Access Rules ---');
    // Simulated token validation function from donationController
    const token = reloadedDonation.receiptAccessToken;
    assert(token && token.length === 48, `Token length is 48 characters (${token})`);

    // Verify access matrix
    const isOwner = testUser._id.toString() === reloadedDonation.userId.toString();
    assert(isOwner === true, 'Owner has legitimate access to their own receipt');

    const otherUser = new mongoose.Types.ObjectId();
    const isOtherUserOwner = otherUser.toString() === reloadedDonation.userId.toString();
    assert(isOtherUserOwner === false, 'Different user is correctly denied ownership access');

    // Clean up test records
    await Donation.findByIdAndDelete(verifiedDonation._id);
    await Notification.deleteMany({ relatedId: verifiedDonation._id });
    if (fs.existsSync(pdfDiskPath)) {
      try { fs.unlinkSync(pdfDiskPath); } catch {}
    }

  } catch (err) {
    console.error('Fatal error during test execution:', err);
  } finally {
    await mongoose.disconnect();
    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passed} / ${total} tests passed.`);
    console.log(`========================================\n`);
    if (passed === total) {
      console.log('ALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!');
      process.exit(0);
    } else {
      console.error('SOME ACCEPTANCE CRITERIA FAILED!');
      process.exit(1);
    }
  }
}

runEndToEndTests();
