const Booking = require('../models/Booking');
const { createAdminNotification, createUserNotification } = require('../services/requestNotificationService');

const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { bookingNumber: id };
    const booking = await Booking.findOne(query).populate('userId', 'name phone email parishMemberId familyId anbiyam');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    
    // Authorization check: Admin or Request Owner
    const isOwner = booking.userId && (booking.userId._id ? booking.userId._id.toString() : booking.userId.toString()) === req.user._id.toString();
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only view your own requests.' });
    }

    res.json({ success: true, booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getAllBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, id } = req.query;
    const query = {};
    if (id) {
      if (id.match(/^[0-9a-fA-F]{24}$/)) query._id = id;
      else query.bookingNumber = id;
    } else if (status) {
      query.status = status;
    }
    const total = await Booking.countDocuments(query);
    const bookings = await Booking.find(query).populate('userId', 'name phone email parishMemberId familyId anbiyam').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, total, bookings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createBooking = async (req, res) => {
  try {
    const { massDate, massTime, intentionType, intentionDetails, familyName, personName, familyDetails, attachmentUrl, offertory } = req.body;
    
    // Generate unique reference number if not set by schema pre-save
    const bookingNumber = 'MB-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-6);

    const booking = await Booking.create({
      userId: req.user._id,
      bookingNumber,
      massDate,
      massTime: massTime || 'Any Available Time',
      intentionType,
      intentionDetails,
      familyName,
      personName,
      familyDetails,
      attachmentUrl,
      offertory: Number(offertory) || 0
    });
    
    const formattedDate = new Date(massDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const detailString = `${personName || familyName ? `For: ${personName || familyName}. ` : ''}Intention: ${(intentionType || '').replace(/_/g, ' ')} on ${formattedDate} (${massTime || 'Any Time'})`;

    // 1. Central Admin Notification (Dashboard Bell, WhatsApp, Web Push, Email)
    createAdminNotification({
      type: 'MASS_BOOKING',
      requestType: 'MASS_BOOKING',
      title: 'New Mass Booking Request',
      message: `${req.user.name} submitted a new Mass Booking request for ${formattedDate}.`,
      userId: req.user._id,
      memberId: req.user.parishMemberId,
      requestId: booking.bookingNumber || booking._id,
      priority: 'normal',
      status: 'PENDING',
      details: detailString,
      request: booking,
      user: req.user,
      req
    }).catch(e => console.error('[BookingController] Central Admin notification error:', e.message));

    // 2. Central User Confirmation Notification (Dashboard Bell, Web Push, Email, WhatsApp)
    createUserNotification({
      userId: req.user._id,
      type: 'REQUEST_STATUS_UPDATE',
      requestType: 'MASS_BOOKING',
      requestId: booking.bookingNumber || booking._id,
      status: 'PENDING',
      title: 'Mass Booking Received',
      message: `Your Mass Booking request for ${formattedDate} has been received and is pending church review.`,
      redirectUrl: `/dashboard/bookings/${booking.bookingNumber || booking._id}`,
      request: booking,
      req
    }).catch(e => console.error('[BookingController] Central User notification error:', e.message));

    res.status(201).json({ success: true, booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateBookingStatus = async (req, res) => {
  try {
    const { status, adminNote, suggestedDate, suggestedTime } = req.body;
    const previousBooking = await Booking.findById(req.params.id).populate('userId', 'name phone email parishMemberId familyId anbiyam');
    const previousStatus = previousBooking?.status || 'pending';

    const updateData = { status, adminNote, confirmedBy: req.user._id };
    if (suggestedDate) updateData.suggestedDate = suggestedDate;
    if (suggestedTime) updateData.suggestedTime = suggestedTime;

    const booking = await Booking.findByIdAndUpdate(req.params.id, updateData, { new: true }).populate('userId', 'name phone email parishMemberId familyId anbiyam');

    const adminComment = adminNote || (suggestedDate ? `Parish office suggested: ${new Date(suggestedDate).toLocaleDateString()} (${suggestedTime || 'Any time'})` : null);

    // Central User Status Notification through ALL channels (Website bell, Web Push, Email, WhatsApp)
    createUserNotification({
      userId: booking.userId?._id || booking.userId,
      type: 'REQUEST_STATUS_UPDATE',
      requestType: 'MASS_BOOKING',
      requestId: booking.bookingNumber || booking._id,
      status,
      adminComment,
      redirectUrl: `/dashboard/bookings/${booking.bookingNumber || booking._id}`,
      metadata: {
        previousStatus,
        newStatus: status,
        adminComment
      },
      request: booking,
      req
    }).catch(e => console.error('[BookingController] Central User status notification error:', e.message));

    res.json({ success: true, booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteBooking = async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Booking deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getMyBookings, getAllBookings, getBookingById, createBooking, updateBookingStatus, deleteBooking };
