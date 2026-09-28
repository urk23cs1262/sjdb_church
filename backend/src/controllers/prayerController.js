const PrayerRequest = require('../models/PrayerRequest');
const User = require('../models/User');
const { createAdminNotification, createUserNotification } = require('../services/requestNotificationService');
const { sendMail } = require('../config/mailer');

function sendWA(phone, text) {
  return require('../bot/whatsapp').sendWhatsAppMessage(phone, text).catch(() => { });
}

const getPublic = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = {
      isPublic: true,
      status: 'approved',
      $or: [
        { preferredDate: { $gte: today } },
        { preferredDate: { $exists: false } },
        { preferredDate: null }
      ]
    };

    const prayers = await PrayerRequest.find(query).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, prayers });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getPrayerById = async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { _id: id };
    } else {
      const rawHex = id.replace(/^PR-/i, '');
      query = { _id: { $regex: rawHex + '$', $options: 'i' } };
    }
    const prayer = await PrayerRequest.findOne(query).populate('userId', 'name email phone parishMemberId familyId anbiyam');
    if (!prayer) return res.status(404).json({ success: false, message: 'Prayer request not found' });
    
    // Authorization check: Admin OR Owner OR matching contact
    const isOwner = prayer.userId && (prayer.userId._id ? prayer.userId._id.toString() : prayer.userId.toString()) === req.user?._id?.toString();
    const phoneMatch = req.user?.phone && prayer.contactPhone && req.user.phone.replace(/\D/g, '') === prayer.contactPhone.replace(/\D/g, '');
    const emailMatch = req.user?.email && prayer.email && req.user.email.toLowerCase() === prayer.email.toLowerCase();

    if (req.user?.role !== 'admin' && !isOwner && !phoneMatch && !emailMatch && !prayer.isPublic) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only view your own requests.' });
    }

    res.json({ success: true, prayer });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getAll = async (req, res) => {
  try {
    const { status, id } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = {};
    if (id) {
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        query._id = id;
      } else {
        query._id = { $regex: id.replace(/^PR-/i, '') + '$', $options: 'i' };
      }
    } else if (status === 'completed') {
      query.$or = [
        { status: 'completed' },
        { preferredDate: { $lt: today } }
      ];
    } else if (status === 'pending' || status === 'approved' || status === 'rejected') {
      query.status = status;
      query.$or = [
        { preferredDate: { $gte: today } },
        { preferredDate: { $exists: false } },
        { preferredDate: null }
      ];
    } else if (status) {
      query.status = status;
    }

    const prayers = await PrayerRequest.find(query).populate('userId', 'name email phone parishMemberId familyId anbiyam').sort({ createdAt: -1 });
    res.json({ success: true, prayers });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const create = async (req, res) => {
  try {
    const {
      intention, isPublic, name, email, phone, language, prayerLocation,
      churchLocation, type, preferredDate, preferredTime,
      confessionLocation, contactPhone
    } = req.body;

    const isConfession = prayerLocation === 'confession' || type === 'Confession Request';
    const finalIsPublic = isConfession ? false : Boolean(isPublic);
    const applicantName = name || req.user?.name || 'Anonymous';
    const userEmail = email || req.user?.email;
    const userPhone = contactPhone || phone || req.user?.phone;
    const finalIntention = (intention && String(intention).trim())
      ? String(intention).trim()
      : (isConfession
        ? `Confession Request (Sacrament of Reconciliation)`
        : 'Prayer Intention');

    const prayer = await PrayerRequest.create({
      userId: req.user?._id,
      name: applicantName,
      email: userEmail,
      intention: finalIntention,
      isPublic: finalIsPublic,
      language: language || 'en',
      prayerLocation: prayerLocation || 'personal',
      churchLocation,
      type: type || 'General Prayer Request',
      preferredDate,
      preferredTime,
      confessionLocation,
      contactPhone: userPhone
    });

    const notifTitle = isConfession ? 'New Confession Request' : 'New Prayer Request';
    const userActionUrl = isConfession ? '/dashboard' : '/dashboard/prayer-requests/' + prayer._id;

    // 1. Central Admin Notification (WhatsApp, Email, Web Push, In-App Bell)
    createAdminNotification({
      type: isConfession ? 'CONFESSION_REQUEST' : 'PRAYER_REQUEST',
      requestType: isConfession ? 'CONFESSION_REQUEST' : 'PRAYER_REQUEST',
      title: notifTitle,
      message: `${applicantName} submitted a ${type || 'prayer request'}: "${finalIntention.slice(0, 100)}".`,
      userId: req.user?._id,
      memberId: req.user?.parishMemberId,
      requestId: prayer._id,
      priority: 'high',
      status: 'PENDING',
      details: finalIntention,
      request: prayer,
      user: req.user,
      req
    }).catch(e => console.error('[PrayerController] Central Admin notification error:', e.message));

    // 2. Central User Confirmation Notification
    createUserNotification({
      userId: req.user?._id,
      type: 'REQUEST_STATUS_UPDATE',
      requestType: isConfession ? 'CONFESSION_REQUEST' : 'PRAYER_REQUEST',
      requestId: prayer._id,
      status: 'PENDING',
      title: isConfession ? 'Confession Request Submitted' : 'Prayer Request Received',
      message: isConfession
        ? 'Your confidential confession request has been submitted to the Parish Priest.'
        : 'Your prayer request has been received and submitted for church review.',
      redirectUrl: userActionUrl,
      request: prayer,
      req
    }).catch(e => console.error('[PrayerController] Central User notification error:', e.message));

    res.status(201).json({ success: true, prayer });
  } catch (err) {
    console.error('Prayer creation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status, adminComment, adminNote } = req.body;
    const comment = adminComment || adminNote;
    const previousPrayer = await PrayerRequest.findById(req.params.id);
    const previousStatus = previousPrayer?.status || 'pending';

    const prayer = await PrayerRequest.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate('userId', 'name email phone parishMemberId familyId anbiyam');

    if (prayer) {
      const isConfession = prayer.type === 'Confession Request';
      const userActionUrl = isConfession ? '/dashboard' : '/dashboard/prayer-requests/' + prayer._id;

      // Central User Status Notification through ALL channels (Website bell, Web Push, Email, WhatsApp)
      createUserNotification({
        userId: prayer.userId?._id || prayer.userId,
        type: 'REQUEST_STATUS_UPDATE',
        requestType: isConfession ? 'CONFESSION_REQUEST' : 'PRAYER_REQUEST',
        requestId: prayer._id,
        status,
        adminComment: comment,
        redirectUrl: userActionUrl,
        metadata: {
          previousStatus,
          newStatus: status,
          adminComment: comment
        },
        request: prayer,
        req
      }).catch(e => console.error('[PrayerController] Central User status notification error:', e.message));
    }

    res.json({ success: true, prayer });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deletePrayer = async (req, res) => {
  try {
    const prayer = await PrayerRequest.findByIdAndDelete(req.params.id);
    if (!prayer) return res.status(404).json({ success: false, message: 'Prayer request not found' });
    res.json({ success: true, message: 'Prayer request permanently deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteAllByStatus = async (req, res) => {
  try {
    const { status } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = {};
    if (status === 'completed') {
      query.$or = [
        { status: 'completed' },
        { preferredDate: { $lt: today } }
      ];
    } else if (status === 'pending' || status === 'approved' || status === 'rejected') {
      query.status = status;
      query.$or = [
        { preferredDate: { $gte: today } },
        { preferredDate: { $exists: false } },
        { preferredDate: null }
      ];
    }
    const result = await PrayerRequest.deleteMany(query);
    res.json({ success: true, message: `Permanently deleted all ${status || 'matching'} prayer requests`, count: result.deletedCount });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const incrementPrayer = async (req, res) => {
  try {
    const prayer = await PrayerRequest.findByIdAndUpdate(req.params.id, { $inc: { prayerCount: 1 } }, { new: true });
    res.json({ success: true, prayer });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getPublic, getAll, getPrayerById, create, updateStatus, incrementPrayer, deletePrayer, deleteAllByStatus };
