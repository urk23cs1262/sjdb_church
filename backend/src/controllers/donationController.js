const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Razorpay = require('razorpay');
const Donation = require('../models/Donation');
const User = require('../models/User');
const { notifyAdmins, createNotification } = require('../services/notificationService');
const { generateDonationReceipt } = require('../services/pdfService');
const { sendMail } = require('../config/mailer');

const DONATION_TYPES = [
  { id: 'general', label: 'General Offering' },
  { id: 'feast', label: 'Feast Donation' },
  { id: 'building', label: 'Building Fund' },
  { id: 'candle', label: 'Candle Offering' },
  { id: 'tithe', label: 'Tithe Offering' },
  { id: 'special', label: 'Special Offering' },
];

function getRazorpayInstance() {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

  if (!keyId || !keySecret) return null;

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function getRequiredRazorpayInstance() {
  const razorpay = getRazorpayInstance();
  if (!razorpay) {
    const error = new Error('Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are missing or not configured on the server.');
    error.statusCode = 503;
    throw error;
  }
  return razorpay;
}

function safeEqualHex(expected, received) {
  if (!expected || !received || typeof received !== 'string') return false;
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(received, 'utf8');
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}


// ─── HELPER: SEND IDENTICAL RECEIPT EMAIL TO DONOR & ADMIN ───────────────────
const sendDonationReceiptEmails = async (donation, { force = false } = {}) => {
  try {
    if (!donation) return;
    if (donation.receiptSent && !force) {
      console.log(`Receipt email already sent for donation ${donation._id}. Skipping duplicate.`);
      return;
    }

    // 1. Generate / Ensure PDF exists
    const receiptPath = await generateDonationReceipt(donation, donation.userId);
    const receiptId = donation._id.toString().slice(-6).toUpperCase();
    const receiptNumber = `SJBC-${new Date(donation.paidAt || donation.createdAt || Date.now()).getFullYear()}-${receiptId}`;
    const filename = `Donation_Receipt_${receiptId}.pdf`;
    const fullPath = path.join(__dirname, '..', '..', receiptPath);

    const attachments = [];
    if (fs.existsSync(fullPath)) {
      attachments.push({
        filename,
        path: fullPath,
        contentType: 'application/pdf',
      });
    }

    const donorName = donation.donorName || 'Beloved Devotee';
    const amountFormatted = `INR ${(donation.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const categoryLabel = DONATION_TYPES.find(t => t.id === donation.type)?.label || donation.type || 'General Offering';
    const paymentRef = donation.razorpayPaymentId || donation.transactionId || 'N/A';
    const paymentMethod = donation.razorpayPaymentId ? 'Razorpay (Online / UPI)' : (donation.paymentMethod?.toUpperCase() || 'UPI');
    const paymentDateStr = new Date(donation.paidAt || donation.createdAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    const emailTemplate = `
<div style="margin:0;padding:20px 10px;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <!-- CONTAINER -->
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    
    <!-- TOP META BAR -->
    <tr>
      <td style="padding:16px 20px 10px;border-bottom:1px solid #f0f0f0;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="left" style="font-size:11px;color:#555555;font-weight:normal;">
              ${paymentDateStr}
            </td>
            <td align="right" style="font-size:11px;color:#1e3a8a;font-weight:bold;">
              ${receiptNumber}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- CHURCH HEADER & TITLE -->
    <tr>
      <td style="padding:18px 20px 14px;border-bottom:2px solid #e5e5e5;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="left" style="vertical-align:middle;">
              <h1 style="margin:0;font-size:18px;line-height:22px;color:#1e3a8a;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                ST. JOHN DE BRITTO'S CHURCH
              </h1>
              <p style="margin:3px 0 0;font-size:13px;color:#b8860b;font-weight:normal;">
                புனித அருளானந்தர் தேவாலயம்
              </p>
              <p style="margin:2px 0 0;font-size:10px;color:#666666;line-height:14px;">
                Murthi Nagar, Kalayarkoil, Tamil Nadu 630551, India.
              </p>
            </td>
            <td align="right" style="vertical-align:middle;padding-left:10px;white-space:nowrap;">
              <span style="font-size:20px;font-weight:bold;color:#111111;">Receipt</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- TWO-COLUMN / STACKED DETAILS GRID -->
    <tr>
      <td style="padding:16px 20px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="table-layout:fixed;">
          <tr>
            <td style="padding:5px 0;width:38%;font-size:12px;font-weight:bold;color:#444444;vertical-align:top;">Receipt No :</td>
            <td style="padding:5px 0;width:62%;font-size:12px;font-weight:bold;color:#111111;text-align:right;word-break:break-all;">${receiptNumber}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:12px;font-weight:bold;color:#444444;vertical-align:top;">Name :</td>
            <td style="padding:5px 0;font-size:12px;font-weight:bold;color:#111111;text-align:right;word-break:break-word;">${donorName}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:12px;font-weight:bold;color:#444444;vertical-align:top;">Donation Type :</td>
            <td style="padding:5px 0;font-size:12px;color:#111111;text-align:right;">${categoryLabel}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:12px;font-weight:bold;color:#444444;vertical-align:top;">Purpose :</td>
            <td style="padding:5px 0;font-size:12px;color:#111111;text-align:right;">${categoryLabel}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:12px;font-weight:bold;color:#444444;vertical-align:top;">Receipt Date :</td>
            <td style="padding:5px 0;font-size:12px;color:#111111;text-align:right;">${paymentDateStr}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:12px;font-weight:bold;color:#444444;vertical-align:top;">Total Paid :</td>
            <td style="padding:5px 0;font-size:13px;font-weight:bold;color:#b8860b;text-align:right;">${amountFormatted}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:12px;font-weight:bold;color:#444444;vertical-align:top;">Payment Method :</td>
            <td style="padding:5px 0;font-size:12px;color:#111111;text-align:right;">${paymentMethod}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:12px;font-weight:bold;color:#444444;vertical-align:top;">Payment ID :</td>
            <td style="padding:5px 0;font-size:11px;font-family:monospace,Courier,sans-serif;color:#333333;text-align:right;word-break:break-all;">${paymentRef}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- TABLE: DESCRIPTION & AMOUNT -->
    <tr>
      <td style="padding:0 20px 16px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          <thead>
            <tr style="background-color:#f3f4f6;">
              <th align="left" style="padding:10px 12px;font-size:12px;color:#111111;font-weight:bold;border-bottom:1px solid #e5e7eb;">Donation Description</th>
              <th align="right" style="padding:10px 12px;font-size:12px;color:#111111;font-weight:bold;border-bottom:1px solid #e5e7eb;">Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td align="left" style="padding:12px;font-size:12px;color:#333333;">${categoryLabel}</td>
              <td align="right" style="padding:12px;font-size:12px;font-weight:bold;color:#1e3a8a;">${amountFormatted}</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>

    <!-- MESSAGE / INTENTION BOX -->
    <tr>
      <td style="padding:0 20px 16px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#fafafa;border:1px solid #e5e7eb;border-radius:8px;">
          <tr>
            <td align="center" style="padding:12px 14px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:bold;color:#555555;text-transform:uppercase;">Message / Intention :</p>
              <p style="margin:0;font-size:12px;font-style:italic;color:#222222;line-height:16px;">
                "${donation.note || donation.message || 'Prayers for parish and family blessings'}"
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- THANK YOU & BLESSING -->
    <tr>
      <td align="center" style="padding:12px 20px;text-align:center;line-height:20px;font-size:12px;color:#333333;">
        <p style="margin:0;">Thank you for your generous contribution</p>
        <p style="margin:0;">towards the ministry and mission of</p>
        <p style="margin:0;font-weight:bold;color:#1e3a8a;">St. John de Britto's Church.</p>
        <p style="margin:8px 0 0;color:#b8860b;font-weight:bold;">May God bless you abundantly.</p>
      </td>
    </tr>

    <!-- CONTACT DETAILS -->
    <tr>
      <td align="center" style="padding:10px 20px 14px;text-align:center;font-size:11px;color:#666666;line-height:18px;">
        <p style="margin:0;font-weight:bold;color:#444444;">Contact Details :</p>
        <p style="margin:0;">Parish Office Phone : +91 96291 95484</p>
        <p style="margin:0;">Parish Office Email : arndas777@gmail.com</p>
        <p style="margin:0;">Parish Office Website : www.stjohnchurch.com</p>
      </td>
    </tr>

    <!-- FOOTER STATEMENT -->
    <tr>
      <td align="center" style="padding:14px 20px 18px;background-color:#fafafa;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;font-weight:bold;color:#000000;">
        Computer Generated Receipt. <span style="color:#dc2626;">SIGNATURE NOT REQUIRED</span>
        <p style="margin:6px 0 0;font-size:10px;color:#6b7280;font-weight:normal;">
          (Official PDF copy is also attached to this email)
        </p>
      </td>
    </tr>
  </table>
</div>
    `;

    // 2. Send email to Donor and Church/Admin copy. Await both sends so the
    // receipt delivery flag is not marked successful before the mailer finishes.
    const donorEmail = donation.email || (donation.userId && typeof donation.userId === 'object' ? donation.userId.email : null);
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM || null;
    const emailJobs = [];

    if (donorEmail) {
      emailJobs.push(
        sendMail({
          to: donorEmail,
          subject: `Donation Receipt ${receiptNumber} — St. John de Britto's Church`,
          html: emailTemplate,
          attachments,
        })
      );
    }

    if (adminEmail && adminEmail.toLowerCase() !== donorEmail?.toLowerCase()) {
      emailJobs.push(
        sendMail({
          to: adminEmail,
          subject: `[Admin Copy] New Donation ${amountFormatted} (${donorName}) — ${receiptNumber}`,
          html: emailTemplate,
          attachments,
        })
      );
    }

    const emailResults = await Promise.allSettled(emailJobs);
    emailResults.forEach(result => {
      if (result.status === 'rejected') {
        console.warn('[Donation] Receipt email error:', result.reason?.message || result.reason);
      }
    });

    // 4. Send In-App & Push Notification to Donor (User)
    if (donation.userId) {
      createNotification({
        userId: donation.userId,
        recipient: 'user',
        title: 'Thank You for Your Donation',
        message: `Dear ${donorName}, thank you for your generous offering of ₹${donation.amount} towards ${categoryLabel} of St. John de Britto's Church.\nReceipt No: ${receiptNumber}\nPayment ID: ${paymentRef}\nMay God bless you and your family abundantly!`,
        type: 'donation',
        category: 'donations',
        priority: 'medium',
        actionUrl: '/dashboard',
        relatedId: donation._id,
        relatedModel: 'Donation',
        fileUrl: receiptPath,
        channels: ['push', 'sms', 'whatsapp'],
      }).catch(e => console.warn('[Donation] Donor in-app/push error:', e.message));
    }

    // 5. Send WhatsApp direct message & receipt document to Donor phone (if available)
    const donorPhone = donation.phone || (donation.userId && typeof donation.userId === 'object' ? donation.userId.phone : null);
    if (donorPhone) {
      try {
        const { sendWhatsAppMedia, sendWhatsAppMessage } = require('../bot/whatsapp');
        const waCaption = `*ST. JOHN DE BRITTO'S CHURCH*\n*புனித அருளானந்தர் தேவாலயம்*\n\nDear *${donorName}*,\n\nThank you for your generous donation of *₹${donation.amount}* towards *${categoryLabel}*.\n\n*Receipt No:* ${receiptNumber}\n*Payment ID:* ${paymentRef}\n*Date:* ${paymentDateStr}\n\n_“God loves a cheerful giver.” — 2 Corinthians 9:7_\n\nMay Lord Jesus and St. John de Britto bless you abundantly.`;
        
        if (fs.existsSync(fullPath)) {
          sendWhatsAppMedia(donorPhone, {
            url: fullPath,
            mimetype: 'application/pdf',
            fileName: filename,
            caption: waCaption
          }).catch(err => {
            console.warn('[Donation] WhatsApp media send fallback to text:', err.message);
            sendWhatsAppMessage(donorPhone, waCaption).catch(e => console.warn('[Donation] WhatsApp text send error:', e.message));
          });
        } else {
          sendWhatsAppMessage(donorPhone, waCaption).catch(e => console.warn('[Donation] WhatsApp text send error:', e.message));
        }
      } catch (waErr) {
        console.warn('[Donation] WhatsApp dispatch error:', waErr.message);
      }
    }

    // 6. Send In-App, Push, and WhatsApp Alert to Church Admins
    notifyAdmins({
      title: 'New Donation Received (Paid)',
      message: `A new donation has been received!\n\nDonor: ${donorName}\nAmount: ₹${donation.amount}\nCategory: ${categoryLabel}\nReceipt No: ${receiptNumber}\nPayment ID: ${paymentRef}\nIntention: ${donation.note || donation.message || 'None'}\n\nOfficial receipt PDF is generated and attached for download.`,
      fileUrl: receiptPath,
    }).catch(e => console.warn('[Donation] Admin notification error:', e.message));

    // 7. Update and persist donation record. Mark delivery successful only if
    // at least one configured email was actually accepted by the mailer.
    const emailDeliverySucceeded = emailJobs.length > 0 && emailResults.some(result => result.status === 'fulfilled');
    donation.receiptUrl = receiptPath;
    donation.receiptSent = emailDeliverySucceeded || donation.receiptSent;
    donation.receiptSentAt = emailDeliverySucceeded ? new Date() : donation.receiptSentAt;
    await donation.save();
  } catch (err) {
    console.error('Error sending donation receipt emails and notifications:', err);
  }
};

