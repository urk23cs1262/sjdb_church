const SiteSettings = require('../models/SiteSettings');
const { uploadToGridFS, deleteFromGridFS } = require('../services/gridfsService');

// In-memory cache for ultra-fast response
let cachedMap = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1 min cache

// GET all settings (public - needed by frontend widgets)
const getSettings = async (req, res) => {
  try {
    const now = Date.now();
    if (cachedMap && (now - cacheTime < CACHE_TTL)) {
      return res.json({ success: true, settings: cachedMap });
    }

    const settings = await SiteSettings.find().lean();
    const map = { videoAdId: 'wQ49o-0L1Gk' };
    settings.forEach(s => { map[s.key] = s.value; });
    cachedMap = map;
    cacheTime = now;
    res.json({ success: true, settings: map });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET single setting by key (public)
const getSetting = async (req, res) => {
  try {
    const setting = await SiteSettings.findOne({ key: req.params.key }).lean();
    let value = setting?.value || null;
    if (!value && req.params.key === 'videoAdId') {
      value = 'wQ49o-0L1Gk';
    }
    res.json({ success: true, value });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPSERT a text setting (admin only)
const updateTextSetting = async (req, res) => {
  try {
    const { key, value, label } = req.body;
    if (!key || !value) return res.status(400).json({ success: false, message: 'key and value required' });
    const setting = await SiteSettings.findOneAndUpdate(
      { key },
      { key, value, label: label || key, type: 'text' },
      { upsert: true, new: true }
    );
    cachedMap = null; // Invalidate cache immediately
    res.json({ success: true, setting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPLOAD a file setting (admin only) - Supports GridFS & Disk Storage
const uploadFileSetting = async (req, res) => {
  try {
    const { key, label } = req.body;
    if (!key) return res.status(400).json({ success: false, message: 'key required' });
    if (!req.file) return res.status(400).json({ success: false, message: 'file required' });

    let filePath;
    if (req.file.buffer) {
      // Store reliably in MongoDB GridFS
      const fileInfo = await uploadToGridFS(req.file.buffer, req.file.originalname, req.file.mimetype);
      filePath = fileInfo.url;
    } else if (req.file.filename) {
      filePath = `/uploads/settings/${req.file.filename}`;
    } else {
      return res.status(400).json({ success: false, message: 'Could not process uploaded file' });
    }

    // Delete prior GridFS file if it existed
    const priorSetting = await SiteSettings.findOne({ key }).lean();
    if (priorSetting && priorSetting.value && priorSetting.value.startsWith('/api/files/')) {
      const priorId = priorSetting.value.replace('/api/files/', '');
      try { await deleteFromGridFS(priorId); } catch (_) {}
    }

    const setting = await SiteSettings.findOneAndUpdate(
      { key },
      { key, value: filePath, label: label || key, type: 'file' },
      { upsert: true, new: true }
    );
    cachedMap = null; // Invalidate cache immediately
    res.json({ success: true, setting, filePath });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE / REMOVE a setting (admin only)
const deleteSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const priorSetting = await SiteSettings.findOne({ key }).lean();
    if (priorSetting && priorSetting.value && priorSetting.value.startsWith('/api/files/')) {
      const priorId = priorSetting.value.replace('/api/files/', '');
      try { await deleteFromGridFS(priorId); } catch (_) {}
    }

    await SiteSettings.findOneAndDelete({ key });
    cachedMap = null; // Invalidate cache immediately
    res.json({ success: true, message: 'Setting removed and reverted to default' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getSettings, getSetting, updateTextSetting, uploadFileSetting, deleteSetting };
