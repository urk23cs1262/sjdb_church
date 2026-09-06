const multer = require('multer');

const storage = multer.memoryStorage();

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp',
  'pdf',
  'mp4', 'mov',
  'mp3', 'ogg', 'wav', 'm4a', 'aac', 'flac', 'wma',
  'zip'
]);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'video/mp4', 'video/quicktime',
  'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/x-aac', 'audio/flac', 'audio/x-flac', 'audio/mp4',
  'audio/wma', 'audio/x-ms-wma',
  'application/zip', 'application/x-zip-compressed', 'application/x-zip', 'multipart/x-zip', 'application/zip-compressed',
  'application/octet-stream' // frequently sent for zip and raw audio by browsers on Windows
]);

const fileFilter = (req, file, cb) => {
  const ext = (file.originalname || '').split('.').pop()?.toLowerCase() || '';
  const mime = (file.mimetype || '').toLowerCase();

  // If extension is zip, accept it (browsers often send application/octet-stream for zip files)
  if (ext === 'zip') {
    return cb(null, true);
  }

  if (ALLOWED_EXTENSIONS.has(ext) && (ALLOWED_MIME_TYPES.has(mime) || mime === 'application/octet-stream')) {
    return cb(null, true);
  }
  return cb(new Error('Invalid file type. Only standard images, PDFs, audio, videos, and zip files are allowed.'));
};

// Generous 500MB limit to support large church audio albums and zip archives
const upload = multer({
  storage,
  limits: { 
    fileSize: 500 * 1024 * 1024, // 500MB
    files: 100 // Allow up to 100 files in batch upload
  },
  fileFilter,
});

/**
 * Middleware wrapper to catch Multer errors and return friendly 400/413 responses
 */
const handleUpload = (multerMiddleware) => {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
              success: false,
              message: 'File too large. Maximum allowed size is 500MB.'
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              success: false,
              message: 'Too many files selected. Maximum allowed is 100 files.'
            });
          }
          return res.status(400).json({
            success: false,
            message: `Upload error: ${err.message}`
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'Invalid upload file'
        });
      }
      next();
    });
  };
};

upload.handleUpload = handleUpload;

module.exports = upload;
