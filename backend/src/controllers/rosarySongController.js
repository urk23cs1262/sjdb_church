const path = require('path');
const fs = require('fs');
const os = require('os');
const AdmZip = require('adm-zip');
const RosarySong = require('../models/RosarySong');
const SiteSettings = require('../models/SiteSettings');
const { uploadToGridFS, uploadStreamToGridFS, deleteFromGridFS, getGridFSFileDoc } = require('../services/gridfsService');

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

/**
 * Concurrency runner for high-speed parallel file operations
 */
async function pMap(items, mapper, concurrency = 6) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const p = Promise.resolve().then(() => mapper(item));
    results.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

function formatTitle(filename) {
  if (!filename) return 'Devotional Song';
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  // Replace underscores/hyphens with spaces and trim
  const clean = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean || filename;
}

/**
 * Normalizes song name for robust duplicate detection:
 * - Strips audio extensions (.mp3, .wav, etc.)
 * - Lowercases
 * - Replaces hyphens/underscores with spaces
 * - Collapses multi-spaces into single space
 * - Trims whitespace
 */
function normalizeSongName(filenameOrTitle) {
  if (!filenameOrTitle) return '';
  let str = String(filenameOrTitle).trim();
  // Strip audio extension (handling any spaces before/after dot)
  str = str.replace(/\s*\.(mp3|wav|m4a|ogg|aac|flac|wma)\s*$/i, '');
  const ext = path.extname(str);
  if (ext && AUDIO_EXTENSIONS.has(ext.toLowerCase())) {
    str = path.basename(str, ext);
  }
  return str
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
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
 * Streams directly from temporary disk storage into GridFS (Zero-RAM accumulation)
 */
const uploadIndividualSongs = async (req, res) => {
  const tempFilesToClean = [];
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No audio files provided' });
    }

    const lastSong = await RosarySong.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    const baseSortOrder = lastSong ? (lastSong.sortOrder || 0) + 1 : 1;

    files.forEach(f => {
      if (f.path) tempFilesToClean.push(f.path);
    });

    // High-speed parallel upload to GridFS (6 concurrent streams)
    const songResults = await pMap(files.map((file, idx) => ({ file, idx })), async ({ file, idx }) => {
      try {
        const ext = path.extname(file.originalname).toLowerCase();
        const mimeType = file.mimetype || MIME_MAP[ext] || 'audio/mpeg';

        let fileInfo;
        let fileSize = 0;

        if (file.path && fs.existsSync(file.path)) {
          const stats = fs.statSync(file.path);
          fileSize = stats.size;
          const readStream = fs.createReadStream(file.path);
          fileInfo = await uploadStreamToGridFS(readStream, file.originalname, mimeType);
        } else if (file.buffer) {
          fileSize = file.size || file.buffer.length;
          fileInfo = await uploadToGridFS(file.buffer, file.originalname, mimeType);
        } else {
          return null;
        }

        const song = await RosarySong.create({
          title: formatTitle(file.originalname),
          fileUrl: fileInfo.url,
          fileName: file.originalname,
          fileSize: fileSize || fileInfo.size,
          mimeType,
          sortOrder: baseSortOrder + idx,
          isActive: true
        });

        return song;
      } catch (fileErr) {
        console.error(`Failed to upload song ${file?.originalname}:`, fileErr.message);
        return null;
      }
    }, 6);

    const createdSongs = songResults.filter(Boolean);

    res.json({
      success: true,
      message: `Successfully uploaded ${createdSongs.length} of ${files.length} song(s)`,
      songs: createdSongs
    });
  } catch (err) {
    console.error('Upload individual songs error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    for (const fPath of tempFilesToClean) {
      try {
        if (fs.existsSync(fPath)) fs.unlinkSync(fPath);
      } catch (_) {}
    }
  }
};

