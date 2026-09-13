const fs = require('fs');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendSMS } = require('../config/twilio');
const { createNotification } = require('../services/notificationService');
function sendWA(phone, text) {
  return require('../bot/whatsapp').sendWhatsAppMessage(phone, text).catch(() => { });
}

const getAll = async (req, res) => {
  try {
    const { type, page = 1, limit = 20, admin, all } = req.query;
    const query = {};
    const isAdmin = admin === 'true' || all === 'true';

    if (!isAdmin) {
      query.isPublished = true;
      const now = new Date();
      query.$or = [{ expiresAt: { $gt: now } }, { expiresAt: null }, { expiresAt: { $exists: false } }];
    }
    if (type) query.type = type;

    const total = await Announcement.countDocuments(query);
    let announcements = await Announcement.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));

    // Auto-sync broadcast notifications of category 'announcements' into Announcement collection
    try {
      const broadcastNotifs = await Notification.find({
        isBroadcast: true,
        $or: [{ category: 'announcements' }, { type: 'announcement' }]
      }).sort({ createdAt: -1 });

      for (const notif of broadcastNotifs) {
        const exists = announcements.some(a => a.title === notif.title || (notif.relatedId && String(a._id) === String(notif.relatedId)));
        if (!exists) {
          const created = await Announcement.create({
            title: notif.title,
            content: notif.message,
            priority: notif.priority === 'high' ? 'urgent' : 'medium',
            type: 'general',
            isPublished: true,
            createdAt: notif.createdAt
          }).catch(() => null);
          if (created) announcements.unshift(created);
        }
      }
    } catch { /* silent */ }

    res.json({ success: true, total, announcements });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const create = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.user) data.publishedBy = req.user._id;

    if (!data.type) data.type = 'general';
    if (!data.priority) data.priority = 'medium';
    if (data.expiresAt === '' || data.expiresAt === 'null' || !data.expiresAt) {
      delete data.expiresAt;
    }
    if (typeof data.isPublished === 'string') {
      data.isPublished = data.isPublished === 'true';
    } else if (data.isPublished === undefined) {
      data.isPublished = true;
    }

    if (req.file) {
      const { uploadToGridFS } = require('../services/gridfsService');
      const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
      if (buffer) {
        const fileInfo = await uploadToGridFS(buffer, req.file.originalname, req.file.mimetype);
        data.attachment = fileInfo.url;
        data.image = fileInfo.url;
      }
    }
    const ann = await Announcement.create(data);

    // Multi-Channel Broadcast across WhatsApp, Email, In-App, and Push
    if (ann.isPublished !== false) {
      const { broadcastAnnouncementPublished } = require('../services/broadcastNotificationService');
      broadcastAnnouncementPublished({ announcement: ann, action: 'created' }).catch(err => {
        console.error('[AnnouncementController] Error broadcasting new announcement:', err.message);
      });
    }

    res.status(201).json({ success: true, announcement: ann });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const update = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.expiresAt === '' || data.expiresAt === 'null' || !data.expiresAt) {
      data.expiresAt = null;
    }
    if (typeof data.isPublished === 'string') {
      data.isPublished = data.isPublished === 'true';
    }

    if (req.body.removeImage === 'true') {
      data.attachment = '';
      data.image = '';
    } else if (req.file) {
      const { uploadToGridFS } = require('../services/gridfsService');
      const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
      if (buffer) {
        const fileInfo = await uploadToGridFS(buffer, req.file.originalname, req.file.mimetype);
        data.attachment = fileInfo.url;
        data.image = fileInfo.url;
      }
    }
    const ann = await Announcement.findByIdAndUpdate(req.params.id, data, { new: true });

    // Multi-Channel Broadcast for Updated Announcement
    if (ann && ann.isPublished !== false) {
      const { broadcastAnnouncementPublished } = require('../services/broadcastNotificationService');
      broadcastAnnouncementPublished({ announcement: ann, action: 'updated' }).catch(err => {
        console.error('[AnnouncementController] Error broadcasting updated announcement:', err.message);
      });
    }

    res.json({ success: true, announcement: ann });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};


const remove = async (req, res) => {
  try {
    const annId = req.params.id;
    const ann = await Announcement.findByIdAndDelete(annId);

    // Clean up linked notifications in Notification collection
    if (ann) {
      const titleClean = ann.title ? ann.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
      const filter = {
        $or: [
          { relatedId: annId },
          { relatedModel: 'Announcement' }
        ]
      };
      if (titleClean) {
        filter.$or.push({ title: new RegExp(titleClean, 'i') });
      }
      await Notification.deleteMany(filter).catch(() => { });
    } else {
      await Notification.deleteMany({ relatedId: annId }).catch(() => { });
    }

    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getAll, create, update, remove };
