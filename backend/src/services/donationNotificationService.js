const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Donation = require('../models/Donation');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendMail } = require('../config/mailer');
const { getSiteUrl, getBaseClientUrl } = require('../config/siteRoutes');
const { getChurchEmail, getAdminEmail, getParishOfficePhone } = require('../config/contactConfig');
const { generateDonationReceipt } = require('./pdfService');
const { sendWhatsAppNotification } = require('./whatsAppNotificationService');
const { sendPushToUser, sendPushToAdmins } = require('./webPushService');
const { getAllAdminEmailRecipients, getAllAdminPhoneNumbers } = require('./requestNotificationService');

const DONATION_LABELS = {
  general: 'General Offering',
  feast: 'Feast Donation',
  building: 'Building Fund',
  candle: 'Candle Offering',
  tithe: 'Tithe Offering',
  special: 'Special Offering'
};

/**
 * Normalizes phone number into clean digits (e.g. 919876543210)
 */
function cleanPhoneNumber(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  while (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = '91' + digits;
  return digits.length >= 10 ? digits : null;
}

/**
 * Generate User Notification Plain Text Message
 */
function buildUserTextMessage({ userName, amount, donationDate, transactionId, receiptNumber, userDashboardMyDonationsUrl }) {
  return (
`Dear ${userName},

Thank you for your generous donation of ₹${amount} to St. John de Britto's Church.

Your kindness and support help our church continue its spiritual, charitable, and community activities. We sincerely appreciate your contribution.

Your donation receipt is attached to this notification wherever supported. You can also access your receipt and donation history through your dashboard.

Donation Details:

- Donor Name: ${userName}
- Donation Amount: ₹${amount}
- Donation Date: ${donationDate}
- Transaction ID: ${transactionId}
- Receipt Number: ${receiptNumber}

View My Donations: ${userDashboardMyDonationsUrl}

With heartfelt gratitude,

St. John de Britto's Church`
  );
}

/**
 * Generate Admin Notification Plain Text Message
 */
function buildAdminTextMessage({ userName, userEmail, userPhone, amount, donationDate, transactionId, receiptNumber, paymentStatus, donationPurpose, adminDonationsUrl }) {
  return (
`Dear Administrator,

A new donation has been successfully received by St. John de Britto's Church.

Donation Details:

- Donor Name: ${userName}
- Email: ${userEmail || 'N/A'}
- Phone: ${userPhone || 'N/A'}
- Donation Amount: ₹${amount}
- Donation Date: ${donationDate}
- Transaction ID: ${transactionId}
- Receipt Number: ${receiptNumber}
- Payment Status: ${paymentStatus}
- Donation Purpose: ${donationPurpose}

The donation receipt PDF is attached wherever supported. You can review the complete donation record and receipt from the administration panel.

Open Admin Donations: ${adminDonationsUrl}

Please verify the donation details if necessary.

St. John de Britto's Church – Donation Management System`
  );
}

/**
 * Generate User HTML Email Template
 */
function buildUserHtmlEmail({ userName, amount, donationDate, transactionId, receiptNumber, donationPurpose, userDashboardMyDonationsUrl, secureReceiptUrl }) {
  const parishPhone = getParishOfficePhone() || '+91 96556 39144';
  const churchEmail = getChurchEmail() || 'stjdbchurch@gmail.com';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Thank You for Your Generous Donation</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background-color:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
    
    <!-- HEADER -->
    <tr>
      <td style="padding:28px 24px 20px;background:linear-gradient(135deg,#1e3a8a 0%,#172554 100%);text-align:center;color:#ffffff;">
        <h1 style="margin:0;font-size:22px;font-weight:bold;letter-spacing:-0.02em;color:#ffffff;">
          ST. JOHN DE BRITTO CHURCH
        </h1>
        <p style="margin:4px 0 0;font-size:13px;color:#fde047;font-weight:500;">
          புனித அருளானந்தர் திருத்தலம் • Kalayarkoil
        </p>
        <div style="display:inline-block;margin-top:12px;background:rgba(212,160,23,0.25);border:1px solid rgba(253,224,71,0.5);border-radius:20px;padding:4px 14px;font-size:12px;color:#fef08a;font-weight:600;">
          Official Donation Receipt
        </div>
      </td>
    </tr>

    <!-- BODY -->
    <tr>
      <td style="padding:28px 24px 20px;color:#1f2937;font-size:15px;line-height:1.65;">
        <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#111827;">
          Dear ${userName},
        </p>
        <p style="margin:0 0 16px;color:#374151;">
          Thank you for your generous donation of <strong style="color:#1e3a8a;font-size:16px;">₹${amount}</strong> to <strong>St. John de Britto's Church</strong>.
        </p>
        <p style="margin:0 0 20px;color:#4b5563;">
          Your kindness and support help our church continue its spiritual, charitable, and community activities. We sincerely appreciate your contribution.
        </p>
        <p style="margin:0 0 24px;color:#4b5563;font-size:14px;background-color:#f0fdf4;border-left:4px solid #16a34a;padding:12px 14px;border-radius:6px;">
          📎 <strong>Your official donation receipt PDF is attached</strong> to this email. You can also view and download your receipts anytime through your church member dashboard.
        </p>

        <!-- DETAILS TABLE -->
        <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:18px;margin-bottom:26px;">
          <h3 style="margin:0 0 12px;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">
            Donation Details
          </h3>
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size:14px;">
            <tr>
              <td style="padding:6px 0;color:#6b7280;width:40%;">Donor Name:</td>
              <td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${userName}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Donation Amount:</td>
              <td style="padding:6px 0;font-weight:bold;color:#1e3a8a;text-align:right;">₹${amount}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Purpose:</td>
              <td style="padding:6px 0;font-weight:500;color:#111827;text-align:right;">${donationPurpose}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Donation Date:</td>
              <td style="padding:6px 0;font-weight:500;color:#111827;text-align:right;">${donationDate}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Transaction ID:</td>
              <td style="padding:6px 0;font-family:monospace;font-size:12px;color:#374151;text-align:right;">${transactionId}</td>
            </tr>
            <tr style="border-top:1px dashed #d1d5db;">
              <td style="padding:8px 0 0;font-weight:bold;color:#111827;">Receipt Number:</td>
              <td style="padding:8px 0 0;font-weight:bold;color:#b45309;text-align:right;">${receiptNumber}</td>
            </tr>
          </table>
        </div>

        <!-- ACTION BUTTONS -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
          <tr>
            <td align="center">
              <a href="${userDashboardMyDonationsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 28px;background-color:#1e3a8a;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;border-radius:10px;box-shadow:0 2px 8px rgba(30,58,138,0.25);">
                View My Donations
              </a>
              ${secureReceiptUrl ? `
                <span style="display:inline-block;width:12px;"></span>
                <a href="${secureReceiptUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 20px;background-color:#f3f4f6;color:#1f2937;text-decoration:none;font-weight:600;font-size:14px;border-radius:10px;border:1px solid #d1d5db;">
                  Download PDF Receipt
                </a>
              ` : ''}
            </td>
          </tr>
        </table>

        <p style="margin:0 0 6px;color:#4b5563;font-style:italic;">
          “Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.” — 2 Corinthians 9:7
        </p>

        <p style="margin:20px 0 4px;font-size:15px;color:#111827;">
          With heartfelt gratitude,
        </p>
        <p style="margin:0;font-weight:bold;color:#1e3a8a;font-size:15px;">
          St. John de Britto's Church
        </p>
      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td style="padding:18px 24px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;line-height:1.5;">
        <p style="margin:0 0 4px;">Parish Office Phone: ${parishPhone} | Email: ${churchEmail}</p>
        <p style="margin:0;">Murthi Nagar, Kalayarkoil, Tamil Nadu 630551, India.</p>
        <p style="margin:6px 0 0;font-size:11px;color:#9ca3af;">Computer generated receipt. No physical signature required.</p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Generate Admin HTML Email Template
 */
function buildAdminHtmlEmail({ userName, userEmail, userPhone, amount, donationDate, transactionId, receiptNumber, paymentStatus, donationPurpose, adminDonationsUrl, secureReceiptUrl }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Donation Received – ₹${amount}</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background-color:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
    
    <!-- HEADER -->
    <tr>
      <td style="padding:24px 24px 18px;background:linear-gradient(135deg,#065f46 0%,#047857 100%);color:#ffffff;">
        <div style="font-size:12px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#a7f3d0;margin-bottom:4px;">
          Administrative Alert • St. John de Britto Church
        </div>
        <h1 style="margin:0;font-size:22px;font-weight:bold;color:#ffffff;">
          New Donation Received – ₹${amount}
        </h1>
      </td>
    </tr>

    <!-- BODY -->
    <tr>
      <td style="padding:24px;color:#1f2937;font-size:14px;line-height:1.65;">
        <p style="margin:0 0 14px;font-size:15px;font-weight:bold;color:#111827;">
          Dear Administrator,
        </p>
        <p style="margin:0 0 18px;color:#374151;">
          A new donation has been successfully received by <strong>St. John de Britto's Church</strong>.
        </p>

        <!-- DETAILS TABLE -->
        <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:18px;margin-bottom:24px;">
          <h3 style="margin:0 0 12px;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#4b5563;">
            Donation Details
          </h3>
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size:14px;">
            <tr>
              <td style="padding:6px 0;color:#6b7280;width:40%;">Donor Name:</td>
              <td style="padding:6px 0;font-weight:bold;color:#111827;text-align:right;">${userName}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Email:</td>
              <td style="padding:6px 0;color:#111827;text-align:right;">${userEmail || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Phone:</td>
              <td style="padding:6px 0;color:#111827;text-align:right;">${userPhone || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Donation Amount:</td>
              <td style="padding:6px 0;font-weight:bold;color:#047857;font-size:16px;text-align:right;">₹${amount}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Donation Date:</td>
              <td style="padding:6px 0;color:#111827;text-align:right;">${donationDate}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Transaction ID:</td>
              <td style="padding:6px 0;font-family:monospace;font-size:12px;color:#374151;text-align:right;">${transactionId}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Receipt Number:</td>
              <td style="padding:6px 0;font-weight:bold;color:#1e3a8a;text-align:right;">${receiptNumber}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Payment Status:</td>
              <td style="padding:6px 0;font-weight:bold;color:#059669;text-align:right;">${paymentStatus}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Donation Purpose:</td>
              <td style="padding:6px 0;font-weight:500;color:#111827;text-align:right;">${donationPurpose}</td>
            </tr>
          </table>
        </div>

        <p style="margin:0 0 20px;color:#4b5563;font-size:13px;background-color:#ecfdf5;border-left:4px solid #10b981;padding:12px 14px;border-radius:6px;">
          📎 <strong>The donation receipt PDF is attached</strong> to this notification. You can review the complete donation record and receipt from the administration panel.
        </p>

        <!-- ACTION BUTTONS -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
          <tr>
            <td align="center">
              <a href="${adminDonationsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 28px;background-color:#047857;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;border-radius:10px;box-shadow:0 2px 8px rgba(4,120,87,0.25);">
                Open Admin Donations
              </a>
              ${secureReceiptUrl ? `
                <span style="display:inline-block;width:12px;"></span>
                <a href="${secureReceiptUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 20px;background-color:#f3f4f6;color:#1f2937;text-decoration:none;font-weight:600;font-size:14px;border-radius:10px;border:1px solid #d1d5db;">
                  Download PDF Copy
                </a>
              ` : ''}
            </td>
          </tr>
        </table>

        <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">
          Please verify the donation details if necessary.
        </p>

        <p style="margin:0;font-weight:bold;color:#111827;font-size:13px;">
          St. John de Britto's Church – Donation Management System
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Main Centralized Donation Notification & Receipt Dispatcher
 *
 * Guarantees:
 * - Exactly one notification execution per donation (idempotent, prevents duplicates).
 * - Delivers to all supported channels: Email, In-Website, WhatsApp, Push.
 * - Attaches official PDF receipt wherever supported.
 * - Handles individual channel failures gracefully without rolling back verified payments.
 * - Persists detailed per-channel delivery telemetry for monitoring and retry.
 *
 * @param {Object} donation - Donation document or populated object
 * @param {Object} [options] - Options ({ force: false })
 */
async function sendDonationNotifications(donation, { force = false } = {}) {
  try {
    if (!donation) {
      console.warn('[DonationNotification] No donation document provided.');
      return { success: false, reason: 'Missing donation' };
    }

    // 1. Payment Verification Check
    const isPaid = donation.status === 'paid' || donation.status === 'verified' || donation.isVerified === true;
    if (!isPaid) {
      console.log(`[DonationNotification] Donation ${donation._id} status is "${donation.status}". Notification only triggers for paid/verified donations.`);
      return { success: false, reason: 'Donation not paid' };
    }

    // 2. Concurrency & Idempotency Check
    if (donation.notificationStatus?.notified && !force) {
      console.log(`[DonationNotification] Donation ${donation._id} already notified at ${donation.notificationStatus.notifiedAt}. Skipping duplicate.`);
      return { success: true, alreadyNotified: true };
    }

    // Atomically claim notification lock to prevent race condition between webhook & verify
    if (!force) {
      const locked = await Donation.findOneAndUpdate(
        {
          _id: donation._id,
          'notificationStatus.notified': { $ne: true }
        },
        {
          $set: {
            'notificationStatus.notified': true,
            'notificationStatus.notifiedAt': new Date()
          }
        },
        { new: true }
      );

      if (!locked) {
        console.log(`[DonationNotification] Concurrency guard: Donation ${donation._id} was claimed by another thread. Skipping.`);
        return { success: true, alreadyNotified: true };
      }
    }

    // 3. Populate user if needed
    if (donation.userId && (!donation.userId.name || !donation.userId.email)) {
      try {
        const u = await User.findById(donation.userId).select('name email phone parishMemberId settings').lean();
        if (u) donation.userId = u;
      } catch { }
    }

    // 4. Ensure Receipt Number and Access Token are persistent
    const createdAtDate = donation.paidAt || (donation.createdAt ? new Date(donation.createdAt) : new Date());
    const year = createdAtDate.getFullYear();
    const shortId = donation._id.toString().slice(-6).toUpperCase();
    if (!donation.receiptNumber) {
      donation.receiptNumber = `SJBC-${year}-${shortId}`;
    }
    if (!donation.receiptAccessToken) {
      donation.receiptAccessToken = crypto.randomBytes(24).toString('hex');
    }

    // 5. Generate / Ensure Official Server PDF exists
    const receiptPath = await generateDonationReceipt(donation, donation.userId);
    const filename = `Donation_Receipt_${shortId}.pdf`;
    let fullPath;
    if (path.isAbsolute(receiptPath) && fs.existsSync(receiptPath)) {
      fullPath = receiptPath;
    } else {
      const cleanRel = String(receiptPath).replace(/^[/\\]+/, '');
      fullPath = path.join(__dirname, '..', '..', cleanRel);
    }

    let pdfBuffer = null;
    let pdfExists = false;
    if (fs.existsSync(fullPath)) {
      pdfExists = true;
      pdfBuffer = fs.readFileSync(fullPath);
    } else {
      console.warn(`[DonationNotification] PDF receipt not found on disk at: ${fullPath}`);
    }

    // 6. Format Common Interpolation Variables
    const userName = donation.donorName || donation.userId?.name || 'Parishioner';
    const userEmail = donation.email || donation.userId?.email || null;
    const userPhone = cleanPhoneNumber(donation.phone || donation.userId?.phone);
    const amount = Number(donation.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const donationDate = createdAtDate.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
    const transactionId = donation.razorpayPaymentId || donation.transactionId || 'N/A';
    const receiptNumber = donation.receiptNumber;
    const paymentStatus = (donation.status || 'PAID').toUpperCase();
    const donationPurpose = DONATION_LABELS[donation.type] || donation.type || 'General Offering';

    const userDashboardMyDonationsUrl = getSiteUrl('/dashboard/donations');
    const adminDonationsUrl = getSiteUrl('/admin/donations');
    const secureReceiptUrl = `${getBaseClientUrl()}/api/donations/${donation._id}/receipt?token=${donation.receiptAccessToken}&download=true`;

    // Messages
    const userTextMessage = buildUserTextMessage({
      userName, amount, donationDate, transactionId, receiptNumber, userDashboardMyDonationsUrl
    });
    const adminTextMessage = buildAdminTextMessage({
      userName, userEmail, userPhone, amount, donationDate, transactionId, receiptNumber, paymentStatus, donationPurpose, adminDonationsUrl
    });

    const userEmailHtml = buildUserHtmlEmail({
      userName, amount, donationDate, transactionId, receiptNumber, donationPurpose, userDashboardMyDonationsUrl, secureReceiptUrl
    });
    const adminEmailHtml = buildAdminHtmlEmail({
      userName, userEmail, userPhone, amount, donationDate, transactionId, receiptNumber, paymentStatus, donationPurpose, adminDonationsUrl, secureReceiptUrl
    });

    // Attachments for Email
    const emailAttachments = pdfExists ? [{
      filename,
      path: fullPath,
      contentType: 'application/pdf'
    }] : [];

    // Telemetry tracking object
    const tracking = {
      user: {
        email: { sent: false, error: null },
        inApp: { sent: false, error: null, notificationId: null },
        whatsapp: { sent: false, error: null },
        push: { sent: false, error: null }
      },
      admin: {
        email: { sent: false, error: null },
        inApp: { sent: false, error: null, notificationId: null },
        whatsapp: { sent: false, error: null },
        push: { sent: false, error: null }
      }
    };

    // ──────────────────────────────────────────────────────────────────────────
    // USER NOTIFICATION CHANNELS
    // ──────────────────────────────────────────────────────────────────────────

    // Channel 1: User Email (with attached PDF)
    const userEmailPromise = (async () => {
      if (!userEmail) {
        tracking.user.email.error = 'No donor email address on record';
        return;
      }
      try {
        await sendMail({
          to: userEmail,
          subject: "Thank You for Your Generous Donation – St. John de Britto's Church",
          html: userEmailHtml,
          text: userTextMessage,
          attachments: emailAttachments
        });
        tracking.user.email.sent = true;
        tracking.user.email.sentAt = new Date();
        console.log(`[DonationNotification] ✅ Donor email delivered with PDF receipt to: ${userEmail}`);
      } catch (err) {
        tracking.user.email.error = err.message;
        console.warn(`[DonationNotification] ❌ Donor email delivery failed to ${userEmail}:`, err.message);
      }
    })();

    // Channel 2: User In-Website Notification
    const userInAppPromise = (async () => {
      const recipientUserId = donation.userId?._id || (typeof donation.userId === 'string' ? donation.userId : null);
      if (!recipientUserId) {
        tracking.user.inApp.error = 'Guest donor (not linked to user account)';
        return;
      }
      try {
        const idempotencyKey = `DONATION_USER_${donation._id}`;
        let notif = await Notification.findOne({ idempotencyKey });
        if (!notif) {
          notif = await Notification.create({
            recipient: 'user',
            userId: recipientUserId,
            title: "Thank You for Your Generous Donation – St. John de Britto's Church",
            message: `Dear ${userName}, thank you for your generous donation of ₹${amount} towards ${donationPurpose}.\n\nReceipt Number: ${receiptNumber}\nTransaction ID: ${transactionId}\nDate: ${donationDate}`,
            type: 'donations',
            category: 'donations',
            requestType: 'DONATION',
            requestId: receiptNumber,
            status: paymentStatus,
            priority: 'high',
            actionUrl: '/dashboard/donations',
            redirectUrl: '/dashboard/donations',
            fileUrl: receiptPath,
            relatedId: donation._id,
            relatedModel: 'Donation',
            idempotencyKey,
            channels: {
              website: { sent: true, sentAt: new Date(), read: false },
              email: { sent: tracking.user.email.sent, sentAt: new Date() },
              whatsapp: { sent: false },
              push: { sent: false }
            },
            metadata: {
              donationId: donation._id,
              receiptNumber,
              amount: donation.amount,
              purpose: donationPurpose,
              transactionId,
              downloadUrl: secureReceiptUrl
            }
          });
        }
        tracking.user.inApp.sent = true;
        tracking.user.inApp.sentAt = new Date();
        tracking.user.inApp.notificationId = notif._id;
        console.log(`[DonationNotification] ✅ Donor in-website notification created for: ${recipientUserId}`);
      } catch (err) {
        tracking.user.inApp.error = err.message;
        console.warn(`[DonationNotification] ❌ Donor in-website notification failed:`, err.message);
      }
    })();

    // Channel 3: User WhatsApp (with PDF Document attached)
    const userWhatsAppPromise = (async () => {
      if (!userPhone) {
        tracking.user.whatsapp.error = 'No donor phone number on record';
        return;
      }
      try {
        const waOptions = {};
        if (pdfExists && pdfBuffer) {
          waOptions.media = {
            buffer: pdfBuffer,
            url: fullPath,
            fileName: filename,
            mimetype: 'application/pdf',
            caption: userTextMessage
          };
        }

        const res = await sendWhatsAppNotification(userPhone, userTextMessage, waOptions);
        if (res && res.success !== false) {
          tracking.user.whatsapp.sent = true;
          tracking.user.whatsapp.sentAt = new Date();
          console.log(`[DonationNotification] ✅ Donor WhatsApp message delivered to: ${userPhone}`);
        } else {
          // Fallback to text with receipt download link
          const fallbackText = `${userTextMessage}\n\n📄 Download Receipt PDF:\n${secureReceiptUrl}`;
          const resFallback = await sendWhatsAppNotification(userPhone, fallbackText);
          tracking.user.whatsapp.sent = !!(resFallback && resFallback.success !== false);
          tracking.user.whatsapp.sentAt = new Date();
          if (!tracking.user.whatsapp.sent) {
            tracking.user.whatsapp.error = res?.error || 'WhatsApp dispatch returned false';
          }
        }
      } catch (err) {
        tracking.user.whatsapp.error = err.message;
        console.warn(`[DonationNotification] ❌ Donor WhatsApp dispatch failed to ${userPhone}:`, err.message);
      }
    })();

    // Channel 4: User Push Notification
    const userPushPromise = (async () => {
      const recipientUserId = donation.userId?._id || (typeof donation.userId === 'string' ? donation.userId : null);
      if (!recipientUserId) {
        tracking.user.push.error = 'Guest donor (no registered user ID for WebPush)';
        return;
      }
      try {
        const pushRes = await sendPushToUser(recipientUserId, {
          title: "Thank You for Your Generous Donation – St. John de Britto's Church",
          body: `Thank you, ${userName}! Your donation of ₹${amount} was received. Tap to view your receipt.`,
          icon: '/icon-192.png',
          badge: '/icon-64.png',
          data: {
            url: '/dashboard/donations',
            actionUrl: '/dashboard/donations',
            donationId: donation._id.toString()
          }
        });
        tracking.user.push.sent = !!(pushRes && pushRes.success);
        tracking.user.push.sentAt = new Date();
        if (!tracking.user.push.sent) {
          tracking.user.push.error = pushRes?.reason || pushRes?.error || 'Push delivery failed or not subscribed';
        }
        console.log(`[DonationNotification] 📲 Donor WebPush delivery: ${tracking.user.push.sent ? 'SUCCESS' : 'SKIPPED/FAILED'}`);
      } catch (err) {
        tracking.user.push.error = err.message;
        console.warn(`[DonationNotification] ❌ Donor WebPush delivery error:`, err.message);
      }
    })();

    // ──────────────────────────────────────────────────────────────────────────
    // ADMIN NOTIFICATION CHANNELS
    // ──────────────────────────────────────────────────────────────────────────

    // Channel 5: Admin Email (with attached PDF)
    const adminEmailPromise = (async () => {
      try {
        const adminRecipients = await getAllAdminEmailRecipients();
        const primaryAdminEmail = getAdminEmail() || process.env.SMTP_FROM || null;
        const targetEmails = new Set();

        adminRecipients.forEach(r => {
          if (r.email) targetEmails.add(r.email.toLowerCase());
        });
        if (primaryAdminEmail) {
          targetEmails.add(primaryAdminEmail.toLowerCase());
        }

        const emailJobs = [];
        for (const adm of targetEmails) {
          emailJobs.push(
            sendMail({
              to: adm,
              subject: `New Donation Received – ₹${amount}`,
              html: adminEmailHtml,
              text: adminTextMessage,
              attachments: emailAttachments
            })
          );
        }

        const results = await Promise.allSettled(emailJobs);
        const anySuccess = results.some(r => r.status === 'fulfilled');
        tracking.admin.email.sent = anySuccess;
        tracking.admin.email.sentAt = anySuccess ? new Date() : null;
        if (!anySuccess && results.length > 0) {
          tracking.admin.email.error = results[0]?.reason?.message || 'Admin email rejected';
        }
        console.log(`[DonationNotification] ✅ Admin emails dispatched to ${targetEmails.size} recipients. Result: ${anySuccess ? 'SUCCESS' : 'FAILED'}`);
      } catch (err) {
        tracking.admin.email.error = err.message;
        console.warn(`[DonationNotification] ❌ Admin email delivery failed:`, err.message);
      }
    })();

    // Channel 6: Admin In-Website Notification
    const adminInAppPromise = (async () => {
      try {
        const idempotencyKey = `DONATION_ADMIN_${donation._id}`;
        let notif = await Notification.findOne({ idempotencyKey });
        if (!notif) {
          notif = await Notification.create({
            recipient: 'admin',
            title: `New Donation Received – ₹${amount}`,
            message: `A new donation of ₹${amount} has been received from ${userName} (${donationPurpose}). Receipt: ${receiptNumber}. Payment ID: ${transactionId}.`,
            type: 'donations',
            category: 'donations',
            requestType: 'DONATION',
            requestId: receiptNumber,
            status: paymentStatus,
            priority: 'high',
            actionUrl: '/admin/donations',
            redirectUrl: '/admin/donations',
            fileUrl: receiptPath,
            relatedId: donation._id,
            relatedModel: 'Donation',
            idempotencyKey,
            channels: {
              website: { sent: true, sentAt: new Date(), read: false },
              email: { sent: tracking.admin.email.sent, sentAt: new Date() },
              whatsapp: { sent: false },
              push: { sent: false }
            },
            metadata: {
              donationId: donation._id,
              donorName: userName,
              userEmail,
              userPhone,
              receiptNumber,
              amount: donation.amount,
              purpose: donationPurpose,
              transactionId,
              paymentStatus,
              adminDonationsUrl
            }
          });
        }
        tracking.admin.inApp.sent = true;
        tracking.admin.inApp.sentAt = new Date();
        tracking.admin.inApp.notificationId = notif._id;
        console.log(`[DonationNotification] ✅ Admin in-website notification created.`);
      } catch (err) {
        tracking.admin.inApp.error = err.message;
        console.warn(`[DonationNotification] ❌ Admin in-website notification failed:`, err.message);
      }
    })();

    // Channel 7: Admin WhatsApp (with PDF Document attached)
    const adminWhatsAppPromise = (async () => {
      try {
        const adminPhones = await getAllAdminPhoneNumbers();
        if (!adminPhones || adminPhones.length === 0) {
          tracking.admin.whatsapp.error = 'No church administrator phone numbers configured';
          return;
        }

        const waOptions = {};
        if (pdfExists && pdfBuffer) {
          waOptions.media = {
            buffer: pdfBuffer,
            url: fullPath,
            fileName: filename,
            mimetype: 'application/pdf',
            caption: adminTextMessage
          };
        }

        const waJobs = adminPhones.map(async (admPhone) => {
          const res = await sendWhatsAppNotification(admPhone, adminTextMessage, waOptions);
          if (!res || res.success === false) {
            // Text fallback
            const fallbackText = `${adminTextMessage}\n\n📄 View Receipt:\n${secureReceiptUrl}`;
            return sendWhatsAppNotification(admPhone, fallbackText);
          }
          return res;
        });

        const results = await Promise.allSettled(waJobs);
        const anySuccess = results.some(r => r.status === 'fulfilled' && r.value?.success !== false);
        tracking.admin.whatsapp.sent = anySuccess;
        tracking.admin.whatsapp.sentAt = anySuccess ? new Date() : null;
        if (!anySuccess && results.length > 0) {
          tracking.admin.whatsapp.error = results[0]?.reason?.message || 'Admin WhatsApp rejected';
        }
        console.log(`[DonationNotification] ✅ Admin WhatsApp dispatched to ${adminPhones.length} numbers. Result: ${anySuccess ? 'SUCCESS' : 'FAILED'}`);
      } catch (err) {
        tracking.admin.whatsapp.error = err.message;
        console.warn(`[DonationNotification] ❌ Admin WhatsApp dispatch failed:`, err.message);
      }
    })();

    // Channel 8: Admin Push Notification
    const adminPushPromise = (async () => {
      try {
        const pushRes = await sendPushToAdmins({
          title: `New Donation Received – ₹${amount}`,
          body: `${userName} donated ₹${amount} (${donationPurpose}). Tap to open Admin Donations.`,
          icon: '/icon-192.png',
          badge: '/icon-64.png',
          data: {
            url: '/admin/donations',
            actionUrl: '/admin/donations',
            donationId: donation._id.toString()
          }
        });
        tracking.admin.push.sent = !!(pushRes && pushRes.success);
        tracking.admin.push.sentAt = new Date();
        if (!tracking.admin.push.sent) {
          tracking.admin.push.error = pushRes?.reason || pushRes?.error || 'No active admin push subscriptions';
        }
        console.log(`[DonationNotification] 📲 Admin WebPush delivery: ${tracking.admin.push.sent ? 'SUCCESS' : 'SKIPPED/FAILED'}`);
      } catch (err) {
        tracking.admin.push.error = err.message;
        console.warn(`[DonationNotification] ❌ Admin WebPush delivery error:`, err.message);
      }
    })();

    // Wait for all 8 channels concurrently
    await Promise.allSettled([
      userEmailPromise,
      userInAppPromise,
      userWhatsAppPromise,
      userPushPromise,
      adminEmailPromise,
      adminInAppPromise,
      adminWhatsAppPromise,
      adminPushPromise
    ]);

    // 7. Persist Final Delivery Status on Donation Document
    const emailDelivered = tracking.user.email.sent || tracking.admin.email.sent;
    donation.receiptUrl = receiptPath;
    donation.receiptSent = emailDelivered || donation.receiptSent;
    donation.receiptSentAt = emailDelivered ? new Date() : donation.receiptSentAt;
    donation.notificationStatus = {
      notified: true,
      notifiedAt: new Date(),
      retries: (donation.notificationStatus?.retries || 0) + (force ? 1 : 0),
      lastError: tracking.user.email.error || tracking.admin.email.error || null,
      user: tracking.user,
      admin: tracking.admin
    };

    await Donation.findByIdAndUpdate(donation._id, {
      $set: {
        receiptUrl: donation.receiptUrl,
        receiptNumber: donation.receiptNumber,
        receiptAccessToken: donation.receiptAccessToken,
        receiptSent: donation.receiptSent,
        receiptSentAt: donation.receiptSentAt,
        notificationStatus: donation.notificationStatus
      }
    });

    console.log(`[DonationNotification] 🎉 Complete donation notification workflow finished for donation ${donation._id} (${receiptNumber}).`);
    return {
      success: true,
      donationId: donation._id,
      receiptNumber,
      tracking
    };

  } catch (outerErr) {
    console.error('[DonationNotification] Critical error during notification workflow:', outerErr);
    try {
      await Donation.findByIdAndUpdate(donation._id, {
        $set: {
          'notificationStatus.lastError': outerErr.message
        }
      });
    } catch { }
    return { success: false, error: outerErr.message };
  }
}

module.exports = {
  sendDonationNotifications,
  buildUserTextMessage,
  buildAdminTextMessage,
  buildUserHtmlEmail,
  buildAdminHtmlEmail
};
