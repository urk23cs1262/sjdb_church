const multer = require('multer');

const storage = multer.memoryStorage();

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
  'application/zip', 'application/x-zip-compressed'
]);

const fileFilter = (req, file, cb) => {
  const ext = (file.originalname || '').split('.').pop()?.toLowerCase() || '';
  const mime = (file.mimetype || '').toLowerCase();

  if (ALLOWED_EXTENSIONS.has(ext) && ALLOWED_MIME_TYPES.has(mime)) {
    return cb(null, true);
  }
  return cb(new Error('Invalid file type. Only standard images, PDFs, audio, videos, and zip files are allowed.'));
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter,
});

module.exports = upload;
