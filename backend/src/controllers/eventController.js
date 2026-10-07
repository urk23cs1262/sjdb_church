const fs = require('fs');
const Event = require('../models/Event');
const User = require('../models/User');
const { sendSMS } = require('../config/twilio');
const { createNotification } = require('../services/notificationService');
const { registerUserForEvent, withdrawUserRegistration } = require('../services/eventRegistrationService');
const { resolveBackendImageUrl } = require('../utils/imageUrlHelper');

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
    const rawEvents = await Event.find(query).sort({ date: 1 }).skip((page - 1) * limit).limit(Number(limit)).lean();

    const isAdmin = req.user && ['admin', 'priest'].includes(req.user.role);
    const events = rawEvents.map(e => {
      const isRegistered = Boolean(
        req.user && (e.registrations || []).some(r => r.userId?.toString() === req.user._id.toString())
      );
      const registrationCount = e.registrationCount || (e.registrations || []).length;
      const resolvedImage = resolveBackendImageUrl(e.image);

      const sanitizedRegistrations = isAdmin
        ? e.registrations
        : (isRegistered ? (e.registrations || []).filter(r => r.userId?.toString() === req.user._id.toString()) : []);

      return {
        ...e,
        image: resolvedImage,
        isRegistered,
        registrationCount,
        registrations: sanitizedRegistrations
      };
    });

    if (req.user) {
      res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    } else if (all !== 'true') {
      res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
    }

    res.json({ success: true, total, events });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getOne = async (req, res) => {
  try {
    const rawEvent = await Event.findById(req.params.id).populate('createdBy', 'name').lean();
    if (!rawEvent) return res.status(404).json({ success: false, message: 'Event not found' });

    const isRegistered = Boolean(
      req.user && (rawEvent.registrations || []).some(r => r.userId?.toString() === req.user._id.toString())
    );
    const registrationCount = rawEvent.registrationCount || (rawEvent.registrations || []).length;
    const resolvedImage = resolveBackendImageUrl(rawEvent.image);

    const isAdmin = req.user && ['admin', 'priest'].includes(req.user.role);
    const sanitizedRegistrations = isAdmin
      ? rawEvent.registrations
      : (isRegistered ? (rawEvent.registrations || []).filter(r => r.userId?.toString() === req.user._id.toString()) : []);

    const event = {
      ...rawEvent,
      image: resolvedImage,
      isRegistered,
      registrationCount,
      registrations: sanitizedRegistrations
    };

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

    // Server-Side Hourly Tomorrow Event Reminder & Announcement Hook
    const { onEventCreated } = require('../services/hourlyEventReminderService');
    onEventCreated(event).catch(err => {
      console.error('[EventController] Error initializing hourly event reminder:', err.message);
    });

    // Multi-Channel Broadcast across WhatsApp, Email, In-App, and Push
    if (event.isPublished !== false) {
      const { broadcastEventPublished } = require('../services/broadcastNotificationService');
      broadcastEventPublished({ event, action: 'created' }).catch(err => {
        console.error('[EventController] Error broadcasting new event:', err.message);
      });
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

    const previousEvent = await Event.findById(req.params.id);
    if (!previousEvent) return res.status(404).json({ success: false, message: 'Event not found' });

    if (data.status === 'cancelled' || data.isCancelled === 'true' || data.isCancelled === true) {
      data.status = 'cancelled';
      data.isCancelled = true;
      data.cancelledAt = new Date();
      data.reminderStatus = 'cancelled';
    } else if (data.status === 'active') {
      data.isCancelled = false;
    }

    if (req.body.removeImage === 'true') {
      data.image = '';
      if (previousEvent.image && previousEvent.image.startsWith('/api/files/')) {
        const { deleteFromGridFS } = require('../services/gridfsService');
        deleteFromGridFS(previousEvent.image.replace('/api/files/', '')).catch(() => {});
      }
    } else if (req.file) {
      const { uploadToGridFS, deleteFromGridFS } = require('../services/gridfsService');
      const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
      if (buffer) {
        const fileInfo = await uploadToGridFS(buffer, req.file.originalname, req.file.mimetype);
        data.image = fileInfo.url;
        if (previousEvent.image && previousEvent.image.startsWith('/api/files/')) {
          deleteFromGridFS(previousEvent.image.replace('/api/files/', '')).catch(() => {});
        }
      }
    }
    const event = await Event.findByIdAndUpdate(req.params.id, data, { new: true });

    // Server-Side Hourly Event Reminder Hook
    const { onEventCreated: reevalEvent, onEventCancelledOrDeleted } = require('../services/hourlyEventReminderService');
    if (event.status === 'cancelled' || event.isCancelled === true) {
      onEventCancelledOrDeleted(event._id).catch(err => {
        console.error('[EventController] Error cancelling event reminders:', err.message);
      });
    } else {
      reevalEvent(event).catch(err => {
        console.error('[EventController] Error updating event reminders:', err.message);
      });
    }

    // Multi-Channel Broadcast for Updated Event
    if (event && event.isPublished !== false) {
      const { broadcastEventPublished } = require('../services/broadcastNotificationService');
      broadcastEventPublished({ event, action: 'updated' }).catch(err => {
        console.error('[EventController] Error broadcasting updated event:', err.message);
      });
    }

    res.json({ success: true, event });
  } catch (err) {
    console.error('[EventController] Update error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    if (event.image && event.image.startsWith('/api/files/')) {
      const { deleteFromGridFS } = require('../services/gridfsService');
      deleteFromGridFS(event.image.replace('/api/files/', '')).catch(() => {});
    }

    // Immediately halt reminders and purge announcements BEFORE deleting the event
    const { onEventCancelledOrDeleted } = require('../services/hourlyEventReminderService');
    await onEventCancelledOrDeleted(req.params.id);

    await Event.findByIdAndDelete(req.params.id);

    // Multi-Channel Broadcast for Cancelled Event
    if (event.isPublished !== false) {
      const { broadcastEventPublished } = require('../services/broadcastNotificationService');
      broadcastEventPublished({ event, action: 'cancelled' }).catch(err => {
        console.error('[EventController] Error broadcasting cancelled event:', err.message);
      });
    }

    res.json({ success: true, message: 'Event deleted and cancellation broadcast dispatched' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const registerForEvent = async (req, res) => {
  try {
    const result = await registerUserForEvent({
      eventId: req.params.id,
      user: req.user,
      registrationData: req.body
    });
    res.status(201).json(result);
  } catch (err) {
    const status = err.statusCode || (err.code === 'ALREADY_REGISTERED' ? 409 : 500);
    res.status(status).json({
      success: false,
      code: err.code || 'REGISTRATION_FAILED',
      message: err.message
    });
  }
};

const withdrawRegistration = async (req, res) => {
  try {
    const result = await withdrawUserRegistration({
      eventId: req.params.id,
      userId: req.user._id
    });
    res.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      code: err.code || 'WITHDRAWAL_FAILED',
      message: err.message
    });
  }
};

module.exports = { getAll, getOne, create, update, remove, registerForEvent, withdrawRegistration };
