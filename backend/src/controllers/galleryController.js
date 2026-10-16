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
    const { uploadToGridFS } = require('../services/gridfsService');
    const data = { ...req.body, uploadedBy: req.user?._id };

    // Sanitize category
    const validCategories = ['church', 'feast', 'events', 'priests', 'community', 'other'];
    if (!data.category || !validCategories.includes(data.category.toLowerCase())) {
      data.category = 'other';
    } else {
      data.category = data.category.toLowerCase();
    }

    // Sanitize boolean
    if (typeof data.isPublished === 'string') {
      data.isPublished = data.isPublished === 'true';
    } else if (data.isPublished === undefined) {
      data.isPublished = true;
    }

    // Collect all uploaded files from req.files or req.file without field duplicates
    const files = [];
    if (req.files) {
      if (Array.isArray(req.files)) {
        const hasImagesField = req.files.some(f => f.fieldname === 'images' || f.fieldname === 'images[]');
        if (hasImagesField) {
          files.push(...req.files.filter(f => f.fieldname === 'images' || f.fieldname === 'images[]'));
        } else {
          files.push(...req.files);
        }
      } else {
        Object.values(req.files).forEach(f => {
          if (Array.isArray(f)) files.push(...f);
          else if (f) files.push(f);
        });
      }
    }
    if (req.file && files.length === 0) {
      files.push(req.file);
    }

    if (files.length === 0 && !data.imageUrl) {
      return res.status(400).json({ success: false, message: 'Please upload at least one image for the gallery' });
    }

    const baseTitle = data.title?.trim() || 'Church Gallery Photo';
    const uploadedUrls = [];

    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const buffer = file.buffer || (file.path ? fs.readFileSync(file.path) : null);
        if (!buffer) continue;

        const fileInfo = await uploadToGridFS(buffer, file.originalname, file.mimetype);
        if (fileInfo?.url) {
          uploadedUrls.push(fileInfo.url);
        }
      }
    } else if (data.imageUrl) {
      uploadedUrls.push(data.imageUrl);
    }

    if (uploadedUrls.length === 0) {
      return res.status(400).json({ success: false, message: 'Failed to process uploaded images' });
    }

    const item = await Gallery.create({
      ...data,
      title: baseTitle,
      imageUrl: uploadedUrls[0],
      images: uploadedUrls,
      album: data.album?.trim() || undefined
    });

    // Send broadcast notification to all users
    const albumOrTitle = data.album || baseTitle || 'Parish Memories';
    const notifMsg = uploadedUrls.length > 1
      ? `${uploadedUrls.length} new photos have been added to "${albumOrTitle}" in our church gallery.`
      : `New photo "${baseTitle}" has been added to our church gallery.`;

    createNotification({
      isBroadcast: true,
      recipient: 'user',
      title: `📸 New Photos in Church Gallery`,
      message: notifMsg,
      type: 'general',
      category: 'general',
      actionUrl: '/gallery'
    }).catch(e => console.warn('Gallery notification error:', e.message));

    res.status(201).json({
      success: true,
      count: uploadedUrls.length,
      items: [item],
      item: item
    });
  } catch (err) {
    console.error('[GalleryController] Create error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const { uploadToGridFS, deleteFromGridFS } = require('../services/gridfsService');
    const previous = await Gallery.findById(req.params.id);
    if (!previous) return res.status(404).json({ success: false, message: 'Gallery item not found' });

    const data = { ...req.body };

    // 1. Process remaining existing images
    let remainingExisting = [];
    if (data.existingImages !== undefined) {
      if (typeof data.existingImages === 'string') {
        try {
          const parsed = JSON.parse(data.existingImages);
          remainingExisting = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          remainingExisting = data.existingImages ? [data.existingImages] : [];
        }
      } else if (Array.isArray(data.existingImages)) {
        remainingExisting = data.existingImages;
      }
    } else {
      remainingExisting = (previous.images && previous.images.length > 0)
        ? previous.images
        : (previous.imageUrl ? [previous.imageUrl] : []);
    }

    // 2. Identify deleted images and clean up GridFS
    const previousAll = [...(previous.images || []), previous.imageUrl].filter(Boolean);
    const toDelete = previousAll.filter(url => !remainingExisting.includes(url));
    for (const delUrl of toDelete) {
      if (delUrl && delUrl.startsWith('/api/files/')) {
        deleteFromGridFS(delUrl.replace('/api/files/', '')).catch(() => {});
      }
    }

    // 3. Upload any newly added files
    const newlyUploadedUrls = [];
    let files = [];
    if (req.files) {
      if (Array.isArray(req.files)) {
        const hasImagesField = req.files.some(f => f.fieldname === 'images' || f.fieldname === 'images[]');
        if (hasImagesField) {
          files = req.files.filter(f => f.fieldname === 'images' || f.fieldname === 'images[]');
        } else {
          files = req.files;
        }
      } else {
        files = Object.values(req.files).flat();
      }
    } else if (req.file) {
      files = [req.file];
    }

    if (files.length > 0) {
      for (const f of files) {
        const buffer = f.buffer || (f.path ? fs.readFileSync(f.path) : null);
        if (!buffer) continue;
        const fileInfo = await uploadToGridFS(buffer, f.originalname, f.mimetype);
        if (fileInfo?.url) newlyUploadedUrls.push(fileInfo.url);
      }
    }

    // 4. Combine remaining existing + new uploads
    const finalImages = [...remainingExisting, ...newlyUploadedUrls];

    if (finalImages.length === 0 && !data.imageUrl && data.removeImage !== 'true') {
      return res.status(400).json({ success: false, message: 'A gallery item must have at least one image' });
    }

    if (finalImages.length > 0) {
      data.images = finalImages;
      data.imageUrl = finalImages[0];
    } else if (data.removeImage === 'true') {
      data.images = [];
      data.imageUrl = '';
    }

    const item = await Gallery.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json({ success: true, item });
  } catch (err) {
    console.error('[GalleryController] Update error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const { deleteFromGridFS } = require('../services/gridfsService');
    const item = await Gallery.findById(req.params.id);
    if (item) {
      const allUrls = [...(item.images || []), item.imageUrl].filter(Boolean);
      for (const url of allUrls) {
        if (url && url.startsWith('/api/files/')) {
          deleteFromGridFS(url.replace('/api/files/', '')).catch(() => {});
        }
      }
    }
    await Gallery.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Gallery item deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const removeAll = async (req, res) => {
  try {
    const { deleteFromGridFS } = require('../services/gridfsService');
    const { category } = req.query;
    const query = {};
    if (category && category !== 'all') {
      query.category = category.toLowerCase();
    }
    const items = await Gallery.find(query).select('imageUrl images').lean();
    for (const it of items) {
      const allUrls = [...(it.images || []), it.imageUrl].filter(Boolean);
      for (const url of allUrls) {
        if (url && url.startsWith('/api/files/')) {
          deleteFromGridFS(url.replace('/api/files/', '')).catch(() => {});
        }
      }
    }
    const result = await Gallery.deleteMany(query);
    res.json({ success: true, message: `Deleted ${result.deletedCount} gallery items permanently`, count: result.deletedCount });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getAll, create, update, remove, removeAll };
