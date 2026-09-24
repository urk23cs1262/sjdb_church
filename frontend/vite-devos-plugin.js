import fs from 'fs';
import path from 'path';

const AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac', '.wma']);
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
  let base = path.basename(filename, ext);
  base = base.replace(/\s*\((?:MP3|mp3)[^)]*\)/gi, '');
  base = base.replace(/\s*_\s*/g, ' - ');
  base = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (base === base.toLowerCase()) {
    base = base.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return base || filename;
}

export function devosSongsPlugin() {
  const rootDir = process.cwd();
  const devosDir = path.resolve(rootDir, 'src/assets/Devos');
  const publicDir = path.resolve(rootDir, 'public/devotional-songs');
  const frontendJson = path.resolve(rootDir, 'src/data/defaultDevotionalSongs.json');
  const backendJson = path.resolve(rootDir, '../backend/src/data/defaultDevotionalSongs.json');

  const syncDevos = () => {
    if (!fs.existsSync(devosDir)) return;
    try {
      const files = fs.readdirSync(devosDir)
        .filter(f => AUDIO_EXTS.has(path.extname(f).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

      const catalog = files.map((fileName, idx) => {
        const fullPath = path.join(devosDir, fileName);
        let fileSize = 0;
        try { fileSize = fs.statSync(fullPath).size; } catch (_) {}
        const ext = path.extname(fileName).toLowerCase();

        const dstPath = path.join(publicDir, fileName);
        if (!fs.existsSync(dstPath) || fs.statSync(dstPath).size !== fileSize) {
          fs.copyFileSync(fullPath, dstPath);
        }

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

      const jsonStr = JSON.stringify(catalog, null, 2);
      fs.writeFileSync(frontendJson, jsonStr, 'utf8');
      if (fs.existsSync(path.dirname(backendJson))) {
        fs.writeFileSync(backendJson, jsonStr, 'utf8');
      }
      console.log(`[DevosPlugin] Auto-synchronized ${catalog.length} devotional songs.`);
    } catch (err) {
      console.error('[DevosPlugin] Error synchronizing devotional songs:', err.message);
    }
  };

  return {
    name: 'vite-plugin-devos-songs',
    buildStart() {
      syncDevos();
    },
    configureServer(server) {
      syncDevos();

      // Serve /devotional-songs directly with range request support
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url.startsWith('/devotional-songs/')) {
          const rawName = url.replace('/devotional-songs/', '').split('?')[0];
          const decoded = decodeURIComponent(rawName);
          const cleanName = path.basename(decoded);
          const candidatePaths = [
            path.join(devosDir, cleanName),
            path.join(publicDir, cleanName)
          ];

          for (const target of candidatePaths) {
            if (fs.existsSync(target)) {
              const stat = fs.statSync(target);
              const ext = path.extname(cleanName).toLowerCase();
              const mime = MIME_MAP[ext] || 'application/octet-stream';
              const total = stat.size;
              const range = req.headers.range;

              if (range) {
                const parts = range.replace(/bytes=/, '').split('-');
                const partialStart = parts[0];
                const partialEnd = parts[1];
                const start = parseInt(partialStart, 10);
                const end = partialEnd ? parseInt(partialEnd, 10) : total - 1;
                const chunksize = end - start + 1;

                res.writeHead(206, {
                  'Content-Range': `bytes ${start}-${end}/${total}`,
                  'Accept-Ranges': 'bytes',
                  'Content-Length': chunksize,
                  'Content-Type': mime
                });
                const stream = fs.createReadStream(target, { start, end });
                return stream.pipe(res);
              } else {
                res.writeHead(200, {
                  'Content-Length': total,
                  'Accept-Ranges': 'bytes',
                  'Content-Type': mime
                });
                const stream = fs.createReadStream(target);
                return stream.pipe(res);
              }
            }
          }
        }
        next();
      });

      // Watch frontend/src/assets/Devos directory
      if (fs.existsSync(devosDir)) {
        let debounceTimer = null;
        try {
          fs.watch(devosDir, (eventType, filename) => {
            if (!filename) return;
            const ext = path.extname(filename).toLowerCase();
            if (!AUDIO_EXTS.has(ext)) return;

            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              console.log(`[DevosPlugin] Detected ${eventType} on ${filename}. Updating default songs...`);
              syncDevos();
            }, 800);
          });
        } catch (_) {}
      }
    }
  };
}

export default devosSongsPlugin;
