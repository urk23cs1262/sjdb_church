const Notification = require('../models/Notification');
const Announcement = require('../models/Announcement');

// ─── USER ───────────────────────────────────────────────────────────────────

// GET /api/notifications
// Fetch notifications for the current user (personal + broadcasts)
const getMyNotifications = async (req, res) => {
  try {
    const { category, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {
      recipient: { $in: ['user', 'both'] },
      $or: [{ userId: req.user._id }, { isBroadcast: true }]
    };
    if (category && category !== 'all') filter.category = category;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(filter)
    ]);

    res.json({ success: true, notifications, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/notifications/unread-count
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: { $in: ['user', 'both'] },
      $or: [{ userId: req.user._id }, { isBroadcast: true }],
      isRead: false
    });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/notifications/:id/read
const markRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/notifications/read-all
const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        $or: [{ userId: req.user._id }, { isBroadcast: true }],
        isRead: false
      },
      { isRead: true }
    );
    res.json({ success: true, message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/notifications/:id/pin
const togglePin = async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ success: false, message: 'Not found' });
    notif.isPinned = !notif.isPinned;
    await notif.save();
    res.json({ success: true, isPinned: notif.isPinned });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/notifications/:id
const deleteOne = async (req, res) => {
  try {
    const notif = await Notification.findByIdAndDelete(req.params.id);
    if (notif && (notif.relatedId || notif.title)) {
      if (notif.relatedId && notif.relatedModel === 'Announcement') {
        await Announcement.findByIdAndDelete(notif.relatedId).catch(() => {});
      } else if (notif.category === 'announcements' || notif.type === 'announcement') {
        const cleanTitle = notif.title ? notif.title.replace(/^\s*/, '').trim() : '';
        if (cleanTitle) {
          await Announcement.deleteMany({ title: new RegExp(cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).catch(() => {});
        }
      }
    }
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/notifications/delete-all
const deleteAll = async (req, res) => {
  try {
    await Notification.deleteMany({
      $or: [
        { userId: req.user._id },
        { isBroadcast: true },
        { recipient: { $in: ['user', 'both'] } }
      ]
    });
    res.json({ success: true, message: 'All user notifications permanently deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/notifications/admin/clear-all
const deleteAllAdmin = async (req, res) => {
  try {
    await Notification.deleteMany({
      recipient: { $in: ['admin', 'both'] }
    });
    res.json({ success: true, message: 'All admin notifications permanently deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ADMIN ──────────────────────────────────────────────────────────────────

// GET /api/notifications/admin
// Fetch only notifications targeted for admin panel
const getAdminNotifications = async (req, res) => {
  try {
    const { category, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {
      recipient: { $in: ['admin', 'both'] }
    };
    if (category && category !== 'all') {
      const isPerm = category === 'permission';
      if (isPerm) {
        filter.$or = [{ category: 'permission' }, { type: 'permission' }, { relatedModel: 'PermissionRequest' }];
      } else {
        filter.category = category;
      }
    }

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ isPinned: -1, priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('userId', 'name email phone'),
      Notification.countDocuments(filter)
    ]);

    res.json({ success: true, notifications, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/notifications/admin/unread-count
const getAdminUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: { $in: ['admin', 'both'] },
      isRead: false
    });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/notifications/admin/read-all
const markAllAdminRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: { $in: ['admin', 'both'] }, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true, message: 'All admin notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/notifications/broadcast
// Admin broadcast to all users
const broadcast = async (req, res) => {
  try {
    const { title, message, type, category, priority, actionUrl } = req.body;

    const selectedCategory = category || 'announcements';
    let targetActionUrl = actionUrl;
    let relatedId = null;
    let relatedModel = null;

    if (selectedCategory === 'announcements' || type === 'announcement') {
      try {
        const ann = await Announcement.create({
          title,
          content: message,
          priority: priority === 'high' ? 'urgent' : (priority || 'medium'),
          publishedBy: req.user._id,
          isPublished: true
        });
        targetActionUrl = '/announcements';
        relatedId = ann._id;
        relatedModel = 'Announcement';
      } catch (err) {
        console.warn('Error creating Announcement document during broadcast:', err.message);
      }
    } else if (selectedCategory === 'events' || type === 'event') {
      try {
        const Event = require('../models/Event');
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        const ev = await Event.create({
          title,
          description: message,
          date: futureDate,
          category: 'Spiritual',
          createdBy: req.user._id,
          isPublished: true
        });
        targetActionUrl = '/events';
        relatedId = ev._id;
        relatedModel = 'Event';
      } catch (err) {
        console.warn('Error creating Event document during broadcast:', err.message);
      }
    } else if (!targetActionUrl) {
      targetActionUrl = (
        selectedCategory === 'bookings' ? '/dashboard' :
        selectedCategory === 'documents' ? '/dashboard/documents' :
        selectedCategory === 'donations' ? '/donate' :
        selectedCategory === 'prayer' ? '/prayers' :
        '/dashboard'
      );
    }

    const notif = await Notification.create({
      isBroadcast: true,
      recipient: 'user',
      title,
      message,
      type: selectedCategory,
      category: selectedCategory,
      priority: priority || 'medium',
      actionUrl: targetActionUrl,
      relatedId,
      relatedModel
    });

    // Unified Push Broadcast
    const { sendPushBroadcast } = require('../services/webPushService');
    sendPushBroadcast({
      title: title || "St. John de Britto's Church",
      body: (message || '').replace(/\n+/g, ' ').slice(0, 140),
      notificationId: notif._id.toString(),
      url: `/notifications?notification=${notif._id.toString()}`,
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: `sjdb-notif-${notif._id.toString()}`
    }).catch(e => console.warn('[Broadcast] Push dispatch error:', e.message));

    res.status(201).json({ success: true, notification: notif });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/notifications/vapid-key
const getVapidKey = async (req, res) => {
  try {
    const { getVapidPublicKey } = require('../services/webPushService');
    res.json({ success: true, publicKey: getVapidPublicKey() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/notifications/subscribe-push
const subscribePush = async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, message: 'Subscription is required' });
    }

    const { saveSubscription } = require('../services/webPushService');
    const sub = await saveSubscription({
      userId: req.user?._id || null,
      subscription,
      userAgent: req.headers['user-agent']
    });

    res.json({ success: true, message: 'Push subscription saved successfully', sub });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  togglePin,
  deleteOne,
  deleteAll,
  deleteAllAdmin,
  getAdminNotifications,
  getAdminUnreadCount,
  markAllAdminRead,
  broadcast,
  getVapidKey,
  subscribePush
};
