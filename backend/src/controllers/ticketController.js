const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { notifyAdmins, createNotification } = require('../services/notificationService');

const getMyTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, tickets });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getAll = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    const total = await Ticket.countDocuments(query);
    const tickets = await Ticket.find(query).populate('userId', 'name phone email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, total, tickets });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const create = async (req, res) => {
  try {
    const { subject, message, category, priority } = req.body;
    const ticket = await Ticket.create({ userId: req.user._id, subject, message, category, priority });

    // NEW: Confirm to the user that their message was received
    createNotification({
      userId: req.user._id,
      recipient: 'user',
      title: 'We Received Your Message ',
      message: `Dear ${req.user.name}, thank you for contacting St. John de britto Church. We received your inquiry about "${subject}". Our team will get back to you soon.`,
      type: 'ticket',
      category: 'tickets',
      priority: 'low',
      actionUrl: '/dashboard/tickets',
      relatedId: ticket._id,
      relatedModel: 'Ticket',
      channels: ['email'],
    }).catch(e => console.error('Ticket user notification error:', e.message));

    // Admin in-app notification
    createNotification({
      recipient: 'admin',
      title: ` New Support Ticket`,
      message: `${req.user.name} submitted a ticket (${category || 'General'}): "${subject}".`,
      type: 'ticket',
      category: 'tickets',
      priority: priority || 'medium',
      actionUrl: '/admin/tickets',
      relatedId: ticket._id,
      relatedModel: 'Ticket',
      channels: []
    }).catch(e => console.error('Ticket admin in-app notification error:', e.message));

    // Also email/WhatsApp admins
    notifyAdmins({
      title: 'New Support Ticket',
      message: `A new inquiry has been received:\n\n User: ${req.user.name}\n Phone: ${req.user.phone || 'N/A'}\n Email: ${req.user.email || 'N/A'}\n Category: ${category || 'General'}\n Subject: ${subject}\n Message: ${message}\n\nView details: ${process.env.CLIENT_URL}/admin/tickets`
    }).catch(e => console.error('Ticket admin notification error:', e.message));

    res.status(201).json({ success: true, ticket });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const reply = async (req, res) => {
  try {
    const { message, from } = req.body;
    const ticket = await Ticket.findById(req.params.id).populate('userId', 'name email');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    ticket.replies.push({ from: from || 'admin', message, repliedBy: req.user._id });
    if (from === 'admin') ticket.status = 'in_progress';
    await ticket.save();

    // NEW: Email user when admin replies
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

    res.json({ success: true, ticket });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const update = { status };
    if (status === 'resolved') update.resolvedAt = new Date();
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, update, { new: true }).populate('userId', 'name');

    // NEW: Email user when ticket is resolved
    if (status === 'resolved' && ticket.userId) {
      createNotification({
        userId: ticket.userId._id || ticket.userId,
        recipient: 'user',
        title: 'Your Inquiry Has Been Resolved and closed ',
        message: `Your inquiry regarding "${ticket.subject}" has been marked as resolved and closed. Thank you for contacting St. John de britto Church.`,
        type: 'ticket',
        category: 'tickets',
        priority: 'medium',
        actionUrl: '/dashboard/tickets',
        relatedId: ticket._id,
        relatedModel: 'Ticket',
        channels: ['email'],
      }).catch(e => console.error('Ticket resolved notification error:', e.message));
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

module.exports = { getMyTickets, getAll, create, reply, updateStatus, deleteTicket };