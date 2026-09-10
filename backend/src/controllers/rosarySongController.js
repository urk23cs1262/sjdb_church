const path = require('path');
const AdmZip = require('adm-zip');
const RosarySong = require('../models/RosarySong');
const SiteSettings = require('../models/SiteSettings');
const { uploadToGridFS, deleteFromGridFS, getGridFSFileDoc } = require('../services/gridfsService');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac', '.wma']);

const MIME_MAP = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.wma': 'audio/x-ms-wma'
};

function formatTitle(filename) {
  if (!filename) return 'Devotional Song';
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  // Replace underscores/hyphens with spaces and trim
  const clean = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean || filename;
}

/**
 * Helper to ensure a song has its genuine original filename and filesize from GridFS
 */
async function enrichSongDetails(song) {
  if (!song) return song;
  
  const isHexOrMissing = !song.fileName || /^[a-f\d]{24}$/i.test(song.fileName) || song.fileName === 'songsAudio';
  const isDefaultTitle = !song.title || song.title.includes('Tamil Devotional Hymn') || /^[a-f\d]{24}$/i.test(song.title);
  
  if (song.fileUrl && song.fileUrl.startsWith('/api/files/') && (isHexOrMissing || !song.fileSize || isDefaultTitle)) {
    const fileId = song.fileUrl.replace('/api/files/', '');
    try {
      const doc = await getGridFSFileDoc(fileId);
      if (doc) {
        const origName = doc.metadata?.originalName || doc.filename || 'Song.mp3';
        const newTitle = formatTitle(origName);
        const newSize = doc.length || song.fileSize || 0;
        
        await RosarySong.findByIdAndUpdate(song._id, {
          $set: {
            title: newTitle,
            fileName: origName,
            fileSize: newSize
          }
        });
        song.title = newTitle;
        song.fileName = origName;
        song.fileSize = newSize;
      }
    } catch (_) {}
  }
  return song;
}

/**
 * Public: Get active songs for users in Navbar Rosary modal (sorted from oldest to newest -> appended from end)
 */
