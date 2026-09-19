const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Destination folder in system temp directory
const tempDir = path.join(os.tmpdir(), 'sjdb_uploads');
if (!fs.existsSync(tempDir)) {
  try {
    fs.mkdirSync(tempDir, { recursive: true });
  } catch (_) {}
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `upload_${uniqueSuffix}_${safeBase}${ext}`);
  }
});

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp',
  'pdf',
  'mp4', 'mov',
  'mp3', 'ogg', 'wav', 'm4a', 'aac', 'flac',
  'zip'
]);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'video/mp4', 'video/quicktime',
  'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/x-m4a', 'audio/aac', 'audio/flac', 'audio/mp4',
  'application/zip', 'application/x-zip-compressed', 'application/octet-stream'
]);

const fileFilter = (req, file, cb) => {
  const ext = (file.originalname || '').split('.').pop()?.toLowerCase() || '';
  const mime = (file.mimetype || '').toLowerCase();

  // Accept if extension matches or mime matches
  if (ALLOWED_EXTENSIONS.has(ext) || ALLOWED_MIME_TYPES.has(mime)) {
    return cb(null, true);
  }
  return cb(new Error('Invalid file type. Only standard images, PDFs, audio, videos, and zip files are allowed.'));
};

const diskUpload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max on disk (consumes 0 MB of Node.js RAM!)
  },
  fileFilter
});

module.exports = diskUpload;
