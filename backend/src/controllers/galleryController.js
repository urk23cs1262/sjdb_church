const Gallery = require('../models/Gallery');
const { createNotification } = require('../services/notificationService');

const getAll = async (req, res) => {
  try {
    const { category, album, admin, page = 1, limit = 100 } = req.query;
    const query = {};
    if (admin !== 'true') {
      query.isPublished = true;
    }
    if (category && category !== 'all') {
      query.category = category.toLowerCase();
    }
    if (album) {
      query.album = album;
    }
    const total = await Gallery.countDocuments(query);
    const items = await Gallery.find(query).sort({ createdAt: -1 }).skip((page - 1) * Number(limit)).limit(Number(limit));
    res.json({ success: true, total, items });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const create = async (req, res) => {
  try {
    const data = { ...req.body, uploadedBy: req.user?._id };
    if (req.file) {
      const { uploadToGridFS } = require('../services/gridfsService');
      const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
      if (buffer) {
        const fileInfo = await uploadToGridFS(buffer, req.file.originalname, req.file.mimetype);
        data.imageUrl = fileInfo.url;
      }
    }
    if (!data.imageUrl && !req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image for the gallery item' });
    }
    if (!data.category) {
      data.category = 'other';
    }
    const item = await Gallery.create(data);

    // Send broadcast notification to all users
    createNotification({
      isBroadcast: true,
      recipient: 'user',
      title: ` New Photos in Church Gallery`,
      message: `New photo "${item.title || 'Parish Memories'}" has been added to our church gallery.`,
      type: 'general',
      category: 'general',
      actionUrl: '/gallery'
    }).catch(e => console.warn('Gallery notification error:', e.message));

    res.status(201).json({ success: true, item });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const update = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      const { uploadToGridFS } = require('../services/gridfsService');
      const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
      if (buffer) {
        const fileInfo = await uploadToGridFS(buffer, req.file.originalname, req.file.mimetype);
        data.imageUrl = fileInfo.url;
      }
    }
    const item = await Gallery.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json({ success: true, item });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const remove = async (req, res) => {
  try {
    await Gallery.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Gallery item deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const removeAll = async (req, res) => {
  try {
    const { category } = req.query;
    const query = {};
    if (category && category !== 'all') {
      query.category = category.toLowerCase();
    }
    const result = await Gallery.deleteMany(query);
    res.json({ success: true, message: `Deleted ${result.deletedCount} gallery items permanently`, count: result.deletedCount });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getAll, create, update, remove, removeAll };
