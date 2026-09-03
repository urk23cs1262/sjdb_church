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

    // Notify all users in background
    if (ann.isPublished !== false) {
      const publicUrl = 'https://stjb-church.vercel.app';
      const { formatAnnouncementWhatsApp, broadcastAnnouncementCreated } = require('../services/whatsappBroadcastHelper');
      
      const msg = formatAnnouncementWhatsApp(ann);
      broadcastAnnouncementCreated(ann).catch(err => console.error("Error auto-broadcasting announcement to WhatsApp:", err));

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
        title: `📢 ${ann.title}`,
        message: ann.content ? (ann.content.length > 150 ? ann.content.slice(0, 150) + '...' : ann.content) : 'A new announcement from the church.',
        type: 'announcement',
        category: 'announcements',
        priority: 'medium',
        actionUrl: '/announcements',
        relatedId: ann._id,
        relatedModel: 'Announcement',
        channels: []
      }).catch(e => console.error('Announcement broadcast notification error:', e.message));

      // Admin confirmation in-app
      createNotification({
        recipient: 'admin',
        title: `📢 Announcement Published: ${ann.title}`,
        message: `The announcement "${ann.title}" has been published successfully.`,
        type: 'announcement',
        category: 'announcements',
        priority: 'low',
        actionUrl: '/admin/announcements',
        relatedId: ann._id,
        relatedModel: 'Announcement',
        channels: []
      }).catch(e => console.error('Announcement admin notification error:', e.message));
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

    // Notify all users about Updated Announcement in background
    if (ann && ann.isPublished !== false) {
      const { formatAnnouncementWhatsApp } = require('../services/whatsappBroadcastHelper');
      const msg = formatAnnouncementWhatsApp(ann);

      User.find({ isVerified: true }).then(users => {
        users.forEach(user => {
          if (user.phone) {
            sendSMS(user.phone, msg).catch(() => { });
            sendWA(user.phone, msg);
          }
        });
      }).catch(err => console.error("Error notifying users on announcement update:", err));
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