/**
 * Admin: Upload ZIP archive containing songs with Duplicate Detection
 * Flow:
 * 1. Multer streams ZIP straight to disk (0 MB in Node RAM)
 * 2. AdmZip reads catalog from disk
 * 3. Extract audio files to temporary staging folder
 * 4. Normalize song names and compare against existing DB songs & intra-ZIP songs
 * 5. If duplicates found:
 *    - Save session state to session.json in staging folder
 *    - Return duplicates list + sessionId to frontend (DO NOT import duplicates yet)
 * 6. If no duplicates:
 *    - Stream all files into GridFS and save records
 *    - Clean up staging folder immediately
 */
const uploadZipSongs = async (req, res) => {
  const sessionId = `zip_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
  const stagingDir = path.join(os.tmpdir(), `sjdb_staging_${sessionId}`);
  const tempFilesToClean = [];
  if (req.file?.path) tempFilesToClean.push(req.file.path);

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please select a ZIP file' });
    }

    let zip;
    try {
      if (req.file.path && fs.existsSync(req.file.path)) {
        zip = new AdmZip(req.file.path);
      } else if (req.file.buffer) {
        zip = new AdmZip(req.file.buffer);
      } else {
        return res.status(400).json({ success: false, message: 'Could not access uploaded ZIP file' });
      }
    } catch (zipErr) {
      return res.status(400).json({ success: false, message: 'Invalid ZIP archive file' });
    }

    if (!fs.existsSync(stagingDir)) {
      fs.mkdirSync(stagingDir, { recursive: true });
    }

    // Fetch existing songs from database for duplicate comparison
    const existingSongs = await RosarySong.find().lean();
    const existingMap = new Map();
    for (const s of existingSongs) {
      const nTitle = normalizeSongName(s.title);
      const nFile = normalizeSongName(s.fileName);
      if (nTitle) existingMap.set(nTitle, s);
      if (nFile) existingMap.set(nFile, s);
    }

    const zipEntries = zip.getEntries();
    const duplicates = [];
    const nonDuplicates = [];
    const seenInZip = new Map();
    let duplicateIndex = 1;
    let skippedCount = 0;

    for (const entry of zipEntries) {
      const normalizedEntryPath = (entry.entryName || '').replace(/\\/g, '/');
      const baseName = path.basename(normalizedEntryPath).trim();

      // Ignore directories or hidden OS files (__MACOSX, .DS_Store)
      if (entry.isDirectory || normalizedEntryPath.includes('__MACOSX') || baseName.startsWith('.') || !baseName) {
        continue;
      }

      const ext = path.extname(baseName).toLowerCase();
      if (!AUDIO_EXTENSIONS.has(ext)) {
        skippedCount++;
        continue;
      }

      const mimeType = MIME_MAP[ext] || 'audio/mpeg';

      // Extract entry safely via buffer into unique temporary file
      try {
        const entryData = entry.getData();
        if (!entryData || entryData.length === 0) continue;

        const safeTempName = `temp_${Date.now()}_${Math.round(Math.random() * 1e9)}_${baseName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const extractedFilePath = path.join(stagingDir, safeTempName);
        fs.writeFileSync(extractedFilePath, entryData);

        const fileSize = entryData.length;
        const normalized = normalizeSongName(baseName);

        // Check if duplicate of an existing song in DB
        if (existingMap.has(normalized)) {
          const existing = existingMap.get(normalized);
          duplicates.push({
            id: `dup_${duplicateIndex++}`,
            normalizedName: normalized,
            title: formatTitle(baseName),
            existingSong: {
              id: existing._id.toString(),
              title: existing.title || formatTitle(existing.fileName),
              fileName: existing.fileName || 'Audio.mp3',
              fileSize: existing.fileSize || 0,
              fileUrl: existing.fileUrl
            },
            uploadedSong: {
              tempFileName: safeTempName,
              fileName: baseName,
              title: formatTitle(baseName),
              fileSize: fileSize,
              mimeType: mimeType,
              previewUrl: `/api/rosary-songs/temp-preview/${sessionId}/${encodeURIComponent(safeTempName)}`
            }
          });
        } else if (seenInZip.has(normalized)) {
          // Intra-ZIP duplicate
          const firstOccur = seenInZip.get(normalized);
          duplicates.push({
            id: `dup_${duplicateIndex++}`,
            normalizedName: normalized,
            title: formatTitle(baseName),
            existingSong: {
              id: null,
              title: firstOccur.title,
              fileName: firstOccur.fileName,
              fileSize: firstOccur.fileSize,
              fileUrl: `/api/rosary-songs/temp-preview/${sessionId}/${encodeURIComponent(firstOccur.tempFileName)}`
            },
            uploadedSong: {
              tempFileName: safeTempName,
              fileName: baseName,
              title: formatTitle(baseName),
              fileSize: fileSize,
              mimeType: mimeType,
              previewUrl: `/api/rosary-songs/temp-preview/${sessionId}/${encodeURIComponent(safeTempName)}`
            }
          });
        } else {
          nonDuplicates.push({
            tempFileName: safeTempName,
            fileName: baseName,
            title: formatTitle(baseName),
            fileSize: fileSize,
            mimeType: mimeType
          });
          seenInZip.set(normalized, {
            tempFileName: safeTempName,
            fileName: baseName,
            title: formatTitle(baseName),
            fileSize: fileSize
          });
        }
      } catch (entryErr) {
        console.warn(`Error extracting entry ${baseName}:`, entryErr.message);
        continue;
      }
    }

    if (duplicates.length === 0 && nonDuplicates.length === 0) {
      try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch (_) {}
      return res.status(400).json({
        success: false,
        message: 'No valid audio files (.mp3, .wav, .m4a, .ogg) found in the ZIP archive'
      });
    }

    // IF DUPLICATES FOUND: Save session and return duplicate review payload without importing duplicates
    if (duplicates.length > 0) {
      fs.writeFileSync(
        path.join(stagingDir, 'session.json'),
        JSON.stringify({ sessionId, duplicates, nonDuplicates, createdAt: Date.now() })
      );

      return res.json({
        success: true,
        hasDuplicates: true,
        sessionId,
        duplicates,
        nonDuplicatesCount: nonDuplicates.length,
        totalAudioFound: duplicates.length + nonDuplicates.length,
        message: `${duplicates.length} duplicate song(s) found. Please review and choose which versions to keep.`
      });
    }

    // NO DUPLICATES FOUND: High-speed parallel import into GridFS (6 concurrent streams)
    const lastSong = await RosarySong.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    const baseSortOrder = lastSong ? (lastSong.sortOrder || 0) + 1 : 1;

    const importedResults = await pMap(nonDuplicates.map((item, idx) => ({ item, idx })), async ({ item, idx }) => {
      try {
        const filePath = path.join(stagingDir, item.tempFileName);
        if (!fs.existsSync(filePath)) return null;

        const readStream = fs.createReadStream(filePath);
        const fileInfo = await uploadStreamToGridFS(readStream, item.fileName, item.mimeType);

        return await RosarySong.create({
          title: item.title,
          fileUrl: fileInfo.url,
          fileName: item.fileName,
          fileSize: item.fileSize || fileInfo.size,
          mimeType: item.mimeType,
          sortOrder: baseSortOrder + idx,
          isActive: true
        });
      } catch (err) {
        console.error(`Failed to import ZIP song ${item.fileName}:`, err.message);
        return null;
      }
    }, 6);

    const createdSongs = importedResults.filter(Boolean);

    // Clean up staging folder
    try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch (_) {}

    res.json({
      success: true,
      hasDuplicates: false,
      message: `Extracted & uploaded ${createdSongs.length} song(s) from ZIP${skippedCount > 0 ? ` (${skippedCount} non-audio files skipped)` : ''}`,
      songs: createdSongs
    });
  } catch (err) {
    console.error('Upload ZIP error:', err);
    try { if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true }); } catch (_) {}
    res.status(500).json({ success: false, message: err.message });
  } finally {
    for (const fPath of tempFilesToClean) {
      try {
        if (fs.existsSync(fPath)) fs.unlinkSync(fPath);
      } catch (_) {}
    }
  }
};

