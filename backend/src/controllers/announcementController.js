const fs = require('fs');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendSMS } = require('../config/twilio');
const { createNotification } = require('../services/notificationService');
function sendWA(phone, text) {
  const { sendWhatsAppNotification } = require('../services/whatsAppNotificationService');
  return sendWhatsAppNotification(phone, text).catch(() => { });
}

let lastBroadcastSync = 0;

const getAll = async (req, res) => {
  try {
    const now = new Date();

    // 1. Permanently purge crossed event announcements
    try {
      const { cleanupCrossedEventAnnouncements } = require('../services/hourlyEventReminderService');
      await cleanupCrossedEventAnnouncements();
    } catch (cleanupErr) {
      console.warn('[AnnouncementController] Event auto-cleanup error:', cleanupErr.message);
    }

    // 2. Automatically mark passed announcements as EXPIRED (halts reminders, deletes broadcasts)
    try {
      const { cleanupExpiredAnnouncements } = require('../services/hourlyAnnouncementReminderService');
      await cleanupExpiredAnnouncements();
    } catch (cleanupErr) {
      console.warn('[AnnouncementController] Announcement expiry cleanup error:', cleanupErr.message);
    }

    const { type, page = 1, limit = 20, search } = req.query;
    const query = {};

    // Both Public and Admin announcement pages only return active, published, non-expired announcements!
    // Expired announcements automatically disappear from both pages immediately upon expiration.
    query.isPublished = true;
    query.status = { $nin: ['expired', 'deleted', 'unpublished'] };
    query.$or = [
      { expiresAt: { $gt: now } },
      { expiresAt: null },
      { expiresAt: { $exists: false } }
    ];

    if (type && type !== 'all') query.type = type;
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } }
        ]
      });
    }

    const total = await Announcement.countDocuments(query);
    let announcements = await Announcement.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).lean();

    // Auto-sync broadcast notifications throttled to at most once per 60 seconds
    const nowMs = Date.now();
    if (nowMs - lastBroadcastSync > 60000) {
      lastBroadcastSync = nowMs;
      try {
        const broadcastNotifs = await Notification.find({
          isBroadcast: true,
          $or: [{ category: 'announcements' }, { type: 'announcement' }]
        }).sort({ createdAt: -1 }).limit(10).lean();

        for (const notif of broadcastNotifs) {
          const exists = announcements.some(a => a.title === notif.title || (notif.relatedId && String(a._id) === String(notif.relatedId)));
          if (!exists) {
            const created = await Announcement.create({
              title: notif.title,
              content: notif.message,
              priority: notif.priority === 'high' ? 'urgent' : 'medium',
              type: 'general',
              sourceType: 'announcement',
              status: 'published',
              isPublished: true,
              createdAt: notif.createdAt
            }).catch(() => null);
            if (created) announcements.unshift(created.toObject ? created.toObject() : created);
          }
        }
      } catch { /* silent */ }
    }

    res.json({ success: true, total, announcements });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const create = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.user) data.publishedBy = req.user._id;

    if (!data.sourceType) data.sourceType = 'announcement';
    if (!data.type) data.type = 'general';
    if (!data.priority) data.priority = 'medium';
    if (data.expiresAt === '' || data.expiresAt === 'null' || !data.expiresAt) {
      delete data.expiresAt;
    } else {
      const d = new Date(data.expiresAt);
      if (!isNaN(d.getTime())) {
        data.expiresAt = d;
      }
    }
    if (typeof data.isPublished === 'string') {
      data.isPublished = data.isPublished === 'true';
    } else if (data.isPublished === undefined) {
      data.isPublished = true;
    }

    data.status = data.isPublished ? 'published' : 'unpublished';
    data.reminderStatus = data.isPublished ? 'active' : 'idle';
    if (!data.eventLink) data.eventLink = '/announcements';

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

    // Single Notification Pipeline: Hourly reminder scheduling & multi-channel broadcast with deduplication
    if (ann.isPublished !== false) {
      const { onAnnouncementCreated } = require('../services/hourlyAnnouncementReminderService');
      onAnnouncementCreated(ann).catch(err => {
        console.error('[AnnouncementController] Error initializing announcement notification pipeline:', err.message);
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

    if (data.isPublished === false || data.status === 'unpublished') {
      data.status = 'unpublished';
      data.reminderStatus = 'cancelled';
    } else if (data.status === 'expired') {
      data.isPublished = false;
      data.reminderStatus = 'expired';
    } else if (data.isPublished === true) {
      data.status = 'published';
    }

    const previousAnn = await Announcement.findById(req.params.id);
    if (!previousAnn) return res.status(404).json({ success: false, message: 'Announcement not found' });

    if (req.body.removeImage === 'true') {
      data.attachment = '';
      data.image = '';
      const { deleteFromGridFS } = require('../services/gridfsService');
      if (previousAnn.image && previousAnn.image.startsWith('/api/files/')) {
        deleteFromGridFS(previousAnn.image.replace('/api/files/', '')).catch(() => {});
      }
      if (previousAnn.attachment && previousAnn.attachment.startsWith('/api/files/')) {
        deleteFromGridFS(previousAnn.attachment.replace('/api/files/', '')).catch(() => {});
      }
    } else if (req.file) {
      const { uploadToGridFS, deleteFromGridFS } = require('../services/gridfsService');
      const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
      if (buffer) {
        const fileInfo = await uploadToGridFS(buffer, req.file.originalname, req.file.mimetype);
        data.attachment = fileInfo.url;
        data.image = fileInfo.url;
        if (previousAnn.image && previousAnn.image.startsWith('/api/files/')) {
          deleteFromGridFS(previousAnn.image.replace('/api/files/', '')).catch(() => {});
        }
      }
    }
    const ann = await Announcement.findByIdAndUpdate(req.params.id, data, { new: true });

    // Server-Side Hourly Announcement Reminder Hook
    const { onAnnouncementCreated, onAnnouncementCancelledOrExpired } = require('../services/hourlyAnnouncementReminderService');
    if (ann.status === 'unpublished' || ann.status === 'expired' || ann.isPublished === false) {
      onAnnouncementCancelledOrExpired(ann._id, { reason: ann.status }).catch(err => {
        console.error('[AnnouncementController] Error cancelling reminders:', err.message);
      });
    } else {
      onAnnouncementCreated(ann).catch(err => {
        console.error('[AnnouncementController] Error updating announcement reminders:', err.message);
      });
    }

    // Multi-Channel Broadcast for Updated Announcement
    if (ann && ann.isPublished !== false && ann.status === 'published') {
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
    const ann = await Announcement.findById(annId);

    if (ann) {
      // Stop all future reminders immediately and clear notification broadcasts
      const { onAnnouncementCancelledOrExpired } = require('../services/hourlyAnnouncementReminderService');
      await onAnnouncementCancelledOrExpired(annId, { reason: 'deleted' });

      const { deleteFromGridFS } = require('../services/gridfsService');
      if (ann.image && ann.image.startsWith('/api/files/')) {
        deleteFromGridFS(ann.image.replace('/api/files/', '')).catch(() => {});
      }
      if (ann.attachment && ann.attachment.startsWith('/api/files/')) {
        deleteFromGridFS(ann.attachment.replace('/api/files/', '')).catch(() => {});
      }

      await Announcement.findByIdAndDelete(annId);

      // Clean up linked notifications in Notification collection
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