// ─── 1. CREATE RAZORPAY ORDER ───────────────────────────────────────────────
const createDonationOrder = async (req, res) => {
  try {
    const { donorName, email, phone, amount, type = 'general', message, note, isAnonymous } = req.body;

    if (!donorName || !String(donorName).trim() || amount === undefined || amount === null) {
      return res.status(400).json({ success: false, message: 'Donor name and amount are required.' });
    }

    const donationAmount = Number(amount);
    if (!Number.isFinite(donationAmount) || donationAmount < 1 || donationAmount > 10000000) {
      return res.status(400).json({ success: false, message: 'Invalid donation amount. Enter an amount between ₹1 and ₹1,00,00,000.' });
    }

    const allowedTypes = DONATION_TYPES.map(item => item.id);
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid donation type.' });
    }

    const razorpay = getRequiredRazorpayInstance();
    const amountInPaise = Math.round(donationAmount * 100);

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `sjbc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      notes: {
        donorName: isAnonymous ? 'Anonymous' : String(donorName).trim().slice(0, 100),
        email: email || '',
        phone: phone || '',
        type,
        intention: String(note || message || '').slice(0, 100),
      },
    });

    const donation = await Donation.create({
      userId: req.user?._id || null,
      donorName: isAnonymous ? 'Anonymous' : String(donorName).trim(),
      email: email || '',
      phone: phone || '',
      amount: donationAmount,
      currency: 'INR',
      type,
      paymentMethod: 'razorpay',
      razorpayOrderId: razorpayOrder.id,
      status: 'created',
      note: note || message || '',
      message: message || note || '',
      isAnonymous: Boolean(isAnonymous),
      isVerified: false,
    });

    return res.status(201).json({
      success: true,
      orderId: razorpayOrder.id,
      order: { id: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency },
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: (process.env.RAZORPAY_KEY_ID || '').trim(),
      donationId: donation._id,
    });
  } catch (error) {
    console.error('[Razorpay] Error creating donation order:', error?.error || error?.message || error);
    const statusCode = error.statusCode || (error?.statusCode || 500);
    const clientMessage = error.statusCode === 503
      ? error.message
      : (error?.error?.description || error.message || 'Failed to initiate donation order.');
    return res.status(statusCode).json({
      success: false,
      message: clientMessage,
      error: error?.error?.description || error.message,
    });
  }
};

// ─── 2. VERIFY RAZORPAY PAYMENT ─────────────────────────────────────────────
const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, donationId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Incomplete Razorpay payment verification data.' });
    }

    const donation = donationId
      ? await Donation.findById(donationId)
      : await Donation.findOne({ razorpayOrderId: razorpay_order_id });

    if (!donation) {
      return res.status(404).json({ success: false, message: 'Associated donation record not found.' });
    }

    if (donation.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'Payment order does not match the donation.' });
    }

    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (!keySecret) {
      return res.status(503).json({ success: false, message: 'Razorpay credentials are not configured on the server.' });
    }

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (!safeEqualHex(generatedSignature, razorpay_signature)) {
      return res.status(400).json({ success: false, message: 'Payment signature verification failed.' });
    }

    // Confirm the payment with Razorpay itself before marking the donation paid.
    const razorpay = getRequiredRazorpayInstance();
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (!payment || payment.order_id !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'Razorpay payment does not match the donation order.' });
    }

    if (payment.currency !== donation.currency || Number(payment.amount) !== Math.round(donation.amount * 100)) {
      return res.status(400).json({ success: false, message: 'Payment amount or currency does not match the donation.' });
    }

    if (!['captured', 'authorized'].includes(payment.status)) {
      return res.status(400).json({ success: false, message: `Payment is not successful. Current status: ${payment.status || 'unknown'}.` });
    }

    if (donation.status !== 'paid') {
      donation.razorpayPaymentId = payment.id;
      donation.razorpaySignature = razorpay_signature;
      donation.transactionId = payment.id;
      donation.status = payment.status === 'captured' ? 'paid' : 'pending';
      donation.isVerified = payment.status === 'captured';
      donation.paidAt = payment.status === 'captured' ? (donation.paidAt || new Date()) : null;
      await donation.save();
    }

    if (donation.status === 'paid') {
      await sendDonationReceiptEmails(donation);
    }

    return res.json({
      success: true,
      message: donation.status === 'paid' ? 'Donation payment verified successfully.' : 'Payment authorized. Waiting for capture confirmation.',
      donation,
    });
  } catch (error) {
    console.error('[Razorpay] Donation verification error:', error?.error || error?.message || error);
    const clientMessage = error.statusCode === 503
      ? error.message
      : (error?.error?.description || error.message || 'Payment verification failed.');
    return res.status(error.statusCode || 500).json({ 
      success: false, 
      message: clientMessage,
      error: error?.error?.description || error.message
    });
  }
};

// ─── 3. RAZORPAY WEBHOOK HANDLER ────────────────────────────────────────────
const razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();

    if (!webhookSecret || !signature || !req.rawBody) {
      console.warn('[Razorpay Webhook] Missing webhook secret, signature, or raw body.');
      return res.status(400).json({ success: false, message: 'Invalid webhook configuration.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.rawBody)
      .digest('hex');

    if (!safeEqualHex(expectedSignature, signature)) {
      console.warn('[Razorpay Webhook] Signature mismatch.');
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    console.log(`[Razorpay Webhook] Event received: ${event?.event}`);

    if (event?.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      const orderId = payment?.order_id;
      if (orderId) {
        const donation = await Donation.findOne({ razorpayOrderId: orderId });
        if (donation) {
          if (payment.amount !== Math.round(donation.amount * 100) || payment.currency !== donation.currency) {
            console.error(`[Razorpay Webhook] Amount/currency mismatch for donation ${donation._id}`);
            return res.status(400).json({ success: false, message: 'Payment amount mismatch.' });
          }

          donation.razorpayPaymentId = payment.id;
          donation.transactionId = payment.id;
          donation.status = 'paid';
          donation.isVerified = true;
          donation.paidAt = donation.paidAt || new Date();
          await donation.save();
          await sendDonationReceiptEmails(donation);
        }
      }
    } else if (event?.event === 'order.paid') {
      const order = event.payload?.order?.entity;
      const orderId = order?.id;
      if (orderId) {
        const donation = await Donation.findOne({ razorpayOrderId: orderId });
        if (donation) {
          if (order.amount !== Math.round(donation.amount * 100) || order.currency !== donation.currency) {
            console.error(`[Razorpay Webhook] Order amount/currency mismatch for donation ${donation._id}`);
            return res.status(400).json({ success: false, message: 'Order amount mismatch.' });
          }
          if (donation.status !== 'paid') {
            donation.status = 'paid';
            donation.isVerified = true;
            donation.paidAt = donation.paidAt || new Date();
            await donation.save();
          }
          await sendDonationReceiptEmails(donation);
        }
      }
    } else if (event?.event === 'payment.failed') {
      const payment = event.payload?.payment?.entity;
      const orderId = payment?.order_id;
      if (orderId) {
        await Donation.findOneAndUpdate(
          { razorpayOrderId: orderId, status: { $nin: ['paid', 'verified', 'refunded'] } },
          { $set: { status: 'failed' } }
        );
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    return res.status(500).json({ success: false, message: 'Webhook processing failed.' });
  }
};

// ─── 4. ADMIN & USER DONATION CONTROLLERS ──────────────────────────────────
const getAll = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 100 } = req.query;
    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    const total = await Donation.countDocuments(query);
    const donations = await Donation.find(query).populate('userId', 'name email phone').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    const totalAmount = await Donation.aggregate([{ $match: query }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    res.json({ success: true, total, totalAmount: totalAmount[0]?.total || 0, donations });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const create = async (req, res) => {
  try {
    const { amount, type, paymentMethod, transactionId, donorName, note, isAnonymous, email, phone } = req.body;
    const donation = await Donation.create({ 
      userId: req.user?._id, 
      amount, 
      type, 
      paymentMethod: paymentMethod || 'upi', 
      transactionId, 
      donorName: isAnonymous ? 'Anonymous' : (donorName || req.user?.name), 
      email: email || req.user?.email,
      phone: phone || req.user?.phone,
      note, 
      isAnonymous,
      status: 'pending'
    });
    
    res.status(201).json({ success: true, donation });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const verify = async (req, res) => {
  try {
    const donation = await Donation.findByIdAndUpdate(req.params.id, { 
      isVerified: true, 
      status: 'verified',
      verifiedBy: req.user._id,
      paidAt: new Date()
    }, { new: true });

    if (donation) {
      await sendDonationReceiptEmails(donation);
    }

    res.json({ success: true, donation });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const rejectDonation = async (req, res) => {
  try {
    const donation = await Donation.findByIdAndUpdate(req.params.id, {
      status: 'rejected',
      isVerified: false,
      verifiedBy: req.user._id
    }, { new: true });
    res.json({ success: true, donation });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getStats = async (req, res) => {
  try {
    const stats = await Donation.aggregate([
      { $match: { $or: [{ status: 'paid' }, { status: 'verified' }, { isVerified: true }] } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);
    res.json({ success: true, stats });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getMyDonations = async (req, res) => {
  try {
    const donations = await Donation.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, donations });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getDonationConfig = async (req, res) => {
  try {
    const SiteSettings = require('../models/SiteSettings');
    const upiSetting = await SiteSettings.findOne({ key: 'donation_upi_id' }).lean();
    const merchantSetting = await SiteSettings.findOne({ key: 'merchant_name' }).lean();

    const upiId = upiSetting?.value || process.env.DONATION_UPI_ID || '112520120';
    const merchantName = merchantSetting?.value || process.env.MERCHANT_NAME || "St. John de Britto's Church";
    const keyId = process.env.RAZORPAY_KEY_ID || null;

    res.json({
      success: true,
      keyId,
      upiId,
      merchantName
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getDonationReceipt = async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id).populate('userId', 'name email phone');
    if (!donation) {
      return res.status(404).json({ success: false, message: 'Donation not found.' });
    }

    // Verify access
    const role = (req.user?.role || '').toLowerCase();
    const isAdminOrStaff = role === 'admin' || role === 'priest' || role === 'staff' || req.user?.isTechnicalTeam;
    const isOwner = req.user && donation.userId && donation.userId._id?.toString() === req.user._id?.toString();

    if (!isAdminOrStaff && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this receipt.' });
    }

    const receiptPath = await generateDonationReceipt(donation, donation.userId);
    const filename = `Donation_Receipt_${donation._id.toString().slice(-6).toUpperCase()}.pdf`;
    const fullPath = path.join(__dirname, '..', '..', receiptPath);

    if (req.query.download === 'true') {
      return res.download(fullPath, filename);
    }

    return res.json({
      success: true,
      receiptUrl: receiptPath,
      filename,
      donation
    });
  } catch (err) {
    console.error('getDonationReceipt error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const resendReceiptEmail = async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id).populate('userId', 'name email phone');
    if (!donation) {
      return res.status(404).json({ success: false, message: 'Donation not found.' });
    }

    await sendDonationReceiptEmails(donation, { force: true });

    return res.json({
      success: true,
      message: `Official donation receipt re-sent successfully to ${donation.email || 'donor'} and church admin copy.`,
      donation
    });
  } catch (err) {
    console.error('resendReceiptEmail error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { 
  createDonationOrder, 
  verifyRazorpayPayment, 
  razorpayWebhook, 
  getAll, 
  create, 
  verify, 
  rejectDonation, 
  getStats, 
  getMyDonations, 
  getDonationConfig,
  getDonationReceipt,
  resendReceiptEmail
};
