const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Razorpay = require('razorpay');
const Donation = require('../models/Donation');
const User = require('../models/User');
const { createAdminNotification, createUserNotification } = require('../services/requestNotificationService');
const { generateDonationReceipt } = require('../services/pdfService');
const { sendDonationNotifications } = require('../services/donationNotificationService');
const { sendMail } = require('../config/mailer');
const { getParishOfficePhone, getChurchEmail, getAdminEmail } = require('../config/contactConfig');

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


// ─── HELPER: AUTOMATED DONATION NOTIFICATIONS ACROSS ALL CHANNELS ─────────────
const sendDonationReceiptEmails = async (donation, options = {}) => {
  return sendDonationNotifications(donation, options);
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
    const finalName = isAnonymous ? 'Anonymous Parishioner' : (donorName || req.user?.name || 'Parishioner');
    const finalEmail = email || req.user?.email;
    const finalPhone = phone || req.user?.phone;

    const donation = await Donation.create({
      userId: req.user?._id,
      amount,
      type,
      paymentMethod: paymentMethod || 'upi',
      transactionId,
      donorName: finalName,
      email: finalEmail,
      phone: finalPhone,
      note,
      isAnonymous,
      status: 'pending'
    });

    // 1. Central Admin Notification (Dashboard Bell, WhatsApp, Web Push, Email)
    createAdminNotification({
      type: 'DONATION',
      requestType: 'DONATION',
      title: 'New Donation Submission',
      message: `${finalName} submitted a donation of ₹${amount} (${type || 'General Offering'}).`,
      userId: req.user?._id,
      memberId: req.user?.parishMemberId,
      requestId: donation.transactionId || donation._id,
      priority: 'normal',
      status: 'PENDING',
      details: `Amount: ₹${amount} | Method: ${(paymentMethod || 'upi').toUpperCase()} | Ref: ${transactionId || 'Pending'}`,
      request: donation,
      user: req.user,
      req
    }).catch(e => console.error('[DonationController] Central Admin notification error:', e.message));

    // 2. Central User Confirmation Notification
    if (req.user?._id) {
      createUserNotification({
        userId: req.user._id,
        type: 'REQUEST_STATUS_UPDATE',
        requestType: 'DONATION',
        requestId: donation.transactionId || donation._id,
        status: 'PENDING',
        title: 'Donation Received',
        message: `Your donation of ₹${amount} has been received and is pending church verification.`,
        redirectUrl: '/dashboard/donations',
        request: donation,
        req
      }).catch(e => console.error('[DonationController] Central User notification error:', e.message));
    }

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

      // Central User Status Notification through ALL channels
      createUserNotification({
        userId: donation.userId,
        type: 'REQUEST_STATUS_UPDATE',
        requestType: 'DONATION',
        requestId: donation.transactionId || donation._id,
        status: 'VERIFIED',
        title: 'Donation Verified & Approved',
        message: `Your donation of ₹${donation.amount} has been verified and confirmed. Official receipt has been generated. Thank you for your generous support!`,
        redirectUrl: '/dashboard/donations',
        request: donation,
        req
      }).catch(e => console.error('[DonationController] Central User verify notification error:', e.message));
    }

    res.json({ success: true, donation });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const rejectDonation = async (req, res) => {
  try {
    const { reason } = req.body;
    const donation = await Donation.findByIdAndUpdate(req.params.id, {
      status: 'rejected',
      isVerified: false,
      verifiedBy: req.user._id
    }, { new: true });

    if (donation && donation.userId) {
      createUserNotification({
        userId: donation.userId,
        type: 'REQUEST_STATUS_UPDATE',
        requestType: 'DONATION',
        requestId: donation.transactionId || donation._id,
        status: 'REJECTED',
        title: 'Donation Verification Update',
        message: `Your donation submission of ₹${donation.amount} could not be verified.${reason ? ` Reason: ${reason}` : ''}`,
        adminComment: reason,
        redirectUrl: '/dashboard/donations',
        request: donation,
        req
      }).catch(e => console.error('[DonationController] Central User reject notification error:', e.message));
    }

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
    const merchantName = merchantSetting?.value || process.env.MERCHANT_NAME || "St. John de Britto Church";
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

    // Only allow receipts for completed, paid, or verified donations
    const isPaidOrVerified = donation.status === 'paid' || donation.status === 'verified' || donation.isVerified;
    if (!isPaidOrVerified) {
      return res.status(400).json({
        success: false,
        message: 'Receipt is only available for completed and verified donations.'
      });
    }

    // Authorization: Admin / Owner / Secure Receipt Token
    const role = (req.user?.role || '').toLowerCase();
    const isAdminOrStaff = Boolean(role === 'admin' || role === 'priest' || role === 'staff' || req.user?.isTechnicalTeam);
    const isOwner = Boolean(req.user && donation.userId && donation.userId._id?.toString() === req.user._id?.toString());
    const token = (req.query.token || req.headers['x-receipt-token'] || '').toString().trim();
    const hasValidToken = Boolean(
      token && donation.receiptAccessToken && safeEqualHex(donation.receiptAccessToken, token)
    );

    if (!isAdminOrStaff && !isOwner && !hasValidToken) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this receipt. Please log in or use the secure link provided in your donation notification.'
      });
    }

    // Ensure persistent receipt number and access token
    let needsSave = false;
    if (!donation.receiptNumber) {
      const year = new Date(donation.paidAt || donation.createdAt || Date.now()).getFullYear();
      donation.receiptNumber = `SJBC-${year}-${donation._id.toString().slice(-6).toUpperCase()}`;
      needsSave = true;
    }
    if (!donation.receiptAccessToken) {
      donation.receiptAccessToken = crypto.randomBytes(24).toString('hex');
      needsSave = true;
    }
    if (needsSave) {
      await donation.save().catch(() => {});
    }

    const receiptPath = await generateDonationReceipt(donation, donation.userId);
    const receiptNumber = donation.receiptNumber || `SJBC-${donation._id.toString().slice(-6).toUpperCase()}`;
    let fullPath;
    if (path.isAbsolute(receiptPath) && fs.existsSync(receiptPath)) {
      fullPath = receiptPath;
    } else {
      const cleanRel = String(receiptPath).replace(/^[/\\]+/, '');
      fullPath = path.join(__dirname, '..', '..', cleanRel);
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(500).json({ success: false, message: 'Receipt PDF could not be generated.' });
    }

    // Direct download requested
    if (req.query.download === 'true') {
      return res.download(fullPath, filename);
    }

    // Browser PDF preview or direct navigation
    if (req.query.inline === 'true' || (req.headers.accept && req.headers.accept.includes('application/pdf'))) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return fs.createReadStream(fullPath).pipe(res);
    }

    return res.json({
      success: true,
      receiptUrl: receiptPath,
      receiptNumber,
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

    const result = await sendDonationReceiptEmails(donation, { force: true });

    return res.json({
      success: true,
      message: `Official donation receipt re-sent successfully across channels to ${donation.email || donation.donorName || 'donor'} and church administrators.`,
      notificationResult: result,
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