/**
 * Admin: Confirm ZIP Import Choices after Duplicate Review
 */
const confirmZipImport = async (req, res) => {
  const { sessionId, choices } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, message: 'Session ID is required' });
  }

  const stagingDir = path.join(os.tmpdir(), `sjdb_staging_${sessionId}`);
  const sessionFile = path.join(stagingDir, 'session.json');

  if (!fs.existsSync(sessionFile)) {
    return res.status(400).json({ success: false, message: 'Upload session expired or not found. Please upload the ZIP archive again.' });
  }

  try {
    const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    const { duplicates = [], nonDuplicates = [] } = sessionData;

    const lastSong = await RosarySong.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    let nextSortOrder = lastSong ? (lastSong.sortOrder || 0) + 1 : 1;

    let importedCount = 0;
    let replacedCount = 0;
    let keptCount = 0;

    // 1. Import non-duplicate songs in parallel (6 concurrent streams)
    const nonDupResults = await pMap(nonDuplicates.map((item, idx) => ({ item, idx })), async ({ item, idx }) => {
      try {
        const filePath = path.join(stagingDir, item.tempFileName);
        if (!fs.existsSync(filePath)) return false;

        const readStream = fs.createReadStream(filePath);
        const fileInfo = await uploadStreamToGridFS(readStream, item.fileName, item.mimeType);

        await RosarySong.create({
          title: item.title,
          fileUrl: fileInfo.url,
          fileName: item.fileName,
          fileSize: item.fileSize || fileInfo.size,
          mimeType: item.mimeType,
          sortOrder: nextSortOrder + idx,
          isActive: true
        });
        return true;
      } catch (err) {
        console.error(`Failed to confirm non-duplicate song ${item.fileName}:`, err.message);
        return false;
      }
    }, 6);

    importedCount += nonDupResults.filter(Boolean).length;
    nextSortOrder += nonDuplicates.length;

    // 2. Process duplicates based on admin choices in parallel (6 concurrent streams)
    await pMap(duplicates.map((dup, idx) => ({ dup, idx })), async ({ dup, idx }) => {
      try {
        const choice = choices?.[dup.id] || 'existing'; // 'existing' | 'uploaded' | 'new'

        if (choice === 'uploaded') {
          const filePath = path.join(stagingDir, dup.uploadedSong.tempFileName);
          if (fs.existsSync(filePath)) {
            const readStream = fs.createReadStream(filePath);
            const fileInfo = await uploadStreamToGridFS(readStream, dup.uploadedSong.fileName, dup.uploadedSong.mimeType);

            if (dup.existingSong?.id) {
              const existing = await RosarySong.findById(dup.existingSong.id);
              if (existing) {
                // Delete old GridFS file
                if (existing.fileUrl && existing.fileUrl.startsWith('/api/files/')) {
                  const oldId = existing.fileUrl.replace('/api/files/', '');
                  try { await deleteFromGridFS(oldId); } catch (_) {}
                }

                // Update existing record with uploaded song metadata, preserving original sortOrder
                existing.title = dup.uploadedSong.title || existing.title;
                existing.fileName = dup.uploadedSong.fileName;
                existing.fileSize = dup.uploadedSong.fileSize || fileInfo.size;
                existing.fileUrl = fileInfo.url;
                existing.mimeType = dup.uploadedSong.mimeType;
                await existing.save();
                replacedCount++;
              } else {
                await RosarySong.create({
                  title: dup.uploadedSong.title,
                  fileUrl: fileInfo.url,
                  fileName: dup.uploadedSong.fileName,
                  fileSize: dup.uploadedSong.fileSize || fileInfo.size,
                  mimeType: dup.uploadedSong.mimeType,
                  sortOrder: nextSortOrder + idx,
                  isActive: true
                });
                importedCount++;
              }
            } else {
              await RosarySong.create({
                title: dup.uploadedSong.title,
                fileUrl: fileInfo.url,
                fileName: dup.uploadedSong.fileName,
                fileSize: dup.uploadedSong.fileSize || fileInfo.size,
                mimeType: dup.uploadedSong.mimeType,
                sortOrder: nextSortOrder + idx,
                isActive: true
              });
              importedCount++;
            }
          }
        } else if (choice === 'new') {
          // Import as a separate new song alongside existing
          const filePath = path.join(stagingDir, dup.uploadedSong.tempFileName);
          if (fs.existsSync(filePath)) {
            const readStream = fs.createReadStream(filePath);
            const fileInfo = await uploadStreamToGridFS(readStream, dup.uploadedSong.fileName, dup.uploadedSong.mimeType);
            await RosarySong.create({
              title: `${dup.uploadedSong.title} (New)`,
              fileUrl: fileInfo.url,
              fileName: dup.uploadedSong.fileName,
              fileSize: dup.uploadedSong.fileSize || fileInfo.size,
              mimeType: dup.uploadedSong.mimeType,
              sortOrder: nextSortOrder + idx,
              isActive: true
            });
            importedCount++;
          }
        } else {
          // Keep existing
          keptCount++;
        }
      } catch (dupErr) {
        console.error(`Failed to process duplicate choice for ${dup?.title}:`, dupErr.message);
      }
    }, 6);

    // Clean up staging directory completely
    try {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    } catch (_) {}

    res.json({
      success: true,
      message: `Import complete: ${importedCount} new song(s) imported, ${replacedCount} song(s) replaced, ${keptCount} existing song(s) retained.`,
      importedCount,
      replacedCount,
      keptCount
    });
  } catch (err) {
    console.error('Confirm ZIP import error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    try {
      if (fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
    } catch (_) {}
  }
};