const getActiveSongs = async (req, res) => {
  try {
    let songs = await RosarySong.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    // If no songs in collection, auto-sync from SiteSettings.songsAudio if uploaded
    if (songs.length === 0) {
      const setting = await SiteSettings.findOne({ key: 'songsAudio' }).lean();
      if (setting && setting.value) {
        let origName = 'Tamil Devotional Song.mp3';
        let fileSize = 0;
        
        if (setting.value.startsWith('/api/files/')) {
          const fileId = setting.value.replace('/api/files/', '');
          const doc = await getGridFSFileDoc(fileId);
          if (doc) {
            origName = doc.metadata?.originalName || doc.filename || origName;
            fileSize = doc.length || 0;
          }
        }

        const autoSong = await RosarySong.findOneAndUpdate(
          { fileUrl: setting.value },
          {
            title: formatTitle(origName),
            fileUrl: setting.value,
            fileName: origName,
            fileSize: fileSize,
            sortOrder: 1,
            isActive: true
          },
          { upsert: true, new: true }
        ).lean();
        songs = [autoSong];
      }
    } else {
      // Enrich any existing songs if needed
      songs = await Promise.all(songs.map(enrichSongDetails));
    }

    res.json({ success: true, songs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: Get all songs (sorted from oldest to newest -> appended from end)
 */
const getAllSongsAdmin = async (req, res) => {
  try {
    let songs = await RosarySong.find()
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    if (songs.length === 0) {
      const setting = await SiteSettings.findOne({ key: 'songsAudio' }).lean();
      if (setting && setting.value) {
        let origName = 'Tamil Devotional Song.mp3';
        let fileSize = 0;
        
        if (setting.value.startsWith('/api/files/')) {
          const fileId = setting.value.replace('/api/files/', '');
          const doc = await getGridFSFileDoc(fileId);
          if (doc) {
            origName = doc.metadata?.originalName || doc.filename || origName;
            fileSize = doc.length || 0;
          }
        }

        const autoSong = await RosarySong.findOneAndUpdate(
          { fileUrl: setting.value },
          {
            title: formatTitle(origName),
            fileUrl: setting.value,
            fileName: origName,
            fileSize: fileSize,
            sortOrder: 1,
            isActive: true
          },
          { upsert: true, new: true }
        ).lean();
        songs = [autoSong];
      }
    } else {
      songs = await Promise.all(songs.map(enrichSongDetails));
    }

    res.json({ success: true, songs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: Upload individual audio files (appended to the end of the list)
 */
const uploadIndividualSongs = async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No audio files provided' });
    }

    const lastSong = await RosarySong.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    let nextSortOrder = lastSong ? (lastSong.sortOrder || 0) + 1 : 1;

    const createdSongs = [];

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const mimeType = file.mimetype || MIME_MAP[ext] || 'audio/mpeg';

      const fileInfo = await uploadToGridFS(file.buffer, file.originalname, mimeType);

      const song = await RosarySong.create({
        title: formatTitle(file.originalname),
        fileUrl: fileInfo.url,
        fileName: file.originalname,
        fileSize: file.size || file.buffer.length,
        mimeType,
        sortOrder: nextSortOrder++,
        isActive: true
      });

      createdSongs.push(song);
    }

    res.json({
      success: true,
      message: `Successfully uploaded ${createdSongs.length} song(s)`,
      songs: createdSongs
    });
  } catch (err) {
    console.error('Upload individual songs error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: Upload ZIP archive containing songs (appended to the end of the list)
 */
const uploadZipSongs = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please select a ZIP file' });
    }

    let zip;
    try {
      zip = new AdmZip(req.file.buffer);
    } catch (zipErr) {
      return res.status(400).json({ success: false, message: 'Invalid ZIP archive file' });
    }

    const lastSong = await RosarySong.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    let nextSortOrder = lastSong ? (lastSong.sortOrder || 0) + 1 : 1;

    const zipEntries = zip.getEntries();
    const createdSongs = [];
    let skippedCount = 0;

    for (const entry of zipEntries) {
      // Ignore directories or hidden OS files (__MACOSX, .DS_Store)
      if (entry.isDirectory || entry.entryName.startsWith('__MACOSX') || entry.name.startsWith('.')) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!AUDIO_EXTENSIONS.has(ext)) {
        skippedCount++;
        continue;
      }

      const fileBuffer = entry.getData();
      if (!fileBuffer || fileBuffer.length === 0) {
        continue;
      }

      const mimeType = MIME_MAP[ext] || 'audio/mpeg';
      const fileInfo = await uploadToGridFS(fileBuffer, entry.name, mimeType);

      const song = await RosarySong.create({
        title: formatTitle(entry.name),
        fileUrl: fileInfo.url,
        fileName: entry.name,
        fileSize: fileBuffer.length,
        mimeType,
        sortOrder: nextSortOrder++,
        isActive: true
      });

      createdSongs.push(song);
    }

    if (createdSongs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid audio files (.mp3, .wav, .m4a, .ogg) found in the ZIP archive'
      });
    }

    res.json({
      success: true,
      message: `Extracted & uploaded ${createdSongs.length} song(s) from ZIP${skippedCount > 0 ? ` (${skippedCount} non-audio files skipped)` : ''}`,
      songs: createdSongs
    });
  } catch (err) {
    console.error('Upload ZIP error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: Toggle single song isActive status
 */
const toggleSongStatus = async (req, res) => {
  try {
    const song = await RosarySong.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ success: false, message: 'Song not found' });
    }

    song.isActive = !song.isActive;
    await song.save();

    res.json({ success: true, song, message: `Song is now ${song.isActive ? 'Active' : 'Inactive'}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: Update single song details (title, isActive, sortOrder)
 */
const updateSong = async (req, res) => {
  try {
    const { title, isActive, sortOrder } = req.body;
    const song = await RosarySong.findByIdAndUpdate(
      req.params.id,
      { $set: { ...(title && { title }), ...(typeof isActive === 'boolean' && { isActive }), ...(typeof sortOrder === 'number' && { sortOrder }) } },
      { new: true }
    );
    if (!song) {
      return res.status(404).json({ success: false, message: 'Song not found' });
    }
    res.json({ success: true, song, message: 'Song updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: Bulk update song statuses
 */
const bulkUpdateStatus = async (req, res) => {
  try {
    const { updates } = req.body; // Array of { id, isActive }
    if (!Array.isArray(updates)) {
      return res.status(400).json({ success: false, message: 'Invalid updates payload' });
    }

    const ops = updates.map(u => ({
      updateOne: {
        filter: { _id: u.id },
        update: { $set: { isActive: Boolean(u.isActive) } }
      }
    }));

    await RosarySong.bulkWrite(ops);
    res.json({ success: true, message: 'Updated songs availability' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: Delete song and clean up GridFS
 */
const deleteSong = async (req, res) => {
  try {
    const song = await RosarySong.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ success: false, message: 'Song not found' });
    }

    if (song.fileUrl && song.fileUrl.startsWith('/api/files/')) {
      const fileId = song.fileUrl.replace('/api/files/', '');
      try {
        await deleteFromGridFS(fileId);
      } catch (_) {}
    }

    await RosarySong.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Song deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: Reorder songs
 */
const reorderSongs = async (req, res) => {
  try {
    const { songIds, order } = req.body;
    let ops = [];

    if (Array.isArray(songIds)) {
      ops = songIds.map((id, index) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { sortOrder: index + 1 } }
        }
      }));
    } else if (Array.isArray(order)) {
      ops = order.map(item => ({
        updateOne: {
          filter: { _id: item.id },
          update: { $set: { sortOrder: item.sortOrder } }
        }
      }));
    } else {
      return res.status(400).json({ success: false, message: 'Invalid reorder payload' });
    }

    if (ops.length > 0) {
      await RosarySong.bulkWrite(ops);
    }

    res.json({ success: true, message: 'Songs reordered successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getActiveSongs,
  getAllSongsAdmin,
  uploadIndividualSongs,
  uploadZipSongs,
  toggleSongStatus,
  updateSong,
  bulkUpdateStatus,
  reorderSongs,
  deleteSong
};
