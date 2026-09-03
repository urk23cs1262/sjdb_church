const fs = require('fs');
const Event = require('../models/Event');
const User = require('../models/User');
const { sendSMS } = require('../config/twilio');
const { createNotification } = require('../services/notificationService');
function sendWA(phone, text) {
  return require('../bot/whatsapp').sendWhatsAppMessage(phone, text).catch(() => { });
}

const getAll = async (req, res) => {
  try {
    const { category, upcoming, featured, page = 1, limit = 20, all } = req.query;
    const query = {};
    if (all !== 'true') query.isPublished = true;
    if (category) query.category = category;
    if (upcoming === 'true') query.date = { $gte: new Date() };
    if (featured === 'true') query.isFeatured = true;
    const total = await Event.countDocuments(query);
    const events = await Event.find(query).sort({ date: 1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, total, events });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getOne = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('createdBy', 'name');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, event });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const create = async (req, res) => {
  try {
    const data = { ...req.body };

    // Sanitize category enum
    const validCategories = ['feast', 'mass', 'meeting', 'youth', 'choir', 'catechism', 'community', 'other'];
    if (!data.category || !validCategories.includes(data.category)) {
      data.category = 'other';
    }

    // Sanitize booleans
    if (typeof data.isPublished === 'string') {
      data.isPublished = data.isPublished === 'true';
    } else if (data.isPublished === undefined) {
      data.isPublished = true;
    }
    if (typeof data.isFeatured === 'string') {
      data.isFeatured = data.isFeatured === 'true';
    }
    if (typeof data.registrationRequired === 'string') {
      data.registrationRequired = data.registrationRequired === 'true';
    }

    // Validate required fields
    if (!data.title || !data.title.trim()) {
      return res.status(400).json({ success: false, message: 'Event title is required' });
    }
    if (!data.date) {
      return res.status(400).json({ success: false, message: 'Event date is required' });
    }
    const parsedDate = new Date(data.date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid event date' });
    }
    data.date = parsedDate;

    if (req.file) {
      const { uploadToGridFS } = require('../services/gridfsService');
      const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
      if (buffer) {
        const fileInfo = await uploadToGridFS(buffer, req.file.originalname, req.file.mimetype);
        data.image = fileInfo.url;
      }
    }
    if (req.user) data.createdBy = req.user._id;
    const event = await Event.create(data);

    // Notify all users in background
    if (event.isPublished !== false) {
      const { formatEventWhatsApp, broadcastEventCreated } = require('../services/whatsappBroadcastHelper');
      const msg = formatEventWhatsApp(event);

      broadcastEventCreated(event).catch(err => console.error("Error auto-broadcasting event to WhatsApp:", err));

      User.find({ isVerified: true }).then(users => {
        users.forEach(user => {
          if (user.phone) {
            sendSMS(user.phone, msg).catch(() => { });
          }
        });
      }).catch(err => console.error("Error notifying users:", err));

      // In-app broadcast notification for all users
      createNotification({
        isBroadcast: true,
        recipient: 'user',
        title: `📅 New Event: ${event.title}`,
        message: `A new church event has been announced: ${event.title}${event.date ? ' on ' + new Date(event.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) : ''}${event.venue ? ' at ' + event.venue : ''}.`,
        type: 'event',
        category: 'events',
        priority: 'medium',
        actionUrl: '/events',
        relatedId: event._id,
        relatedModel: 'Event',
        channels: []
      }).catch(e => console.error('Event broadcast notification error:', e.message));

      // Admin in-app notification
      createNotification({
        recipient: 'admin',
        title: `📅 New Event Created: ${event.title}`,
        message: `A new event "${event.title}" has been published.${event.date ? ' Date: ' + new Date(event.date).toLocaleDateString('en-IN') : ''}`,
        type: 'event',
        category: 'events',
        priority: 'low',
        actionUrl: '/admin/events',
        relatedId: event._id,
        relatedModel: 'Event',
        channels: []
      }).catch(e => console.error('Event admin notification error:', e.message));
    }

    res.status(201).json({ success: true, event });
  } catch (err) {
    console.error('[EventController] Create error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const data = { ...req.body };

    const validCategories = ['feast', 'mass', 'meeting', 'youth', 'choir', 'catechism', 'community', 'other'];
    if (data.category && !validCategories.includes(data.category)) {
      data.category = 'other';
    }
    if (typeof data.isPublished === 'string') {
      data.isPublished = data.isPublished === 'true';
    }
    if (typeof data.isFeatured === 'string') {
      data.isFeatured = data.isFeatured === 'true';
    }
    if (typeof data.registrationRequired === 'string') {
      data.registrationRequired = data.registrationRequired === 'true';
    }
    if (data.date) {
      const parsedDate = new Date(data.date);
      if (!isNaN(parsedDate.getTime())) {
        data.date = parsedDate;
      } else {
        delete data.date;
      }
    }

    if (req.body.removeImage === 'true') {
      data.image = '';
    } else if (req.file) {
      const { uploadToGridFS } = require('../services/gridfsService');
      const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
      if (buffer) {
        const fileInfo = await uploadToGridFS(buffer, req.file.originalname, req.file.mimetype);
        data.image = fileInfo.url;
      }
    }
    const event = await Event.findByIdAndUpdate(req.params.id, data, { new: true });

    // Notify all users about Updated Event in background
    if (event && event.isPublished !== false) {
      const { formatEventWhatsApp } = require('../services/whatsappBroadcastHelper');
      const msg = formatEventWhatsApp(event);

      User.find({ isVerified: true }).then(users => {
        users.forEach(user => {
          if (user.phone) {
            sendSMS(user.phone, msg).catch(() => { });
            sendWA(user.phone, msg);
          }
        });
      }).catch(err => console.error("Error notifying users on event update:", err));
    }

    res.json({ success: true, event });
  } catch (err) {
    console.error('[EventController] Update error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};


const remove = async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Event deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const registerForEvent = async (req, res) => {
  try {
    const { name, phone, email, gender, comingFrom } = req.body;
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    const alreadyRegistered = event.registrations.some(r => r.userId?.toString() === req.user._id.toString());
    if (alreadyRegistered) return res.status(400).json({ success: false, message: 'Already registered' });
    event.registrations.push({
      userId: req.user._id,
      name: name || req.user.name,
      phone: phone || req.user.phone,
      email: email || req.user.email,
      gender,
      comingFrom,
      registeredAt: new Date()
    });
    await event.save();

    // In-app: confirm registration to user
    createNotification({
      userId: req.user._id,
      recipient: 'user',
      title: ` Event Registration Confirmed`,
      message: `You have successfully registered for "${event.title}"${event.date ? ' on ' + new Date(event.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) : ''}.`,
      type: 'event',
      category: 'events',
      priority: 'low',
      actionUrl: '/events',
      relatedId: event._id,
      relatedModel: 'Event',
      channels: []
    }).catch(e => console.error('Event reg notification error:', e.message));

    // Admin in-app notification
    createNotification({
      recipient: 'admin',
      title: ` New Event Registration`,
      message: `${req.user.name} has registered for "${event.title}". Total registrations: ${event.registrations.length}`,
      type: 'event',
      category: 'events',
      priority: 'low',
      actionUrl: '/admin/events',
      relatedId: event._id,
      relatedModel: 'Event',
      channels: []
    }).catch(e => console.error('Event reg admin notification error:', e.message));

    res.json({ success: true, message: 'Registered successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const withdrawRegistration = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const index = event.registrations.findIndex(r => r.userId?.toString() === req.user._id.toString());
    if (index === -1) return res.status(400).json({ success: false, message: 'Not registered for this event' });

    event.registrations.splice(index, 1);
    await event.save();
    res.json({ success: true, message: 'Registration withdrawn successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getAll, getOne, create, update, remove, registerForEvent, withdrawRegistration };
