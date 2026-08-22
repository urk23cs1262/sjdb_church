const Donation = require('../models/Donation');
const User = require('../models/User');

const DONATION_TYPES = [
  { id: 'general', label: 'General Offering' },
  { id: 'feast', label: 'Feast Donation' },
  { id: 'building', label: 'Building Fund' },
  { id: 'candle', label: 'Candle Offering' },
];
const { notifyAdmins, createNotification } = require('../services/notificationService');
const { generateDonationReceipt } = require('../services/pdfService');

const getAll = async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const query = {};
    if (type) query.type = type;
    const total = await Donation.countDocuments(query);
    const donations = await Donation.find(query).populate('userId', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    const totalAmount = await Donation.aggregate([{ $match: query }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    res.json({ success: true, total, totalAmount: totalAmount[0]?.total || 0, donations });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const create = async (req, res) => {
  try {
    const { amount, type, paymentMethod, transactionId, donorName, note, isAnonymous } = req.body;
    const donation = await Donation.create({ userId: req.user?._id, amount, type, paymentMethod, transactionId, donorName: isAnonymous ? 'Anonymous' : (donorName || req.user?.name), note, isAnonymous });
    
    // 1. Generate PDF Receipt
    let receiptUrl = null;
    try {
      receiptUrl = await generateDonationReceipt(donation, req.user);
    } catch (pdfErr) {
      console.error('PDF Generation failed:', pdfErr.message);
    }

    // 2. Notify User (Email with Attachment, SMS)
    if (req.user) {
      const donationTypeLabel = DONATION_TYPES.find(t => t.id === type)?.label || type;
      createNotification({
        userId: req.user._id,
        recipient: 'user',
        title: 'Thank You for Your Donation ',
        message: `Dear ${donation.donorName}, thank you for your generous contribution of ₹${amount} towards the ${donationTypeLabel} of St. John de Britto's Church. God bless you!`,
        type: 'donation',
        category: 'donations',
        priority: 'medium',
        actionUrl: '/dashboard',
        relatedId: donation._id,
        relatedModel: 'Donation',
        fileUrl: receiptUrl,
        channels: ['email', 'sms']
      }).catch(e => console.error('User notification error:', e.message));
    }

    // Admin in-app notification
    createNotification({
      recipient: 'admin',
      title: ` New Donation: ₹${amount}`,
      message: `A donation of ₹${amount} (${type}) received from ${donation.donorName}. Transaction: ${transactionId || 'N/A'}.`,
      type: 'donation',
      category: 'donations',
      priority: 'high',
      actionUrl: '/admin/donations',
      relatedId: donation._id,
      relatedModel: 'Donation',
      channels: []
    }).catch(e => console.error('Donation admin in-app notification error:', e.message));

    // Also email/WhatsApp admins
    notifyAdmins({
      title: 'New Donation Received',
      message: `A new donation of ₹${amount} has been received for ${type}.\n\n Donor: ${donation.donorName}\n Email: ${req.user?.email || 'N/A'}\n Phone: ${req.user?.phone || 'N/A'}\n Amount: ₹${amount}\n Category: ${type}\n Method: ${paymentMethod}\n🆔 Transaction ID: ${transactionId || 'N/A'}\n Note: ${note || 'None'}\n\nView all donations: ${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/donations`,
      fileUrl: receiptUrl
    }).catch(e => console.error('Donation notification error:', e.message));

    res.status(201).json({ success: true, donation });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const verify = async (req, res) => {
  try {
    const donation = await Donation.findByIdAndUpdate(req.params.id, { 
      isVerified: true, 
      status: 'verified',
      verifiedBy: req.user._id 
    }, { new: true });

    // Optional: Notify user that donation was verified
    if (donation.userId) {
      createNotification({
        userId: donation.userId,
        recipient: 'user',
        title: 'Donation Verified ',
        message: `Your donation of ₹${donation.amount} has been verified by the parish office. Thank you for your generosity!`,
        type: 'donation',
        category: 'donations',
        priority: 'medium',
        actionUrl: '/dashboard',
        relatedId: donation._id,
        relatedModel: 'Donation',
        channels: ['email']
      }).catch(e => console.error('Verification notification error:', e.message));
    }

    res.json({ success: true, donation });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const rejectDonation = async (req, res) => {
  try {
    const donation = await Donation.findByIdAndUpdate(req.params.id, { 
      status: 'rejected',
      isVerified: false 
    }, { new: true });

    // Optional: Notify user that donation was rejected
    if (donation.userId) {
      createNotification({
        userId: donation.userId,
        recipient: 'user',
        title: 'Donation Rejected ',
        message: `Your donation of ₹${donation.amount} could not be verified. Please contact the parish office for details.`,
        type: 'donation',
        category: 'donations',
        priority: 'high',
        actionUrl: '/dashboard',
        relatedId: donation._id,
        relatedModel: 'Donation',
        channels: ['email']
      }).catch(e => console.error('Rejection notification error:', e.message));
    }

    res.json({ success: true, donation });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getStats = async (req, res) => {
  try {
    const stats = await Donation.aggregate([
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

module.exports = { getAll, create, verify, rejectDonation, getStats, getMyDonations };
