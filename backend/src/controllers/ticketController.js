const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { notifyAdmins, createNotification } = require('../services/notificationService');
const { emitRequestCreated, emitRequestStatusChanged } = require('../services/requestNotificationService');

const getMyTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, tickets });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { _id: id };
    } else {
      query = { ticketNumber: id };
    }
    const ticket = await Ticket.findOne(query).populate('userId', 'name phone email parishMemberId familyId anbiyam').populate('replies.repliedBy', 'name role');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    
    // Authorization check: Admin OR Ticket Owner
    const isOwner = ticket.userId && (ticket.userId._id ? ticket.userId._id.toString() : ticket.userId.toString()) === req.user._id.toString();
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only view your own requests.' });
    }

    res.json({ success: true, ticket });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getAll = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, id } = req.query;
    const query = {};
    if (id) {
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        query._id = id;
      } else {
        query.ticketNumber = id;
      }
    } else if (status) {
      query.status = status;
    }
    const total = await Ticket.countDocuments(query);
    const tickets = await Ticket.find(query).populate('userId', 'name phone email parishMemberId familyId anbiyam').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, total, tickets });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const create = async (req, res) => {
  try {
    const { subject, message, category, priority } = req.body;
    const ticket = await Ticket.create({ userId: req.user._id, subject, message, category, priority });

    // Confirm to the user that their message was received
    createNotification({
      userId: req.user._id,
      recipient: 'user',
      title: 'We Received Your Message ',
      message: `Dear ${req.user.name}, thank you for contacting St. John de Britto Church. We received your inquiry about "${subject}". Our team will get back to you soon.`,
      type: 'ticket',
      category: 'tickets',
      priority: 'low',
      actionUrl: '/dashboard/tickets',
      relatedId: ticket._id,
      relatedModel: 'Ticket',
      channels: ['email'],
    }).catch(e => console.error('Ticket user notification error:', e.message));

    // Central Admin Request Notification (WhatsApp Bot, Email, Push, In-App)
    emitRequestCreated({
      module: 'ticket_request',
      request: ticket,
      user: req.user,
      req
    });

    res.status(201).json({ success: true, ticket });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const reply = async (req, res) => {
  try {
    const { message, from } = req.body;
    const ticket = await Ticket.findById(req.params.id).populate('userId', 'name email phone parishMemberId familyId anbiyam');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const previousStatus = ticket.status;
    ticket.replies.push({ from: from || 'admin', message, repliedBy: req.user._id });
    if (from === 'admin') ticket.status = 'in_progress';
    await ticket.save();

    // Email user when admin replies
    if (from === 'admin' && ticket.userId) {
      createNotification({
        userId: ticket.userId._id || ticket.userId,
        recipient: 'user',
        title: 'Reply to Your Inquiry ',
        message: `The parish office replied to your inquiry "${ticket.subject}": ${message}`,
        type: 'ticket',
        category: 'tickets',
        priority: 'medium',
        actionUrl: '/dashboard/tickets',
        relatedId: ticket._id,
        relatedModel: 'Ticket',
        channels: ['email'],
      }).catch(e => console.error('Ticket reply notification error:', e.message));
    }

    // Central Admin Notification on reply if user replied or status updated
    emitRequestStatusChanged({
      module: 'ticket_request',
      request: ticket,
      previousStatus,
      newStatus: ticket.status,
      user: ticket.userId,
      updatedBy: req.user,
      note: `Reply from ${from === 'admin' ? 'Parish Admin' : ticket.userId?.name || 'User'}: "${message.slice(0, 80)}"`,
      req
    });

    res.json({ success: true, ticket });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const previousTicket = await Ticket.findById(req.params.id);
    const previousStatus = previousTicket?.status || 'open';

    const update = { status };
    if (status === 'resolved') update.resolvedAt = new Date();
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, update, { new: true }).populate('userId', 'name email phone parishMemberId familyId anbiyam');

    // Email user when ticket is resolved
    if (status === 'resolved' && ticket.userId) {
      createNotification({
        userId: ticket.userId._id || ticket.userId,
        recipient: 'user',
        title: 'Your Inquiry Has Been Resolved and closed ',
        message: `Your inquiry regarding "${ticket.subject}" has been marked as resolved and closed. Thank you for contacting St. John de Britto Church.`,
        type: 'ticket',
        category: 'tickets',
        priority: 'medium',
        actionUrl: '/dashboard/tickets',
        relatedId: ticket._id,
        relatedModel: 'Ticket',
        channels: ['email'],
      }).catch(e => console.error('Ticket resolved notification error:', e.message));
    }

    // Central Admin Status Change Notification
    emitRequestStatusChanged({
      module: 'ticket_request',
      request: ticket,
      previousStatus,
      newStatus: status,
      user: ticket.userId,
      updatedBy: req.user,
      req
    });

    res.json({ success: true, ticket });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, message: 'Ticket deleted permanently' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getMyTickets, getAll, getTicketById, create, reply, updateStatus, deleteTicket };