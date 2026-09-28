const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { createAdminNotification, createUserNotification } = require('../services/requestNotificationService');

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
    const { subject, message, category, priority, name, email, phone } = req.body;
    const userId = req.user?._id || null;
    const userName = req.user?.name || name || 'Website Visitor';
    const userEmail = req.user?.email || email || '';
    const userPhone = req.user?.phone || phone || '';
    const memberId = req.user?.parishMemberId || 'GUEST';

    const ticketData = {
      subject,
      message,
      category: category || 'enquiry',
      priority: priority || 'medium'
    };
    if (userId) ticketData.userId = userId;
    if (name || !userId) ticketData.name = userName;
    if (email || !userId) ticketData.email = userEmail;
    if (phone || !userId) ticketData.phone = userPhone;

    const ticket = await Ticket.create(ticketData);
    const isEnquiry = category === 'enquiry';
    const typeLabel = isEnquiry ? 'Website Enquiry' : 'Support Ticket';

    // 1. Central Admin Notification
    createAdminNotification({
      type: isEnquiry ? 'CONTACT_ENQUIRY' : 'TICKET',
      requestType: isEnquiry ? 'CONTACT_ENQUIRY' : 'TICKET',
      title: `New ${typeLabel}`,
      message: `${userName} submitted a new ${typeLabel.toLowerCase()}: "${subject}".`,
      userId: userId,
      memberId: memberId,
      requestId: ticket.ticketNumber || ticket._id,
      priority: priority || 'normal',
      status: 'OPEN',
      details: `${subject} — ${message.slice(0, 120)}`,
      request: ticket,
      user: req.user || { _id: userId, name: userName, email: userEmail, phone: userPhone, parishMemberId: memberId },
      req
    }).catch(e => console.error('[TicketController] Central Admin notification error:', e.message));

    // 2. Central User Confirmation Notification (if user or email/phone provided)
    if (userId || userEmail || userPhone) {
      createUserNotification({
        userId: userId,
        type: 'REQUEST_STATUS_UPDATE',
        requestType: isEnquiry ? 'CONTACT_ENQUIRY' : 'TICKET',
        requestId: ticket.ticketNumber || ticket._id,
        status: 'OPEN',
        title: 'We Received Your Inquiry',
        message: `Dear ${userName}, thank you for contacting St. John de Britto Church. We received your message about "${subject}". Our team will review and respond promptly.`,
        redirectUrl: `/dashboard/tickets/${ticket.ticketNumber || ticket._id}`,
        request: ticket,
        user: req.user || { _id: userId, name: userName, email: userEmail, phone: userPhone, parishMemberId: memberId },
        req
      }).catch(e => console.error('[TicketController] Central User notification error:', e.message));
    }

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

    // Central User Notification when Admin replies
    if (from === 'admin' && ticket.userId) {
      createUserNotification({
        userId: ticket.userId._id || ticket.userId,
        type: 'REQUEST_STATUS_UPDATE',
        requestType: 'TICKET',
        requestId: ticket.ticketNumber || ticket._id,
        status: 'IN_PROGRESS',
        title: `Reply to: ${ticket.subject}`,
        message: `Parish administration replied to your ticket "${ticket.subject}": ${message}`,
        adminComment: message,
        redirectUrl: `/dashboard/tickets/${ticket.ticketNumber || ticket._id}`,
        metadata: {
          previousStatus,
          newStatus: 'in_progress',
          adminComment: message
        },
        request: ticket,
        req
      }).catch(e => console.error('[TicketController] Central User reply notification error:', e.message));
    }

    res.json({ success: true, ticket });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateStatus = async (req, res) => {
  try {
    const { status, adminComment } = req.body;
    const previousTicket = await Ticket.findById(req.params.id);
    const previousStatus = previousTicket?.status || 'open';

    const update = { status };
    if (status === 'resolved') update.resolvedAt = new Date();
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, update, { new: true }).populate('userId', 'name email phone parishMemberId familyId anbiyam');

    // Central User Notification on status change
    if (ticket.userId) {
      createUserNotification({
        userId: ticket.userId._id || ticket.userId,
        type: 'REQUEST_STATUS_UPDATE',
        requestType: 'TICKET',
        requestId: ticket.ticketNumber || ticket._id,
        status,
        adminComment,
        redirectUrl: `/dashboard/tickets/${ticket.ticketNumber || ticket._id}`,
        metadata: {
          previousStatus,
          newStatus: status,
          adminComment
        },
        request: ticket,
        req
      }).catch(e => console.error('[TicketController] Central User status notification error:', e.message));
    }

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