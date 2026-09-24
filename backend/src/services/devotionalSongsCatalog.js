const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

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

// Candidate directory locations
const devosAssetDir = path.resolve(__dirname, '../../../frontend/src/assets/Devos');
const devosZipFile = path.resolve(__dirname, '../../../frontend/src/assets/Devos.zip');
const devosPublicDir = path.resolve(__dirname, '../../../frontend/public/devotional-songs');
const devosBackendUploads = path.resolve(__dirname, '../../uploads/Devos');

const devosDirs = [
  devosAssetDir,
  devosPublicDir,
  devosBackendUploads,
  path.resolve(__dirname, '../../Devos'),
  path.resolve(__dirname, '../../../Devos'),
  'C:\\Users\\Admin\\Desktop\\Devos'
].filter(p => fs.existsSync(p));

const backendJsonPath = path.resolve(__dirname, '../data/defaultDevotionalSongs.json');
const frontendJsonPath = path.resolve(__dirname, '../../../frontend/src/data/defaultDevotionalSongs.json');

/**
 * Format human-readable title from filename
 */
function formatTitle(filename) {
  if (!filename) return 'Devotional Song';
  const ext = path.extname(filename);
  let base = path.basename(filename, ext);
  // Clean up common audio tags like (MP3 160K), (MP3_128K), etc.
  base = base.replace(/\s*\((?:MP3|mp3)[^)]*\)/gi, '');
  base = base.replace(/\s*_\s*/g, ' - ');
  base = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (base === base.toLowerCase()) {
    base = base.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return base || filename;
}

/**
 * Unpacks Devos.zip into devosAssetDir if asset directory is missing or empty
 */
function ensureDevosExtracted() {
  try {
    if (!fs.existsSync(devosAssetDir)) {
      fs.mkdirSync(devosAssetDir, { recursive: true });
    }

    const currentFiles = fs.readdirSync(devosAssetDir).filter(f => AUDIO_EXTENSIONS.has(path.extname(f).toLowerCase()));
    if (currentFiles.length === 0 && fs.existsSync(devosZipFile)) {
      console.log('[Devos] Extracting default songs from Devos.zip into assets...');
      const zip = new AdmZip(devosZipFile);
      const entries = zip.getEntries();
      for (const entry of entries) {
        if (!entry.isDirectory) {
          const fileName = path.basename(entry.entryName);
          const ext = path.extname(fileName).toLowerCase();
          if (AUDIO_EXTENSIONS.has(ext)) {
            const dest = path.join(devosAssetDir, fileName);
            fs.writeFileSync(dest, entry.getData());
          }
        }
      }
      console.log(`[Devos] Extracted default songs into ${devosAssetDir}`);
    }
  } catch (err) {
    console.warn('[Devos] Notice during Devos.zip check:', err.message);
  }
}

/**
 * Scans frontend/src/assets/Devos for all audio songs
 */
