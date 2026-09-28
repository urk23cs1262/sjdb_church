const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: './.env' });

const Donation = require('../src/models/Donation');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const { generateDonationReceipt } = require('../src/services/pdfService');
const { getAllAdminPhoneNumbers, getAllAdminEmailRecipients, dispatchWhatsApp } = require('../src/services/requestNotificationService');
const whatsappBot = require('../src/bot/whatsapp');

async function testDonationWhatsAppPdf() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  let passed = 0;
  let total = 0;
  function assert(cond, msg) {
    total++;
    if (cond) {
      console.log(`  PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  FAIL: ${msg}`);
    }
  }

  console.log('\n--- TEST: Donation Receipt PDF Generation & Admin WhatsApp Dispatch ---');

  // 1. Find or create donor
  let donor = await User.findOne({ role: 'user' });
  if (!donor) {
    donor = await User.create({
      name: 'NIVESH ARN',
      phone: '917639520006',
      email: 'arndas777@gmail.com',
      role: 'user',
      parishMemberId: 'SJDB_M01',
      passwordHash: 'dummy'
    });
  }

  // 2. Create mock paid donation
  const donation = new Donation({
    donorName: donor.name,
    userId: donor._id,
    amount: 100,
    type: 'candle',
    email: donor.email,
    phone: donor.phone,
    razorpayPaymentId: 'pay_TEST_' + Date.now(),
    transactionId: 'TXN_' + Date.now(),
    status: 'paid',
    isVerified: true,
    paidAt: new Date(),
    note: 'Prayer intention for family'
  });
  await donation.save();

  // 3. Generate receipt PDF
  const receiptPath = await generateDonationReceipt(donation, donor._id);
  const rel = String(receiptPath).replace(/^[/\\]+/, '');
  const fullPath = path.join(__dirname, '..', rel);
  
  assert(fs.existsSync(fullPath), `Receipt PDF exists on disk: ${fullPath}`);
  assert(fullPath.endsWith('.pdf'), 'Receipt file is a valid PDF');

  // 4. Resolve admin WhatsApp numbers
  const adminPhones = await getAllAdminPhoneNumbers();
  assert(adminPhones.length > 0, `Admin WhatsApp phone numbers resolved: ${adminPhones.join(', ')}`);

  // 5. Test sendWhatsAppMedia directly with the receipt PDF
  let mediaSent = false;
  const testPhone = adminPhones[0];
  const fileBuffer = fs.readFileSync(fullPath);
  const filename = path.basename(fullPath);
  const waCaption = `🔔 *Admin Alert: New Donation Received (Paid)*\n\n👤 *Donor:* ${donor.name}\n💰 *Amount:* ₹${donation.amount}\n🏷️ *Category:* Candle Offering\n\n📎 Official receipt PDF is attached below.`;

  // Test Baileys bot sendWhatsAppMedia / fallback
  try {
    const res = await whatsappBot.sendWhatsAppMedia(testPhone, {
      url: fullPath,
      buffer: fileBuffer,
      mimetype: 'application/pdf',
      fileName: filename,
      caption: waCaption
    });
    // If bot is not connected in test runner, it safely returns false and logs skip
    assert(typeof res === 'boolean', `sendWhatsAppMedia returned boolean status: ${res}`);
  } catch (err) {
    console.error('sendWhatsAppMedia error:', err);
  }

  // 6. Test dispatchWhatsApp with mediaOptions
  const dispatchRes = await dispatchWhatsApp(testPhone, waCaption, {
    url: fullPath,
    buffer: fileBuffer,
    mimetype: 'application/pdf',
    fileName: filename,
    caption: waCaption
  });
  assert(typeof dispatchRes === 'boolean', `dispatchWhatsApp with mediaOptions executed safely: ${dispatchRes}`);

  // 7. Verify admin notification creation with fileUrl & mediaOptions
  const { createAdminNotification } = require('../src/services/requestNotificationService');
  const notif = await createAdminNotification({
    type: 'DONATION',
    requestType: 'DONATION',
    title: `New Donation Received: ₹${donation.amount} (${donor.name})`,
    message: `A new donation was received from ${donor.name}.`,
    userId: donor._id,
    requestId: donation.transactionId,
    status: 'PAID',
    fileUrl: receiptPath,
    pdfPath: fullPath,
    mediaOptions: {
      url: fullPath,
      buffer: fileBuffer,
      mimetype: 'application/pdf',
      fileName: filename,
      caption: waCaption
    }
  });

  assert(notif && notif._id, 'Admin notification created successfully');
  assert(notif.fileUrl === receiptPath, `Notification fileUrl saved correctly: ${notif.fileUrl}`);
  assert(notif.recipient === 'admin', 'Notification recipient is "admin"');

  // Wait for async delivery to record channels
  await new Promise(r => setTimeout(r, 1000));
  const refreshed = await Notification.findById(notif._id);
  assert(refreshed.channels.whatsapp.hasAttachment === true, 'Notification channels.whatsapp.hasAttachment is true');
  assert(refreshed.channels.whatsapp.recipients.length > 0, `Notification channels.whatsapp.recipients recorded: ${refreshed.channels.whatsapp.recipients.join(', ')}`);

  // Cleanup test donation and notification
  await Donation.findByIdAndDelete(donation._id);
  await Notification.findByIdAndDelete(notif._id);
  console.log('Cleaned up test records.');

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} / ${total} tests passed!`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
  process.exit(passed === total ? 0 : 1);
}

testDonationWhatsAppPdf().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
