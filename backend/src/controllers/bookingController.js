const Booking = require('../models/Booking');
const { createNotification, notifyAdmins } = require('../services/notificationService');
const { emitRequestCreated, emitRequestStatusChanged } = require('../services/requestNotificationService');

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

    // Notify user with confirmation email format
    createNotification({ 
      userId: req.user._id, 
      recipient: 'user',
      title: 'Mass Booking Received ', 
      message: `Mass Booking Received\n\nReference Number: ${booking.bookingNumber}\nRequested Date: ${formattedDate}\nMass Time: ${massTime || 'Any Available Time'}\nFor: ${personName || familyName || 'Intention'}\nIntention: ${intentionType?.replace('_', ' ')}\nStatus: Pending Approval\n\nWe will review your request and notify you once approved.`, 
      type: 'booking', 
      category: 'bookings',
      priority: 'medium',
      actionUrl: '/dashboard/booking',
      relatedId: booking._id, 
      relatedModel: 'Booking',
      channels: ['email'] 
    }).catch(e => console.error('Booking notification error:', e.message));
    
    // Admin in-app notification
    createNotification({
      recipient: 'admin',
      title: ` New Mass Booking (${booking.bookingNumber})`,
      message: `${req.user.name} booked a mass for ${formattedDate} (${massTime || 'Any time'}). Intention: ${intentionType}.`,
      type: 'booking',
      category: 'bookings',
      priority: 'medium',
      actionUrl: '/admin/bookings',
      relatedId: booking._id,
      relatedModel: 'Booking',
      channels: []
    }).catch(e => console.error('Booking admin notification error:', e.message));
    
    // Trigger central admin request notification (WhatsApp Bot, Email, Push, In-App)
    emitRequestCreated({
      module: 'mass_intention',
      request: booking,
      user: req.user,
      req
    });

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
    
    const statusText = status === 'approved' ? 'Approved ' : status === 'completed' ? 'Completed ' : 'Rejected ';
    let msg = `Your mass booking (${booking.bookingNumber || 'Ref'}) for ${new Date(booking.massDate).toLocaleDateString()} has been ${status}.`;
    if (suggestedDate) {
      msg += ` The parish office suggested another date/time: ${new Date(suggestedDate).toLocaleDateString()} (${suggestedTime || 'Any time'}).`;
    }
    if (adminNote) msg += ` Note: ${adminNote}`;

    createNotification({ 
        userId: booking.userId?._id || booking.userId, 
        recipient: 'user',
        title: `Mass Booking ${statusText}`, 
        message: msg, 
        type: 'booking', 
        category: 'bookings',
        priority: status === 'rejected' ? 'high' : 'medium',
        actionUrl: '/dashboard/booking',
        relatedId: booking._id, 
        relatedModel: 'Booking',
        channels: ['email'] 
    }).catch(e => console.error('Booking status notification error:', e.message));
    
    // Trigger central admin notification for status change
    emitRequestStatusChanged({
      module: 'mass_intention',
      request: booking,
      previousStatus,
      newStatus: status,
      user: booking.userId,
      updatedBy: req.user,
      note: adminNote || (suggestedDate ? `Alternative date suggested: ${new Date(suggestedDate).toLocaleDateString()}` : null),
      req
    });

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
