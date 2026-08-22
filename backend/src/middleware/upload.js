const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|pdf|mp4|mov|mp3|mpeg|ogg|wav|m4a|aac|flac|wma|zip|x-zip|octet-stream/;
  const ext = allowed.test((file.originalname || '').split('.').pop()?.toLowerCase() || '');
  const allowedMimes = /image\/|audio\/|video\/|application\/pdf|application\/zip|application\/x-zip|application\/octet-stream/;
  const mime = allowedMimes.test(file.mimetype);
  if (ext || mime) return cb(null, true);
  cb(new Error('File type not allowed'));
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter,
});

module.exports = upload;
