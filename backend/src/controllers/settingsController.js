const SiteSettings = require('../models/SiteSettings');
const { uploadToGridFS, deleteFromGridFS } = require('../services/gridfsService');
const {
  getChurchEmail,
  getChurchPhone,
  getParishOfficePhone,
  getWhatsAppBotNumber,
  getWhatsAppChannelUrl,
  getWhatsAppChannelJid
} = require('../config/contactConfig');

// In-memory cache for ultra-fast response
let cachedMap = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1 min cache

// GET all settings (public - needed by frontend widgets)
const getSettings = async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    const now = Date.now();
    if (cachedMap && (now - cacheTime < CACHE_TTL)) {
      return res.json({ success: true, settings: cachedMap });
    }

    const settings = await SiteSettings.find().lean();
    const map = {
      videoAdId: 'wQ49o-0L1Gk',
      donationUpiId: process.env.DONATION_UPI_ID || '112520120',
      whatsappBotPhoneNumber: getWhatsAppBotNumber(),
      whatsappChannelUrl: getWhatsAppChannelUrl(),
      whatsappChannelJid: getWhatsAppChannelJid(),
      churchEmail: getChurchEmail(),
      contactEmail: getChurchEmail(),
      churchPhone: getChurchPhone(),
      contactPhone: getChurchPhone(),
      parishOfficePhone: getParishOfficePhone(),
      merchantName: process.env.MERCHANT_NAME || "St. John de Britto Church"
    };
    settings.forEach(s => { map[s.key] = s.value; });
    if (map.whatsapp_channel_url && !map.whatsappChannelUrl) map.whatsappChannelUrl = map.whatsapp_channel_url;
    if (map.whatsapp_channel_jid && !map.whatsappChannelJid) map.whatsappChannelJid = map.whatsapp_channel_jid;
    if (map.contact_email && !map.churchEmail) map.churchEmail = map.contact_email;
    if (map.contact_phone && !map.churchPhone) map.churchPhone = map.contact_phone;
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
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    const setting = await SiteSettings.findOne({ key: req.params.key }).lean();
    let value = setting?.value || null;
    if (!value) {
      if (req.params.key === 'videoAdId') value = 'wQ49o-0L1Gk';
      else if (req.params.key === 'donationUpiId' || req.params.key === 'donation_upi_id') value = process.env.DONATION_UPI_ID || '112520120';
      else if (req.params.key === 'whatsappBotPhoneNumber' || req.params.key === 'whatsapp_bot_phone_number') value = getWhatsAppBotNumber();
      else if (req.params.key === 'churchEmail' || req.params.key === 'contactEmail') value = getChurchEmail();
      else if (req.params.key === 'churchPhone' || req.params.key === 'contactPhone') value = getChurchPhone();
      else if (req.params.key === 'parishOfficePhone') value = getParishOfficePhone();
      else if (req.params.key === 'merchantName' || req.params.key === 'merchant_name') value = process.env.MERCHANT_NAME || "St. John de Britto Church";
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
      try { await deleteFromGridFS(priorId); } catch (_) { }
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
      try { await deleteFromGridFS(priorId); } catch (_) { }
    }

    await SiteSettings.findOneAndDelete({ key });
    cachedMap = null; // Invalidate cache immediately
    res.json({ success: true, message: 'Setting removed and reverted to default' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getSettings, getSetting, updateTextSetting, uploadFileSetting, deleteSetting };
