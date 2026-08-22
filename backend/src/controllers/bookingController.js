const Booking = require('../models/Booking');
const { createNotification, notifyAdmins } = require('../services/notificationService');

const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getAllBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    const total = await Booking.countDocuments(query);
    const bookings = await Booking.find(query).populate('userId', 'name phone email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
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
    
    // Also email/WhatsApp admins
    notifyAdmins({
      title: `New Mass Booking (${booking.bookingNumber})`,
      message: `A new mass booking has been requested:\n\n Ref ID: ${booking.bookingNumber}\n User: ${req.user.name}\n For Person/Family: ${personName || familyName || 'N/A'}\n Phone: ${req.user.phone || 'N/A'}\n Date: ${formattedDate}\n Time: ${massTime || 'Any time'}\n Intention: ${intentionType}\n Details: ${intentionDetails || 'None'}\n Voluntary Offering: ₹${offertory || 0}\n\nView details: ${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/bookings`
    }).catch(e => console.error('Booking notification error:', e.message));

    res.status(201).json({ success: true, booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateBookingStatus = async (req, res) => {
  try {
    const { status, adminNote, suggestedDate, suggestedTime } = req.body;
    const updateData = { status, adminNote, confirmedBy: req.user._id };
    if (suggestedDate) updateData.suggestedDate = suggestedDate;
    if (suggestedTime) updateData.suggestedTime = suggestedTime;

    const booking = await Booking.findByIdAndUpdate(req.params.id, updateData, { new: true });
    
    const statusText = status === 'approved' ? 'Approved ' : status === 'completed' ? 'Completed ' : 'Rejected ';
    let msg = `Your mass booking (${booking.bookingNumber || 'Ref'}) for ${new Date(booking.massDate).toLocaleDateString()} has been ${status}.`;
    if (suggestedDate) {
      msg += ` The parish office suggested another date/time: ${new Date(suggestedDate).toLocaleDateString()} (${suggestedTime || 'Any time'}).`;
    }
    if (adminNote) msg += ` Note: ${adminNote}`;

    createNotification({ 
        userId: booking.userId, 
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
    
    res.json({ success: true, booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteBooking = async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Booking deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getMyBookings, getAllBookings, createBooking, updateBookingStatus, deleteBooking };