function scanDevosFolder() {
  ensureDevosExtracted();

  if (!fs.existsSync(devosAssetDir)) {
    // Fallback to static JSON file if directory doesn't exist
    if (fs.existsSync(backendJsonPath)) {
      try {
        return JSON.parse(fs.readFileSync(backendJsonPath, 'utf8'));
      } catch (_) {}
    }
    return [];
  }

  try {
    const rawFiles = fs.readdirSync(devosAssetDir);
    const audioFiles = rawFiles
      .filter(f => AUDIO_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    if (audioFiles.length === 0) {
      if (fs.existsSync(backendJsonPath)) {
        try {
          return JSON.parse(fs.readFileSync(backendJsonPath, 'utf8'));
        } catch (_) {}
      }
      return [];
    }

    return audioFiles.map((fileName, idx) => {
      const fullPath = path.join(devosAssetDir, fileName);
      let fileSize = 0;
      try {
        fileSize = fs.statSync(fullPath).size;
      } catch (_) {}
      const ext = path.extname(fileName).toLowerCase();

      return {
        _id: `default_devos_${idx + 1}`,
        id: `default_devos_${idx + 1}`,
        title: formatTitle(fileName),
        fileName: fileName,
        fileUrl: `/devotional-songs/${encodeURIComponent(fileName)}`,
        fileSize: fileSize,
        mimeType: MIME_MAP[ext] || 'audio/mpeg',
        isActive: true,
        sortOrder: idx + 1,
        isDefault: true
      };
    });
  } catch (err) {
    console.error('[Devos] Error scanning Devos directory:', err.message);
    if (fs.existsSync(backendJsonPath)) {
      try {
        return JSON.parse(fs.readFileSync(backendJsonPath, 'utf8'));
      } catch (_) {}
    }
    return [];
  }
}

/**
 * Get the live catalog of default devotional songs
 */
function getDefaultSongsCatalog() {
  const songs = scanDevosFolder();
  return songs;
}

/**
 * Syncs any newly added/modified songs from Devos folder to:
 * 1. backend & frontend defaultDevotionalSongs.json
 * 2. frontend/public/devotional-songs (for static client streaming)
 * 3. MongoDB RosarySong collection (auto-seed missing default songs)
 */
/**
 * Syncs default devotional songs catalog to disk (JSON files and public directory)
 * Does NOT touch MongoDB, avoiding duplicate seeding during restore operations.
 */
async function syncDefaultSongsToDisk() {
  try {
    const songs = scanDevosFolder();
    if (!songs || songs.length === 0) return;

    // 1. Update JSON files only if changed (prevents nodemon restart loops)
    const jsonStr = JSON.stringify(songs, null, 2);
    try {
      const currentBackend = fs.existsSync(backendJsonPath) ? fs.readFileSync(backendJsonPath, 'utf8') : '';
      if (currentBackend !== jsonStr) {
        fs.writeFileSync(backendJsonPath, jsonStr, 'utf8');
      }
    } catch (_) {}

    try {
      if (fs.existsSync(path.dirname(frontendJsonPath))) {
        const currentFrontend = fs.existsSync(frontendJsonPath) ? fs.readFileSync(frontendJsonPath, 'utf8') : '';
        if (currentFrontend !== jsonStr) {
          fs.writeFileSync(frontendJsonPath, jsonStr, 'utf8');
        }
      }
    } catch (_) {}

    // 2. Sync to frontend/public/devotional-songs
    try {
      if (!fs.existsSync(devosPublicDir)) {
        fs.mkdirSync(devosPublicDir, { recursive: true });
      }

      for (const song of songs) {
        const src = path.join(devosAssetDir, song.fileName);
        const dst = path.join(devosPublicDir, song.fileName);
        if (fs.existsSync(src)) {
          let needsCopy = !fs.existsSync(dst);
          if (!needsCopy) {
            try {
              needsCopy = fs.statSync(src).size !== fs.statSync(dst).size;
            } catch (_) {
              needsCopy = true;
            }
          }
          if (needsCopy) {
            fs.copyFileSync(src, dst);
          }
        }
      }
    } catch (pubErr) {
      console.warn('[Devos] Notice copying to public dir:', pubErr.message);
    }
  } catch (err) {
    console.error('[Devos] Disk sync error:', err.message);
  }
}

/**
 * Auto-seeds any missing devotional songs from Devos into MongoDB
 * Checks against existing fileNames (case-insensitive) to prevent duplicate entries
 */
async function autoSeedMissingSongsToDatabase() {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.connection || mongoose.connection.readyState !== 1) return;

    const songs = scanDevosFolder();
    if (!songs || songs.length === 0) return;

    const RosarySong = require('../models/RosarySong');
    const SiteSettings = require('../models/SiteSettings');

    const cleared = await SiteSettings.findOne({ key: 'devotionalSongsCleared' }).lean();
    if (cleared && cleared.value === 'true') return;

    const existing = await RosarySong.find().lean();
    const existingNames = new Set(existing.map(s => String(s.fileName).toLowerCase().trim()));

    const missing = [];
    songs.forEach((s, idx) => {
      const norm = String(s.fileName).toLowerCase().trim();
      if (!existingNames.has(norm)) {
        existingNames.add(norm); // Prevent duplicates within the missing array
        missing.push({
          title: s.title,
          fileName: s.fileName,
          fileUrl: s.fileUrl,
          fileSize: s.fileSize || 0,
          mimeType: s.mimeType || 'audio/mpeg',
          isActive: true,
          sortOrder: existing.length + idx + 1
        });
      }
    });

    if (missing.length > 0) {
      await RosarySong.insertMany(missing);
      console.log(`[Devos] Auto-seeded ${missing.length} new devotional songs from Devos folder into database.`);
    }
  } catch (err) {
    console.error('[Devos] Auto-seed error:', err.message);
  }
}

async function syncDefaultSongsToDiskAndDatabase() {
  await syncDefaultSongsToDisk();
  await autoSeedMissingSongsToDatabase();
}

/**
 * Initializes directory watcher on frontend/src/assets/Devos
 * Automatically detects newly added, updated, or removed songs
 */
let watcherInitialized = false;
function initDevosWatcher() {
  if (watcherInitialized) return;
  watcherInitialized = true;

  // Run initial extraction and sync
  ensureDevosExtracted();
  syncDefaultSongsToDiskAndDatabase();

  if (!fs.existsSync(devosAssetDir)) return;

  let debounceTimer = null;
  try {
    fs.watch(devosAssetDir, (eventType, filename) => {
      if (!filename) return;
      const ext = path.extname(filename).toLowerCase();
      if (!AUDIO_EXTENSIONS.has(ext)) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log(`[DevosWatcher] Detected ${eventType} on ${filename}. Synchronizing default songs...`);
        syncDefaultSongsToDiskAndDatabase();
      }, 1000);
    });
    console.log(`[DevosWatcher] Watching ${devosAssetDir} for new devotional songs.`);
  } catch (err) {
    console.warn('[DevosWatcher] Could not start watcher on Devos dir:', err.message);
  }
}

module.exports = {
  devosDirs,
  devosAssetDir,
  devosPublicDir,
  getDefaultSongsCatalog,
  syncDefaultSongsToDisk,
  syncDefaultSongsToDiskAndDatabase,
  initDevosWatcher,
  formatTitle
};
