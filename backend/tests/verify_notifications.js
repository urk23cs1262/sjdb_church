const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const Notification = require('../src/models/Notification');
const User = require('../src/models/User');
const Booking = require('../src/models/Booking');
const Document = require('../src/models/Document');
const Ticket = require('../src/models/Ticket');
const PrayerRequest = require('../src/models/PrayerRequest');
const Donation = require('../src/models/Donation');

const {
  createAdminNotification,
  createUserNotification,
  generateStatusTitle,
  generateStatusMessage,
  generateRequestRedirectUrl,
  generateAdminReviewUrl
} = require('../src/services/requestNotificationService');

async function runTests() {
  console.log('Connecting to MongoDB for End-to-End Notification Testing...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB successfully.');

  // Find or pick a test user and admin
  let admin = await User.findOne({ role: 'admin' });
  let testUser = await User.findOne({ role: 'user' });

  if (!testUser) {
    console.log('Creating mock test user...');
    testUser = await User.create({
      name: 'Shanu',
      email: 'roshaunpaul@karunya.edu.in',
      phone: '8610172583',
      parishMemberId: 'SJDB_M03',
      role: 'user',
      isActive: true
    });
  }

  if (!admin) {
    console.log('Creating mock admin...');
    admin = await User.create({
      name: 'NIVESH ARN',
      email: 'arndas777@gmail.com',
      phone: '07639520006',
      parishMemberId: 'SJDB_M02',
      role: 'admin',
      isActive: true
    });
  }

  console.log(`Test User: ${testUser.name} (${testUser.parishMemberId})`);
  console.log(`Test Admin: ${admin.name} (${admin.parishMemberId})`);

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  PASS: ${message}`);
      passed++;
    } else {
      console.error(`  FAIL: ${message}`);
    }
  }

  console.log('\n--- TEST SUITE 1: Mass Booking Flow ---');
  // 1. User submits Mass Booking
  const mockBooking = {
    _id: new mongoose.Types.ObjectId(),
    bookingNumber: 'MB-20261029-99',
    type: 'Thanksgiving Mass',
    intentionDetails: 'Special Thanksgiving Intention',
    date: '2026-10-29',
    time: '06:30 AM',
    status: 'pending'
  };

  const adminNotifMB = await createAdminNotification({
    type: 'MASS_BOOKING',
    requestType: 'MASS_BOOKING',
    title: 'New Mass Booking Request',
    message: `${testUser.name} submitted a new Mass Booking request.`,
    userId: testUser._id,
    user: testUser,
    memberId: testUser.parishMemberId,
    requestId: mockBooking.bookingNumber,
    priority: 'normal',
    details: `${mockBooking.type} on ${mockBooking.date}`,
    request: mockBooking
  });

  assert(adminNotifMB && adminNotifMB._id, 'Admin notification created for Mass Booking');
  assert(adminNotifMB.actionUrl.includes('bookings'), `Admin actionUrl is correct: ${adminNotifMB.actionUrl}`);
  assert(adminNotifMB.channels && adminNotifMB.channels.website.read === false, 'Admin in-app notification is unread');
  assert(adminNotifMB.metadata.userEmail === testUser.email, `Admin notification has user email: ${adminNotifMB.metadata.userEmail}`);
  assert(adminNotifMB.metadata.userPhone === testUser.phone, `Admin notification has user phone: ${adminNotifMB.metadata.userPhone}`);

  // Idempotency check: submitting the same request event again should return existing notification
  const adminNotifMBDup = await createAdminNotification({
    type: 'MASS_BOOKING',
    requestType: 'MASS_BOOKING',
    title: 'New Mass Booking Request',
    message: `${testUser.name} submitted a new Mass Booking request.`,
    userId: testUser._id,
    memberId: testUser.parishMemberId,
    requestId: mockBooking.bookingNumber,
    request: mockBooking
  });
  assert(adminNotifMBDup._id.toString() === adminNotifMB._id.toString(), 'Idempotency prevented duplicate admin notification for Mass Booking');

  // Admin approves Mass Booking -> User receives notification
  const userNotifMB = await createUserNotification({
    userId: testUser._id,
    type: 'REQUEST_STATUS_UPDATE',
    requestType: 'MASS_BOOKING',
    requestId: mockBooking.bookingNumber,
    status: 'APPROVED',
    title: generateStatusTitle('MASS_BOOKING', 'APPROVED'),
    message: generateStatusMessage(mockBooking, 'APPROVED', 'Mass will be offered at the Main Altar.'),
    redirectUrl: generateRequestRedirectUrl(mockBooking, 'MASS_BOOKING'),
    request: mockBooking
  });

  assert(userNotifMB && userNotifMB._id, 'User notification created for Mass Booking Approval');
  assert(userNotifMB.redirectUrl === `/dashboard/bookings/${mockBooking.bookingNumber}`, `User redirectUrl deep link is correct: ${userNotifMB.redirectUrl}`);
  assert(userNotifMB.title === 'Mass Booking Approved', `User title is status-specific: "${userNotifMB.title}"`);
  assert(userNotifMB.message.includes('Main Altar'), `Admin comment included in message: "${userNotifMB.message}"`);
  assert(userNotifMB.metadata.userEmail === testUser.email, `User notification has user email: ${userNotifMB.metadata.userEmail}`);
  assert(userNotifMB.metadata.userPhone === testUser.phone, `User notification has user phone: ${userNotifMB.metadata.userPhone}`);

  console.log('\n--- TEST SUITE 2: Document Request Flow ---');
  const mockDoc = {
    _id: new mongoose.Types.ObjectId(),
    type: 'baptism_certificate',
    purpose: 'School Admission',
    status: 'pending'
  };

  const adminNotifDoc = await createAdminNotification({
    type: 'DOCUMENT_REQUEST',
    requestType: 'DOCUMENT_REQUEST',
    title: 'New Document (BAPTISM CERTIFICATE)',
    message: `${testUser.name} requested baptism certificate.`,
    userId: testUser._id,
    memberId: testUser.parishMemberId,
    requestId: mockDoc._id.toString(),
    details: 'Baptism Certificate for School Admission',
    request: mockDoc
  });

  assert(adminNotifDoc && adminNotifDoc._id, 'Admin notification created for Document Request');

  const userNotifDoc = await createUserNotification({
    userId: testUser._id,
    type: 'REQUEST_STATUS_UPDATE',
    requestType: 'DOCUMENT_REQUEST',
    requestId: mockDoc._id.toString(),
    status: 'COMPLETED',
    title: generateStatusTitle('DOCUMENT_REQUEST', 'COMPLETED'),
    message: generateStatusMessage(mockDoc, 'COMPLETED'),
    redirectUrl: generateRequestRedirectUrl(mockDoc, 'DOCUMENT_REQUEST'),
    request: mockDoc
  });

  assert(userNotifDoc && userNotifDoc._id, 'User notification created for Document Completed');
  assert(userNotifDoc.redirectUrl.includes('/dashboard/documents/'), `User redirectUrl is document deep link: ${userNotifDoc.redirectUrl}`);
  assert(userNotifDoc.title.includes('Completed'), `User title reflects completion: "${userNotifDoc.title}"`);

  console.log('\n--- TEST SUITE 3: Prayer Request Flow ---');
  const mockPrayer = {
    _id: new mongoose.Types.ObjectId(),
    intention: 'Healing for grandparents',
    prayerLocation: 'altar',
    status: 'pending'
  };

  const adminNotifPrayer = await createAdminNotification({
    type: 'PRAYER_REQUEST',
    requestType: 'PRAYER_REQUEST',
    title: 'New Prayer Request',
    message: `${testUser.name} submitted a new prayer intention: "Healing for grandparents"`,
    userId: testUser._id,
    memberId: testUser.parishMemberId,
    requestId: mockPrayer._id.toString(),
    request: mockPrayer
  });

  assert(adminNotifPrayer && adminNotifPrayer._id, 'Admin notification created for Prayer Request');

  const userNotifPrayer = await createUserNotification({
    userId: testUser._id,
    type: 'REQUEST_STATUS_UPDATE',
    requestType: 'PRAYER_REQUEST',
    requestId: mockPrayer._id.toString(),
    status: 'APPROVED',
    title: generateStatusTitle('PRAYER_REQUEST', 'APPROVED'),
    message: generateStatusMessage(mockPrayer, 'APPROVED', 'The parish community will pray for your family.'),
    redirectUrl: generateRequestRedirectUrl(mockPrayer, 'PRAYER_REQUEST'),
    request: mockPrayer
  });

  assert(userNotifPrayer && userNotifPrayer._id, 'User notification created for Prayer Request Approval');
  assert(userNotifPrayer.redirectUrl.includes('/dashboard/prayer-requests/'), `User redirectUrl is prayer deep link: ${userNotifPrayer.redirectUrl}`);

  console.log('\n--- TEST SUITE 4: Raise a Ticket & Public Enquiry Flow ---');
  const mockTicket = {
    _id: new mongoose.Types.ObjectId(),
    ticketNumber: 'TKT-998877',
    subject: 'Catechism Class Timings',
    message: 'Could you please confirm the Sunday catechism schedule?',
    category: 'enquiry',
    status: 'open'
  };

  const adminNotifTkt = await createAdminNotification({
    type: 'CONTACT_ENQUIRY',
    requestType: 'CONTACT_ENQUIRY',
    title: 'New Website Enquiry',
    message: `${testUser.name} submitted an enquiry: "${mockTicket.subject}".`,
    userId: testUser._id,
    memberId: testUser.parishMemberId,
    requestId: mockTicket.ticketNumber,
    request: mockTicket
  });

  assert(adminNotifTkt && adminNotifTkt._id, 'Admin notification created for Support Ticket / Enquiry');

  const userNotifTkt = await createUserNotification({
    userId: testUser._id,
    type: 'REQUEST_STATUS_UPDATE',
    requestType: 'TICKET',
    requestId: mockTicket.ticketNumber,
    status: 'IN_PROGRESS',
    title: generateStatusTitle('TICKET', 'IN_PROGRESS'),
    message: generateStatusMessage(mockTicket, 'IN_PROGRESS', 'Fr. Vicar has received your message and will reply today.'),
    redirectUrl: generateRequestRedirectUrl(mockTicket, 'TICKET'),
    request: mockTicket
  });

  assert(userNotifTkt && userNotifTkt._id, 'User notification created for Ticket Reply / Status');
  assert(userNotifTkt.redirectUrl.includes('/dashboard/tickets/'), `User redirectUrl is ticket deep link: ${userNotifTkt.redirectUrl}`);

  console.log('\n--- TEST SUITE 5: Donation Submission Flow ---');
  const mockDonation = {
    _id: new mongoose.Types.ObjectId(),
    transactionId: 'TXN-99881122',
    amount: 1500,
    cause: 'Church Renovation Fund',
    status: 'pending'
  };

  const adminNotifDonation = await createAdminNotification({
    type: 'DONATION',
    requestType: 'DONATION',
    title: 'New Donation Submission',
    message: `${testUser.name} submitted a donation of ₹1500 for Church Renovation Fund.`,
    userId: testUser._id,
    memberId: testUser.parishMemberId,
    requestId: mockDonation.transactionId,
    request: mockDonation
  });

  assert(adminNotifDonation && adminNotifDonation._id, 'Admin notification created for Donation');

  const userNotifDonation = await createUserNotification({
    userId: testUser._id,
    type: 'REQUEST_STATUS_UPDATE',
    requestType: 'DONATION',
    requestId: mockDonation.transactionId,
    status: 'VERIFIED',
    title: generateStatusTitle('DONATION', 'VERIFIED'),
    message: generateStatusMessage(mockDonation, 'VERIFIED'),
    redirectUrl: '/dashboard/donations',
    request: mockDonation
  });

  assert(userNotifDonation && userNotifDonation._id, 'User notification created for Donation Verification');

  console.log('\n--- TEST SUITE 6: Multi-Admin Dispatch (3 or More Admins Across All Channels) ---');
  // 1. Create or ensure 3 distinct test admins exist in the database
  const mockAdmin1Email = 'test_admin_priest@sjdbchurch.org';
  const mockAdmin2Email = 'test_admin_asst@sjdbchurch.org';
  const mockAdmin3Email = 'test_admin_office@sjdbchurch.org';

  const mockAdmin1Phone = '919876500001';
  const mockAdmin2Phone = '919876500002';
  const mockAdmin3Phone = '919876500003';

  await User.deleteMany({ email: { $in: [mockAdmin1Email, mockAdmin2Email, mockAdmin3Email] } });

  const admin1 = await User.create({
    name: 'Rev. Fr. Parish Priest',
    email: mockAdmin1Email,
    phone: mockAdmin1Phone,
    role: 'admin',
    parishMemberId: 'SJDB_ADM01',
    passwordHash: 'testhash',
    isActive: true
  });

  const admin2 = await User.create({
    name: 'Rev. Fr. Assistant Priest',
    email: mockAdmin2Email,
    phone: mockAdmin2Phone,
    role: 'priest',
    parishMemberId: 'SJDB_ADM02',
    passwordHash: 'testhash',
    isActive: true
  });

  const admin3 = await User.create({
    name: 'Parish Office Secretary',
    email: mockAdmin3Email,
    phone: mockAdmin3Phone,
    role: 'staff',
    parishMemberId: 'SJDB_ADM03',
    passwordHash: 'testhash',
    isActive: true
  });

  const {
    getAllAdminPhoneNumbers,
    getAllAdminEmailRecipients
  } = require('../src/services/requestNotificationService');

  // Verify Phone Resolution includes all 3 admins
  const resolvedPhones = await getAllAdminPhoneNumbers();
  assert(resolvedPhones.includes(mockAdmin1Phone), `getAllAdminPhoneNumbers includes Admin 1 phone (${mockAdmin1Phone})`);
  assert(resolvedPhones.includes(mockAdmin2Phone), `getAllAdminPhoneNumbers includes Admin 2 phone (${mockAdmin2Phone})`);
  assert(resolvedPhones.includes(mockAdmin3Phone), `getAllAdminPhoneNumbers includes Admin 3 phone (${mockAdmin3Phone})`);
  assert(resolvedPhones.length >= 3, `Total admin phones resolved: ${resolvedPhones.length} (>= 3)`);

  // Verify Email Resolution includes all 3 admins
  const resolvedEmails = await getAllAdminEmailRecipients();
  const resolvedEmailAddresses = resolvedEmails.map(r => r.email.toLowerCase());
  assert(resolvedEmailAddresses.includes(mockAdmin1Email), `getAllAdminEmailRecipients includes Admin 1 email (${mockAdmin1Email})`);
  assert(resolvedEmailAddresses.includes(mockAdmin2Email), `getAllAdminEmailRecipients includes Admin 2 email (${mockAdmin2Email})`);
  assert(resolvedEmailAddresses.includes(mockAdmin3Email), `getAllAdminEmailRecipients includes Admin 3 email (${mockAdmin3Email})`);
  assert(resolvedEmails.length >= 3, `Total admin emails resolved: ${resolvedEmails.length} (>= 3)`);

  // Create a new service request and verify delivery metadata records all 3 admins
  const multiAdminBooking = {
    _id: new mongoose.Types.ObjectId(),
    bookingNumber: 'MB-MULTI-2026-999',
    type: 'Family Thanksgiving',
    status: 'pending'
  };

  const multiAdminNotif = await createAdminNotification({
    type: 'MASS_BOOKING',
    requestType: 'MASS_BOOKING',
    title: 'New Mass Booking for 3+ Admins',
    message: `${testUser.name} submitted a request for multiple admins test.`,
    userId: testUser._id,
    user: testUser,
    memberId: testUser.parishMemberId,
    requestId: multiAdminBooking.bookingNumber,
    request: multiAdminBooking
  });

  // Verify DB record & channels
  assert(multiAdminNotif && multiAdminNotif._id, 'Multi-admin notification created in MongoDB');
  assert(multiAdminNotif.recipient === 'admin', 'Notification recipient is "admin"');
  
  // Wait for async delivery promises (SMTP network requests) to settle
  let refreshedNotif = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    refreshedNotif = await Notification.findById(multiAdminNotif._id);
    if (
      refreshedNotif?.channels?.whatsapp?.recipients?.length >= 3 &&
      refreshedNotif?.channels?.email?.recipients?.length >= 3
    ) {
      break;
    }
  }

  assert(
    refreshedNotif.channels.whatsapp && Array.isArray(refreshedNotif.channels.whatsapp.recipients) &&
    refreshedNotif.channels.whatsapp.recipients.includes(mockAdmin1Phone) &&
    refreshedNotif.channels.whatsapp.recipients.includes(mockAdmin2Phone) &&
    refreshedNotif.channels.whatsapp.recipients.includes(mockAdmin3Phone),
    `WhatsApp dispatched to all 3 admins: ${refreshedNotif.channels.whatsapp?.recipients?.join(', ')}`
  );

  assert(
    refreshedNotif.channels.email && Array.isArray(refreshedNotif.channels.email.recipients) &&
    refreshedNotif.channels.email.recipients.includes(mockAdmin1Email) &&
    refreshedNotif.channels.email.recipients.includes(mockAdmin2Email) &&
    refreshedNotif.channels.email.recipients.includes(mockAdmin3Email),
    `Email dispatched to all 3 admins: ${refreshedNotif.channels.email?.recipients?.join(', ')}`
  );

  // Verify Per-Admin In-App Read Status Tracking
  // Helper for computing admin unread count using controller logic
  const getUnreadForAdmin = async (adminId) => {
    return await Notification.countDocuments({
      _id: multiAdminNotif._id,
      recipient: { $in: ['admin', 'both'] },
      readBy: { $ne: adminId }
    });
  };

  assert(await getUnreadForAdmin(admin1._id) === 1, 'Admin 1 initially has 1 unread notification');
  assert(await getUnreadForAdmin(admin2._id) === 1, 'Admin 2 initially has 1 unread notification');
  assert(await getUnreadForAdmin(admin3._id) === 1, 'Admin 3 initially has 1 unread notification');

  // Admin 1 marks it as read
  await Notification.findByIdAndUpdate(multiAdminNotif._id, { $addToSet: { readBy: admin1._id } });
  assert(await getUnreadForAdmin(admin1._id) === 0, 'Admin 1 now has 0 unread notifications after reading');
  assert(await getUnreadForAdmin(admin2._id) === 1, 'Admin 2 STILL has 1 unread notification (independent tracking)');
  assert(await getUnreadForAdmin(admin3._id) === 1, 'Admin 3 STILL has 1 unread notification (independent tracking)');

  // Admin 2 marks it as read
  await Notification.findByIdAndUpdate(multiAdminNotif._id, { $addToSet: { readBy: admin2._id } });
  assert(await getUnreadForAdmin(admin2._id) === 0, 'Admin 2 now has 0 unread notifications after reading');
  assert(await getUnreadForAdmin(admin3._id) === 1, 'Admin 3 STILL has 1 unread notification (independent tracking)');

  // Admin 3 marks all as read
  await Notification.updateMany({ _id: multiAdminNotif._id }, { $addToSet: { readBy: admin3._id } });
  assert(await getUnreadForAdmin(admin3._id) === 0, 'Admin 3 now has 0 unread notifications');

  console.log('\n--- CLEANUP OF TEST NOTIFICATIONS & TEST ADMINS ---');
  await Notification.deleteMany({
    $or: [
      { requestId: { $in: [mockBooking.bookingNumber, mockDoc._id.toString(), mockPrayer._id.toString(), mockTicket.ticketNumber, mockDonation.transactionId, multiAdminBooking.bookingNumber] } },
      { _id: multiAdminNotif._id }
    ]
  });
  await User.deleteMany({ _id: { $in: [admin1._id, admin2._id, admin3._id] } });
  console.log('Test notifications and test admins cleaned up from database.');

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} / ${total} tests passed!`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
  process.exit(passed === total ? 0 : 1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