/**
 * Admin: Cancel ZIP Import and cleanup staging files
 */
const cancelZipImport = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (sessionId) {
      const stagingDir = path.join(os.tmpdir(), `sjdb_staging_${sessionId}`);
      if (fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
    }
    res.json({ success: true, message: 'Upload cancelled and temporary files removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: Preview Temporary Uploaded Audio in Duplicate Modal
 */
const previewTempAudio = (req, res) => {
  try {
    const { sessionId, fileName } = req.params;
    if (!sessionId || !fileName) {
      return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }

    const safeName = path.basename(fileName);
    const stagingDir = path.join(os.tmpdir(), `sjdb_staging_${sessionId}`);
    const targetFile = path.join(stagingDir, safeName);

    if (!fs.existsSync(targetFile)) {
      return res.status(404).json({ success: false, message: 'Preview audio not found or expired' });
    }

    const stat = fs.statSync(targetFile);
    const fileSize = stat.size;
    const range = req.headers.range;
    const ext = path.extname(safeName).toLowerCase();
    const contentType = MIME_MAP[ext] || 'audio/mpeg';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      });

      const stream = fs.createReadStream(targetFile, { start, end });
      return stream.pipe(res);
    } else {
      res.set({
        'Content-Type': contentType,
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache'
      });
      return fs.createReadStream(targetFile).pipe(res);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: Delete All Devotional Songs & Clean up GridFS
 */
const deleteAllSongs = async (req, res) => {
  try {
    const songs = await RosarySong.find();
    
    // Permanently remove all GridFS audio files
    for (const song of songs) {
      if (song.fileUrl && song.fileUrl.startsWith('/api/files/')) {
        const fileId = song.fileUrl.replace('/api/files/', '');
        try {
          await deleteFromGridFS(fileId);
        } catch (_) {}
      }
    }

    // Delete all database records
    await RosarySong.deleteMany({});

    res.json({
      success: true,
      message: 'All devotional songs have been permanently deleted.'
    });
  } catch (err) {
    console.error('Delete all songs error:', err);
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
  confirmZipImport,
  cancelZipImport,
  previewTempAudio,
  toggleSongStatus,
  updateSong,
  bulkUpdateStatus,
  reorderSongs,
  deleteSong,
  deleteAllSongs
};
